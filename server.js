// server.js - CLEAN VERSION
import express from "express";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import * as db from "./database-sqlite.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Wheel configuration (must match wheel.js)
const WHEEL_ORDER = [
  'Wild Time','1x','3x','Loot Rush','1x','7x','50&50','1x',
  '3x','11x','1x','3x','Loot Rush','1x','7x','50&50',
  '1x','3x','1x','11x','3x','1x','7x','50&50'
];

// --- Base settings
app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Static files from ./public
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".json")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
  }
}));

// ====== HEALTH ======
app.get("/health", (req, res) => res.json({ ok: true }));

// ====== TonConnect manifest ======
app.get("/tonconnect-manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify({
    url: process.env.PUBLIC_URL || baseUrlFrom(req),
    name: "Wild Time",
    iconUrl: `${process.env.PUBLIC_URL || baseUrlFrom(req)}/icons/app-icon.png`,
    termsOfUseUrl: `${process.env.PUBLIC_URL || baseUrlFrom(req)}/terms`,
    privacyPolicyUrl: `${process.env.PUBLIC_URL || baseUrlFrom(req)}/privacy`,
    manifestVersion: 1
  }));
});

// ====== Telegram avatar proxy ======
app.get("/api/tg/photo/:userId", async (req, res) => {
  try {
    const token = process.env.BOT_TOKEN;
    const userId = req.params.userId;
    if (!token) return res.status(500).send("BOT_TOKEN not set");

    const p1 = await fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    const j1 = await p1.json();
    const photos = j1?.result?.photos?.[0];
    if (!photos) return res.status(404).send("no photo");

    const fileId = photos[photos.length - 1].file_id;
    const p2 = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const j2 = await p2.json();
    const fpath = j2?.result?.file_path;
    if (!fpath) return res.status(404).send("no file path");

    const fileResp = await fetch(`https://api.telegram.org/file/bot${token}/${fpath}`);
    if (!fileResp.ok) return res.status(502).send("tg file fetch failed");

    res.setHeader("Cache-Control", "public, max-age=3600, immutable");
    res.setHeader("Content-Type", fileResp.headers.get("content-type") || "image/jpeg");
    fileResp.body.pipe(res);
  } catch (e) {
    console.error('[Avatar]', e);
    res.status(500).send("error");
  }
});

// ====== DEPOSIT NOTIFICATION ======
// ====== SSE для автообновления баланса ======
const balanceClients = new Map(); // userId -> Set of response objects

app.get("/api/balance/stream", (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  console.log('[SSE] Client connected:', userId);
  
  // Add client to list
  if (!balanceClients.has(userId)) {
    balanceClients.set(userId, new Set());
  }
  balanceClients.get(userId).add(res);
  
  // Send initial balance
  try {
    const balance = db.getUserBalance(parseInt(userId));
    res.write(`data: ${JSON.stringify({
      type: 'balance',
      ton: parseFloat(balance.ton_balance) || 0,
      stars: parseInt(balance.stars_balance) || 0,
      timestamp: Date.now()
    })}\n\n`);
  } catch (err) {
    console.error('[SSE] Error sending initial balance:', err);
  }
  
  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000); // Every 30 seconds
  
  // Cleanup on disconnect
  req.on('close', () => {
    console.log('[SSE] Client disconnected:', userId);
    clearInterval(heartbeat);
    const clients = balanceClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        balanceClients.delete(userId);
      }
    }
  });
});

// Function to broadcast balance updates
function broadcastBalanceUpdate(userId, currency, newBalance) {
  const clients = balanceClients.get(String(userId));
  if (!clients || clients.size === 0) {
    console.log('[SSE] No clients to notify for user:', userId);
    return;
  }
  
  console.log('[SSE] Broadcasting update to', clients.size, 'clients for user:', userId);
  
  // Get full balance
  try {
    const balance = db.getUserBalance(userId);
    const data = JSON.stringify({
      type: 'balance',
      ton: parseFloat(balance.ton_balance) || 0,
      stars: parseInt(balance.stars_balance) || 0,
      timestamp: Date.now()
    });
    
    clients.forEach(client => {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (err) {
        console.error('[SSE] Error sending to client:', err);
        clients.delete(client);
      }
    });
  } catch (err) {
    console.error('[SSE] Error broadcasting:', err);
  }
}

