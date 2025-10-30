/**
 * switch.js - Currency Switch System (TON / Telegram Stars)
 * ИСПРАВЛЕННАЯ ВЕРСИЯ - правильная обработка покупки Stars
 */

(function() {
    'use strict';
  
    // ================== STATE ==================
    let currentCurrency = 'ton'; // 'ton' | 'stars'
    let userBalance = {
      ton: 0,
      stars: 0
    };
  
    // Telegram Web App API
    const tg = window.Telegram?.WebApp;
  
    // ================== INIT ==================
    function init() {
      console.log('[Switch] Initializing currency system...');
      
      loadCurrency();
      initUI();
      attachEventListeners();
      updateBalanceDisplay();
      
      console.log('[Switch] Currency system ready. Current:', currentCurrency);
    }
  
    // ================== UI SETUP ==================
    function initUI() {
      const currencyBtns = document.querySelectorAll('.curr-btn');
      currencyBtns.forEach(btn => {
        const currency = btn.dataset.currency;
        if (currency === currentCurrency) {
          btn.classList.add('curr-btn--active');
        } else {
          btn.classList.remove('curr-btn--active');
        }
      });
    }
  
    // ================== EVENT LISTENERS ==================
    function attachEventListeners() {
      // Переключатели валюты в профиле
      const currencyBtns = document.querySelectorAll('.curr-btn');
      currencyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currency = btn.dataset.currency;
          console.log('[Switch] Currency button clicked:', currency);
          switchCurrency(currency);
        });
        
        btn.style.cursor = 'pointer';
        btn.style.userSelect = 'none';
        btn.style.webkitTapHighlightColor = 'transparent';
      });
  
      // Кнопка депозита в topbar
      const tonPill = document.getElementById('tonPill');
      if (tonPill) {
        tonPill.addEventListener('click', openDepositSheet);
      }
  
      // КРИТИЧНО: Обработчик кнопки Deposit/Buy Stars
      const btnDeposit = document.getElementById('btnDepositNow');
      if (btnDeposit) {
        // Удаляем все предыдущие обработчики (если есть)
        const newBtn = btnDeposit.cloneNode(true);
        btnDeposit.parentNode.replaceChild(newBtn, btnDeposit);
        
        // Добавляем наш обработчик с capture=true
        newBtn.addEventListener('click', handleDepositClick, true);
      }
  
      // Слушаем события баланса от других модулей
      window.addEventListener('balance:update', (e) => {
        if (e.detail) {
          updateBalance(e.detail);
        }
      });
    }
  
    // ================== DEPOSIT BUTTON HANDLER ==================
    function handleDepositClick(e) {
      console.log('[Switch] Deposit button clicked. Current currency:', currentCurrency);
      
      if (currentCurrency === 'stars') {
        // Для Stars - обрабатываем сами и ОСТАНАВЛИВАЕМ propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const input = document.getElementById('depAmount');
        const amount = parseInt(input?.value) || 0;
        
        console.log('[Switch] Handling Stars purchase, amount:', amount);
        buyStarsViaTelegram(amount);
        
        return false;
      }
      
      // Для TON - пропускаем дальше в deposit.js
      console.log('[Switch] TON mode - letting deposit.js handle it');
    }
  
    // ================== CURRENCY SWITCHING ==================
    function switchCurrency(currency) {
      if (currency === currentCurrency) {
        console.log('[Switch] Already on', currency);
        return;
      }
      
      console.log(`[Switch] Switching from ${currentCurrency} to ${currency}`);
      currentCurrency = currency;
      
      saveCurrency();
      updateCurrencyUI();
      updateBalanceDisplay(true);
      
      // Уведомляем другие модули
      window.dispatchEvent(new CustomEvent('currency:changed', {
        detail: { currency }
      }));
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
      }
    }
  
    function updateCurrencyUI() {
      // Обновляем кнопки переключателя
      const currencyBtns = document.querySelectorAll('.curr-btn');
      currencyBtns.forEach(btn => {
        const currency = btn.dataset.currency;
        if (currency === currentCurrency) {
          btn.classList.add('curr-btn--active');
        } else {
          btn.classList.remove('curr-btn--active');
        }
      });
  
      // Обновляем иконку в topbar
      const tonPillIcon = document.querySelector('.pill--ton .pill-icon');
      if (tonPillIcon) {
        tonPillIcon.src = currentCurrency === 'ton' 
          ? '/icons/ton.svg' 
          : '/icons/stars.svg';
      }
  
      // Обновляем текст в deposit sheet
      updateDepositSheetUI();
    }
  
    // ================== BALANCE MANAGEMENT ==================
    function updateBalance(balances) {
      console.log('[Switch] Updating balance:', balances);
      
      if (balances.ton !== undefined) {
        userBalance.ton = parseFloat(balances.ton) || 0;
      }
      if (balances.stars !== undefined) {
        userBalance.stars = parseInt(balances.stars) || 0;
      }
      
      updateBalanceDisplay(true);
    }
  
    function updateBalanceDisplay(animate = false) {
      const tonAmount = document.getElementById('tonAmount');
      if (!tonAmount) return;

      const targetValue = currentCurrency === 'ton' 
        ? userBalance.ton.toFixed(2)
        : formatStars(userBalance.stars);

      if (animate) {
        animateBalanceChange(tonAmount, targetValue);
      } else {
        tonAmount.textContent = targetValue;
      }
    }
  
    function animateBalanceChange(element, targetValue) {
      element.classList.add('balance-jelly');
      
      const currentText = element.textContent;
      const currentNum = parseFloat(currentText.replace(/[^\d.]/g, '')) || 0;
      const targetNum = parseFloat(targetValue.replace(/[^\d.]/g, '')) || 0;
      
      const duration = 800;
      const steps = 30;
      const stepDuration = duration / steps;
      const increment = (targetNum - currentNum) / steps;
      
      let currentStep = 0;
      
      const timer = setInterval(() => {
        currentStep++;
        
        if (currentStep >= steps) {
          element.textContent = targetValue;
          clearInterval(timer);
          
          setTimeout(() => {
            element.classList.remove('balance-jelly');
          }, 600);
        } else {
          const newValue = currentNum + (increment * currentStep);
          element.textContent = currentCurrency === 'ton' 
            ? newValue.toFixed(2)
            : formatStars(Math.round(newValue));
        }
      }, stepDuration);
    }
  
    function formatStars(amount) {
      if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'M';
      }
      if (amount >= 1000) {
        return (amount / 1000).toFixed(1) + 'K';
      }
      return amount.toString();
    }
  
    // ================== DEPOSIT SHEET ==================
    function openDepositSheet() {
      const sheet = document.getElementById('depositSheet');
      if (!sheet) return;

      console.log('[Switch] Opening deposit sheet for currency:', currentCurrency);
      
      updateDepositSheetUI();
      sheet.classList.add('sheet--open');
      
      const tonPill = document.querySelector('.pill--ton');
      if (tonPill) {
        tonPill.classList.add('balance-flash');
        setTimeout(() => {
          tonPill.classList.remove('balance-flash');
        }, 600);
      }
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    }
  
    function updateDepositSheetUI() {
      const title = document.querySelector('.sheet__title');
      const subtitle = document.querySelector('.sheet__sub');
      const inputIcon = document.querySelector('.dep-input__icon');
      const input = document.getElementById('depAmount');
      const btnConnect = document.getElementById('btnConnectWallet');
      const btnDeposit = document.getElementById('btnDepositNow');
      const depActions = document.querySelector('.dep-actions');

      if (currentCurrency === 'ton') {
        // TON MODE
        if (title) title.textContent = 'Deposit TON';
        if (subtitle) subtitle.innerHTML = 'Minimum deposit <b>0.5 TON</b>';
        if (inputIcon) inputIcon.src = '/icons/ton.svg';
        if (input) {
          input.placeholder = '0 TON';
          input.value = '';
        }
        if (btnConnect) {
          btnConnect.style.display = '';
          btnConnect.innerHTML = '<span class="btn__icons"><img src="/icons/telegram.svg" alt=""></span> Connect wallet';
        }
        if (btnDeposit) {
          btnDeposit.textContent = 'Deposit Now';
        }
        if (depActions) depActions.classList.remove('single');
      } else {
        // STARS MODE
        if (title) title.textContent = 'Buy Telegram Stars';
        if (subtitle) subtitle.innerHTML = 'Minimum purchase <b>50 Stars</b>';
        if (inputIcon) inputIcon.src = '/icons/stars.svg';
        if (input) {
          input.placeholder = '0 Stars';
          input.value = '';
        }
        if (btnConnect) {
          btnConnect.style.display = 'none';
        }
        if (btnDeposit) {
          btnDeposit.textContent = 'Buy Stars';
          btnDeposit.disabled = false;
        }
        if (depActions) depActions.classList.add('single');
      }
    }
  
    // ================== TELEGRAM STARS PAYMENT ==================
    async function buyStarsViaTelegram(amount) {
      console.log('[Switch] buyStarsViaTelegram called with amount:', amount);
      
      if (!tg) {
        console.error('[Switch] Telegram WebApp is not available');
        alert('This feature is only available in Telegram');
        return;
      }

      const starsAmount = parseInt(amount) || 0;
      const MIN_STARS = 1;

      if (starsAmount < MIN_STARS) {
        const msg = `Minimum purchase is ${MIN_STARS} Stars`;
        console.warn('[Switch]', msg);
        if (tg.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        if (tg.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('warning');
        }
        return;
      }

      try {
        console.log('[Switch] Creating Stars invoice for amount:', starsAmount);

        // ВАРИАНТ 1: Используем Telegram Stars API (если доступен)
        if (typeof tg.openInvoice === 'function') {
          console.log('[Switch] Using tg.openInvoice method');
          
          // Получаем invoice link с вашего сервера
          const response = await fetch('/api/stars/create-invoice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: starsAmount,
              userId: tg.initDataUnsafe?.user?.id
            })
          });

          if (!response.ok) {
            throw new Error('Failed to create invoice');
          }

          const data = await response.json();
          console.log('[Switch] Invoice data:', data);

          // Открываем Telegram invoice
          tg.openInvoice(data.invoiceLink, (status) => {
            console.log('[Switch] Payment status:', status);
            
            if (status === 'paid') {
              console.log('[Switch] Payment successful!');
              
              // Закрываем deposit sheet
              const sheet = document.getElementById('depositSheet');
              sheet?.classList.remove('sheet--open');
              
              // Показываем уведомление
              if (tg.showPopup) {
                tg.showPopup({
                  title: '⭐ Stars Purchased!',
                  message: `You received ${starsAmount} Stars`,
                  buttons: [{ type: 'ok' }]
                });
              }
              
              if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
              }
              
              // Обновляем баланс
              userBalance.stars += starsAmount;
              updateBalanceDisplay(true);
              
              // Отправляем событие
              window.dispatchEvent(new CustomEvent('stars:purchased', {
                detail: { amount: starsAmount }
              }));
              
            } else if (status === 'cancelled') {
              console.log('[Switch] Payment cancelled');
              if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('warning');
              }
            } else if (status === 'failed') {
              console.error('[Switch] Payment failed');
              if (tg.showAlert) {
                tg.showAlert('Payment failed. Please try again.');
              }
              if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('error');
              }
            }
          });
        } 
        // ВАРИАНТ 2: Fallback - открываем ссылку
        else {
          console.log('[Switch] Using fallback openLink method');
          
          const response = await fetch('/api/stars/create-invoice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: starsAmount,
              userId: tg.initDataUnsafe?.user?.id
            })
          });

          if (!response.ok) {
            throw new Error('Failed to create invoice');
          }

          const data = await response.json();
          tg.openLink(data.invoiceLink);
        }

      } catch (error) {
        console.error('[Switch] Error buying stars:', error);
        
        const errorMsg = error.message || 'Failed to create payment. Please try again.';
        if (tg.showAlert) {
          tg.showAlert(errorMsg);
        } else {
          alert(errorMsg);
        }
        
        if (tg.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
      }
    }

    // ================== STORAGE ==================
    function loadCurrency() {
      try {
        const saved = localStorage.getItem('wt-currency');
        if (saved && (saved === 'ton' || saved === 'stars')) {
          currentCurrency = saved;
          console.log('[Switch] Loaded currency from storage:', currentCurrency);
        }
      } catch (e) {
        console.warn('[Switch] Failed to load currency:', e);
      }
    }

    function saveCurrency() {
      try {
        localStorage.setItem('wt-currency', currentCurrency);
        console.log('[Switch] Saved currency to storage:', currentCurrency);
      } catch (e) {
        console.warn('[Switch] Failed to save currency:', e);
      }
    }

    // ================== PUBLIC API ==================
    window.WildTimeCurrency = {
      get current() { return currentCurrency; },
      get balance() { return { ...userBalance }; },
      switchTo: switchCurrency,
      updateBalance: updateBalance,
      setBalance: (currency, amount) => {
        userBalance[currency] = currency === 'ton' ? parseFloat(amount) : parseInt(amount);
        updateBalanceDisplay(true);
      },
      buyStars: buyStarsViaTelegram,
      formatStars: formatStars
    };
  
    // ================== INJECT STYLES ==================
    const styles = `
      /* Balance animation */
      #tonAmount {
        display: inline-block;
        transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        will-change: transform;
      }
  
      #tonAmount.balance-jelly {
        animation: jellyBounce 0.8s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        transform-origin: center;
      }
  
      @keyframes jellyBounce {
        0% { transform: scale3d(1, 1, 1); }
        10% { transform: scale3d(1.25, 0.75, 1); }
        20% { transform: scale3d(0.85, 1.15, 1); }
        30% { transform: scale3d(1.15, 0.85, 1); }
        40% { transform: scale3d(0.95, 1.05, 1); }
        50% { transform: scale3d(1.05, 0.95, 1); }
        60% { transform: scale3d(0.98, 1.02, 1); }
        70% { transform: scale3d(1.02, 0.98, 1); }
        80%, 100% { transform: scale3d(1, 1, 1); }
      }

      /* Currency switcher */
      .currency-switch {
        display: flex;
        gap: 8px;
        padding: 4px;
        background: var(--panel, #121823);
        border: 1px solid var(--border, #253247);
        border-radius: 16px;
        margin: 16px 0;
        position: relative;
        overflow: hidden;
      }

      /* Анимированный индикатор */
      .currency-switch::before {
        content: "";
        position: absolute;
        top: 4px;
        bottom: 4px;
        left: 4px;
        width: calc(50% - 8px);
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(0,166,255,.15), rgba(13,104,195,.15));
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        z-index: 0;
        transform: translateX(0);
      }

      /* Сдвиг на Stars */
      .currency-switch:has(.curr-btn[data-currency="stars"].curr-btn--active)::before {
        transform: translateX(calc(100% + 8px));
      }

      /* Кнопки */
      .curr-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 12px;
        background: transparent;
        border: none;
        color: var(--muted, #99a7bb);
        font-weight: 700;
        font-size: 14px;
        transition: color .2s ease, transform .15s ease;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        min-height: 44px;
        position: relative;
        z-index: 1;
      }

      .curr-btn::after {
        content: '';
        position: absolute;
        inset: -6px;
        border-radius: 14px;
      }

      .curr-btn:hover {
        color: var(--text, #e7edf7);
      }

      .curr-btn:active {
        transform: scale(.96);
      }

      .curr-btn--active {
        color: var(--accent, #00a6ff);
      }

      .curr-icon {
        width: 20px;
        height: 20px;
        opacity: .7;
        transition: opacity .3s ease, transform .2s ease;
        pointer-events: none;
      }

      .curr-btn:hover .curr-icon {
        opacity: .9;
        transform: scale(1.05);
      }

      .curr-btn--active .curr-icon {
        opacity: 1;
        filter: drop-shadow(0 0 4px rgba(0,166,255,.3));
      }

      .curr-btn span {
        pointer-events: none;
        white-space: nowrap;
      }

      /* TON pill effects */
      .pill--ton {
        transition: all 0.25s ease;
      }

      .pill--ton:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 
          0 0 0 1px rgba(0,166,255,.35) inset,
          0 8px 24px rgba(0,166,255,.25);
      }

      .pill--ton.balance-flash {
        animation: balanceFlash 0.6s ease;
      }

      @keyframes balanceFlash {
        0%, 100% { background: var(--panel); }
        50% {
          background: rgba(0,166,255,.12);
          box-shadow: 0 0 0 2px rgba(0,166,255,.4) inset;
        }
      }

      /* Deposit actions layout */
      .dep-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }

      .dep-actions.single {
        justify-content: center;
      }

      .dep-actions.single .btn {
        flex: 0 0 auto;
        min-width: 200px;
      }

      .dep-actions:not(.single) .btn {
        flex: 1;
      }
    `;
  
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  
    // ================== AUTO-INIT ==================
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  
  })();