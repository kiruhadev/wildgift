// database-sqlite.js - SQLite Production Database
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔥 Database path - поддержка Render Persistent Disk
const DB_PATH = process.env.DB_PATH || 
  (process.env.NODE_ENV === 'production' 
    ? '/opt/render/project/data/wildgift.db'
    : path.join(__dirname, 'wildgift.db')
  );

console.log('[DB] 🚀 Initializing SQLite database');
console.log('[DB] 📂 Path:', DB_PATH);

// 🔧 Create directory if it doesn't exist
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  console.log('[DB] 📁 Creating directory:', dbDir);
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('[DB] ✅ Directory created successfully');
  } catch (err) {
    console.error('[DB] ❌ Failed to create directory:', err);
    throw err;
  }
}

// Create database connection
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // ⚡ Performance boost
db.pragma('synchronous = NORMAL'); // Balance between speed and safety

// ====== INIT TABLES ======
function initDatabase() {
  console.log('[DB] 📋 Creating tables...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT,
      is_premium INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS balances (
      telegram_id INTEGER PRIMARY KEY,
      ton_balance REAL DEFAULT 0,
      stars_balance INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT,
      tx_hash TEXT,
      invoice_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      round_id TEXT NOT NULL,
      bet_data TEXT NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      result TEXT DEFAULT 'pending',
      win_amount REAL DEFAULT 0,
      multiplier REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_bets_result ON bets(result);
    CREATE INDEX IF NOT EXISTS idx_bets_created ON bets(created_at DESC);
  `);
  
  console.log('[DB] ✅ Tables created successfully');
}

// ====== USERS ======
export function saveUser(userData) {
  try {
    console.log('[DB] 👤 Saving user:', userData.id);
    
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_premium, created_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code,
        is_premium = excluded.is_premium,
        last_seen = excluded.last_seen
    `);

    stmt.run(
      userData.id,
      userData.username || null,
      userData.first_name || null,
      userData.last_name || null,
      userData.language_code || null,
      userData.is_premium ? 1 : 0,
      now,
      now
    );

    // Create balance if not exists
    const balanceStmt = db.prepare(`
      INSERT OR IGNORE INTO balances (telegram_id, ton_balance, stars_balance, updated_at)
      VALUES (?, 0, 0, ?)
    `);
    balanceStmt.run(userData.id, now);

    console.log('[DB] ✅ User saved:', userData.id);
    return true;
  } catch (err) {
    console.error('[DB] ❌ Error saving user:', err);
    throw err;
  }
}

export function getUserById(telegramId) {
  try {
    console.log('[DB] 🔍 Getting user:', telegramId);
    
    const stmt = db.prepare(`
      SELECT u.*, b.ton_balance, b.stars_balance
      FROM users u
      LEFT JOIN balances b ON u.telegram_id = b.telegram_id
      WHERE u.telegram_id = ?
    `);
    
    const user = stmt.get(telegramId);
    
    if (!user) {
      console.log('[DB] ⚠️ User not found:', telegramId);
      return null;
    }
    
    console.log('[DB] ✅ User found:', telegramId);
    return user;
  } catch (err) {
    console.error('[DB] ❌ Error getting user:', err);
    throw err;
  }
}

// ====== BALANCE ======
export function getUserBalance(telegramId) {
  try {
    console.log('[DB] 💰 Getting balance for:', telegramId);
    
    const stmt = db.prepare(`
      SELECT ton_balance, stars_balance, updated_at
      FROM balances
      WHERE telegram_id = ?
    `);
    
    let balance = stmt.get(telegramId);
    
    if (!balance) {
      console.log('[DB] ⚠️ Balance not found, creating new:', telegramId);
      
      const insertStmt = db.prepare(`
        INSERT INTO balances (telegram_id, ton_balance, stars_balance, updated_at)
        VALUES (?, 0, 0, ?)
      `);
      const now = Math.floor(Date.now() / 1000);
      insertStmt.run(telegramId, now);
      
      balance = { ton_balance: 0, stars_balance: 0, updated_at: now };
    }
    
    console.log('[DB] ✅ Balance:', {
      userId: telegramId,
      ton: balance.ton_balance,
      stars: balance.stars_balance
    });
    
    return balance;
  } catch (err) {
    console.error('[DB] ❌ Error getting balance:', err);
    return { ton_balance: 0, stars_balance: 0, updated_at: Math.floor(Date.now() / 1000) };
  }
}

