// database.js - SQLite database for user data and balances
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем/открываем БД
const db = new Database(path.join(__dirname, 'wildgift.db'));

// Включаем WAL mode для лучшей производительности
db.pragma('journal_mode = WAL');

// ====== СОЗДАНИЕ ТАБЛИЦ ======
function initDatabase() {
  // Таблица пользователей
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT,
      is_premium INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_seen INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Таблица балансов
  db.exec(`
    CREATE TABLE IF NOT EXISTS balances (
      telegram_id INTEGER PRIMARY KEY,
      ton_balance REAL DEFAULT 0,
      stars_balance INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
    )
  `);

  // Таблица транзакций (история пополнений/списаний)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL,
      balance_after REAL,
      description TEXT,
      tx_hash TEXT,
      invoice_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
    )
  `);

  // Таблица ставок
  db.exec(`
    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      round_id TEXT NOT NULL,
      bet_data TEXT NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      result TEXT,
      win_amount REAL DEFAULT 0,
      multiplier REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      resolved_at INTEGER,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
    )
  `);

  // Индексы для быстрого поиска
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user 
    ON transactions(telegram_id, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_bets_user 
    ON bets(telegram_id, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_bets_round 
    ON bets(round_id);
  `);

  console.log('✅ Database initialized');
}

// ВАЖНО: Инициализируем БД СРАЗУ, до создания prepared statements
initDatabase();

// ====== ПОЛЬЗОВАТЕЛИ ======

// Создать или обновить пользователя
const upsertUser = db.prepare(`
  INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_premium, last_seen)
  VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
  ON CONFLICT(telegram_id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    language_code = excluded.language_code,
    is_premium = excluded.is_premium,
    last_seen = excluded.last_seen
`);

export function saveUser(userData) {
  try {
    upsertUser.run(
      userData.id,
      userData.username || null,
      userData.first_name || null,
      userData.last_name || null,
      userData.language_code || null,
      userData.is_premium ? 1 : 0
    );
    
    // Создаем запись баланса если её нет
    const balanceExists = db.prepare('SELECT 1 FROM balances WHERE telegram_id = ?').get(userData.id);
    if (!balanceExists) {
      db.prepare(`
        INSERT INTO balances (telegram_id, ton_balance, stars_balance)
        VALUES (?, 0, 0)
      `).run(userData.id);
    }
    
    return true;
  } catch (err) {
    console.error('[DB] Error saving user:', err);
    return false;
  }
}

// Получить пользователя
const getUser = db.prepare(`
  SELECT u.*, b.ton_balance, b.stars_balance
  FROM users u
  LEFT JOIN balances b ON u.telegram_id = b.telegram_id
  WHERE u.telegram_id = ?
`);

export function getUserById(telegramId) {
  return getUser.get(telegramId);
}

// ====== БАЛАНСЫ ======

// Получить баланс
const getBalance = db.prepare(`
  SELECT ton_balance, stars_balance, updated_at
  FROM balances
  WHERE telegram_id = ?
`);

export function getUserBalance(telegramId) {
  const balance = getBalance.get(telegramId);
  if (!balance) {
    // Создаем если нет
    db.prepare(`
      INSERT INTO balances (telegram_id, ton_balance, stars_balance)
      VALUES (?, 0, 0)
    `).run(telegramId);
    return { ton_balance: 0, stars_balance: 0 };
  }
  return balance;
}

// Обновить баланс (с транзакцией)
export function updateBalance(telegramId, currency, amount, type, description = null, metadata = {}) {
  const transaction = db.transaction(() => {
    // Получаем текущий баланс
    const current = getUserBalance(telegramId);
    const field = currency === 'ton' ? 'ton_balance' : 'stars_balance';
    const oldBalance = current[field];
    const newBalance = oldBalance + amount;

    // Проверяем что баланс не уйдет в минус
    if (newBalance < 0) {
      throw new Error('Insufficient balance');
    }

    // Обновляем баланс
    db.prepare(`
      UPDATE balances 
      SET ${field} = ?,
          updated_at = strftime('%s', 'now')
      WHERE telegram_id = ?
    `).run(newBalance, telegramId);

    // Добавляем запись в транзакции
    db.prepare(`
      INSERT INTO transactions 
      (telegram_id, type, currency, amount, balance_before, balance_after, description, tx_hash, invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      telegramId,
      type,
      currency,
      amount,
      oldBalance,
      newBalance,
      description,
      metadata.txHash || null,
      metadata.invoiceId || null
    );

    return newBalance;
  });

  try {
    return transaction();
  } catch (err) {
    console.error('[DB] Error updating balance:', err);
    throw err;
  }
}

// ====== СТАВКИ ======

// Создать ставку
export function createBet(telegramId, roundId, betData, totalAmount, currency) {
  try {
    // Списываем баланс
    updateBalance(telegramId, currency, -totalAmount, 'bet', `Bet on round ${roundId}`);

    // Создаем запись ставки
    const result = db.prepare(`
      INSERT INTO bets (telegram_id, round_id, bet_data, total_amount, currency, result)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(telegramId, roundId, JSON.stringify(betData), totalAmount, currency);

    return result.lastInsertRowid;
  } catch (err) {
    console.error('[DB] Error creating bet:', err);
    throw err;
  }
}

// Разрешить ставку (выигрыш/проигрыш)
export function resolveBet(betId, result, winAmount = 0, multiplier = 0) {
  const transaction = db.transaction(() => {
    // Получаем ставку
    const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(betId);
    if (!bet) throw new Error('Bet not found');
    if (bet.result !== 'pending') throw new Error('Bet already resolved');

    // Обновляем ставку
    db.prepare(`
      UPDATE bets
      SET result = ?,
          win_amount = ?,
          multiplier = ?,
          resolved_at = strftime('%s', 'now')
      WHERE id = ?
    `).run(result, winAmount, multiplier, betId);

    // Если выигрыш - начисляем баланс
    if (result === 'win' && winAmount > 0) {
      updateBalance(
        bet.telegram_id,
        bet.currency,
        winAmount,
        'win',
        `Win on round ${bet.round_id} (${multiplier}x)`
      );
    }

    return true;
  });

  try {
    return transaction();
  } catch (err) {
    console.error('[DB] Error resolving bet:', err);
    throw err;
  }
}

// Получить историю ставок пользователя
const getUserBets = db.prepare(`
  SELECT * FROM bets
  WHERE telegram_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

export function getBetHistory(telegramId, limit = 50) {
  return getUserBets.all(telegramId, limit).map(bet => ({
    ...bet,
    bet_data: JSON.parse(bet.bet_data)
  }));
}

// ====== ТРАНЗАКЦИИ ======

// Получить историю транзакций
const getUserTransactions = db.prepare(`
  SELECT * FROM transactions
  WHERE telegram_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

export function getTransactionHistory(telegramId, limit = 50) {
  return getUserTransactions.all(telegramId, limit);
}

// ====== СТАТИСТИКА ======

export function getUserStats(telegramId) {
  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN result = 'win' THEN 1 END) as wins,
      COUNT(CASE WHEN result = 'lose' THEN 1 END) as losses,
      SUM(CASE WHEN result = 'win' THEN win_amount ELSE 0 END) as total_won,
      SUM(total_amount) as total_wagered,
      COUNT(*) as total_bets
    FROM bets
    WHERE telegram_id = ? AND result != 'pending'
  `).get(telegramId);

  return stats || { wins: 0, losses: 0, total_won: 0, total_wagered: 0, total_bets: 0 };
}

export default db;