// ====== DEPOSIT TRACKING (prevent duplicates) ======
const processedDeposits = new Map(); // invoiceId/txHash -> timestamp

function isDepositProcessed(identifier) {
  if (!identifier) return false;
  
  // Clean old entries (older than 10 minutes)
  const now = Date.now();
  for (const [key, timestamp] of processedDeposits.entries()) {
    if (now - timestamp > 600000) {
      processedDeposits.delete(key);
    }
  }
  
  return processedDeposits.has(identifier);
}

function markDepositProcessed(identifier) {
  if (identifier) {
    processedDeposits.set(identifier, Date.now());
  }
}

// ====== DEPOSIT NOTIFICATION ======
app.post("/api/deposit-notification", async (req, res) => {
  try {
    const { amount, currency, userId, txHash, timestamp, initData, invoiceId } = req.body;
    
    const depositId = invoiceId || txHash || `${userId}_${currency}_${amount}_${timestamp}`;
    
    console.log('[Deposit] Notification received:', {
      amount,
      currency,
      userId,
      depositId: depositId?.substring(0, 20) + '...',
      timestamp
    });

    // 🔥 CHECK FOR DUPLICATES
    if (isDepositProcessed(depositId)) {
      console.log('[Deposit] ⚠️ Duplicate detected, skipping:', depositId);
      return res.json({ 
        ok: true, 
        message: 'Already processed',
        duplicate: true
      });
    }

    // Validation
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount' });
    }

    if (!currency || !['ton', 'stars'].includes(currency)) {
      return res.status(400).json({ ok: false, error: 'Invalid currency' });
    }

    // Extract user data from initData
    let user = null;
    if (initData) {
      const check = verifyInitData(initData, process.env.BOT_TOKEN, 300);
      if (check.ok && check.params.user) {
        try { 
          user = JSON.parse(check.params.user);
          db.saveUser(user);
          console.log('[Deposit] User saved:', user.id);
        } catch (err) {
          console.error('[Deposit] Failed to parse user:', err);
        }
      }
    }

    // 🔥 MARK AS PROCESSED BEFORE UPDATING BALANCE
    markDepositProcessed(depositId);

    // Process deposit based on currency
    try {
      if (currency === 'ton') {
        const newBalance = db.updateBalance(
          userId,
          'ton',
          parseFloat(amount),
          'deposit',
          txHash ? `TON deposit ${txHash.substring(0, 10)}...` : 'TON deposit',
          { txHash }
        );
        
        console.log('[Deposit] ✅ TON balance updated:', { userId, newBalance });
        
        // 🔥 BROADCAST BALANCE UPDATE
        broadcastBalanceUpdate(userId, 'ton', newBalance);
        
        // Send notification
        if (process.env.BOT_TOKEN) {
          await sendTelegramMessage(userId, `✅ Deposit confirmed!\n\nYou received ${amount} TON`);
        }
        
        return res.json({ 
          ok: true, 
          message: 'TON deposit processed',
          newBalance: newBalance
        });
        
      } else if (currency === 'stars') {
        const newBalance = db.updateBalance(
          userId,
          'stars',
          parseInt(amount),
          'deposit',
          'Stars payment',
          { invoiceId: depositId }
        );
        
        console.log('[Deposit] ✅ Stars balance updated:', { userId, newBalance });
        
        // 🔥 BROADCAST BALANCE UPDATE
        broadcastBalanceUpdate(userId, 'stars', newBalance);
        
        return res.json({ 
          ok: true, 
          message: 'Stars deposit processed',
          newBalance: newBalance
        });
      }
      
    } catch (err) {
      console.error('[Deposit] Error updating balance:', err);
      // Remove from processed if failed
      processedDeposits.delete(depositId);
      
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to update balance',
        details: err.message 
      });
    }

  } catch (error) {
    console.error('[Deposit] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: error.message || 'Internal server error'
    });
  }
});




