// database.js - DEBUG VERSION with detailed logs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'wildgift.json');

// Database structure
let db = {
  users: {},
  balances: {},
  transactions: [],
  bets: [],
  nextTransactionId: 1,
  nextBetId: 1
};

// ====== INIT ======
function initDatabase() {
  console.log('[DB] 🚀 Initializing JSON database...');
  console.log('[DB] 📂 DB path:', DB_PATH);
  
  try {
    if (fs.existsSync(DB_PATH)) {
      console.log('[DB] 📖 Reading existing database...');
      const data = fs.readFileSync(DB_PATH, 'utf8');
      db = JSON.parse(data);
      console.log('[DB] 📂 Loaded database:', {
        users: Object.keys(db.users).length,
        balances: Object.keys(db.balances).length,
        transactions: db.transactions?.length || 0,
        bets: db.bets?.length || 0
      });
    } else {
      console.log('[DB] ✨ Creating new database...');
      saveDatabase();
      console.log('[DB] ✨ New database created');
    }
    
    console.log('[DB] ✅ Database initialized successfully');
    return true;
  } catch (err) {
    console.error('[DB] ❌ Init error:', err);
    console.error('[DB] Stack:', err.stack);
    throw err;
  }
}

// ====== SAVE ======
function saveDatabase() {
  try {
    const data = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_PATH, data, 'utf8');
    console.log('[DB] 💾 Database saved');
  } catch (err) {
    console.error('[DB] ❌ Save error:', err);
    console.error('[DB] Stack:', err.stack);
  }
}

// Auto-save every 5 seconds
let saveInterval = setInterval(() => {
  try {
    saveDatabase();
  } catch (err) {
    console.error('[DB] ❌ Auto-save error:', err);
  }
}, 5000);

// ====== USERS ======
export function saveUser(userData) {
  try {
    console.log('[DB] 👤 Saving user:', userData.id);
    
    const userId = userData.id.toString();
    const now = Math.floor(Date.now() / 1000);
    
    db.users[userId] = {
      telegram_id: userData.id,
      username: userData.username || null,
      first_name: userData.first_name || null,
      last_name: userData.last_name || null,
      language_code: userData.language_code || null,
      is_premium: userData.is_premium ? 1 : 0,
      created_at: db.users[userId]?.created_at || now,
      last_seen: now
    };
    
    // Create balance if not exists
    if (!db.balances[userId]) {
      console.log('[DB] 💰 Creating new balance for user:', userId);
      db.balances[userId] = {
        telegram_id: userData.id,
        ton_balance: 0,
        stars_balance: 0,
        updated_at: now
      };
    }
    
    saveDatabase();
    console.log('[DB] ✅ User saved:', userId);
    return true;
  } catch (err) {
    console.error('[DB] ❌ Error saving user:', err);
    console.error('[DB] Stack:', err.stack);
    return false;
  }
}

export function getUserById(telegramId) {
  try {
    console.log('[DB] 🔍 Getting user:', telegramId);
    
    const userId = telegramId.toString();
    const user = db.users[userId];
    
    if (!user) {
      console.log('[DB] ⚠️ User not found:', userId);
      return null;
    }
    
    const balance = db.balances[userId] || { ton_balance: 0, stars_balance: 0 };
    
    const result = {
      ...user,
      ...balance
    };
    
    console.log('[DB] ✅ User found:', userId);
    return result;
  } catch (err) {
    console.error('[DB] ❌ Error getting user:', err);
    console.error('[DB] Stack:', err.stack);
    return null;
  }
}

// ====== BALANCE ======
export function getUserBalance(telegramId) {
  try {
    console.log('[DB] 💰 Getting balance for:', telegramId);
    
    const userId = telegramId.toString();
    
    // Create balance if not exists
    if (!db.balances[userId]) {
      console.log('[DB] ⚠️ Balance not found, creating new:', userId);
      db.balances[userId] = {
        telegram_id: parseInt(userId),
        ton_balance: 0,
        stars_balance: 0,
        updated_at: Math.floor(Date.now() / 1000)
      };
      saveDatabase();
    }
    
    const balance = db.balances[userId];
    console.log('[DB] ✅ Balance:', {
      userId,
      ton: balance.ton_balance,
      stars: balance.stars_balance
    });
    
    return balance;
  } catch (err) {
    console.error('[DB] ❌ Error getting balance:', err);
    console.error('[DB] Stack:', err.stack);
    return { ton_balance: 0, stars_balance: 0 };
  }
}