export function updateBalance(telegramId, currency, amount, type, description = null, metadata = {}) {
  const transaction = db.transaction(() => {
    try {
      console.log('[DB] 💰 Updating balance:', { telegramId, currency, amount, type });
      
      // Get current balance
      const balance = getUserBalance(telegramId);
      const field = currency === 'ton' ? 'ton_balance' : 'stars_balance';
      const oldBalance = parseFloat(balance[field]) || 0;
      const parsedAmount = currency === 'ton' ? parseFloat(amount) : parseInt(amount);
      const newBalance = oldBalance + parsedAmount;

      console.log('[DB] 📊 Balance change:', { 
        oldBalance, 
        amount: parsedAmount, 
        newBalance,
        field,
        currency
      });

      if (newBalance < 0) {
        console.error('[DB] ❌ Insufficient balance:', { oldBalance, amount: parsedAmount, newBalance });
        throw new Error('Insufficient balance');
      }

      // Update balance
      const updateStmt = db.prepare(`
        UPDATE balances
        SET ${field} = ?, updated_at = ?
        WHERE telegram_id = ?
      `);
      updateStmt.run(newBalance, Math.floor(Date.now() / 1000), telegramId);

      // Add transaction
      const txStmt = db.prepare(`
        INSERT INTO transactions (telegram_id, type, currency, amount, balance_before, balance_after, description, tx_hash, invoice_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      txStmt.run(
        telegramId,
        type,
        currency,
        parsedAmount,
        oldBalance,
        newBalance,
        description,
        metadata.txHash || null,
        metadata.invoiceId || null,
        Math.floor(Date.now() / 1000)
      );

      console.log('[DB] ✅ Balance updated successfully');
      return newBalance;
    } catch (err) {
      console.error('[DB] ❌ Error updating balance:', err);
      throw err;
    }
  });

  return transaction();
}

// ====== BETS ======
export function createBet(telegramId, roundId, betData, totalAmount, currency) {
  const transaction = db.transaction(() => {
    try {
      console.log('[DB] 🎲 Creating bet:', { telegramId, roundId, totalAmount, currency });
      
      // Deduct balance
      updateBalance(telegramId, currency, -totalAmount, 'bet', `Bet on round ${roundId}`);

      // Create bet
      const stmt = db.prepare(`
        INSERT INTO bets (telegram_id, round_id, bet_data, total_amount, currency, result, win_amount, multiplier, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', 0, 0, ?)
      `);
      
      const info = stmt.run(
        telegramId,
        roundId,
        JSON.stringify(betData),
        totalAmount,
        currency,
        Math.floor(Date.now() / 1000)
      );

      console.log('[DB] ✅ Bet created:', info.lastInsertRowid);
      return info.lastInsertRowid;
    } catch (err) {
      console.error('[DB] ❌ Error creating bet:', err);
      throw err;
    }
  });

  return transaction();
}

export function resolveBet(betId, result, winAmount = 0, multiplier = 0) {
  const transaction = db.transaction(() => {
    try {
      console.log('[DB] 🎯 Resolving bet:', { betId, result, winAmount });
      
      // Get bet
      const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(betId);
      
      if (!bet) {
        throw new Error('Bet not found');
      }
      
      if (bet.result !== 'pending') {
        throw new Error('Bet already resolved');
      }

      // Update bet
      const stmt = db.prepare(`
        UPDATE bets
        SET result = ?, win_amount = ?, multiplier = ?, resolved_at = ?
        WHERE id = ?
      `);
      stmt.run(result, winAmount, multiplier, Math.floor(Date.now() / 1000), betId);

      // Add win transaction if won
      if (result === 'win' && winAmount > 0) {
        updateBalance(
          bet.telegram_id,
          bet.currency,
          winAmount,
          'win',
          `Win on round ${bet.round_id} (${multiplier}x)`
        );
      }

      console.log('[DB] ✅ Bet resolved:', betId);
      return true;
    } catch (err) {
      console.error('[DB] ❌ Error resolving bet:', err);
      throw err;
    }
  });

  return transaction();
}

export function getBetHistory(telegramId, limit = 50) {
  try {
    console.log('[DB] 📜 Getting bet history for:', telegramId);
    
    const stmt = db.prepare(`
      SELECT * FROM bets
      WHERE telegram_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    const bets = stmt.all(telegramId, limit);
    
    console.log('[DB] ✅ Found bets:', bets.length);
    return bets.map(bet => ({
      ...bet,
      bet_data: JSON.parse(bet.bet_data)
    }));
  } catch (err) {
    console.error('[DB] ❌ Error getting bet history:', err);
    return [];
  }
}

// ====== TRANSACTIONS ======
export function getTransactionHistory(telegramId, limit = 50) {
  try {
    console.log('[DB] 📜 Getting transaction history for:', telegramId);
    
    const stmt = db.prepare(`
      SELECT * FROM transactions
      WHERE telegram_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    const transactions = stmt.all(telegramId, limit);
    
    console.log('[DB] ✅ Found transactions:', transactions.length);
    return transactions;
  } catch (err) {
    console.error('[DB] ❌ Error getting transactions:', err);
    return [];
  }
}

// ====== STATS ======
export function getUserStats(telegramId) {
  try {
    console.log('[DB] 📊 Getting stats for:', telegramId);
    
    const stmt = db.prepare(`
      SELECT
        COUNT(CASE WHEN result = 'win' THEN 1 END) as wins,
        COUNT(CASE WHEN result = 'lose' THEN 1 END) as losses,
        SUM(CASE WHEN result = 'win' THEN win_amount ELSE 0 END) as total_won,
        SUM(total_amount) as total_wagered,
        COUNT(*) as total_bets
      FROM bets
      WHERE telegram_id = ? AND result != 'pending'
    `);
    
    const stats = stmt.get(telegramId) || {
      wins: 0,
      losses: 0,
      total_won: 0,
      total_wagered: 0,
      total_bets: 0
    };
    
    console.log('[DB] ✅ Stats:', stats);
    return stats;
  } catch (err) {
    console.error('[DB] ❌ Error getting stats:', err);
    return { wins: 0, losses: 0, total_won: 0, total_wagered: 0, total_bets: 0 };
  }
}

// ====== CLEANUP ======
export function cleanupOldData(daysOld = 90) {
  try {
    console.log('[DB] 🧹 Cleaning up old data...');
    
    const timestamp = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60);
    
    const stmt = db.prepare(`
      DELETE FROM transactions
      WHERE created_at < ? AND type NOT IN ('deposit', 'withdraw')
    `);
    
    const info = stmt.run(timestamp);
    
    console.log('[DB] ✅ Cleaned up', info.changes, 'old transactions');
  } catch (err) {
    console.error('[DB] ❌ Cleanup error:', err);
  }
}

// ====== GRACEFUL SHUTDOWN ======
process.on('exit', () => {
  console.log('[DB] 👋 Closing database...');
  db.close();
});

process.on('SIGINT', () => {
  console.log('[DB] 👋 SIGINT received - closing database...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[DB] 👋 SIGTERM received - closing database...');
  db.close();
  process.exit(0);
});

// ====== INIT ======
try {
  initDatabase();
  console.log('[DB] 🎉 SQLite database ready!');
  console.log('[DB] 📊 Database size:', db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get());
} catch (err) {
  console.error('[DB] 💥 CRITICAL: Failed to initialize database!');
  console.error('[DB] Error:', err);
  process.exit(1);
}

export default db;










