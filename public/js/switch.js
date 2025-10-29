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
      
      // Обновляем дисплей баланса
      updateBalanceDisplay();
      
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
      
      updateBalanceDisplay();
    }
  
    function updateBalanceDisplay() {
      const tonAmount = document.getElementById('tonAmount');
      if (!tonAmount) return;
  
      if (currentCurrency === 'ton') {
        tonAmount.textContent = userBalance.ton.toFixed(2);
      } else {
        tonAmount.textContent = formatStars(userBalance.stars);
      }
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
  
      if (currentCurrency === 'ton') {
        if (title) title.textContent = 'Deposit TON';
        if (subtitle) subtitle.textContent = 'Available in TON only';
        if (minDeposit) minDeposit.innerHTML = 'Minimum deposit <b>0.5 TON</b>';
        if (inputIcon) inputIcon.src = '/icons/ton.svg';
        if (input) input.placeholder = '0 TON';
        if (btnConnect) {
          btnConnect.innerHTML = '<span class="btn__icons"><img src="/icons/telegram.svg" alt=""></span> Connect wallet';
        }
        if (btnDeposit) btnDeposit.textContent = 'Deposit Now';
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
  
      // Обновляем баланс
      userBalance.stars += amount;
      updateBalanceDisplay();
  
      // Закрываем sheet
      const sheet = document.getElementById('depositSheet');
      if (sheet) {
        sheet.classList.remove('sheet--open');
      }
  
      // Показываем уведомление
      showSuccess(`Вы получили ${amount} Stars!`);
  
      // Haptic feedback
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }
  
      // Уведомляем другие модули
      window.dispatchEvent(new CustomEvent('balance:update', {
        detail: { stars: userBalance.stars }
      }));
  
      // Отправляем на сервер (если есть backend)
      sendStarsPurchaseToServer(amount);
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
        updateBalanceDisplay();
      },
      
      // Payments
      buyStars: buyStarsViaTelegram,
      
      // Bet helpers
      convertBetAmount: convertBetAmount,
      hasSufficientBalance: hasSufficientBalance,
      
      // Utils
      formatStars: formatStars
    };
  
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