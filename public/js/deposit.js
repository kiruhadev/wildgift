// public/js/deposit.js
(() => {
  // ====== КОНФИГ ======
  const MANIFEST_URL = `${location.origin}/tonconnect-manifest.json`;
  const PROJECT_TON_ADDRESS = "UQCtVhhBFPBvCoT8H7szNQUhEvHgbvnX50r8v6d8y5wdr19J";
  const MIN_DEPOSIT = 0.5;

  // ====== DOM ======
  const sheet        = document.getElementById("depositSheet");
  const backdrop     = sheet?.querySelector(".sheet__backdrop");
  const btnClose     = document.getElementById("depClose");
  const amountInput  = document.getElementById("depAmount");
  const btnConnect   = document.getElementById("btnConnectWallet");
  const btnDeposit   = document.getElementById("btnDepositNow");
  const tonPill      = document.getElementById("tonPill");

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

  function openSheet(){ 
    sheet?.classList.add("sheet--open"); 
    // Добавим haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
  }
  
  function closeSheet(){ 
    sheet?.classList.remove("sheet--open"); 
  }

  tonPill?.addEventListener("click", openSheet);
  backdrop?.addEventListener("click", closeSheet);
  btnClose?.addEventListener("click", closeSheet);

  amountInput?.addEventListener("input", ()=>{
    const caret = amountInput.selectionStart;
    amountInput.value = amountInput.value
      .replace(",", ".").replace(/[^0-9.]/g,"").replace(/^(\d*\.\d*).*$/, "$1");
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
    uiPreferences: { theme: "SYSTEM" },
    storage,
    restoreConnection: true
  });

  // Отдадим другим модулям (profile.js)
  window.__wtTonConnect = tc;
  window.dispatchEvent(new Event("wt-tc-ready"));

  // Следим за изменением статуса
  tc.onStatusChange((wallet) => {
    console.log('[deposit] TonConnect status changed:', wallet ? 'connected' : 'disconnected');
    renderUI();
  });

  // Перехват модалки
  async function openWalletModal() {
    try {
      console.log('[deposit] Opening wallet modal...');
      sheet?.classList.add("sheet--below");
      document.documentElement.classList.add("tc-modal-open");
      
      // Добавим haptic feedback
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
      }
      
      await tc.openModal();
      console.log('[deposit] Wallet modal opened');
    } catch (e) {
      console.warn("[deposit] openModal error:", e);
      // Показываем пользователю ошибку
      if (tg?.showAlert) {
        tg.showAlert('Failed to open wallet connection. Please try again.');
      } else {
        alert('Failed to open wallet connection. Please try again.');
      }
    } finally {
      setTimeout(()=>{
        sheet?.classList.remove("sheet--below");
        document.documentElement.classList.remove("tc-modal-open");
      }, 350);
    }
  }

  btnConnect?.addEventListener("click", openWalletModal);

  // ====== ОТПРАВКА УВЕДОМЛЕНИЯ В БОТА ======
  async function notifyBot(amount, txHash = null) {
    try {
      const response = await fetch("/api/deposit-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount, 
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

  // ====== Deposit click ======
  btnDeposit?.addEventListener("click", async ()=>{
    const val = normalize(amountInput?.value);
    
    console.log('[deposit] Deposit button clicked. Amount:', val, 'Connected:', !!tc.account);
    
    if (!tc.account) {
      console.log('[deposit] Wallet not connected, opening modal...');
      await openWalletModal();
      return;
    }
    
    if (!(val >= MIN_DEPOSIT)) {
      const msg = `Minimum deposit is ${MIN_DEPOSIT} TON`;
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

    console.log('[deposit] Sending transaction:', tx);

    const old = btnDeposit.textContent;
    btnDeposit.disabled = true;
    btnDeposit.textContent = "Opening wallet…";
    
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
    
    try {
      const result = await tc.sendTransaction(tx);
      console.log('[deposit] Transaction sent:', result);
      
      btnDeposit.textContent = "Processing…";

      // Отправляем уведомление в бота
      await notifyBot(val, result?.boc || null);

      // Показываем успех пользователю
      if (tg?.showPopup) {
        tg.showPopup({
          title: '✅ Deposit Sent',
          message: `Your deposit of ${val} TON is being processed. You'll receive a notification when it's confirmed.`,
          buttons: [{ type: 'ok' }]
        });
      } else if (tg?.showAlert) {
        tg.showAlert(`Deposit of ${val} TON is being processed!`);
      }

      // Haptic success
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }

      // Обновляем баланс (с задержкой для имитации подтверждения)
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
      
      // Показываем ошибку пользователю
      const errorMsg = e.message || 'Transaction failed. Please try again.';
      if (tg?.showAlert) {
        tg.showAlert(errorMsg);
      } else {
        alert(errorMsg);
      }
      
      // Haptic error
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
      
      btnDeposit.textContent = old || "Deposit Now";
      btnDeposit.disabled = false;
    }
  });

  // ====== UI состояния ======
  function renderUI(){
    const connected = !!tc.account;
    console.log('[deposit] Rendering UI. Connected:', connected);
    
    // показываем или скрываем Connect
    if (btnConnect) {
      btnConnect.style.display = connected ? "none" : "";
    }
    
    // доступность Deposit
    const val = normalize(amountInput?.value);
    if (btnDeposit) {
      btnDeposit.disabled = !(connected && val >= MIN_DEPOSIT);
    }
  }

  // стартовый рендер
  renderUI();
  
  console.log('[deposit] Deposit module initialized');
})();