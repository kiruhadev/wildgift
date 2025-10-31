// public/js/deposit.js - ВЕРСИЯ 3.1 с подробным логированием
(() => {
  // ====== КОНФИГ ======
  const MANIFEST_URL = `${location.origin}/tonconnect-manifest.json`;
  const PROJECT_TON_ADDRESS = "UQCtVhhBFPBvCoT8H7szNQUhEvHgbvnX50r8v6d8y5wdr19J";
  const MIN_DEPOSIT_TON = 0.1;
  const MIN_DEPOSIT_STARS = 1;

  // ====== DOM ======
  const sheet        = document.getElementById("depositSheet");
  const backdrop     = sheet?.querySelector(".sheet__backdrop");
  const btnClose     = document.getElementById("depClose");
  const amountInput  = document.getElementById("depAmount");
  const btnConnect   = document.getElementById("btnConnectWallet");
  const btnDeposit   = document.getElementById("btnDepositNow");
  const tonPill      = document.getElementById("tonPill");
  const walletBalanceEl = document.getElementById("walletBalance");
  
  const sheetTitle = sheet?.querySelector(".sheet__title");
  const sheetSub = sheet?.querySelector(".sheet__sub");
  const depInput = sheet?.querySelector(".dep-input");
  const depHint = sheet?.querySelector(".dep-hint");
  const walletBalanceDisplay = sheet?.querySelector(".wallet-balance-display");

  // ====== helpers ======
  const tg = window.Telegram?.WebApp;
  const tgUserId = tg?.initDataUnsafe?.user?.id || "guest";
  const initData = tg?.initData || "";

  console.log('[deposit] Initializing. User ID:', tgUserId);

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
    console.log('[deposit] 📂 Opening sheet. Connected:', !!tc?.account);
    updateSheetContent();
    renderUI(); // ВАЖНО: Обновляем UI при каждом открытии!
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
      amountInput.value = amountInput.value.replace(/[^0-9]/g, "");
    } else {
      amountInput.value = amountInput.value
        .replace(",", ".").replace(/[^0-9.]/g,"").replace(/^(\d*\.\d*).*$/, "$1");
    }
    
    try { amountInput.setSelectionRange(caret, caret); } catch {}
    renderUI();
  });

  // ====== TonConnect UI ======
  cleanupOldTonConnectKeys();
  
  if (!window.TON_CONNECT_UI) {
    console.error("[deposit] ❌ TonConnect UI not loaded!");
    console.error("[deposit] Check if TonConnect script is included in HTML");
    return;
  }

  const storage = makeScopedStorage(`${tgUserId}:tc`);
  
  console.log('[deposit] ✅ Initializing TonConnect');
  console.log('[deposit] Manifest URL:', MANIFEST_URL);
  console.log('[deposit] Project address:', PROJECT_TON_ADDRESS);
  
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
  
  console.log('[deposit] ✅ TonConnect initialized');

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
        console.log('[deposit] ✅ Wallet balance:', balance, 'TON');
        return balance;
      }
      
      return null;
    } catch (error) {
      console.error('[deposit] ❌ Error fetching wallet balance:', error);
      return null;
    }
  }

  async function updateWalletBalance() {
    if (!walletBalanceEl) return;
    
    const currentCurrency = getCurrentCurrency();
    if (currentCurrency !== 'ton') {
      return;
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
    
    console.log('[deposit] Updating sheet. Currency:', currentCurrency, 'Connected:', connected);
    
    if (currentCurrency === 'ton') {
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
      
      if (walletBalanceDisplay) {
        walletBalanceDisplay.style.display = 'flex';
        updateWalletBalance();
      }
      
    } else {
      if (sheetTitle) sheetTitle.textContent = 'Buy Telegram Stars';
      if (sheetSub) {
        sheetSub.innerHTML = `Minimum purchase <b>${MIN_DEPOSIT_STARS} ⭐</b>`;
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
      
      if (walletBalanceDisplay) {
        walletBalanceDisplay.style.display = 'none';
      }
    }
  }

  tonPill?.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log('[deposit] 🔘 TON pill clicked');
    openSheet();
  });

  tc.onStatusChange(async (wallet) => {
    if (wallet) {
      console.log('[deposit] ✅ Wallet connected:', wallet.account.address);
      await updateWalletBalance();
    } else {
      console.log('[deposit] ❌ Wallet disconnected');
    }
    renderUI();
  });

  // ====== ОТКРЫТИЕ МОДАЛКИ TONCONNECT ======
  async function openWalletModal() {
    try {
      console.log('[deposit] 🔓 Opening TonConnect modal...');
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
      
      await tc.openModal();
      
      console.log('[deposit] ✅ Modal opened');
      
    } catch (e) {
      console.error("[deposit] ❌ Connection error:", e);
      
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
    console.log('[deposit] 🔘 Connect button clicked');
    await openWalletModal();
  });

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
        console.log('[deposit] ✅ Bot notification sent');
      } else {
        console.warn('[deposit] ⚠️ Bot notification failed:', await response.text());
      }
    } catch (error) {
      console.error('[deposit] ❌ Error sending bot notification:', error);
    }
  }

  function getCurrentCurrency() {
    return window.WildTimeCurrency?.current || 'ton';
  }

  // ====== DEPOSIT BUTTON - ГЛАВНАЯ ЛОГИКА ======
  btnDeposit?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentCurrency = getCurrentCurrency();
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🔘 DEPOSIT BUTTON CLICKED');
    console.log('Currency:', currentCurrency);
    console.log('Wallet connected:', !!tc.account);
    if (tc.account) {
      console.log('Wallet address:', tc.account.address);
    }
    console.log('═══════════════════════════════════════');
    
    if (currentCurrency === 'stars') {
      console.log('[deposit] ⭐ STARS payment flow - handled by switch.js');
      // Stars обрабатывается в switch.js
      return;
    }
    
    // ====== TON PAYMENT ======
    console.log('[deposit] 💎 TON payment flow started');
    
    const val = normalize(amountInput?.value);
    console.log('[deposit] Amount:', val, 'TON');
    
    // Проверка 1: Подключен ли кошелёк
    if (!tc.account) {
      console.log('[deposit] ❌ Wallet not connected');
      console.log('[deposit] Opening wallet modal...');
      await openWalletModal();
      return;
    }
    
    console.log('[deposit] ✅ Wallet connected:', tc.account.address);
    
    // Проверка 2: Минимальная сумма
    if (!(val >= MIN_DEPOSIT_TON)) {
      const msg = `Minimum deposit is ${MIN_DEPOSIT_TON} TON`;
      console.warn('[deposit] ❌', msg);
      if (tg?.showAlert) {
        tg.showAlert(msg);
      } else {
        alert(msg);
      }
      return;
    }
    
    console.log('[deposit] ✅ Amount valid');
    
    // Проверка 3: Адрес проекта
    if (!PROJECT_TON_ADDRESS || /_{5,}/.test(PROJECT_TON_ADDRESS)) {
      const msg = "Project TON address is not configured";
      console.error('[deposit] ❌', msg);
      console.error('[deposit] Current address:', PROJECT_TON_ADDRESS);
      if (tg?.showAlert) {
        tg.showAlert(msg);
      } else {
        alert(msg);
      }
      return;
    }
    
    console.log('[deposit] ✅ Project address valid:', PROJECT_TON_ADDRESS);

    // Формируем транзакцию
    const nanoAmount = toNanoStr(val);
    const tx = {
      validUntil: Math.floor(Date.now()/1000) + 600,
      messages: [{ 
        address: PROJECT_TON_ADDRESS, 
        amount: nanoAmount
      }]
    };

    console.log('[deposit] 📦 Transaction prepared:');
    console.log('  To:', PROJECT_TON_ADDRESS);
    console.log('  Amount:', val, 'TON');
    console.log('  Amount (nano):', nanoAmount);
    console.log('  Valid until:', new Date(tx.validUntil * 1000).toISOString());

    const old = btnDeposit.textContent;
    btnDeposit.disabled = true;
    btnDeposit.textContent = "Opening wallet…";
    
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
    
    try {
      console.log('[deposit] 🚀 Sending transaction...');
      console.log('[deposit] Calling tc.sendTransaction()...');
      
      const result = await tc.sendTransaction(tx);
      
      console.log('[deposit] ✅ Transaction sent!');
      console.log('[deposit] Result:', result);
      
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
      console.error("");
      console.error("❌❌❌ TRANSACTION ERROR ❌❌❌");
      console.error("Error message:", e.message);
      console.error("Error code:", e.code);
      console.error("Error stack:", e.stack);
      console.error("Error object:", e);
      console.error("❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌");
      console.error("");
      
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
  });

  // ====== UI СОСТОЯНИЯ ======
  function renderUI(){
    const currentCurrency = getCurrentCurrency();
    const connected = !!tc.account;
    console.log('[deposit] 🎨 renderUI: currency=', currentCurrency, 'connected=', connected);
    
    if (currentCurrency === 'ton') {
      if (btnConnect) {
        btnConnect.style.display = connected ? "none" : "";
      }
      
      const val = normalize(amountInput?.value);
      if (btnDeposit) {
        btnDeposit.textContent = "Deposit Now";
        btnDeposit.disabled = !(connected && val >= MIN_DEPOSIT_TON);
      }
      
    } else {
      if (btnConnect) {
        btnConnect.style.display = "none";
      }
      
      const val = parseInt(amountInput?.value) || 0;
      if (btnDeposit) {
        btnDeposit.textContent = "Buy Stars";
        btnDeposit.disabled = val < MIN_DEPOSIT_STARS;
      }
    }
  }

  window.addEventListener('currency:changed', () => {
    console.log('[deposit] Currency changed');
    updateSheetContent();
    renderUI();
  });

  renderUI();
  
  console.log('[deposit] ✅ Deposit module initialized');
  console.log('[deposit] TonConnect ready:', !!tc);
  console.log('[deposit] Wallet connected:', !!tc.account);
})();