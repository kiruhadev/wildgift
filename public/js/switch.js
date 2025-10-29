/**
 * switch.js - Currency Switch System (TON / Telegram Stars)
 * Управление переключением валют и интеграция с Telegram Stars API
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
      
      // Загружаем сохраненную валюту
      loadCurrency();
      
      // Инициализируем UI
      initUI();
      
      // Подключаем обработчики
      attachEventListeners();
      
      // Обновляем баланс
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
      // Переключатели валюты в профиле - УЛУЧШЕННАЯ КЛИКАБЕЛЬНОСТЬ
      const currencyBtns = document.querySelectorAll('.curr-btn');
      currencyBtns.forEach(btn => {
        // Добавляем обработчик на всю кнопку
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currency = btn.dataset.currency;
          console.log('[Switch] Currency button clicked:', currency);
          switchCurrency(currency);
        });
        
        // Делаем кнопку более отзывчивой
        btn.style.cursor = 'pointer';
        btn.style.userSelect = 'none';
        btn.style.webkitTapHighlightColor = 'transparent';
      });
  
      // Кнопка депозита в topbar
      const tonPill = document.getElementById('tonPill');
      if (tonPill) {
        tonPill.addEventListener('click', openDepositSheet);
      }
  
      // Слушаем события баланса от других модулей
      window.addEventListener('balance:update', (e) => {
        if (e.detail) {
          updateBalance(e.detail);
        }
      });
    }
  
    // ================== CURRENCY SWITCHING ==================
    function switchCurrency(currency) {
      if (currency === currentCurrency) {
        console.log('[Switch] Already on', currency);
        return;
      }
      
      console.log(`[Switch] Switching from ${currentCurrency} to ${currency}`);
      currentCurrency = currency;
      
      // Сохраняем выбор
      saveCurrency();
      
      // Обновляем UI
      updateCurrencyUI();
      
      // Обновляем дисплей баланса С АНИМАЦИЕЙ
      updateBalanceDisplay(true);
      
      // Уведомляем другие модули
      window.dispatchEvent(new CustomEvent('currency:changed', {
        detail: { currency }
      }));
      
      // Haptic feedback (если доступен)
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
      
      updateBalanceDisplay(true); // С АНИМАЦИЕЙ
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
  
    /**
     * Плавная анимация изменения баланса с эффектом "желе"
     */
    function animateBalanceChange(element, targetValue) {
      // Добавляем класс для jelly-анимации
      element.classList.add('balance-jelly');
      
      // Счетчик для плавного изменения числа
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
          
          // Убираем класс после окончания анимации
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
      // Форматируем звезды: 1000 -> 1K, 1000000 -> 1M
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
      
      // Добавляем эффект вспышки на pill
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
      const subtitle = document.querySelector('.sheet__sub--muted');
      const minDeposit = document.querySelector('.sheet__sub');
      const inputIcon = document.querySelector('.dep-input__icon');
      const input = document.getElementById('depAmount');
      const btnConnect = document.getElementById('btnConnectWallet');
      const btnDeposit = document.getElementById('btnDepositNow');
      const depActions = document.querySelector('.dep-actions');

      if (currentCurrency === 'ton') {
        if (title) title.textContent = 'Deposit TON';
        if (subtitle) subtitle.textContent = 'Available in TON only';
        if (minDeposit) minDeposit.innerHTML = 'Minimum deposit <b>0.5 TON</b>';
        if (inputIcon) inputIcon.src = '/icons/ton.svg';
        if (input) input.placeholder = '0 TON';
        if (btnConnect) {
          btnConnect.style.display = ''; // Показываем кнопку
          btnConnect.innerHTML = '<span class="btn__icons"><img src="/icons/telegram.svg" alt=""></span> Connect wallet';
        }
        if (btnDeposit) btnDeposit.textContent = 'Deposit Now';
        if (depActions) depActions.classList.remove('single'); // Две кнопки
      } else {
        if (title) title.textContent = 'Buy Stars';
        if (subtitle) subtitle.textContent = 'Pay with Telegram';
        if (minDeposit) minDeposit.innerHTML = 'Minimum purchase <b>50 Stars</b>';
        if (inputIcon) inputIcon.src = '/icons/stars.svg';
        if (input) input.placeholder = '0 Stars';
        if (btnConnect) {
          btnConnect.style.display = 'none'; // Для Stars не нужен кошелек
        }
        if (btnDeposit) {
          btnDeposit.textContent = 'Buy Stars';
          btnDeposit.disabled = false; // Всегда активна для Stars
        }
        if (depActions) depActions.classList.add('single'); // Одна кнопка по центру
      }
    }
  
    // ================== TELEGRAM STARS PAYMENT ==================
    /**
     * Покупка Telegram Stars через встроенную систему оплаты
     * @param {number} amount - Количество звезд
     */
    async function buyStarsViaTelegram(amount) {
      console.log('[Switch] buyStarsViaTelegram called with amount:', amount);
      
      if (!tg) {
        console.error('[Switch] Telegram WebApp is not available');
        alert('This feature is only available in Telegram');
        return;
      }

      const starsAmount = parseInt(amount) || 0;
      const MIN_STARS = 50;

      if (starsAmount < MIN_STARS) {
        const msg = `Minimum purchase is ${MIN_STARS} Stars`;
        console.warn('[Switch]', msg);
        if (tg.showAlert) {
          tg.showAlert(msg);
        } else {
          alert(msg);
        }
        return;
      }

      try {
        console.log('[Switch] Creating invoice for', starsAmount, 'stars');

        // Создаем инвойс на бэкенде
        const response = await fetch('/api/create-stars-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: starsAmount,
            userId: tg.initDataUnsafe?.user?.id,
            initData: tg.initData
          })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Switch] Invoice created:', data);

        if (!data.invoiceLink) {
          throw new Error('No invoice link received');
        }

        // Открываем инвойс в Telegram
        console.log('[Switch] Opening invoice:', data.invoiceLink);
        
        if (tg.openInvoice) {
          // Используем новый API если доступен
          tg.openInvoice(data.invoiceLink, (status) => {
            console.log('[Switch] Invoice status:', status);
            
            if (status === 'paid') {
              // Успешная оплата
              console.log('[Switch] Payment successful!');
              
              // Обновляем баланс
              userBalance.stars += starsAmount;
              updateBalanceDisplay(true);
              
              // Закрываем sheet
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
              
              // Haptic feedback
              if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
              }
              
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
        } else {
          // Fallback для старых версий
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

    // ================== BET CONVERSION ==================
    /**
     * Конвертирует сумму ставки в текущую валюту
     */
    function convertBetAmount(tonAmount) {
      if (currentCurrency === 'ton') {
        return tonAmount;
      }
      // 1 TON ≈ 100 Stars (примерный курс, настрой под свой)
      return Math.round(tonAmount * 100);
    }

    /**
     * Проверяет достаточность баланса для ставки
     */
    function hasSufficientBalance(amount) {
      if (currentCurrency === 'ton') {
        return userBalance.ton >= amount;
      }
      return userBalance.stars >= amount;
    }

    // ================== PUBLIC API ==================
    window.WildTimeCurrency = {
      // State
      get current() { return currentCurrency; },
      get balance() { return { ...userBalance }; },
      
      // Currency management
      switchTo: switchCurrency,
      
      // Balance management
      updateBalance: updateBalance,
      setBalance: (currency, amount) => {
        userBalance[currency] = currency === 'ton' ? parseFloat(amount) : parseInt(amount);
        updateBalanceDisplay(true);
      },
      
      // Payments
      buyStars: buyStarsViaTelegram,
      
      // Bet helpers
      convertBetAmount: convertBetAmount,
      hasSufficientBalance: hasSufficientBalance,
      
      // Utils
      formatStars: formatStars
    };
  
    // ================== INJECT JELLY STYLES ==================
    const jellyStyles = `
      /* 🍮 Jelly Balance Animation */
      #tonAmount {
        display: inline-block;
        transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        will-change: transform;
      }
  
      /* Активная анимация желе */
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

      /* УЛУЧШЕННАЯ КЛИКАБЕЛЬНОСТЬ ПЕРЕКЛЮЧАТЕЛЯ */
      .currency-switch {
        display: flex;
        gap: 8px;
        padding: 4px;
        background: rgba(255,255,255,.04);
        border-radius: 12px;
        margin: 16px 0;
      }

      .curr-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        border-radius: 10px;
        background: transparent;
        border: 1px solid transparent;
        color: #8da1b8;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        /* УВЕЛИЧЕННАЯ ОБЛАСТЬ КЛИКА */
        position: relative;
      }

      /* Увеличиваем кликабельную область */
      .curr-btn::before {
        content: '';
        position: absolute;
        inset: -8px; /* Расширяем на 8px во все стороны */
        border-radius: 12px;
      }

      .curr-btn:active {
        transform: scale(0.95);
      }

      .curr-btn--active {
        background: rgba(0,166,255,.12);
        border-color: rgba(0,166,255,.3);
        color: #00a6ff;
        box-shadow: 0 0 0 1px rgba(0,166,255,.15) inset;
      }

      .curr-icon {
        width: 20px;
        height: 20px;
        pointer-events: none; /* Иконка не мешает клику */
      }

      /* Hover эффект только для неактивной кнопки */
      .curr-btn:not(.curr-btn--active):hover {
        background: rgba(255,255,255,.06);
        border-color: rgba(255,255,255,.1);
        color: #b8c5d6;
      }
  
      /* Hover эффект для pill */
      .pill--ton {
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        cursor: pointer;
      }
  
      .pill--ton:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 
          0 0 0 1px rgba(0,166,255,.35) inset,
          0 8px 24px rgba(0,166,255,.25),
          0 0 30px rgba(0,166,255,.15);
      }
  
      .pill--ton:active {
        transform: translateY(0) scale(0.98);
        transition-duration: 0.1s;
      }
  
      /* Эффект свечения при изменении баланса */
      .pill--ton.balance-flash {
        animation: balanceFlash 0.6s ease;
      }
  
      @keyframes balanceFlash {
        0%, 100% { background: var(--panel); }
        50% {
          background: rgba(0,166,255,.12);
          box-shadow: 
            0 0 0 2px rgba(0,166,255,.4) inset,
            0 0 30px rgba(0,166,255,.3);
        }
      }
  
      /* Пульсация иконки при hover */
      .pill--ton:hover .pill-icon {
        animation: iconPulse 1s ease infinite;
      }
  
      @keyframes iconPulse {
        0%, 100% {
          transform: scale(1);
          filter: brightness(1);
        }
        50% {
          transform: scale(1.1);
          filter: brightness(1.2) drop-shadow(0 0 8px rgba(0,166,255,.5));
        }
      }
  
      /* Плюсик тоже анимируется */
      .pill--ton:hover .pill-plus-icon {
        animation: plusRotate 0.6s ease;
      }
  
      @keyframes plusRotate {
        0% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(90deg) scale(1.2); }
        100% { transform: rotate(180deg) scale(1); }
      }
    `;
  
    // Внедряем стили
    const styleSheet = document.createElement('style');
    styleSheet.textContent = jellyStyles;
    document.head.appendChild(styleSheet);
  
    // ================== AUTO-INIT ==================
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  
    // Обработка deposit button в sheet для Stars
    document.addEventListener('DOMContentLoaded', () => {
      const btnDeposit = document.getElementById('btnDepositNow');
      if (btnDeposit) {
        btnDeposit.addEventListener('click', () => {
          if (currentCurrency === 'stars') {
            const input = document.getElementById('depAmount');
            const amount = parseInt(input?.value) || 0;
            console.log('[Switch] Buy Stars button clicked, amount:', amount);
            buyStarsViaTelegram(amount);
          }
          // Для TON обработка в deposit.js
        });
      }
    });
  
  })();