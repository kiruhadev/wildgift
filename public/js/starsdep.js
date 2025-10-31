// public/js/starsdep.js - Stars Purchase Module (WORKING VERSION)
(() => {
    console.log('[STARS] ⭐ Starting Stars module');
  
    // ====== КОНФИГ ======
    const MIN_STARS = 1;
  
    // ====== DOM ======
    const starsPill = document.getElementById("starsPill");
    const starsAmount = document.getElementById("starsAmount");
    
    const popup = document.getElementById("starsDepositPopup");
    if (!popup) {
      console.error('[STARS] ❌ starsDepositPopup not found!');
      return;
    }
  
    const backdrop = popup.querySelector(".deposit-popup__backdrop");
    const btnClose = document.getElementById("starsPopupClose");
    const balanceBig = document.getElementById("starsBalanceBig");
    const amountInput = document.getElementById("starsAmountInput");
    const btnBuy = document.getElementById("btnBuyStars");
  
    // ====== TELEGRAM ======
    const tg = window.Telegram?.WebApp;
    const tgUserId = tg?.initDataUnsafe?.user?.id || "guest";
    const initData = tg?.initData || "";
  
    if (!tg?.openInvoice) {
      console.warn('[STARS] ⚠️ openInvoice not available (not in Telegram)');
    }
  
    // ====== СОСТОЯНИЕ ======
    let platformBalance = 0;
  
    // ====== POPUP ======
    function openPopup() {
      console.log('[STARS] 📂 Open popup');
      popup.classList.add('deposit-popup--open');
      updateUI();
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }
  
    function closePopup() {
      popup.classList.remove('deposit-popup--open');
    }
  
    backdrop?.addEventListener('click', closePopup);
    btnClose?.addEventListener('click', closePopup);
    starsPill?.addEventListener('click', (e) => { e.preventDefault(); openPopup(); });
  
    // ====== INPUT ======
    amountInput?.addEventListener('input', () => {
      const caret = amountInput.selectionStart;
      amountInput.value = amountInput.value.replace(/[^0-9]/g, "");
      try { amountInput.setSelectionRange(caret, caret); } catch {}
      updateUI();
    });
  
    // ====== UI ======
    function updateUI() {
      const amount = parseInt(amountInput?.value) || 0;
      const valid = amount >= MIN_STARS;
  
      console.log('[STARS] UI:', { amount, valid });
  
      if (btnBuy) btnBuy.disabled = !valid;
    }
  
    // ====== UPDATE BALANCE ======
    function updateBalance(balance) {
      platformBalance = balance;
      if (starsAmount) starsAmount.textContent = Math.floor(balance);
      if (balanceBig) balanceBig.textContent = Math.floor(balance);
      console.log('[STARS] 💰 Balance:', balance);
    }
  
    // ====== CREATE INVOICE ======
    async function createInvoice(amount) {
      console.log('[STARS] 💫 Creating invoice:', amount);
  
      try {
        const res = await fetch('/api/create-stars-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, userId: tgUserId, initData })
        });
  
        if (!res.ok) {
          const text = await res.text();
          console.error('[STARS] Server error:', text);
          throw new Error(`Server error: ${res.status}`);
        }
  
        const data = await res.json();
        console.log('[STARS] Invoice data:', data);
  
        if (!data.ok || !data.invoiceLink) {
          throw new Error(data.error || 'Invalid response');
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
      if (amount < MIN_STARS) {
        if (tg?.showAlert) tg.showAlert(`Minimum: ${MIN_STARS} ⭐`);
        return;
      }
  
      if (!tg?.openInvoice) {
        if (tg?.showAlert) {
          tg.showAlert('Stars payment only works in Telegram app');
        } else {
          alert('Please open in Telegram');
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
          console.log('[STARS] 📋 Status:', status);
  
          if (status === 'paid') {
            console.log('[STARS] ✅ Paid!');
  
            // Notify server
            fetch('/api/deposit-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount, currency: 'stars', userId: tgUserId, initData,
                invoiceId: invoiceData.invoiceId, timestamp: Date.now()
              })
            }).catch(() => {});
  
            if (tg?.showPopup) {
              tg.showPopup({
                title: '✅ Success',
                message: `Purchased ${amount} ⭐ Stars!`,
                buttons: [{ type: 'ok' }]
              });
            }
  
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  
            updateBalance(platformBalance + amount);
  
            setTimeout(() => {
              closePopup();
              if (amountInput) amountInput.value = '';
              btnBuy.textContent = oldText;
              btnBuy.disabled = false;
            }, 1500);
  
          } else if (status === 'cancelled') {
            console.log('[STARS] ⚠️ Cancelled');
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            btnBuy.textContent = oldText;
            btnBuy.disabled = false;
  
          } else if (status === 'failed') {
            console.error('[STARS] ❌ Failed');
            if (tg?.showAlert) tg.showAlert('Payment failed');
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            btnBuy.textContent = oldText;
            btnBuy.disabled = false;
          }
        });
  
      } catch (err) {
        console.error('[STARS] ❌ Error:', err);
  
        let msg = 'Failed to process payment';
        if (err.message.includes('404')) {
          msg = 'Server not configured. Check API endpoint.';
        } else if (err.message.includes('500')) {
          msg = 'Server error. Try again later.';
        } else if (err.message) {
          msg = err.message;
        }
  
        if (tg?.showAlert) tg.showAlert(msg);
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
  
        btnBuy.textContent = oldText;
        btnBuy.disabled = false;
      }
    });
  
    // ====== LOAD BALANCE ======
    async function loadBalance() {
      try {
        const res = await fetch(`/api/balance?userId=${tgUserId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stars !== undefined) updateBalance(data.stars);
        }
      } catch {}
    }
  
    // ====== EVENTS ======
    window.addEventListener('balance:update', (e) => {
      if (e.detail?.stars !== undefined) updateBalance(e.detail.stars);
    });
  
    // ====== INIT ======
    updateUI();
    loadBalance();
    console.log('[STARS] ✅ Ready');
  
    // ====== EXPORT ======
    window.WTStarsDeposit = {
      open: openPopup,
      close: closePopup,
      updateBalance,
      isAvailable: () => !!tg?.openInvoice
    };
  })();
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  