// public/js/tondep.js - TON Deposit Module
(() => {
    console.log('[TON] 🚀 Initializing TON deposit module');
  
    // ====== КОНФИГ ======
    const MANIFEST_URL = `${location.origin}/tonconnect-manifest.json`;
    const PROJECT_TON_ADDRESS = "UQCtVhhBFPBvCoT8H7szNQUhEvHgbvnX50r8v6d8y5wdr19J";
    const MIN_DEPOSIT_TON = 0.1;
  
    // ====== DOM ======
    const sheet = document.getElementById("tonDepositSheet");
    if (!sheet) {
      console.warn('[TON] ⚠️ tonDepositSheet not found in DOM');
      return;
    }
  
    const backdrop = sheet.querySelector(".sheet__backdrop");
    const btnClose = document.getElementById("tonDepClose");
    const amountInput = document.getElementById("tonDepAmount");
    const btnConnect = document.getElementById("btnConnectTonWallet");
    const btnDeposit = document.getElementById("btnDepositTonNow");
    const tonPill = document.getElementById("tonPill");
    const walletBalanceEl = document.getElementById("tonWalletBalance");
    const walletBalanceDisplay = sheet.querySelector(".wallet-balance-display");
  
    // ====== HELPERS ======
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
      bad.forEach((k) => localStorage.removeItem(k));
      for (let i = 0; i < localStorage.length; i++) {
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
      const [i = "0", f = ""] = s.split(".");
      const frac9 = (f + "000000000").slice(0, 9);
      return (BigInt(i || "0") * 1_000_000_000n + BigInt(frac9)).toString();
    }
  
    function fromNano(nanoStr) {
      const nano = BigInt(nanoStr);
      const ton = Number(nano) / 1_000_000_000;
      return ton.toFixed(2);
    }
  
    function openSheet() {
      console.log('[TON] 📂 Opening sheet. Connected:', !!tc?.account);
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
      amountInput.value = amountInput.value
        .replace(",", ".").replace(/[^0-9.]/g, "").replace(/^(\d*\.\d*).*$/, "$1");
      try { amountInput.setSelectionRange(caret, caret); } catch {}
      renderUI();
    });
  
    // ====== TONCONNECT UI ======
    cleanupOldTonConnectKeys();
  
    if (!window.TON_CONNECT_UI) {
      console.error("[TON] ❌ TonConnect UI not loaded!");
      return;
    }
  
    const storage = makeScopedStorage(`${tgUserId}:tc`);
  
    console.log('[TON] ✅ Initializing TonConnect');
    console.log('[TON] Manifest URL:', MANIFEST_URL);
  
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
  
    console.log('[TON] ✅ TonConnect initialized');
  
    // ====== БАЛАНС КОШЕЛЬКА ======
    async function fetchWalletBalance() {
      if (!tc.account) return null;
  
      try {
        const address = tc.account.address;
        console.log('[TON] 💰 Fetching balance for:', address);
  
        const response = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
        const data = await response.json();
  
        if (data.ok && data.result) {
          const balance = fromNano(data.result);
          console.log('[TON] ✅ Balance:', balance, 'TON');
          return balance;
        }
  
        return null;
      } catch (error) {
        console.error('[TON] ❌ Error fetching balance:', error);
        return null;
      }
    }
  
    async function updateWalletBalance() {
      if (!walletBalanceEl) return;
  
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
  
    // ====== КЛИК НА TON PILL ======
    tonPill?.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log('[TON] 🔘 TON pill clicked');
      openSheet();
      if (tc.account) {
        await updateWalletBalance();
      }
    });
  
    // ====== СЛЕЖЕНИЕ ЗА СТАТУСОМ ======
    tc.onStatusChange(async (wallet) => {
      if (wallet) {
        console.log('[TON] ✅ Wallet connected:', wallet.account.address);
        await updateWalletBalance();
      } else {
        console.log('[TON] ❌ Wallet disconnected');
      }
      renderUI();
    });
  
    // ====== ПОДКЛЮЧЕНИЕ КОШЕЛЬКА ======
    async function openWalletModal() {
      try {
        console.log('[TON] 🔌 Opening wallet modal...');
  
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.impactOccurred('medium');
        }
  
        if (tg && tg.openLink) {
          await tc.connectWallet();
        } else {
          await tc.openModal();
        }
  
        console.log('[TON] ✅ Wallet connection initiated');
  
      } catch (e) {
        console.error("[TON] ❌ Connection error:", e);
  
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
      console.log('[TON] Connect button clicked');
      await openWalletModal();
    });
  
    // ====== ОТПРАВКА УВЕДОМЛЕНИЯ В БОТ ======
    async function notifyBot(amount, txHash = null) {
      try {
        const response = await fetch("/api/deposit-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            currency: 'ton',
            initData,
            userId: tgUserId,
            txHash,
            timestamp: Date.now()
          })
        });
  
        if (response.ok) {
          console.log('[TON] ✅ Bot notified');
        } else {
          console.warn('[TON] ⚠️ Bot notification failed');
        }
      } catch (error) {
        console.error('[TON] ❌ Bot notification error:', error);
      }
    }
  
    // ====== ДЕПОЗИТ ======
    btnDeposit?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
  
      const val = normalize(amountInput?.value);
  
      console.log('[TON] 💎 Deposit clicked. Amount:', val, 'Connected:', !!tc.account);
  
      // Проверка подключения
      if (!tc.account) {
        console.log('[TON] Wallet not connected, opening modal...');
        await openWalletModal();
        return;
      }
  
      // Проверка минимальной суммы
      if (!(val >= MIN_DEPOSIT_TON)) {
        const msg = `Minimum deposit is ${MIN_DEPOSIT_TON} TON`;
        console.warn('[TON]', msg);
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }
  
      // Проверка адреса проекта
      if (!PROJECT_TON_ADDRESS || /_{5,}/.test(PROJECT_TON_ADDRESS)) {
        const msg = "Project TON address is not configured";
        console.error('[TON]', msg);
        if (tg?.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }
  
      // Подготовка транзакции
      const nanoAmount = toNanoStr(val);
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{
          address: PROJECT_TON_ADDRESS,
          amount: nanoAmount
        }]
      };
  
      console.log('[TON] 📦 Transaction prepared:');
      console.log('  To:', PROJECT_TON_ADDRESS);
      console.log('  Amount:', val, 'TON');
      console.log('  Amount (nano):', nanoAmount);
  
      const old = btnDeposit.textContent;
      btnDeposit.disabled = true;
      btnDeposit.textContent = "Opening wallet…";
  
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
  
      try {
        console.log('[TON] 🚀 Sending transaction...');
  
        const result = await tc.sendTransaction(tx);
  
        console.log('[TON] ✅ Transaction sent!');
        console.log('[TON] Result:', result);
  
        btnDeposit.textContent = "Processing…";
  
        await notifyBot(val, result?.boc || null);
  
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
  
        // Обновление баланса
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('balance:update', {
            detail: { ton: val }
          }));
        }, 2000);
  
        // Закрытие sheet
        setTimeout(() => {
          btnDeposit.textContent = old || "Deposit Now";
          btnDeposit.disabled = false;
          amountInput.value = '';
          closeSheet();
        }, 1500);
  
      } catch (e) {
        console.error("");
        console.error("❌❌❌ TON TRANSACTION ERROR ❌❌❌");
        console.error("Error message:", e.message);
        console.error("Error code:", e.code);
        console.error("Error stack:", e.stack);
        console.error("❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌");
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
  
    // ====== UI СОСТОЯНИЕ ======
    function renderUI() {
      const connected = !!tc.account;
  
      console.log('[TON] 🎨 renderUI: connected=', connected);
  
      // Кнопка Connect видна только если НЕ подключен
      if (btnConnect) {
        btnConnect.style.display = connected ? "none" : "";
      }
  
      // Кнопка Deposit активна только если подключен и сумма >= минимума
      const val = normalize(amountInput?.value);
      if (btnDeposit) {
        btnDeposit.disabled = !(connected && val >= MIN_DEPOSIT_TON);
      }
  
      // Показываем баланс если подключен
      if (walletBalanceDisplay) {
        walletBalanceDisplay.style.display = connected ? 'flex' : 'none';
      }
    }
  
    // Первичная инициализация
    renderUI();
  
    console.log('[TON] ✅ TON deposit module initialized');
    console.log('[TON] Wallet connected:', !!tc.account);
  
    // Экспорт для использования в других модулях
    window.WTTonDeposit = {
      openSheet,
      closeSheet,
      getTonConnect: () => tc,
      isConnected: () => !!tc.account,
      getBalance: fetchWalletBalance
    };
  })();