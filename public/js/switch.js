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
      // Переключатели валюты в профиле
      const currencyBtns = document.querySelectorAll('.curr-btn');
      currencyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const currency = btn.dataset.currency;
          switchCurrency(currency);
        });
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
      if (currency === currentCurrency) return;
      
      console.log(`[Switch] Switching to ${currency}`);
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
        if (btnDeposit) btnDeposit.textContent = 'Buy Stars';
        if (depActions) depActions.classList.add('single'); // Одна кнопка по центру
      }
    }
  
    // ================== TELEGRAM STARS PAYMENT ==================
    /**
     * Покупка Telegram Stars через встроенную систему оплаты
     * @param {number} amount - Количество звезд
     */
    function buyStarsViaTelegram(amount) {
      if (!tg) {
        console.error('[Switch] Telegram WebApp not available');
        showError('Telegram WebApp не доступен');
        return;
      }
  
      // Валидация
      if (!amount || amount < 50) {
        showError('Минимальная покупка - 50 Stars');
        return;
      }
  
      console.log(`[Switch] Initiating Stars purchase: ${amount}`);
  
      // Создаем invoice для покупки Stars
      const invoice = {
        title: `${amount} Telegram Stars`,
        description: `Purchase ${amount} Stars for Wild Time`,
        payload: JSON.stringify({
          type: 'stars_purchase',
          amount: amount,
          timestamp: Date.now()
        }),
        provider_token: '', // Пустой для Stars (используется внутренняя система Telegram)
        currency: 'XTR', // Telegram Stars currency code
        prices: [{
          label: `${amount} Stars`,
          amount: amount // Цена в Stars (1:1)
        }]
      };
  
      // Открываем форму оплаты Telegram
      if (typeof tg.openInvoice === 'function') {
        tg.openInvoice(invoice.link, (status) => {
          handleStarsPaymentResult(status, amount);
        });
      } else {
        // Альтернативный метод для старых версий
        showStarsPaymentDialog(amount);
      }
    }
  
    /**
     * Альтернативный метод оплаты Stars (для старых версий API)
     */
    function showStarsPaymentDialog(amount) {
      // Формируем ссылку для оплаты через бот
      const botUsername = 'YOUR_BOT_USERNAME'; // Замени на имя своего бота
      const startParam = btoa(JSON.stringify({
        action: 'buy_stars',
        amount: amount,
        userId: tg?.initDataUnsafe?.user?.id
      }));
  
      const paymentUrl = `https://t.me/${botUsername}?start=${startParam}`;
  
      // Открываем в Telegram
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(paymentUrl);
      } else if (tg?.openLink) {
        tg.openLink(paymentUrl);
      } else {
        window.open(paymentUrl, '_blank');
      }
    }
  
    /**
     * Обработка результата оплаты Stars
     */
    function handleStarsPaymentResult(status, amount) {
      console.log('[Switch] Payment status:', status);
  
      if (status === 'paid' || status === 'success') {
        // Успешная оплата
        onStarsPurchaseSuccess(amount);
      } else if (status === 'cancelled') {
        showInfo('Оплата отменена');
      } else if (status === 'failed') {
        showError('Ошибка оплаты. Попробуйте снова');
      }
    }
  
    /**
     * Обработка успешной покупки Stars
     */
    function onStarsPurchaseSuccess(amount) {
      console.log(`[Switch] Stars purchase successful: ${amount}`);
  
      // Обновляем баланс С МОЩНОЙ АНИМАЦИЕЙ
      userBalance.stars += amount;
      
      // Добавляем визуальный взрыв успеха
      triggerSuccessExplosion();
      
      updateBalanceDisplay(true);
  
      // Закрываем sheet
      const sheet = document.getElementById('depositSheet');
      if (sheet) {
        sheet.classList.remove('sheet--open');
      }
  
      // Показываем уведомление
      showSuccess(`Вы получили ${amount} Stars!`);
  
      // МОЩНЫЙ Haptic feedback
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
        // Двойной тапtic для большего эффекта
        setTimeout(() => {
          tg.HapticFeedback.impactOccurred('heavy');
        }, 100);
      }
  
      // Уведомляем другие модули
      window.dispatchEvent(new CustomEvent('balance:update', {
        detail: { stars: userBalance.stars }
      }));
  
      // Отправляем на сервер (если есть backend)
      sendStarsPurchaseToServer(amount);
    }
  
    /**
     * Визуальный "взрыв" успеха при пополнении
     */
    function triggerSuccessExplosion() {
      const tonPill = document.querySelector('.pill--ton');
      if (!tonPill) return;
  
      // Добавляем класс для супер-анимации
      tonPill.classList.add('balance-explosion');
      
      setTimeout(() => {
        tonPill.classList.remove('balance-explosion');
      }, 1200);
  
      // Создаем частицы успеха вокруг pill
      createSuccessParticles(tonPill);
    }
  
    /**
     * Создание анимированных частиц вокруг элемента
     */
    function createSuccessParticles(element) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
  
      for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'success-particle';
        particle.style.cssText = `
          position: fixed;
          left: ${centerX}px;
          top: ${centerY}px;
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, rgba(0,166,255,1) 0%, rgba(0,166,255,0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
        `;
        
        document.body.appendChild(particle);
  
        const angle = (Math.PI * 2 * i) / 12;
        const distance = 60 + Math.random() * 40;
        const duration = 800 + Math.random() * 400;
  
        const targetX = centerX + Math.cos(angle) * distance;
        const targetY = centerY + Math.sin(angle) * distance;
  
        particle.animate([
          { 
            transform: 'translate(0, 0) scale(0)',
            opacity: 1 
          },
          { 
            transform: `translate(${targetX - centerX}px, ${targetY - centerY}px) scale(1.5)`,
            opacity: 1,
            offset: 0.5
          },
          { 
            transform: `translate(${targetX - centerX}px, ${targetY - centerY}px) scale(0)`,
            opacity: 0 
          }
        ], {
          duration: duration,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }).onfinish = () => {
          particle.remove();
        };
      }
    }
  
    /**
     * Отправка информации о покупке на сервер
     */
    async function sendStarsPurchaseToServer(amount) {
      try {
        // Здесь должен быть твой API endpoint
        const response = await fetch('/api/stars/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: tg?.initDataUnsafe?.user?.id,
            amount: amount,
            timestamp: Date.now(),
            initData: tg?.initData // Для верификации на сервере
          })
        });
  
        if (!response.ok) {
          throw new Error('Server error');
        }
  
        const data = await response.json();
        console.log('[Switch] Server response:', data);
      } catch (error) {
        console.error('[Switch] Failed to send purchase to server:', error);
        // Не показываем ошибку пользователю, т.к. Stars уже зачислены локально
      }
    }
  
    // ================== BET CONVERSION ==================
    /**
     * Конвертация суммы ставки между валютами
     * @param {number} amount - Сумма в текущей валюте
     * @returns {number} - Сумма для транзакции
     */
    function convertBetAmount(amount) {
      if (currentCurrency === 'ton') {
        return amount; // TON как есть
      } else {
        // Конвертируем TON в Stars (примерно 1 TON = 100 Stars, настрой под свои нужды)
        return Math.round(amount * 100);
      }
    }
  
    /**
     * Проверка достаточности баланса для ставки
     */
    function hasSufficientBalance(amount) {
      const convertedAmount = convertBetAmount(amount);
      
      if (currentCurrency === 'ton') {
        return userBalance.ton >= amount;
      } else {
        return userBalance.stars >= convertedAmount;
      }
    }
  
    // ================== STORAGE ==================
    function saveCurrency() {
      try {
        localStorage.setItem('wt_currency', currentCurrency);
      } catch (e) {
        console.warn('[Switch] Failed to save currency:', e);
      }
    }
  
    function loadCurrency() {
      try {
        const saved = localStorage.getItem('wt_currency');
        if (saved === 'ton' || saved === 'stars') {
          currentCurrency = saved;
        }
      } catch (e) {
        console.warn('[Switch] Failed to load currency:', e);
      }
    }
  
    // ================== NOTIFICATIONS ==================
    function showSuccess(message) {
      console.log('[Switch] Success:', message);
      // Здесь можно добавить toast-уведомление
      if (tg?.showAlert) {
        tg.showAlert(message);
      }
    }
  
    function showError(message) {
      console.error('[Switch] Error:', message);
      if (tg?.showAlert) {
        tg.showAlert(message);
      }
    }
  
    function showInfo(message) {
      console.log('[Switch] Info:', message);
      if (tg?.showAlert) {
        tg.showAlert(message);
      }
    }
  
    // ================== PUBLIC API ==================
    window.CurrencySwitch = {
      // Getters
      getCurrency: () => currentCurrency,
      getBalance: (currency) => currency ? userBalance[currency] : userBalance[currentCurrency],
      getAllBalances: () => ({ ...userBalance }),
      
      // Currency management
      switchTo: switchCurrency,
      
      // Balance management
      updateBalance: updateBalance,
      setBalance: (currency, amount) => {
        userBalance[currency] = currency === 'ton' ? parseFloat(amount) : parseInt(amount);
        updateBalanceDisplay(true); // С АНИМАЦИЕЙ
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
        0% {
          transform: scale3d(1, 1, 1);
        }
        10% {
          transform: scale3d(1.25, 0.75, 1);
        }
        20% {
          transform: scale3d(0.85, 1.15, 1);
        }
        30% {
          transform: scale3d(1.15, 0.85, 1);
        }
        40% {
          transform: scale3d(0.95, 1.05, 1);
        }
        50% {
          transform: scale3d(1.05, 0.95, 1);
        }
        60% {
          transform: scale3d(0.98, 1.02, 1);
        }
        70% {
          transform: scale3d(1.02, 0.98, 1);
        }
        80% {
          transform: scale3d(1, 1, 1);
        }
        100% {
          transform: scale3d(1, 1, 1);
        }
      }
  
      /* Hover эффект для pill - притягивает внимание */
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
        0%, 100% {
          background: var(--panel);
        }
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
        0% {
          transform: rotate(0deg) scale(1);
        }
        50% {
          transform: rotate(90deg) scale(1.2);
        }
        100% {
          transform: rotate(180deg) scale(1);
        }
      }
  
      /* Магнитный эффект для всей pill */
      .pill--ton {
        position: relative;
      }
  
      .pill--ton::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 999px;
        background: radial-gradient(circle at center, rgba(0,166,255,.15) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
  
      .pill--ton:hover::before {
        opacity: 1;
        animation: magneticPulse 1.5s ease infinite;
      }
  
      @keyframes magneticPulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.6;
        }
      }
  
      /* 💥 ВЗРЫВ УСПЕХА при пополнении */
      .pill--ton.balance-explosion {
        animation: 
          explosionScale 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
          explosionGlow 1.2s ease;
      }
  
      @keyframes explosionScale {
        0% {
          transform: scale(1);
        }
        25% {
          transform: scale(1.3) rotate(3deg);
        }
        50% {
          transform: scale(0.9) rotate(-3deg);
        }
        75% {
          transform: scale(1.1) rotate(1deg);
        }
        100% {
          transform: scale(1) rotate(0deg);
        }
      }
  
      @keyframes explosionGlow {
        0% {
          box-shadow: 
            0 0 0 0 rgba(0,166,255,.7),
            inset 0 0 0 1px rgba(255,255,255,.05);
        }
        50% {
          box-shadow: 
            0 0 0 12px rgba(0,166,255,0),
            0 0 50px rgba(0,166,255,.6),
            inset 0 0 20px rgba(0,166,255,.4);
        }
        100% {
          box-shadow: 
            0 0 0 0 rgba(0,166,255,0),
            inset 0 0 0 1px rgba(255,255,255,.05);
        }
      }
  
      /* Добавляем эффект "сочности" */
      .pill--ton {
        backdrop-filter: blur(8px);
      }
  
      .pill--ton:hover {
        backdrop-filter: blur(12px);
      }
  
      /* Частицы успеха */
      .success-particle {
        animation: particleFade 1s ease-out forwards;
      }
  
      @keyframes particleFade {
        to { opacity: 0; }
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
  
    // Обработка deposit button в sheet
    document.addEventListener('DOMContentLoaded', () => {
      const btnDeposit = document.getElementById('btnDepositNow');
      if (btnDeposit) {
        btnDeposit.addEventListener('click', () => {
          const input = document.getElementById('depAmount');
          const amount = parseFloat(input?.value) || 0;
  
          if (currentCurrency === 'stars') {
            buyStarsViaTelegram(amount);
          } else {
            // Для TON используется TonConnect (обрабатывается в deposit.js)
            console.log('[Switch] TON deposit handled by deposit.js');
          }
        });
      }
    });
  
  })();