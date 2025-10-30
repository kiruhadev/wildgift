// /public/js/profile.js
(() => {
    const tg = window.Telegram?.WebApp;
  
    // DOM элементы - topbar
    const userPill = document.getElementById('userPill');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
  
    // DOM элементы - profile page
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileHandle = document.getElementById('profileHandle');
    const profileWallet = document.getElementById('profileWallet');
    const walletPill = document.getElementById('walletPill');
    const walletDetails = document.getElementById('walletDetails');
    const walletFull = document.getElementById('walletFull');
    const walletCopy = document.getElementById('walletCopy');
    const profileDisconnect = document.getElementById('profileDisconnect');
  
    // Получение данных пользователя из Telegram
    function getTelegramUser() {
      if (!tg?.initDataUnsafe?.user) {
        return {
          id: null,
          firstName: 'Guest',
          lastName: '',
          username: null,
          photoUrl: null
        };
      }
  
      const user = tg.initDataUnsafe.user;
      return {
        id: user.id,
        firstName: user.first_name || 'User',
        lastName: user.last_name || '',
        username: user.username || null,
        photoUrl: user.photo_url || null
      };
    }
  
    // Форматирование имени пользователя
    function getDisplayName(user) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      return fullName || 'User';
    }
  
    // Форматирование username
    function getDisplayHandle(user) {
      return user.username ? `@${user.username}` : `ID: ${user.id || 'Unknown'}`;
    }
  
    // Получение короткого адреса кошелька
    function getShortAddress(address) {
      if (!address) return 'Not connected';
      return `${address.slice(0, 4)}…${address.slice(-4)}`;
    }
  
    // Обновление UI с данными пользователя
    function updateUserUI() {
      const user = getTelegramUser();
      const displayName = getDisplayName(user);
      const displayHandle = getDisplayHandle(user);
  
      // Обновляем аватар
      const avatarUrl = user.photoUrl || '/images/avatar-default.png';
      
      if (userAvatar) {
        userAvatar.src = avatarUrl;
        userAvatar.onerror = () => {
          userAvatar.src = '/images/avatar-default.png';
        };
      }
  
      if (profileAvatar) {
        profileAvatar.src = avatarUrl;
        profileAvatar.onerror = () => {
          profileAvatar.src = '/images/avatar-default.png';
        };
      }
  
      // Обновляем имя в topbar (только имя)
      if (userName) {
        userName.textContent = user.firstName;
      }
  
      // Обновляем имя в профиле (полное имя)
      if (profileName) {
        profileName.textContent = displayName;
      }
  
      // Обновляем handle в профиле
      if (profileHandle) {
        profileHandle.textContent = displayHandle;
      }
  
      console.log('[profile] User UI updated:', { displayName, displayHandle });
    }
  
    // Обновление информации о кошельке
    function updateWalletUI() {
      // Проверяем наличие TonConnect
      const tc = window.__wtTonConnect;
      
      if (!tc || !tc.account) {
        if (profileWallet) {
          profileWallet.textContent = 'Not connected';
        }
        if (walletFull) {
          walletFull.textContent = '—';
        }
        if (walletDetails) {
          walletDetails.hidden = true;
        }
        console.log('[profile] Wallet not connected');
        return;
      }
  
      const address = tc.account.address;
      const shortAddr = getShortAddress(address);
  
      if (profileWallet) {
        profileWallet.textContent = shortAddr;
      }
  
      if (walletFull) {
        // Преобразуем адрес в friendly формат если нужно
        const friendlyAddr = window.WT?.utils?.ensureFriendly?.(address) || address;
        walletFull.textContent = friendlyAddr;
      }
  
      console.log('[profile] Wallet UI updated:', shortAddr);
    }
  
    // Обработчик клика на пилюлю пользователя (переход на профиль)
    if (userPill) {
      userPill.addEventListener('click', () => {
        console.log('[profile] User pill clicked, navigating to profile');
        
        // Переключаемся на страницу профиля
        const profilePage = document.getElementById('profilePage');
        if (profilePage) {
          // Удаляем active у всех страниц
          document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
          
          // Активируем профиль
          profilePage.classList.add('page-active');
          
          // Обновляем навигацию
          document.querySelectorAll('.bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
          const profileNavBtn = document.querySelector('.bottom-nav .nav-item[data-target="profilePage"]');
          if (profileNavBtn) {
            profileNavBtn.classList.add('active');
          }
  
          // Отправляем событие
          if (window.WT?.bus) {
            window.WT.bus.dispatchEvent(new CustomEvent('page:change', { 
              detail: { id: 'profilePage' } 
            }));
          }
  
          // Haptic feedback если доступен
          if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
          }
        }
      });
    }
  
    // Обработчик раскрытия деталей кошелька
    if (walletPill) {
      walletPill.addEventListener('click', () => {
        if (!walletDetails) return;
        
        const isHidden = walletDetails.hidden;
        walletDetails.hidden = !isHidden;
  
        // Анимация шеврона
        const chevron = walletPill.querySelector('.chev');
        if (chevron) {
          chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
  
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.impactOccurred('light');
        }
      });
    }
  
    // Копирование адреса кошелька
    if (walletCopy) {
      walletCopy.addEventListener('click', async () => {
        const tc = window.__wtTonConnect;
        if (!tc?.account) return;
  
        const address = window.WT?.utils?.ensureFriendly?.(tc.account.address) || tc.account.address;
  
        try {
          // Пробуем использовать Telegram WebApp API
          if (tg?.showPopup) {
            await navigator.clipboard.writeText(address);
            tg.showPopup({
              title: '✅ Copied!',
              message: 'Wallet address copied to clipboard',
              buttons: [{ type: 'ok' }]
            });
          } else {
            // Fallback для обычного браузера
            await navigator.clipboard.writeText(address);
            alert('Wallet address copied!');
          }
  
          if (tg?.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
          }
  
          console.log('[profile] Wallet address copied:', address);
        } catch (error) {
          console.error('[profile] Failed to copy address:', error);
          
          if (tg?.showAlert) {
            tg.showAlert('Failed to copy address');
          } else {
            alert('Failed to copy address');
          }
        }
      });
    }
  
    // Отключение кошелька
    if (profileDisconnect) {
      profileDisconnect.addEventListener('click', async () => {
        const tc = window.__wtTonConnect;
        if (!tc) return;
  
        try {
          // Показываем подтверждение
          if (tg?.showPopup) {
            tg.showPopup({
              title: 'Disconnect Wallet?',
              message: 'Are you sure you want to disconnect your wallet?',
              buttons: [
                { id: 'cancel', type: 'cancel' },
                { id: 'disconnect', type: 'destructive', text: 'Disconnect' }
              ]
            }, async (buttonId) => {
              if (buttonId === 'disconnect') {
                await tc.disconnect();
                
                if (tg?.HapticFeedback) {
                  tg.HapticFeedback.notificationOccurred('success');
                }
                
                console.log('[profile] Wallet disconnected');
              }
            });
          } else {
            // Fallback для обычного браузера
            if (confirm('Disconnect wallet?')) {
              await tc.disconnect();
              console.log('[profile] Wallet disconnected');
            }
          }
        } catch (error) {
          console.error('[profile] Failed to disconnect wallet:', error);
          
          if (tg?.showAlert) {
            tg.showAlert('Failed to disconnect wallet');
          } else {
            alert('Failed to disconnect wallet');
          }
        }
      });
    }
  
    // Слушаем изменения в TonConnect
    function setupTonConnectListener() {
      const tc = window.__wtTonConnect;
      if (tc) {
        tc.onStatusChange((wallet) => {
          console.log('[profile] TonConnect status changed:', wallet ? 'connected' : 'disconnected');
          updateWalletUI();
        });
        
        // Обновляем сразу
        updateWalletUI();
      }
    }
  
    // Инициализация при загрузке
    function init() {
      console.log('[profile] Initializing profile module');
      
      // Обновляем информацию о пользователе
      updateUserUI();
      
      // Если TonConnect уже готов, настраиваем слушатель
      if (window.__wtTonConnect) {
        setupTonConnectListener();
      } else {
        // Ждем готовности TonConnect
        window.addEventListener('wt-tc-ready', () => {
          console.log('[profile] TonConnect ready, setting up listener');
          setupTonConnectListener();
        });
      }
    }
  
    // Запускаем инициализацию
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  
    // Экспорт функций для использования в других модулях
    window.WTProfile = {
      updateUserUI,
      updateWalletUI,
      getTelegramUser
    };
  
    console.log('[profile] Profile module loaded');
  })();