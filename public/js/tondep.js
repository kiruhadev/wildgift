// public/js/tondep.js - Simple TON Deposit v2.0
(() => {
    console.log('[TON] 🚀 Initializing TON deposit module');
  
    // ====== КОНФИГ ======
    const MANIFEST_URL = `${location.origin}/tonconnect-manifest.json`;
    const PROJECT_TON_ADDRESS = "UQCtVhhBFPBvCoT8H7szNQUhEvHgbvnX50r8v6d8y5wdr19J"; // ← ЗАМЕНИТЕ!
    const MIN_DEPOSIT_TON = 0.1;
    const DEPOSIT_AMOUNT = 1.0; // Фиксированная сумма депозита
  
    // ====== DOM ======
    const tonPill = document.getElementById("tonPill");
    const tonAmount = document.getElementById("tonAmount");
    
    const popup = document.getElementById("tonDepositPopup");
    const backdrop = popup?.querySelector(".ton-popup__backdrop");
    const btnClose = document.getElementById("tonPopupClose");
    
    const bigBalance = document.getElementById("tonBigBalance");
    const walletBalance = document.getElementById("tonWalletBalance");
    
    const btnConnect = document.getElementById("btnConnectWallet");
    const btnDeposit = document.getElementById("btnDepositTon");
  
    if (!popup) {
      console.error('[TON] ❌ tonDepositPopup not found!');
      return;
    }
  
    // ====== TELEGRAM ======
    const tg = window.Telegram?.WebApp;
    const tgUserId = tg?.initDataUnsafe?.user?.id || "guest";
    const initData = tg?.initData || "";
  
    // ====== СОСТОЯНИЕ ======
    let currentBalance = 0; // Баланс на платформе
    let currentWalletBalance = null; // Баланс кошелька
  
    // ====== HELPERS ======
    function makeScopedStorage(prefix) {
      return {
        getItem: (k) => localStorage.getItem(`${prefix}:${k}`),
        setItem: (k, v) => localStorage.setItem(`${prefix}:${k}`, v),
        removeItem: (k) => localStorage.removeItem(`${prefix}:${k}`)
      };
    }
  
    function toNanoStr(amount) {
      const s = String(amount).replace(",", ".");
      const [i = "0", f = ""] = s.split(".");
      const frac9 = (f + "000000000").slice(0, 9);
      return (BigInt(i || "0") * 1_000_000_000n + BigInt(frac9)).toString();
    }
  
    function fromNano(nanoStr) {
      const nano = BigInt(nanoStr);
      const ton = Number(nano) / 1_000_000_000;
      return ton.toFixed(2);
    }
  
    // ====== POPUP ======
    function openPopup() {
      console.log('[TON] 📂 Opening popup');
      popup.classList.add('ton-popup--open');
      updateUI();
      
      if (tc.account) {
        fetchWalletBalance();
      }
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    }
  
    function closePopup() {
      console.log('[TON] 📁 Closing popup');
      popup.classList.remove('ton-popup--open');
    }
  
    backdrop?.addEventListener('click', closePopup);
    btnClose?.addEventListener('click', closePopup);
  
    tonPill?.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[TON] 🔘 TON pill clicked');
      openPopup();
    });
  
    // ====== TONCONNECT ======
    if (!window.TON_CONNECT_UI) {
      console.error('[TON] ❌ TonConnect UI not loaded!');
      return;
    }
  
    const storage = makeScopedStorage(`${tgUserId}:tc`);
  
    console.log('[TON] ✅ Creating TonConnect instance');
  
    const tc = new TON_CONNECT_UI.TonConnectUI({
      manifestUrl: MANIFEST_URL,
      buttonRootId: null,
      uiPreferences: { theme: "SYSTEM" },
      storage,
      restoreConnection: true,
      actionsConfiguration: { twaReturnUrl: 'https://t.me' }
    });
  
    window.__wtTonConnect = tc;
    console.log('[TON] ✅ TonConnect ready');
  
    // ====== БАЛАНС КОШЕЛЬКА ======
    async function fetchWalletBalance() {
      if (!tc.account) {
        walletBalance.textContent = '—';
        return;
      }
  
      try {
        walletBalance.textContent = 'Loading...';
        
        const address = tc.account.address;
        const response = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
        const data = await response.json();
  
        if (data.ok && data.result) {
          const balance = fromNano(data.result);
          currentWalletBalance = balance;
          walletBalance.textContent = `${balance} TON`;
          console.log('[TON] ✅ Wallet balance:', balance);
        } else {
          walletBalance.textContent = 'Error';
        }
      } catch (error) {
        console.error('[TON] ❌ Balance error:', error);
        walletBalance.textContent = 'Error';
      }
    }
  
    // ====== ОБНОВЛЕНИЕ БАЛАНСА ПЛАТФОРМЫ ======
    function updatePlatformBalance(balance) {
      currentBalance = balance;
      
      // Обновить в topbar
      if (tonAmount) {
        tonAmount.textContent = balance.toFixed(2);
      }
      
      // Обновить в popup
      if (bigBalance) {
        bigBalance.textContent = Math.floor(balance);
      }
      
      console.log('[TON] 💰 Platform balance updated:', balance);
    }
  
    // ====== СЛУШАТЕЛЬ СТАТУСА КОШЕЛЬКА ======
    tc.onStatusChange(async (wallet) => {
      if (wallet) {
        console.log('[TON] ✅ Wallet connected:', wallet.account.address);
        await fetchWalletBalance();
      } else {
        console.log('[TON] ❌ Wallet disconnected');
        currentWalletBalance = null;
        if (walletBalance) {
          walletBalance.textContent = '—';
        }
      }
      updateUI();
    });
  
    // ====== UI ОБНОВЛЕНИЕ ======
    function updateUI() {
      const connected = !!tc.account;
      
      console.log('[TON] 🎨 Updating UI. Connected:', connected);
      
      if (btnConnect) {
        btnConnect.style.display = connected ? 'none' : 'block';
      }
      
      if (btnDeposit) {
        btnDeposit.style.display = connected ? 'block' : 'none';
      }
    }
  
    // ====== ПОДКЛЮЧЕНИЕ КОШЕЛЬКА ======
    btnConnect?.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[TON] 🔌 Connect button clicked');
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
      
      try {
        btnConnect.textContent = 'Connecting...';
        btnConnect.disabled = true;
        
        await tc.openModal();
        
        console.log('[TON] ✅ Wallet modal opened');
        
      } catch (error) {
        console.error('[TON] ❌ Connection error:', error);
        
        if (tg?.showAlert) {
          tg.showAlert('Failed to connect wallet. Please try again.');
        }
      } finally {
        btnConnect.textContent = 'Connect Wallet';
        btnConnect.disabled = false;
      }
    });
  
    // ====== УВЕДОМЛЕНИЕ СЕРВЕРА ======
    async function notifyServer(amount, txHash) {
      try {
        const response = await fetch('/api/deposit-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            currency: 'ton',
            userId: tgUserId,
            initData,
            txHash,
            timestamp: Date.now()
          })
        });
  
        if (response.ok) {
          console.log('[TON] ✅ Server notified');
          return true;
        } else {
          console.warn('[TON] ⚠️ Server notification failed');
          return false;
        }
      } catch (error) {
        console.error('[TON] ❌ Server notification error:', error);
        return false;
      }
    }
  
    // ====== ДЕПОЗИТ ======
    btnDeposit?.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[TON] 💎 Deposit button clicked');
  
      if (!tc.account) {
        console.warn('[TON] Not connected');
        return;
      }
  
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
  
      const amount = DEPOSIT_AMOUNT;
  
      // Подготовка транзакции
      const nanoAmount = toNanoStr(amount);
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{
          address: PROJECT_TON_ADDRESS,
          amount: nanoAmount
        }]
      };
  
      console.log('[TON] 📦 Transaction:', {
        to: PROJECT_TON_ADDRESS,
        amount: amount + ' TON',
        nano: nanoAmount
      });
  
      const oldText = btnDeposit.textContent;
      btnDeposit.disabled = true;
      btnDeposit.textContent = 'Opening wallet...';
  
      try {
        console.log('[TON] 🚀 Sending transaction...');
  
        const result = await tc.sendTransaction(tx);
  
        console.log('[TON] ✅ Transaction sent!');
        console.log('[TON] Result:', result);
  
        btnDeposit.textContent = 'Processing...';
  
        // Уведомить сервер
        await notifyServer(amount, result?.boc || null);
  
        // Показать успех
        if (tg?.showPopup) {
          tg.showPopup({
            title: '✅ Deposit Sent',
            message: `Your deposit of ${amount} TON is being processed.`,
            buttons: [{ type: 'ok' }]
          });
        } else if (tg?.showAlert) {
          tg.showAlert(`✅ Deposit of ${amount} TON sent!`);
        }
  
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }
  
        // Обновить баланс (оптимистично)
        updatePlatformBalance(currentBalance + amount);
  
        // Закрыть popup
        setTimeout(() => {
          closePopup();
          btnDeposit.textContent = oldText;
          btnDeposit.disabled = false;
        }, 1500);
  
      } catch (error) {
        console.error('[TON] ❌ Transaction error:', error);
  
        let errorMsg = 'Transaction failed. Please try again.';
        
        if (error.message.includes('cancel')) {
          errorMsg = 'Transaction cancelled';
        } else if (error.message.includes('insufficient')) {
          errorMsg = 'Insufficient balance in wallet';
        }
  
        if (tg?.showAlert) {
          tg.showAlert(errorMsg);
        }
  
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
  
        btnDeposit.textContent = oldText;
        btnDeposit.disabled = false;
      }
    });
  
    // ====== ЗАГРУЗКА БАЛАНСА ИЗ API ======
    async function loadPlatformBalance() {
      try {
        const response = await fetch(`/api/balance?userId=${tgUserId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.ton !== undefined) {
            updatePlatformBalance(data.ton);
          }
        }
      } catch (error) {
        console.error('[TON] ❌ Failed to load balance:', error);
      }
    }
  
    // ====== СОБЫТИЯ ======
    window.addEventListener('balance:update', (e) => {
      if (e.detail?.ton !== undefined) {
        updatePlatformBalance(e.detail.ton);
      }
    });
  
    // ====== ИНИЦИАЛИЗАЦИЯ ======
    updateUI();
    loadPlatformBalance();
  
    console.log('[TON] ✅ Module initialized');
    console.log('[TON] Connected:', !!tc.account);
  
    // ====== ЭКСПОРТ ======
    window.WTTonDeposit = {
      openPopup,
      closePopup,
      updateBalance: updatePlatformBalance,
      isConnected: () => !!tc.account,
      getBalance: () => currentBalance
    };
  })();
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  