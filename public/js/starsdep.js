// public/js/starsdep.js - Telegram Stars Top-Up Module
(() => {
    console.log('[STARS] ⭐ Initializing Stars top-up module');
  
    // ====== КОНФИГ ======
    const MIN_STARS = 1;
  
    // ====== DOM ======
    const sheet = document.getElementById("starsDepositSheet");
    if (!sheet) {
      console.warn('[STARS] ⚠️ starsDepositSheet not found in DOM');
      return;
    }
  
    const backdrop = sheet.querySelector(".sheet__backdrop");
    const btnClose = document.getElementById("starsDepClose");
    const amountInput = document.getElementById("starsDepAmount");
    const btnBuy = document.getElementById("btnBuyStarsNow");
    const starsPill = document.getElementById("starsPill");
  
    // ====== HELPERS ======
    const tg = window.Telegram?.WebApp;
    const tgUserId = tg?.initDataUnsafe?.user?.id || "guest";
    const initData = tg?.initData || "";
  
    function openSheet() {
      console.log('[STARS] 📂 Opening sheet');
      sheet?.classList.add("sheet--open");
      renderUI();
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    }
  
    function closeSheet() {
      sheet?.classList.remove("sheet--open");
    }
  
    backdrop?.addEventListener("click", closeSheet);
    btnClose?.addEventListener("click", closeSheet);
  
    amountInput?.addEventListener("input", () => {
      const caret = amountInput.selectionStart;
      // Только целые числа для Stars
      amountInput.value = amountInput.value.replace(/[^0-9]/g, "");
      try { amountInput.setSelectionRange(caret, caret); } catch {}
      renderUI();
    });
  
    // ====== КЛИК НА STARS PILL ======
    starsPill?.addEventListener("click", (e) => {
      e.preventDefault();
      console.log('[STARS] 🔘 Stars pill clicked');
      openSheet();
    });
  
    // ====== ОТПРАВКА УВЕДОМЛЕНИЯ В БОТ ======
    async function notifyBot(amount, invoiceId = null) {
      try {
        const response = await fetch("/api/deposit-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            currency: 'stars',
            initData,
            userId: tgUserId,
            invoiceId,
            timestamp: Date.now()
          })
        });
  
        if (response.ok) {
          console.log('[STARS] ✅ Bot notified');
        } else {
          console.warn('[STARS] ⚠️ Bot notification failed');
        }
      } catch (error) {
        console.error('[STARS] ❌ Bot notification error:', error);
      }
    }
  
    // ====== СОЗДАНИЕ STARS INVOICE ======
    async function createStarsInvoice(amount) {
      console.log('[STARS] 💫 Creating invoice for', amount, 'Stars');
  
      try {
        const response = await fetch('/api/create-stars-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            userId: tgUserId,
            initData
          })
        });
  
        console.log('[STARS] Response status:', response.status);
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[STARS] Server error:', errorText);
          throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
  
        const data = await response.json();
        console.log('[STARS] Invoice data:', data);
  
        if (!data.ok || !data.invoiceLink) {
          throw new Error(data.error || 'Invalid invoice response');
        }
  
        return data;
  
      } catch (error) {
        console.error('[STARS] ❌ Error creating invoice:', error);
        throw error;
      }
    }
  
    // ====== ОБРАБОТКА STARS PAYMENT ======
    async function processStarsPayment(amount) {
      // Проверка доступности tg.openInvoice
      if (!tg?.openInvoice) {
        console.error('[STARS] ❌ openInvoice not available');
        const msg = 'Stars payment is only available in Telegram Mini App';
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return false;
      }
  
      try {
        console.log('[STARS] 💳 Processing payment for', amount, 'Stars');
  
        // Создаем invoice на сервере
        const invoiceData = await createStarsInvoice(amount);
  
        console.log('[STARS] 🎫 Opening invoice:', invoiceData.invoiceLink);
  
        // Открываем invoice в Telegram
        tg.openInvoice(invoiceData.invoiceLink, async (status) => {
          console.log('[STARS] 📋 Invoice status:', status);
  
          if (status === 'paid') {
            console.log('[STARS] ✅ Payment successful!');
  
            // Уведомляем бот
            await notifyBot(amount, invoiceData.invoiceId);
  
            // Показываем успешное сообщение
            if (tg?.showPopup) {
              tg.showPopup({
                title: '✅ Payment Successful',
                message: `You've topped up ${amount} ⭐ Stars!`,
                buttons: [{ type: 'ok' }]
              });
            } else if (tg?.showAlert) {
              tg.showAlert(`✅ ${amount} ⭐ Stars added!`);
            }
  
            if (tg?.HapticFeedback) {
              tg.HapticFeedback.notificationOccurred('success');
            }
  
            // Обновляем баланс
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('balance:update', {
                detail: { stars: amount }
              }));
            }, 1000);
  
            // Закрываем sheet
            setTimeout(() => {
              if (amountInput) amountInput.value = '';
              closeSheet();
            }, 1500);
  
          } else if (status === 'cancelled') {
            console.log('[STARS] ⚠️ Payment cancelled by user');
  
            if (tg?.HapticFeedback) {
              tg.HapticFeedback.notificationOccurred('warning');
            }
  
          } else if (status === 'failed') {
            console.error('[STARS] ❌ Payment failed');
  
            if (tg?.showAlert) {
              tg.showAlert('Payment failed. Please try again.');
            }
  
            if (tg?.HapticFeedback) {
              tg.HapticFeedback.notificationOccurred('error');
            }
          }
        });
  
        return true;
  
      } catch (error) {
        console.error('[STARS] ❌ Payment error:', error);
  
        let errorMsg = 'Failed to process payment';
        if (error.message.includes('404')) {
          errorMsg = 'Server endpoint not found. Please check API configuration.';
        } else if (error.message.includes('500')) {
          errorMsg = 'Server error. Please try again later.';
        } else if (error.message) {
          errorMsg = error.message;
        }
  
        if (tg?.showAlert) {
          tg.showAlert(errorMsg);
        } else {
          alert(errorMsg);
        }
  
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
  
        return false;
      }
    }
  
    // ====== ПОКУПКА STARS ======
    btnBuy?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
  
      const amount = parseInt(amountInput?.value) || 0;
  
      console.log('[STARS] 🛒 Buy button clicked. Amount:', amount);
  
      // Проверка минимальной суммы
      if (amount < MIN_STARS) {
        const msg = `Minimum purchase is ${MIN_STARS} ⭐`;
        console.warn('[STARS]', msg);
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }
  
      const old = btnBuy.textContent;
      btnBuy.disabled = true;
      btnBuy.textContent = "Opening payment...";
  
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
  
      const success = await processStarsPayment(amount);
  
      if (!success) {
        // Возвращаем кнопку в исходное состояние при ошибке
        btnBuy.textContent = old || "Buy Stars";
        btnBuy.disabled = false;
      } else {
        // При успехе кнопка будет восстановлена после закрытия invoice
        setTimeout(() => {
          btnBuy.textContent = old || "Buy Stars";
          btnBuy.disabled = false;
        }, 2000);
      }
    });
  
    // ====== UI СОСТОЯНИЕ ======
    function renderUI() {
      const amount = parseInt(amountInput?.value) || 0;
  
      console.log('[STARS] 🎨 renderUI: amount=', amount);
  
      // Кнопка активна только если сумма >= минимума
      if (btnBuy) {
        btnBuy.disabled = amount < MIN_STARS;
      }
    }
  
    // Первичная инициализация
    renderUI();
  
    console.log('[STARS] ✅ Stars top-up module initialized');
  
    // Экспорт для использования в других модулях
    window.WTStarsDeposit = {
      openSheet,
      closeSheet,
      isAvailable: () => !!tg?.openInvoice
    };
  })();