// ====== BALANCE API ======
app.get("/api/balance", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    console.log('[Balance] Request for user:', userId);

    // 🔥 FIX: Handle guest users
    if (userId === 'guest' || isNaN(parseInt(userId))) {
      console.log('[Balance] Guest user, returning zero balance');
      return res.json({
        ok: true,
        userId: userId,
        ton: 0,
        stars: 0,
        updatedAt: Math.floor(Date.now() / 1000)
      });
    }

    const balance = db.getUserBalance(parseInt(userId));

    console.log('[Balance] ✅ Retrieved:', balance);

    res.json({
      ok: true,
      userId: parseInt(userId),
      ton: parseFloat(balance.ton_balance) || 0,
      stars: parseInt(balance.stars_balance) || 0,
      updatedAt: balance.updated_at
    });

  } catch (error) {
    console.error('[Balance] ❌ Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get balance'
    });
  }
});



// ====== STARS PAYMENT API ======
app.post("/api/stars/create-invoice", async (req, res) => {
  try {
    const { amount, userId } = req.body;

    console.log('[Stars API] Creating invoice:', { amount, userId });

    if (!amount || amount < 1) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid amount. Minimum is 1 Star'
      });
    }

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      console.error('[Stars API] Bot token not configured!');
      return res.status(500).json({
        ok: false,
        error: 'Payment system not configured'
      });
    }

    const payload = `stars_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${amount} Telegram Stars`,
          description: `Top up your WildGift balance`,
          payload: payload,
          provider_token: '',
          currency: 'XTR',
          prices: [
            {
              label: `${amount} Stars`,
              amount: amount
            }
          ]
        })
      }
    );

    const invoiceData = await telegramResponse.json();

    console.log('[Stars API] Telegram response:', invoiceData);

    if (!invoiceData.ok) {
      const errorMsg = invoiceData.description || 'Failed to create invoice';
      console.error('[Stars API] Error:', errorMsg);
      return res.status(500).json({
        ok: false,
        error: errorMsg
      });
    }

    res.json({
      ok: true,
      invoiceLink: invoiceData.result,
      invoiceId: payload,
      amount: amount
    });

  } catch (error) {
    console.error('[Stars API] Error creating invoice:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
});

// ====== STARS WEBHOOK ======
app.post("/api/stars/webhook", async (req, res) => {
  try {
    const update = req.body;

    console.log('[Stars Webhook] Received update:', JSON.stringify(update, null, 2));

    // Handle pre_checkout_query
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      const BOT_TOKEN = process.env.BOT_TOKEN;

      console.log('[Stars Webhook] Pre-checkout query:', query.id);

      await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: query.id,
            ok: true
          })
        }
      );

      return res.json({ ok: true });
    }

    // Handle successful_payment
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const userId = update.message.from.id;
      const userFrom = update.message.from;

      console.log('[Stars Webhook] Successful payment:', {
        userId,
        amount: payment.total_amount,
        payload: payment.invoice_payload,
        telegramPaymentChargeId: payment.telegram_payment_charge_id
      });

      db.saveUser(userFrom);

      try {
        const newBalance = db.updateBalance(
          userId,
          'stars',
          payment.total_amount,
          'deposit',
          `Stars payment ${payment.telegram_payment_charge_id}`,
          { invoiceId: payment.invoice_payload }
        );

        console.log('[Stars Webhook] Balance updated:', { userId, newBalance });
        
        await sendTelegramMessage(
          userId, 
          `✅ Payment successful!\n\nYou received ${payment.total_amount} ⭐ Stars`
        );
        
      } catch (err) {
        console.error('[Stars Webhook] Error updating balance:', err);
      }

      res.json({ ok: true });
    } else {
      res.json({ ok: true, message: 'Not a payment update' });
    }

  } catch (error) {
    console.error('[Stars Webhook] Error processing webhook:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ====== USER PROFILE API ======
app.get("/api/user/profile", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    const user = db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'User not found'
      });
    }

    res.json({
      ok: true,
      user: {
        id: user.telegram_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        isPremium: user.is_premium === 1,
        tonBalance: user.ton_balance || 0,
        starsBalance: user.stars_balance || 0,
        createdAt: user.created_at,
        lastSeen: user.last_seen
      }
    });

  } catch (error) {
    console.error('[Profile] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get profile'
    });
  }
});

