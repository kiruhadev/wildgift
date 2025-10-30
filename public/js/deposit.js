// public/js/deposit.js - ВЕРСИЯ 3.0 с Stars Invoice
(() => {
  // ====== КОНФИГ ======
  const MANIFEST_URL = `${location.origin}/tonconnect-manifest.json`;
  const PROJECT_TON_ADDRESS = "UQCtVhhBFPBvCoT8H7szNQUhEvHgbvnX50r8v6d8y5wdr19J";
  const MIN_DEPOSIT_TON = 0.5;
  const MIN_DEPOSIT_STARS = 50;

  // ====== DOM ======
  const sheet        = document.getElementById("depositSheet");
  const backdrop     = sheet?.querySelector(".sheet__backdrop");
  const btnClose     = document.getElementById("depClose");
  const amountInput  = document.getElementById("depAmount");
  const btnConnect   = document.getElementById("btnConnectWallet");
  const btnDeposit   = document.getElementById("btnDepositNow");
  const tonPill      = document.getElementById("tonPill");
  const walletBalanceEl = document.getElementById("walletBalance");
  
  // Динамические элементы
  const sheetTitle = sheet?.querySelector(".sheet__title");
  const sheetSub = sheet?.querySelector(".sheet__sub");
  const depInput = sheet?.querySelector(".dep-input");
  const depHint = sheet?.querySelector(".dep-hint");
  const walletBalanceDisplay = sheet?.querySelector(".wallet-balance-display");

  // ====== helpers ======
  const tg = window.Telegram?.WebApp;
  const tgUserId = tg?.initDataUnsafe?.user?.id || "guest";
  const initData = tg?.initData || "";

  function makeScopedStorage(prefix) {
    return {
      getItem: (k) => localStorage.getItem(`${prefix}:${k}`),
      setItem: (k, v) => localStorage.setItem(`${prefix}:${k}`, v),
      removeItem: (k) => localStorage.removeItem(`${prefix}:${k}`)
    };
  }

  function cleanupOldTonConnectKeys() {
    const bad = ["ton-connect-ui", "ton-connect-storage_bridge_v2"];
    bad.forEach((k)=> localStorage.removeItem(k));
    for (let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      if (key && key.startsWith("guest:tc:")) localStorage.removeItem(key);
    }
  }

  function normalize(input) {
    if (!input) return NaN;
    let s = String(input).trim().replace(",", ".").replace(/[^\d.]/g, "");
    const dot = s.indexOf(".");
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function toNanoStr(amountStr) {
    const s = String(amountStr).trim().replace(",", ".");
    const [i="0", f=""] = s.split(".");
    const frac9 = (f + "000000000").slice(0,9);
    return (BigInt(i||"0")*1_000_000_000n + BigInt(frac9)).toString();
  }

  function fromNano(nanoStr) {
    const nano = BigInt(nanoStr);
    const ton = Number(nano) / 1_000_000_000;
    return ton.toFixed(2);
  }

  function openSheet(){ 
    sheet?.classList.add("sheet--open");
    updateSheetContent(); // Обновляем контент при открытии
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
  }
  
  function closeSheet(){ 
    sheet?.classList.remove("sheet--open"); 
  }

  backdrop?.addEventListener("click", closeSheet);
  btnClose?.addEventListener("click", closeSheet);

  amountInput?.addEventListener("input", ()=>{
    const caret = amountInput.selectionStart;
    const currentCurrency = getCurrentCurrency();
    
    if (currentCurrency === 'stars') {
      // Для Stars только целые числа
      amountInput.value = amountInput.value.replace(/[^0-9]/g, "");
    } else {
      // Для TON - дробные числа
      amountInput.value = amountInput.value
        .replace(",", ".").replace(/[^0-9.]/g,"").replace(/^(\d*\.\d*).*$/, "$1");
    }
    
    try { amountInput.setSelectionRange(caret, caret); } catch {}
    renderUI();
  });

  // ====== TonConnect UI ======
  cleanupOldTonConnectKeys();
  
  if (!window.TON_CONNECT_UI) {
    console.error("[deposit] TonConnect UI not loaded");
    return;
  }

  const storage = makeScopedStorage(`${tgUserId}:tc`);
  
  console.log('[deposit] Initializing TonConnect with manifest:', MANIFEST_URL);
  
  const tc = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: MANIFEST_URL,
    buttonRootId: null,
    uiPreferences: { 
      theme: "SYSTEM"
    },
    storage,
    restoreConnection: true,
    actionsConfiguration: {
      twaReturnUrl: 'https://t.me'
    }
  });

  window.__wtTonConnect = tc;
  window.dispatchEvent(new Event("wt-tc-ready"));

  // ====== ЗАГРУЗКА БАЛАНСА КОШЕЛЬКА ======
  async function fetchWalletBalance() {
    if (!tc.account) return null;
    
    try {
      const address = tc.account.address;
      console.log('[deposit] Fetching balance for:', address);
      
      const response = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
      const data = await response.json();
      
      if (data.ok && data.result) {
        const balance = fromNano(data.result);
        console.log('[deposit] Wallet balance:', balance, 'TON');
        return balance;
      }
      
      return null;
    } catch (error) {
      console.error('[deposit] Error fetching wallet balance:', error);
      return null;
    }
  }

  // ====== ОБНОВЛЕНИЕ БАЛАНСА ======
  async function updateWalletBalance() {
    if (!walletBalanceEl) return;
    
    const currentCurrency = getCurrentCurrency();
    if (currentCurrency !== 'ton') {
      return; // Баланс только для TON
    }
    
    if (!tc.account) {
      walletBalanceEl.textContent = '—';
      return;
    }
    
    walletBalanceEl.textContent = 'Loading...';
    const balance = await fetchWalletBalance();
    
    if (balance !== null) {
      walletBalanceEl.textContent = `${balance} TON`;
    } else {
      walletBalanceEl.textContent = 'Error';
    }
  }

  // ====== ОБНОВЛЕНИЕ КОНТЕНТА SHEET ======
  function updateSheetContent() {
    const currentCurrency = getCurrentCurrency();
    const connected = !!tc.account;
    
    console.log('[deposit] Updating sheet content. Currency:', currentCurrency, 'Connected:', connected);
    
    if (currentCurrency === 'ton') {
      // TON режим
      if (sheetTitle) sheetTitle.textContent = 'Deposit WildGift Balance';
      if (sheetSub) {
        sheetSub.innerHTML = `Minimum deposit <b>${MIN_DEPOSIT_TON} TON</b>`;
      }
      if (depInput) {
        const icon = depInput.querySelector('.dep-input__icon');
        if (icon) icon.src = '/icons/ton.svg';
      }
      if (amountInput) {
        amountInput.placeholder = '0 TON';
        amountInput.inputMode = 'decimal';
      }
      if (depHint) {
        depHint.textContent = 'Enter amount and confirm in your wallet';
      }
      
      // Показываем баланс кошелька
      if (walletBalanceDisplay) {
        walletBalanceDisplay.style.display = 'flex';
        updateWalletBalance();
      }
      
    } else {
      // STARS режим
      if (sheetTitle) sheetTitle.textContent = 'Top Up Stars Balance';
      if (sheetSub) {
        sheetSub.innerHTML = `Minimum top up <b>${MIN_DEPOSIT_STARS} ⭐</b>`;
      }
      if (depInput) {
        const icon = depInput.querySelector('.dep-input__icon');
        if (icon) icon.src = '/icons/stars.svg';
      }
      if (amountInput) {
        amountInput.placeholder = '0 ⭐';
        amountInput.inputMode = 'numeric';
      }
      if (depHint) {
        depHint.textContent = 'Enter amount and confirm payment';
      }
      
      // Скрываем баланс кошелька
      if (walletBalanceDisplay) {
        walletBalanceDisplay.style.display = 'none';
      }
    }
  }

  // ====== ОБРАБОТЧИК КЛИКА НА TON PILL ======
  tonPill?.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const currentCurrency = getCurrentCurrency();
    console.log('[deposit] TON pill clicked. Currency:', currentCurrency, 'Connected:', !!tc.account);
    
    // Всегда открываем deposit sheet
    openSheet();
  });

  // Следим за изменением статуса
  tc.onStatusChange(async (wallet) => {
    console.log('[deposit] TonConnect status changed:', wallet ? 'connected' : 'disconnected');
    if (wallet) {
      console.log('[deposit] Wallet connected:', wallet.account.address);
      await updateWalletBalance();
    }
    renderUI();
  });

  // ====== ОТКРЫТИЕ МОДАЛКИ TONCONNECT ======
  async function openWalletModal() {
    try {
      console.log('[deposit] Opening TonConnect modal...');
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
      
      if (tg && tg.openLink) {
        await tc.connectWallet();
      } else {
        await tc.openModal();
      }
      
      console.log('[deposit] Wallet connection initiated');
      
    } catch (e) {
      console.error("[deposit] Connection error:", e);
      
      const errorMsg = e.message || 'Failed to connect wallet. Please try again.';
      if (tg?.showAlert) {
        tg.showAlert(errorMsg);
      } else {
        alert(errorMsg);
      }
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
    }
  }

  btnConnect?.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log('[deposit] Connect button clicked');
    await openWalletModal();
  });

  // ====== ОТПРАВКА УВЕДОМЛЕНИЯ В БОТ ======
  async function notifyBot(amount, currency, txHash = null) {
    try {
      const response = await fetch("/api/deposit-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount,
          currency,
          initData,
          userId: tgUserId,
          txHash,
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        console.log('[deposit] Bot notification sent successfully');
      } else {
        console.warn('[deposit] Bot notification failed:', await response.text());
      }
    } catch (error) {
      console.error('[deposit] Error sending bot notification:', error);
    }
  }

  function getCurrentCurrency() {
    return window.WildTimeCurrency?.current || 'ton';
  }

  // ====== STARS PAYMENT ======
  async function processStarsPayment(amount) {
    if (!tg?.openInvoice) {
      console.error('[deposit] Telegram WebApp openInvoice not available');
      if (tg?.showAlert) {
        tg.showAlert('Stars payment is only available in Telegram');
      }
      return false;
    }

    try {
      console.log('[deposit] Creating Stars invoice for amount:', amount);

      // Запрос на создание invoice на сервере
      const response = await fetch('/api/create-stars-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          userId: tgUserId,
          initData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }

      const data = await response.json();
      
      if (!data.ok || !data.invoiceLink) {
        throw new Error(data.error || 'Invalid invoice response');
      }

      console.log('[deposit] Opening invoice:', data.invoiceLink);

      // Открываем invoice в Telegram
      tg.openInvoice(data.invoiceLink, (status) => {
        console.log('[deposit] Invoice status:', status);
        
        if (status === 'paid') {
          console.log('[deposit] Payment successful!');
          
          // Уведомляем бот
          notifyBot(amount, 'stars', data.invoiceId);
          
          if (tg?.showPopup) {
            tg.showPopup({
              title: '✅ Payment Successful',
              message: `You've topped up ${amount} ⭐ Stars!`,
              buttons: [{ type: 'ok' }]
            });
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
            amountInput.value = '';
            closeSheet();
          }, 1500);

          return true;
          
        } else if (status === 'cancelled') {
          console.log('[deposit] Payment cancelled by user');
          
          if (tg?.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('warning');
          }
          
        } else if (status === 'failed') {
          console.error('[deposit] Payment failed');
          
          if (tg?.showAlert) {
            tg.showAlert('Payment failed. Please try again.');
          }
          
          if (tg?.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
          }
        }
        
        return false;
      });

      return true;

    } catch (error) {
      console.error('[deposit] Stars payment error:', error);
      
      if (tg?.showAlert) {
        tg.showAlert(error.message || 'Failed to process payment');
      }
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
      
      return false;
    }
  }

  // ====== DEPOSIT BUTTON CLICK ======
  btnDeposit?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentCurrency = getCurrentCurrency();
    
    console.log('[deposit] Deposit button clicked. Currency:', currentCurrency);
    
    if (currentCurrency === 'stars') {
      // ====== STARS PAYMENT ======
      const val = parseInt(amountInput?.value) || 0;
      
      console.log('[deposit] Stars payment. Amount:', val);
      
      if (val < MIN_DEPOSIT_STARS) {
        const msg = `Minimum top up is ${MIN_DEPOSIT_STARS} ⭐`;
        console.warn('[deposit]', msg);
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }

      const old = btnDeposit.textContent;
      btnDeposit.disabled = true;
      btnDeposit.textContent = "Opening payment...";
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }

      const success = await processStarsPayment(val);

      if (!success) {
        btnDeposit.textContent = old || "Top Up";
        btnDeposit.disabled = false;
      }
      
    } else {
      // ====== TON PAYMENT ======
      const val = normalize(amountInput?.value);
      
      console.log('[deposit] TON deposit. Amount:', val, 'Connected:', !!tc.account);
      
      if (!tc.account) {
        console.log('[deposit] Wallet not connected, opening modal...');
        await openWalletModal();
        return;
      }
      
      if (!(val >= MIN_DEPOSIT_TON)) {
        const msg = `Minimum deposit is ${MIN_DEPOSIT_TON} TON`;
        console.warn('[deposit]', msg);
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }
      
      if (!PROJECT_TON_ADDRESS || /_{5,}/.test(PROJECT_TON_ADDRESS)) {
        const msg = "Project TON address is not configured";
        console.error('[deposit]', msg);
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }

      const tx = {
        validUntil: Math.floor(Date.now()/1000) + 600,
        messages: [{ 
          address: PROJECT_TON_ADDRESS, 
          amount: toNanoStr(val)
        }]
      };

      console.log('[deposit] Sending TON transaction:', tx);

      const old = btnDeposit.textContent;
      btnDeposit.disabled = true;
      btnDeposit.textContent = "Opening wallet…";
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
      
      try {
        const result = await tc.sendTransaction(tx);
        console.log('[deposit] Transaction sent:', result);
        
        btnDeposit.textContent = "Processing…";

        await notifyBot(val, 'ton', result?.boc || null);

        if (tg?.showPopup) {
          tg.showPopup({
            title: '✅ Deposit Sent',
            message: `Your deposit of ${val} TON is being processed. You'll receive a notification when it's confirmed.`,
            buttons: [{ type: 'ok' }]
          });
        } else if (tg?.showAlert) {
          tg.showAlert(`Deposit of ${val} TON is being processed!`);
        }

        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }

        setTimeout(()=>{
          window.dispatchEvent(new CustomEvent('balance:update', {
            detail: { ton: val }
          }));
        }, 2000);

        setTimeout(()=>{
          btnDeposit.textContent = old || "Deposit Now";
          btnDeposit.disabled = false;
          amountInput.value = '';
          closeSheet();
        }, 1500);
        
      } catch (e) {
        console.error("[deposit] sendTransaction error:", e);
        
        const errorMsg = e.message || 'Transaction failed. Please try again.';
        if (tg?.showAlert) {
          tg.showAlert(errorMsg);
        } else {
          alert(errorMsg);
        }
        
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
        
        btnDeposit.textContent = old || "Deposit Now";
        btnDeposit.disabled = false;
      }
    }
  });

  // ====== UI СОСТОЯНИЯ ======
  function renderUI(){
    const currentCurrency = getCurrentCurrency();
    const connected = !!tc.account;
    
    console.log('[deposit] Rendering UI. Currency:', currentCurrency, 'Connected:', connected);
    
    if (currentCurrency === 'ton') {
      // TON режим
      // Кнопка Connect видна только если НЕ подключен
      if (btnConnect) {
        btnConnect.style.display = connected ? "none" : "";
      }
      
      const val = normalize(amountInput?.value);
      if (btnDeposit) {
        btnDeposit.textContent = "Deposit Now";
        btnDeposit.disabled = !(connected && val >= MIN_DEPOSIT_TON);
      }
      
    } else {
      // STARS режим
      // Кнопка Connect всегда скрыта
      if (btnConnect) {
        btnConnect.style.display = "none";
      }
      
      const val = parseInt(amountInput?.value) || 0;
      if (btnDeposit) {
        btnDeposit.textContent = "Top Up";
        btnDeposit.disabled = val < MIN_DEPOSIT_STARS;
      }
    }
  }

  // Слушаем изменение валюты
  window.addEventListener('currency:changed', () => {
    console.log('[deposit] Currency changed, updating UI');
    updateSheetContent();
    renderUI();
  });

  // Первичная инициализация
  renderUI();
  
  console.log('[deposit] Deposit module initialized');
})();