export function updateBalance(telegramId, currency, amount, type, description = null, metadata = {}) {
  try {
    const userId = telegramId.toString();
    console.log('[DB] 💰 Updating balance:', { userId, currency, amount, type });
    
    // Create balance if not exists
    if (!db.balances[userId]) {
      console.log('[DB] ⚠️ Creating balance for user:', userId);
      db.balances[userId] = {
        telegram_id: parseInt(userId),
        ton_balance: 0,
        stars_balance: 0,
        updated_at: Math.floor(Date.now() / 1000)
      };
    }
    
    const balance = db.balances[userId];
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
    balance[field] = newBalance;
    balance.updated_at = Math.floor(Date.now() / 1000);

    // Add transaction
    const transaction = {
      id: db.nextTransactionId++,
      telegram_id: parseInt(userId),
      type,
      currency,
      amount: parsedAmount,
      balance_before: oldBalance,
      balance_after: newBalance,
      description,
      tx_hash: metadata.txHash || null,
      invoice_id: metadata.invoiceId || null,
      created_at: Math.floor(Date.now() / 1000)
    };
    
    db.transactions.push(transaction);
    console.log('[DB] 📝 Transaction added:', transaction.id);

    saveDatabase();
    console.log('[DB] ✅ Balance updated successfully');
    
    return newBalance;
  } catch (err) {
    console.error('[DB] ❌ Error updating balance:', err);
    console.error('[DB] Stack:', err.stack);
    throw err;
  }
}

// ====== BETS ======
export function createBet(telegramId, roundId, betData, totalAmount, currency) {
  try {
    const userId = telegramId.toString();
    console.log('[DB] 🎲 Creating bet:', { userId, roundId, totalAmount, currency });
    
    // Deduct balance
    updateBalance(parseInt(userId), currency, -totalAmount, 'bet', `Bet on round ${roundId}`);

    // Create bet
    const betId = db.nextBetId++;
    const bet = {
      id: betId,
      telegram_id: parseInt(userId),
      round_id: roundId,
      bet_data: betData,
      total_amount: totalAmount,
      currency,
      result: 'pending',
      win_amount: 0,
      multiplier: 0,
      created_at: Math.floor(Date.now() / 1000),
      resolved_at: null
    };
    
    db.bets.push(bet);

    saveDatabase();
    console.log('[DB] ✅ Bet created:', betId);
    
    return betId;
  } catch (err) {
    console.error('[DB] ❌ Error creating bet:', err);
    console.error('[DB] Stack:', err.stack);
    throw err;
  }
}

export function resolveBet(betId, result, winAmount = 0, multiplier = 0) {
  try {
    console.log('[DB] 🎯 Resolving bet:', { betId, result, winAmount });
    
    const bet = db.bets.find(b => b.id === betId);
    
    if (!bet) {
      console.error('[DB] ❌ Bet not found:', betId);
      throw new Error('Bet not found');
    }
    
    if (bet.result !== 'pending') {
      console.error('[DB] ❌ Bet already resolved:', betId);
      throw new Error('Bet already resolved');
    }

    bet.result = result;
    bet.win_amount = winAmount;
    bet.multiplier = multiplier;
    bet.resolved_at = Math.floor(Date.now() / 1000);

    if (result === 'win' && winAmount > 0) {
      updateBalance(
        bet.telegram_id,
        bet.currency,
        winAmount,
        'win',
        `Win on round ${bet.round_id} (${multiplier}x)`
      );
    }

    saveDatabase();
    console.log('[DB] ✅ Bet resolved:', betId);
    
    return true;
  } catch (err) {
    console.error('[DB] ❌ Error resolving bet:', err);
    console.error('[DB] Stack:', err.stack);
    throw err;
  }
}