// ====== USER STATS API ======
app.get("/api/user/stats", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    const stats = db.getUserStats(userId);

    res.json({
      ok: true,
      stats: {
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        totalWon: stats.total_won || 0,
        totalWagered: stats.total_wagered || 0,
        totalBets: stats.total_bets || 0,
        winRate: stats.total_bets > 0 ? ((stats.wins / stats.total_bets) * 100).toFixed(1) : 0
      }
    });

  } catch (error) {
    console.error('[Stats] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get stats'
    });
  }
});

// ====== TRANSACTION HISTORY API ======
app.get("/api/user/transactions", async (req, res) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    const transactions = db.getTransactionHistory(userId, parseInt(limit) || 50);

    res.json({
      ok: true,
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        currency: tx.currency,
        amount: tx.amount,
        balanceBefore: tx.balance_before,
        balanceAfter: tx.balance_after,
        description: tx.description,
        txHash: tx.tx_hash,
        invoiceId: tx.invoice_id,
        createdAt: tx.created_at
      }))
    });

  } catch (error) {
    console.error('[Transactions] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get transactions'
    });
  }
});

// ====== WHEEL ROUND API ======
app.get("/api/round/start", (req, res) => {
  try {
    const sliceIndex = Math.floor(Math.random() * WHEEL_ORDER.length);
    const type = WHEEL_ORDER[sliceIndex];
    
    console.log('[Round API] Generated:', { sliceIndex, type });
    
    res.json({
      ok: true,
      sliceIndex: sliceIndex,
      type: type,
      serverSeed: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Round API] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to generate round'
    });
  }
});

// ====== PLACE BET ======
app.post("/api/round/place-bet", async (req, res) => {
  try {
    const { bets, currency, roundId, initData } = req.body || {};
    
    // Check authorization
    const check = verifyInitData(initData, process.env.BOT_TOKEN, 300);
    if (!check.ok) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    let user = null;
    if (check.params.user) {
      try { user = JSON.parse(check.params.user); } catch {}
    }
    const userId = user?.id;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "User ID required" });
    }

    if (!bets || typeof bets !== 'object') {
      return res.status(400).json({ ok: false, error: "Invalid bets format" });
    }

    if (!currency || !['ton', 'stars'].includes(currency)) {
      return res.status(400).json({ ok: false, error: "Invalid currency" });
    }

    // Calculate total bet amount
    const totalAmount = Object.values(bets).reduce((sum, amount) => sum + parseFloat(amount || 0), 0);

    if (totalAmount <= 0) {
      return res.status(400).json({ ok: false, error: "Bet amount must be greater than 0" });
    }

    console.log('[Bets] Received:', { userId, bets, currency, totalAmount, roundId });

    // Save user
    db.saveUser(user);

    // Check balance
    const balance = db.getUserBalance(userId);
    const currentBalance = currency === 'ton' ? balance.ton_balance : balance.stars_balance;

    if (currentBalance < totalAmount) {
      return res.status(400).json({ 
        ok: false, 
        error: "Insufficient balance",
        currentBalance,
        required: totalAmount
      });
    }

    // Create bet in DB
    const betId = db.createBet(userId, roundId || `round_${Date.now()}`, bets, totalAmount, currency);

    // Get new balance
    const newBalance = db.getUserBalance(userId);

    res.json({
      ok: true,
      userId,
      betId,
      bets,
      totalAmount,
      currency,
      balance: {
        ton: newBalance.ton_balance,
        stars: newBalance.stars_balance
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[Bets] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to place bet'
    });
  }
});
// ============================================
// 🧪 TEST BALANCE SYSTEM
// Добавь эти эндпоинты в server.js ПЕРЕД строкой "// ====== SPA fallback ======"
// ============================================

