/**
 * switch.js - Currency Switch System (TON / Telegram Stars)
 * ИСПРАВЛЕННАЯ ВЕРСИЯ - гарантированное переключение иконок
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
    console.log('[Switch] 🚀 Initializing currency system...');
    
    loadCurrency();
    
    // Ждем загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initUI();
        attachEventListeners();
        updateBalanceDisplay();
      });
    } else {
      initUI();
      attachEventListeners();
      updateBalanceDisplay();
    }
    
    console.log('[Switch] ✅ Currency system ready. Current:', currentCurrency);
  }

  // ================== UI SETUP ==================
  function initUI() {
    console.log('[Switch] 🎨 Initializing UI...');
    
    const currencyBtns = document.querySelectorAll('.curr-btn');
    currencyBtns.forEach(btn => {
      const currency = btn.dataset.currency;
      if (currency === currentCurrency) {
        btn.classList.add('curr-btn--active');
      } else {
        btn.classList.remove('curr-btn--active');
      }
    });
    
    // КРИТИЧНО: Обновляем иконку
    updateTopbarIcon();
    
    console.log('[Switch] ✅ UI initialized');
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
        console.log('[Switch] 🔘 Currency button clicked:', currency);
        switchCurrency(currency);
      });
      
      btn.style.cursor = 'pointer';
      btn.style.userSelect = 'none';
      btn.style.webkitTapHighlightColor = 'transparent';
    });

    // Кнопка баланса в topbar - открывает соответствующий попап
    const tonPill = document.getElementById('tonPill');
    if (tonPill) {
      tonPill.addEventListener('click', (e) => {
        e.preventDefault();
        openDepositPopup();
      });
    }

    // Слушаем события баланса от других модулей
    window.addEventListener('balance:update', (e) => {
      if (e.detail) {
        updateBalance(e.detail);
      }
    });
  }

  // ================== OPEN POPUP ==================
  function openDepositPopup() {
    console.log('[Switch] 📂 Opening deposit popup for:', currentCurrency);
    
    closeAllPopups();
    
    setTimeout(() => {
      if (currentCurrency === 'ton') {
        if (window.WTTonDeposit?.open) {
          window.WTTonDeposit.open();
        } else {
          console.error('[Switch] TON module not loaded!');
        }
      } else {
        if (window.WTStarsDeposit?.open) {
          window.WTStarsDeposit.open();
        } else {
          console.error('[Switch] Stars module not loaded!');
        }
      }
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    }, 50);
  }
  
  function closeAllPopups() {
    const tonPopup = document.getElementById('tonDepositPopup');
    const starsPopup = document.getElementById('starsDepositPopup');
    
    let closed = [];
    
    if (tonPopup?.classList.contains('deposit-popup--open')) {
      tonPopup.classList.remove('deposit-popup--open');
      closed.push('TON');
    }
    
    if (starsPopup?.classList.contains('deposit-popup--open')) {
      starsPopup.classList.remove('deposit-popup--open');
      closed.push('Stars');
    }
    
    if (closed.length > 0) {
      console.log('[Switch] 🔒 Closed popups:', closed.join(', '));
    }
  }

  // ================== CURRENCY SWITCHING ==================
  function switchCurrency(currency) {
    if (currency === currentCurrency) {
      console.log('[Switch] Already on', currency);
      return;
    }
    
    console.log(`[Switch] 🔄 Switching from ${currentCurrency} to ${currency}`);
    
    closeAllPopups();
    
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
    console.log('[Switch] 🎨 Updating UI for currency:', currentCurrency);
    
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

    // КРИТИЧНО: Обновляем иконку
    updateTopbarIcon();
  }

  function updateTopbarIcon() {
    const pillIcon = document.getElementById('pillCurrencyIcon');
    
    if (!pillIcon) {
      console.error('[Switch] ❌ pillCurrencyIcon NOT FOUND in DOM!');
      console.error('[Switch] Available elements:', {
        tonPill: !!document.getElementById('tonPill'),
        tonAmount: !!document.getElementById('tonAmount'),
        userPill: !!document.getElementById('userPill')
      });
      return;
    }

    const iconPath = currentCurrency === 'ton' ? '/icons/ton.svg' : '/icons/stars.svg';
    
    console.log('[Switch] 🎨 Changing icon from', pillIcon.src, 'to', iconPath);
    
    // Плавная смена с анимацией
    pillIcon.style.opacity = '0';
    pillIcon.style.transform = 'scale(0.8) rotate(-15deg)';
    
    setTimeout(() => {
      pillIcon.src = iconPath;
      pillIcon.style.opacity = '1';
      pillIcon.style.transform = 'scale(1) rotate(0deg)';
      console.log('[Switch] ✅ Icon updated! Current src:', pillIcon.src);
    }, 150);
  }

  // ================== BALANCE MANAGEMENT ==================
  function updateBalance(balances) {
    console.log('[Switch] 💰 Updating balance:', balances);
    
    if (balances.ton !== undefined) {
      userBalance.ton = parseFloat(balances.ton) || 0;
    }
    if (balances.stars !== undefined) {
      userBalance.stars = parseInt(balances.stars) || 0;
    }
    
    updateBalanceDisplay(true);
    
    // Обновляем балансы в модулях
    if (balances.ton !== undefined && window.WTTonDeposit?.updateBalance) {
      window.WTTonDeposit.updateBalance(balances.ton);
    }
    if (balances.stars !== undefined && window.WTStarsDeposit?.updateBalance) {
      window.WTStarsDeposit.updateBalance(balances.stars);
    }
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

  // ================== STORAGE ==================
  function loadCurrency() {
    try {
      const saved = localStorage.getItem('wt-currency');
      if (saved && (saved === 'ton' || saved === 'stars')) {
        currentCurrency = saved;
        console.log('[Switch] 📥 Loaded currency from storage:', currentCurrency);
      }
    } catch (e) {
      console.warn('[Switch] Failed to load currency:', e);
    }
  }

  function saveCurrency() {
    try {
      localStorage.setItem('wt-currency', currentCurrency);
      console.log('[Switch] 💾 Saved currency to storage:', currentCurrency);
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
    formatStars: formatStars,
    openPopup: openDepositPopup,
    closeAllPopups: closeAllPopups,
    
    // Debug helpers
    debug: {
      forceUpdateIcon: () => {
        console.log('[Switch] 🔧 Force updating icon...');
        updateTopbarIcon();
      },
      testSwitch: (currency) => {
        console.log('[Switch] 🧪 Testing switch to:', currency);
        switchCurrency(currency);
      },
      checkIcon: () => {
        const icon = document.getElementById('pillCurrencyIcon');
        console.log('[Switch] 🔍 Icon check:', {
          exists: !!icon,
          src: icon?.src,
          visible: icon?.offsetParent !== null,
          currentCurrency: currentCurrency
        });
        return icon;
      },
      getState: () => ({
        currency: currentCurrency,
        balance: userBalance,
        iconSrc: document.getElementById('pillCurrencyIcon')?.src
      })
    }
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

    /* Плавная смена иконки с анимацией */
    #pillCurrencyIcon {
      transition: opacity 0.15s ease, transform 0.15s ease;
      will-change: opacity, transform;
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

    .currency-switch:has(.curr-btn[data-currency="stars"].curr-btn--active)::before {
      transform: translateX(calc(100% + 8px));
    }

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
  `;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // ================== AUTO-INIT ==================
  init();

  // ================== DEBUG CHECK ==================
  setTimeout(() => {
    console.log('[Switch] 🔍 Status check:');
    console.log('  - Current currency:', currentCurrency);
    console.log('  - TON module:', window.WTTonDeposit ? '✅' : '❌');
    console.log('  - Stars module:', window.WTStarsDeposit ? '✅' : '❌');
    
    const icon = document.getElementById('pillCurrencyIcon');
    if (icon) {
      console.log('  - Icon element: ✅');
      console.log('  - Icon src:', icon.src);
      console.log('  - Icon visible:', icon.offsetParent !== null);
      console.log('  - Expected icon:', currentCurrency === 'ton' ? '/icons/ton.svg' : '/icons/stars.svg');
    } else {
      console.error('  - Icon element: ❌ NOT FOUND!');
      console.error('  - Check HTML: <img id="pillCurrencyIcon" ... />');
    }
  }, 1000);

  console.log('[Switch] 📦 Module loaded');

})();