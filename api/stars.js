// api/stars.js - Stars Payment Handler
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Твой Telegram Bot Token (из BotFather)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

/**
 * Создание Stars Invoice через Telegram Bot API
 * POST /api/stars/create-invoice
 */
router.post('/create-invoice', async (req, res) => {
  try {
    const { amount, userId } = req.body;

    console.log('[Stars API] Creating invoice:', { amount, userId });

    // Валидация
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

    // Проверка BOT_TOKEN
    if (!BOT_TOKEN) {
      console.error('[Stars API] Bot token not configured!');
      return res.status(500).json({
        ok: false,
        error: 'Payment system not configured. Please set TELEGRAM_BOT_TOKEN in .env'
      });
    }

    // Генерируем уникальный payload для отслеживания платежа
    const payload = `stars_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Создаём invoice через Telegram Bot API
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `${amount} Telegram Stars`,
          description: `Top up your WildGift balance with ${amount} Stars`,
          payload: payload,
          currency: 'XTR', // Telegram Stars currency code
          prices: [
            {
              label: `${amount} Stars`,
              amount: amount // В Stars amount = количество звёзд
            }
          ]
        })
      }
    );

    const invoiceData = await telegramResponse.json();

    console.log('[Stars API] Telegram response:', invoiceData);

    if (!invoiceData.ok) {
      throw new Error(invoiceData.description || 'Failed to create invoice');
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

/**
 * Webhook для обработки successful_payment от Telegram
 * POST /api/stars/webhook
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const update = req.body;

    console.log('[Stars Webhook] Received update:', JSON.stringify(update, null, 2));

    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const userId = update.message.from.id;

      console.log('[Stars Webhook] Successful payment:', {
        userId,
        amount: payment.total_amount,
        payload: payment.invoice_payload
      });

      // Здесь обновляй баланс пользователя в БД
      
      res.json({ ok: true });
    } else {
      res.json({ ok: true, message: 'Not a payment update' });
    }

  } catch (error) {
    console.error('[Stars Webhook] Error processing webhook:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;