// 🎁 ДАТЬ ТЕСТОВЫЕ ДЕНЬГИ (только в development)
app.post("/api/test/give-balance", async (req, res) => {
  try {
    // 🔒 ЗАЩИТА: работает только в development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        ok: false,
        error: 'This endpoint is disabled in production'
      });
    }

    const { userId, ton, stars } = req.body;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    console.log('[TEST] 🎁 Giving test balance:', { userId, ton, stars });

    let results = {};

    // Дать TON
    if (ton && ton > 0) {
      const newTonBalance = db.updateBalance(
        userId,
        'ton',
        parseFloat(ton),
        'test',
        '🧪 Test TON deposit',
        { test: true }
      );
      results.ton = newTonBalance;
      console.log('[TEST] ✅ Added TON:', newTonBalance);
    }

    // Дать Stars
    if (stars && stars > 0) {
      const newStarsBalance = db.updateBalance(
        userId,
        'stars',
        parseInt(stars),
        'test',
        '🧪 Test Stars deposit',
        { test: true }
      );
      results.stars = newStarsBalance;
      console.log('[TEST] ✅ Added Stars:', newStarsBalance);
    }

    // Отправить обновление через SSE
    if (ton || stars) {
      broadcastBalanceUpdate(userId, 'ton', results.ton || 0);
    }

    const finalBalance = db.getUserBalance(userId);

    res.json({
      ok: true,
      message: 'Test balance added successfully',
      balance: {
        ton: parseFloat(finalBalance.ton_balance) || 0,
        stars: parseInt(finalBalance.stars_balance) || 0
      },
      added: {
        ton: ton || 0,
        stars: stars || 0
      }
    });

  } catch (error) {
    console.error('[TEST] Error giving balance:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to give test balance'
    });
  }
});

// 🔄 СБРОСИТЬ БАЛАНС (только в development)
app.post("/api/test/reset-balance", async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        ok: false,
        error: 'This endpoint is disabled in production'
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    console.log('[TEST] 🔄 Resetting balance for user:', userId);

    // Установить баланс в 0
    db.updateBalance(userId, 'ton', 0, 'test', '🧪 Balance reset', { test: true, reset: true });
    db.updateBalance(userId, 'stars', 0, 'test', '🧪 Balance reset', { test: true, reset: true });

    // Отправить обновление через SSE
    broadcastBalanceUpdate(userId, 'ton', 0);

    res.json({
      ok: true,
      message: 'Balance reset to 0',
      balance: {
        ton: 0,
        stars: 0
      }
    });

  } catch (error) {
    console.error('[TEST] Error resetting balance:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to reset balance'
    });
  }
});

