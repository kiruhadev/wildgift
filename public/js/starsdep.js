// public/js/starsdep.js - Stars Purchase Module (UPDATED VERSION)
(() => {
    console.log('[STARS] ⭐ Starting Stars module');
  
    // ====== CONFIG ======
    const MIN_STARS = 1;
  
    // ====== DOM ======
    const popup = document.getElementById("starsDepositPopup");
    if (!popup) {
      console.error('[STARS] ❌ starsDepositPopup not found!');
      return;
    }
  
    const backdrop = popup.querySelector(".deposit-popup__backdrop");
    const btnClose = document.getElementById("starsPopupClose");
    const amountInput = document.getElementById("starsAmountInput");
    const inputWrapper = document.getElementById("starsInputWrapper");
    const errorNotification = document.getElementById("starsErrorNotification");
    const btnBuy = document.getElementById("btnBuyStars");
  
    // ====== TELEGRAM ======
    const tg = window.Telegram?.WebApp;
    const tgUserId = tg?.initDataUnsafe?.user?.id || null;
    const initData = tg?.initData || "";
  
    if (!tg?.openInvoice) {
      console.warn('[STARS] ⚠️ openInvoice not available (not in Telegram)');
    }
  
    // ====== STATE ======
    let platformBalance = 0;
  
    // ====== VALIDATION ======
    function validateAmount() {
      const amount = parseInt(amountInput?.value) || 0;
      
      // Очищаем предыдущее состояние
      if (inputWrapper) {
        inputWrapper.classList.remove('error', 'success');
      }
      if (errorNotification) {
        errorNotification.hidden = true;
      }
      
      if (amount >= MIN_STARS) {
        // Успех
        if (inputWrapper) inputWrapper.classList.add('success');
        if (btnBuy) btnBuy.disabled = false;
        return true;
      } else if (amount > 0) {
        // Меньше минимума
        if (btnBuy) btnBuy.disabled = true;
        return false;
      } else {
        // Пустое
        if (btnBuy) btnBuy.disabled = true;
        return false;
      }
    }
    
    function showValidationError() {
      if (inputWrapper) {
        inputWrapper.classList.remove('success');
        inputWrapper.classList.add('error');
        
        // Убираем тряску через 400ms
        setTimeout(() => {
          inputWrapper.classList.remove('error');
        }, 400);
      }
      
      if (errorNotification) {
        errorNotification.hidden = false;
        
        // Скрываем через 3 секунды
        setTimeout(() => {
          errorNotification.hidden = true;
        }, 3000);
      }
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
    }
  
    // ====== POPUP ======
    function openPopup() {
      console.log('[STARS] 📂 Open popup');
      popup.classList.add('deposit-popup--open');
      updateUI();
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }
  
    function closePopup() {
      popup.classList.remove('deposit-popup--open');
      // Очищаем валидацию при закрытии
      if (inputWrapper) inputWrapper.classList.remove('error', 'success');
      if (errorNotification) errorNotification.hidden = true;
    }
  
    backdrop?.addEventListener('click', closePopup);
    btnClose?.addEventListener('click', closePopup);
  
    // ====== INPUT ======
    amountInput?.addEventListener('input', () => {
      const caret = amountInput.selectionStart;
      amountInput.value = amountInput.value.replace(/[^0-9]/g, "");
      try { amountInput.setSelectionRange(caret, caret); } catch {}
      validateAmount();
    });
    
    amountInput?.addEventListener('blur', () => {
      const amount = parseInt(amountInput?.value) || 0;
      if (amount > 0 && amount < MIN_STARS) {
        showValidationError();
      }
    });
  
    // ====== UI ======
    function updateUI() {
      const valid = validateAmount();
      console.log('[STARS] UI:', { valid });
    }
  
    // ====== UPDATE BALANCE ======
    function updateBalance(balance) {
      platformBalance = balance;
      
      // Обновляем отображение в topbar через систему переключения валюты
      if (window.WildTimeCurrency) {
        window.WildTimeCurrency.setBalance('stars', balance);
      }
      
      console.log('[STARS] 💰 Balance:', balance);
    }
  
    // ====== CREATE INVOICE ======
    async function createInvoice(amount) {
      console.log('[STARS] 💫 Creating invoice:', amount);
  
      if (!tgUserId) {
        throw new Error('User not authorized in Telegram');
      }
  
      try {
        const res = await fetch('/api/stars/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount, 
            userId: tgUserId, 
            initData 
          })
        });
  
        if (!res.ok) {
          const text = await res.text();
          console.error('[STARS] Server error:', res.status, text);
          
          if (res.status === 404) {
            throw new Error('Server endpoint not configured. Please contact support.');
          } else if (res.status === 400) {
            throw new Error('Invalid request');
          } else if (res.status === 500) {
            throw new Error('Server error. Please try again later.');
          } else {
            throw new Error(`Server error: ${res.status}`);
          }
        }
  
        const data = await res.json();
        console.log('[STARS] Invoice response:', data);
  
        if (!data.ok || !data.invoiceLink) {
          throw new Error(data.error || 'Failed to create invoice');
        }
  
        return data;
  
      } catch (err) {
        console.error('[STARS] ❌ Invoice error:', err);
        throw err;
      }
    }
  
    // ====== BUY STARS ======
    btnBuy?.addEventListener('click', async (e) => {
      e.preventDefault();
  
      const amount = parseInt(amountInput?.value) || 0;
      
      // Валидация перед отправкой
      if (amount < MIN_STARS) {
        showValidationError();
        return;
      }
  
      if (!tg?.openInvoice) {
        const msg = 'Stars payment only works in Telegram app. Please open this page in Telegram.';
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }
  
      if (!tgUserId) {
        const msg = 'You must authorize in Telegram first';
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }
  
      console.log('[STARS] 🛒 Buy:', amount);
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
  
      const oldText = btnBuy.textContent;
      btnBuy.disabled = true;
      btnBuy.textContent = 'Creating invoice...';
  
      try {
        // Create invoice
        const invoiceData = await createInvoice(amount);
        
        btnBuy.textContent = 'Opening payment...';
        console.log('[STARS] 🎫 Opening invoice:', invoiceData.invoiceLink);
  
        // Open invoice
        tg.openInvoice(invoiceData.invoiceLink, (status) => {
          console.log('[STARS] 📋 Payment status:', status);
  
          if (status === 'paid') {
            console.log('[STARS] ✅ Payment successful!');
  
            // Notify server about successful payment
            fetch('/api/deposit-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount, 
                currency: 'stars', 
                userId: tgUserId, 
                initData,
                invoiceId: invoiceData.invoiceId, 
                timestamp: Date.now()
              })
            }).catch(err => console.warn('[STARS] Notification failed:', err));
  
            // Show success message
            if (tg?.showPopup) {
              tg.showPopup({
                title: '✅ Success',
                message: `Purchased ${amount} ⭐ Stars!`,
                buttons: [{ type: 'ok' }]
              });
            } else if (tg?.showAlert) {
              tg.showAlert(`✅ Purchased ${amount} ⭐ Stars!`);
            }
  
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  
            // Update balance
            updateBalance(platformBalance + amount);
  
            // Close popup and reset
            setTimeout(() => {
              closePopup();
              if (amountInput) amountInput.value = '';
              btnBuy.textContent = oldText;
              btnBuy.disabled = false;
            }, 1500);
  
          } else if (status === 'cancelled') {
            console.log('[STARS] ⚠️ Payment cancelled by user');
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            btnBuy.textContent = oldText;
            btnBuy.disabled = false;
  
          } else if (status === 'failed') {
            console.error('[STARS] ❌ Payment failed');
            if (tg?.showAlert) tg.showAlert('Payment failed. Please try again.');
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            btnBuy.textContent = oldText;
            btnBuy.disabled = false;
            
          } else {
            console.warn('[STARS] ⚠️ Unknown status:', status);
            btnBuy.textContent = oldText;
            btnBuy.disabled = false;
          }
        });
  
      } catch (err) {
        console.error('[STARS] ❌ Error:', err);
  
        let msg = 'Failed to process payment';
        
        if (err.message.includes('not configured')) {
          msg = 'Server not configured. Please contact support.';
        } else if (err.message.includes('404')) {
          msg = 'Payment service unavailable. Please contact support.';
        } else if (err.message.includes('500')) {
          msg = 'Server error. Please try again later.';
        } else if (err.message.includes('Network')) {
          msg = 'Network error. Please check your connection.';
        } else if (err.message) {
          msg = err.message;
        }
  
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
  
        btnBuy.textContent = oldText;
        btnBuy.disabled = false;
      }
    });
  
    // ====== LOAD BALANCE ======
    async function loadBalance() {
      if (!tgUserId) {
        console.log('[STARS] No user ID, skipping balance load');
        return;
      }
  
      try {
        const res = await fetch(`/api/balance?userId=${tgUserId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stars !== undefined) {
            updateBalance(data.stars);
          }
        }
      } catch (err) {
        console.warn('[STARS] Failed to load balance:', err);
      }
    }
  
    // ====== EVENTS ======
    window.addEventListener('balance:update', (e) => {
      if (e.detail?.stars !== undefined) {
        updateBalance(e.detail.stars);
      }
    });
  
    // ====== INIT ======
    updateUI();
    loadBalance();
    
    console.log('[STARS] ✅ Module ready');
    console.log('[STARS] User ID:', tgUserId || 'Not authorized');
    console.log('[STARS] openInvoice available:', !!tg?.openInvoice);
  
    // ====== EXPORT ======
    window.WTStarsDeposit = {
      open: openPopup,
      close: closePopup,
      updateBalance,
      isAvailable: () => !!tg?.openInvoice && !!tgUserId,
      getBalance: () => platformBalance
    };
  
    // Debug info
    setTimeout(() => {
      console.log('[STARS] 🔍 Status check:', {
        module: 'Ready',
        telegram: !!tg,
        userId: tgUserId || 'Not set',
        openInvoice: !!tg?.openInvoice,
        balance: platformBalance
      });
    }, 1000);
  
  })();
  
  
  
  
  
  