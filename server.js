// server.js
// Node 18+ (fetch встроен). ESM ("type": "module" в package.json).

import express from "express";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Конфигурация колеса (должна совпадать с wheel.js)
const WHEEL_ORDER = [
  'Wild Time','1x','3x','Loot Rush','1x','7x','50&50','1x',
  '3x','11x','1x','3x','Loot Rush','1x','7x','50&50',
  '1x','3x','1x','11x','3x','1x','7x','50&50'
];

// --- базовые настройки
app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- статика из ./public (иконки, index.html, css, js)
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"], // / -> index.html
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

// ====== Telegram avatar proxy (без CORS/404) ======
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
    console.error(e);
    res.status(500).send("error");
  }
});

// ====== DEPOSIT (TON) ======
app.post("/deposit", async (req, res) => {
  try {
    const { amount, initData } = req.body || {};
    const num = Number(amount);
    if (!Number.isFinite(num) || num < 0.5) {
      return res.status(400).json({ ok: false, error: "Minimum deposit 0.5 TON" });
    }

    const check = verifyInitData(initData, process.env.BOT_TOKEN, 300);
    if (!check.ok) return res.status(401).json({ ok: false, error: "unauthorized" });

    let user = null;
    if (check.params.user) {
      try { user = JSON.parse(check.params.user); } catch {}
    }
    const chatId = user?.id;

    if (process.env.BOT_TOKEN && chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ Deposit request sent: ${num} TON\nPlease confirm in your wallet.`
        })
      }).catch(() => {});
    }

    res.json({ ok: true, amount: num, userId: chatId });
  } catch (e) {
    console.error("deposit error:", e);
    res.status(500).json({ ok: false, error: "server_error" });
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

// Webhook для обработки successful_payment и pre_checkout_query
app.post("/api/stars/webhook", async (req, res) => {
  try {
    const update = req.body;

    console.log('[Stars Webhook] Received update:', JSON.stringify(update, null, 2));

    // Обработка pre_checkout_query
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

    // Обработка successful_payment
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const userId = update.message.from.id;

      console.log('[Stars Webhook] Successful payment:', {
        userId,
        amount: payment.total_amount,
        payload: payment.invoice_payload,
        telegramPaymentChargeId: payment.telegram_payment_charge_id
      });

      // Отправляем подтверждение пользователю
      if (process.env.BOT_TOKEN) {
        await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: userId,
              text: `✅ Payment successful!\n\nYou received ${payment.total_amount} ⭐ Stars`,
              parse_mode: 'HTML'
            })
          }
        ).catch(err => console.error('[Stars Webhook] Error sending confirmation:', err));
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

app.post("/api/deposit-notification", async (req, res) => {
  try {
    const { amount, currency, userId, txHash, timestamp } = req.body;
    
    console.log('[Deposit] Notification received:', {
      amount,
      currency,
      userId,
      txHash,
      timestamp
    });

    res.json({ ok: true, message: 'Notification received' });
  } catch (error) {
    console.error('[Deposit] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ====== WHEEL ROUND API - ИСПРАВЛЕНО! ======
app.get("/api/round/start", (req, res) => {
  try {
    // Генерируем случайный индекс сектора
    const sliceIndex = Math.floor(Math.random() * WHEEL_ORDER.length);
    
    // Получаем тип из порядка колеса
    const type = WHEEL_ORDER[sliceIndex];
    
    console.log('[Round API] Generated:', { sliceIndex, type });
    
    // Возвращаем правильную структуру
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

// ====== Проверка ставок (опционально) ======
app.post("/api/round/place-bet", async (req, res) => {
  try {
    const { bets, initData } = req.body || {};
    
    // Проверяем авторизацию
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

    console.log('[Bets] Received:', { userId, bets });

    // Здесь можно добавить валидацию и сохранение ставок в БД
    // Например, проверить баланс пользователя

    res.json({
      ok: true,
      userId,
      bets,
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

// ====== SPA fallback: все прочие GET отдать index.html ======
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

// ====== старт ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🎮 WildGift Server Running          ║
║   Port: ${PORT}                           ║
║   Environment: ${process.env.NODE_ENV || 'development'}      ║
╚═══════════════════════════════════════╝
  `);
  
  // Проверка Bot Token
  if (!process.env.BOT_TOKEN) {
    console.warn('⚠️  WARNING: BOT_TOKEN not set in .env');
    console.warn('   Stars payments will not work!');
  } else {
    console.log('✅ BOT_TOKEN configured');
  }
  
  // Проверка конфигурации колеса
  console.log(`✅ Wheel configured with ${WHEEL_ORDER.length} segments`);
});


// ========== HELPERS ==========
function baseUrlFrom(req) {
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host  = req.get("x-forwarded-host") || req.get("host");
  return `${proto}://${host}`;
}

// Верификация Telegram initData
function verifyInitData(initDataStr, botToken, maxAgeSeconds = 300) {
  try {
    if (!initDataStr || !botToken) return { ok: false, params: {} };

    const params = new URLSearchParams(initDataStr);
    const hash = params.get("hash");
    params.delete("hash");

    // проверка актуальности
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