// 💰 УСТАНОВИТЬ ТОЧНЫЙ БАЛАНС (только в development)
app.post("/api/test/set-balance", async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        ok: false,
        error: 'This endpoint is disabled in production'
      });
    }

    const { userId, ton, stars } = req.body;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    console.log('[TEST] 💰 Setting exact balance:', { userId, ton, stars });

    const currentBalance = db.getUserBalance(userId);

    let results = {};

    // Установить TON
    if (ton !== undefined) {
      const currentTon = parseFloat(currentBalance.ton_balance) || 0;
      const diff = ton - currentTon;
      
      if (diff !== 0) {
        const newTonBalance = db.updateBalance(
          userId,
          'ton',
          diff,
          'test',
          `🧪 Set TON balance to ${ton}`,
          { test: true, setBalance: true }
        );
        results.ton = newTonBalance;
      } else {
        results.ton = currentTon;
      }
    }

    // Установить Stars
    if (stars !== undefined) {
      const currentStars = parseInt(currentBalance.stars_balance) || 0;
      const diff = stars - currentStars;
      
      if (diff !== 0) {
        const newStarsBalance = db.updateBalance(
          userId,
          'stars',
          diff,
          'test',
          `🧪 Set Stars balance to ${stars}`,
          { test: true, setBalance: true }
        );
        results.stars = newStarsBalance;
      } else {
        results.stars = currentStars;
      }
    }

    // Отправить обновление через SSE
    broadcastBalanceUpdate(userId, 'ton', results.ton || 0);

    const finalBalance = db.getUserBalance(userId);

    res.json({
      ok: true,
      message: 'Balance set successfully',
      balance: {
        ton: parseFloat(finalBalance.ton_balance) || 0,
        stars: parseInt(finalBalance.stars_balance) || 0
      }
    });

  } catch (error) {
    console.error('[TEST] Error setting balance:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to set balance'
    });
  }
});

// 📊 ПОЛУЧИТЬ ИНФОРМАЦИЮ О ТЕСТОВОМ РЕЖИМЕ
app.get("/api/test/info", (req, res) => {
  res.json({
    ok: true,
    testMode: process.env.NODE_ENV !== 'production',
    environment: process.env.NODE_ENV || 'development',
    endpoints: process.env.NODE_ENV !== 'production' ? {
      giveBalance: 'POST /api/test/give-balance',
      resetBalance: 'POST /api/test/reset-balance',
      setBalance: 'POST /api/test/set-balance'
    } : null,
    message: process.env.NODE_ENV === 'production' 
      ? 'Test endpoints are disabled in production' 
      : 'Test endpoints are available'
  });
});

// ====== SPA fallback ======
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/tonconnect-manifest.json") {
    return next();
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== Error handling ======
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    ok: false,
    error: err.message || 'Internal server error'
  });
});

// ====== START ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🎮 WildGift Server Running          ║
║   Port: ${PORT}                           ║
║   Environment: ${process.env.NODE_ENV || 'development'}      ║
╚═══════════════════════════════════════╝
  `);
  
  if (!process.env.BOT_TOKEN) {
    console.warn('⚠️  WARNING: BOT_TOKEN not set in .env');
    console.warn('   Stars payments will not work!');
  } else {
    console.log('✅ BOT_TOKEN configured');
  }
  
  console.log(`✅ Wheel configured with ${WHEEL_ORDER.length} segments`);
});

// ========== HELPERS ==========
function baseUrlFrom(req) {
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host  = req.get("x-forwarded-host") || req.get("host");
  return `${proto}://${host}`;
}

// Verify Telegram initData
function verifyInitData(initDataStr, botToken, maxAgeSeconds = 300) {
  try {
    if (!initDataStr || !botToken) return { ok: false, params: {} };

    const params = new URLSearchParams(initDataStr);
    const hash = params.get("hash");
    params.delete("hash");

    // Check validity
    const authDate = Number(params.get("auth_date"));
    if (!Number.isNaN(authDate)) {
      const age = Date.now() / 1000 - authDate;
      if (age > maxAgeSeconds) return { ok: false, params: {} };
    }

    const dataCheckString = [...params.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calcHash  = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const ok = hash && crypto.timingSafeEqual(Buffer.from(calcHash, "hex"), Buffer.from(hash, "hex"));
    return { ok, params: Object.fromEntries(params.entries()) };
  } catch {
    return { ok: false, params: {} };
  }
}

// Send Telegram message
async function sendTelegramMessage(chatId, text) {
  if (!process.env.BOT_TOKEN) return;
  
  try {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('[Telegram] Failed to send message:', err);
  }
}