export function getBetHistory(telegramId, limit = 50) {
  try {
    console.log('[DB] 📜 Getting bet history for:', telegramId);
    
    const userId = parseInt(telegramId);
    
    const bets = db.bets
      .filter(b => b.telegram_id === userId)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
    
    console.log('[DB] ✅ Found bets:', bets.length);
    return bets;
  } catch (err) {
    console.error('[DB] ❌ Error getting bet history:', err);
    console.error('[DB] Stack:', err.stack);
    return [];
  }
}

// ====== TRANSACTIONS ======
export function getTransactionHistory(telegramId, limit = 50) {
  try {
    console.log('[DB] 📜 Getting transaction history for:', telegramId);
    
    const userId = parseInt(telegramId);
    
    const transactions = db.transactions
      .filter(t => t.telegram_id === userId)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
    
    console.log('[DB] ✅ Found transactions:', transactions.length);
    return transactions;
  } catch (err) {
    console.error('[DB] ❌ Error getting transactions:', err);
    console.error('[DB] Stack:', err.stack);
    return [];
  }
}

// ====== STATS ======
export function getUserStats(telegramId) {
  try {
    console.log('[DB] 📊 Getting stats for:', telegramId);
    
    const userId = parseInt(telegramId);
    
    const userBets = db.bets.filter(b => 
      b.telegram_id === userId && b.result !== 'pending'
    );
    
    const wins = userBets.filter(b => b.result === 'win').length;
    const losses = userBets.filter(b => b.result === 'lose').length;
    const total_won = userBets
      .filter(b => b.result === 'win')
      .reduce((sum, b) => sum + (b.win_amount || 0), 0);
    const total_wagered = userBets.reduce((sum, b) => sum + b.total_amount, 0);
    
    const stats = {
      wins,
      losses,
      total_won,
      total_wagered,
      total_bets: userBets.length
    };
    
    console.log('[DB] ✅ Stats:', stats);
    return stats;
  } catch (err) {
    console.error('[DB] ❌ Error getting stats:', err);
    console.error('[DB] Stack:', err.stack);
    return { wins: 0, losses: 0, total_won: 0, total_wagered: 0, total_bets: 0 };
  }
}

// ====== CLEANUP ======
export function cleanupOldData(daysOld = 90) {
  try {
    console.log('[DB] 🧹 Cleaning up old data...');
    
    const timestamp = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60);
    
    const before = db.transactions.length;
    db.transactions = db.transactions.filter(t => 
      t.created_at >= timestamp || ['deposit', 'withdraw'].includes(t.type)
    );
    const after = db.transactions.length;
    
    saveDatabase();
    console.log('[DB] ✅ Cleaned up', before - after, 'old transactions');
  } catch (err) {
    console.error('[DB] ❌ Cleanup error:', err);
    console.error('[DB] Stack:', err.stack);
  }
}

// ====== GRACEFUL SHUTDOWN ======
process.on('exit', () => {
  console.log('[DB] 👋 Process exit - saving database...');
  clearInterval(saveInterval);
  saveDatabase();
  console.log('[DB] 👋 Database saved on exit');
});

process.on('SIGINT', () => {
  console.log('[DB] 👋 SIGINT received - saving database...');
  clearInterval(saveInterval);
  saveDatabase();
  console.log('[DB] 👋 Database saved (SIGINT)');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[DB] 👋 SIGTERM received - saving database...');
  clearInterval(saveInterval);
  saveDatabase();
  console.log('[DB] 👋 Database saved (SIGTERM)');
  process.exit(0);
});

// ====== INIT ======
try {
  initDatabase();
  console.log('[DB] 🎉 Database module loaded successfully');
} catch (err) {
  console.error('[DB] 💥 CRITICAL: Failed to initialize database!');
  console.error('[DB] Error:', err);
  console.error('[DB] Stack:', err.stack);
  process.exit(1);
}

export default db;