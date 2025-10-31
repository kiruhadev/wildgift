// /public/js/profile.js - UPDATED VERSION
(() => {
  const tg = window.Telegram?.WebApp;

  // ====== DOM ELEMENTS ======
  
  // Topbar
  const userPill = document.getElementById('userPill');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');

  // Profile Page
  const profileAvatar = document.getElementById('profileAvatar');
  const profileName = document.getElementById('profileName');
  const profileHandle = document.getElementById('profileHandle');
  
  // Balance Display
  const profileBalanceIcon = document.getElementById('profileBalanceIcon');
  const profileBalanceValue = document.getElementById('profileBalanceValue');

  // Wallet Card
  const walletCard = document.getElementById('walletCard');
  const walletCardStatus = document.getElementById('walletCardStatus');
  const walletCardToggle = document.getElementById('walletCardToggle');
  const walletCardDetails = document.getElementById('walletCardDetails');
  const walletCardAddress = document.getElementById('walletCardAddress');
  const walletCardCopy = document.getElementById('walletCardCopy');
  const walletCardDisconnect = document.getElementById('walletCardDisconnect');

  // ====== UTILITIES ======

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

  function getDisplayName(user) {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    return fullName || 'User';
  }

  function getDisplayHandle(user) {
    return user.username ? `@${user.username}` : `ID: ${user.id || 'Unknown'}`;
  }

  function getShortAddress(address) {
    if (!address) return 'Not connected';
    return `${address.slice(0, 4)}…${address.slice(-4)}`;
  }

  // ====== USER UI ======

  function updateUserUI() {
    const user = getTelegramUser();
    const displayName = getDisplayName(user);
    const displayHandle = getDisplayHandle(user);

    // Аватар
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

    // Имя в topbar (только имя)
    if (userName) {
      userName.textContent = user.firstName;
    }

    // Имя в профиле (полное имя)
    if (profileName) {
      profileName.textContent = displayName;
    }

    // Handle в профиле
    if (profileHandle) {
      profileHandle.textContent = displayHandle;
    }

    console.log('[Profile] User UI updated:', { displayName, displayHandle });
  }

  // ====== BALANCE UI ======

  function updateBalanceUI() {
    if (!window.WildTimeCurrency) {
      console.warn('[Profile] Currency system not loaded');
      return;
    }

    const currency = window.WildTimeCurrency.current;
    const balance = window.WildTimeCurrency.balance;

    // Обновляем иконку
    if (profileBalanceIcon) {
      profileBalanceIcon.src = currency === 'ton' ? '/icons/ton.svg' : '/icons/stars.svg';
    }

    // Обновляем значение
    if (profileBalanceValue) {
      const value = currency === 'ton' 
        ? balance.ton.toFixed(2)
        : window.WildTimeCurrency.formatStars(balance.stars);
      
      profileBalanceValue.textContent = value;
    }

    console.log('[Profile] Balance updated:', { currency, balance });
  }

  // ====== WALLET UI ======

  function updateWalletUI() {
    const tc = window.__wtTonConnect;
    
    if (!tc || !tc.account) {
      // Не подключен
      if (walletCardStatus) {
        walletCardStatus.textContent = 'Not connected';
        walletCardStatus.style.color = 'var(--muted)';
      }
      if (walletCardAddress) {
        walletCardAddress.textContent = '—';
      }
      if (walletCardDetails && !walletCardDetails.hidden) {
        walletCardDetails.hidden = true;
        walletCardToggle?.classList.remove('open');
      }
      console.log('[Profile] Wallet not connected');
      return;
    }

    // Подключен
    const address = tc.account.address;
    const shortAddr = getShortAddress(address);

    if (walletCardStatus) {
      walletCardStatus.textContent = shortAddr;
      walletCardStatus.style.color = 'var(--accent)';
    }

    if (walletCardAddress) {
      const friendlyAddr = window.WT?.utils?.ensureFriendly?.(address) || address;
      walletCardAddress.textContent = friendlyAddr;
    }

    console.log('[Profile] Wallet UI updated:', shortAddr);
  }

  // ====== WALLET CARD TOGGLE ======

  if (walletCardToggle) {
    walletCardToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (!walletCardDetails) return;
      
      const tc = window.__wtTonConnect;
      if (!tc?.account) {
        // Если кошелёк не подключён, открываем попап подключения
        if (window.WTTonDeposit?.open) {
          window.WTTonDeposit.open();
        }
        return;
      }

      // Переключаем видимость деталей
      const isHidden = walletCardDetails.hidden;
      walletCardDetails.hidden = !isHidden;
      
      // Анимация шеврона
      if (isHidden) {
        walletCardToggle.classList.add('open');
      } else {
        walletCardToggle.classList.remove('open');
      }

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    });
  }

  // Клик по всей карточке тоже открывает/закрывает
  if (walletCard) {
    walletCard.querySelector('.wallet-card__header')?.addEventListener('click', () => {
      walletCardToggle?.click();
    });
  }

  // ====== COPY ADDRESS ======

  if (walletCardCopy) {
    walletCardCopy.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const tc = window.__wtTonConnect;
      if (!tc?.account) return;

      const address = window.WT?.utils?.ensureFriendly?.(tc.account.address) || tc.account.address;

      try {
        await navigator.clipboard.writeText(address);
        
        if (tg?.showPopup) {
          tg.showPopup({
            title: '✅ Copied!',
            message: 'Wallet address copied to clipboard',
            buttons: [{ type: 'ok' }]
          });
        } else {
          alert('Wallet address copied!');
        }

        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }

        console.log('[Profile] Address copied:', address);
      } catch (error) {
        console.error('[Profile] Copy failed:', error);
        
        if (tg?.showAlert) {
          tg.showAlert('Failed to copy address');
        } else {
          alert('Failed to copy address');
        }
      }
    });
  }

  // ====== DISCONNECT WALLET ======

  if (walletCardDisconnect) {
    walletCardDisconnect.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const tc = window.__wtTonConnect;
      if (!tc) return;

      try {
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
              
              console.log('[Profile] Wallet disconnected');
            }
          });
        } else {
          if (confirm('Disconnect wallet?')) {
            await tc.disconnect();
            console.log('[Profile] Wallet disconnected');
          }
        }
      } catch (error) {
        console.error('[Profile] Disconnect failed:', error);
        
        if (tg?.showAlert) {
          tg.showAlert('Failed to disconnect wallet');
        } else {
          alert('Failed to disconnect wallet');
        }
      }
    });
  }

  // ====== PROFILE ACTIONS ======

  document.querySelectorAll('.profile-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }

      switch (action) {
        case 'deposit':
          // Открываем попап депозита для текущей валюты
          if (window.WildTimeCurrency) {
            window.WildTimeCurrency.openPopup();
          }
          break;
          
        case 'history':
          console.log('[Profile] History clicked - not implemented yet');
          if (tg?.showAlert) {
            tg.showAlert('History feature coming soon!');
          }
          break;
          
        case 'settings':
          console.log('[Profile] Settings clicked - not implemented yet');
          if (tg?.showAlert) {
            tg.showAlert('Settings feature coming soon!');
          }
          break;
      }
    });
  });

  // ====== USER PILL (TOPBAR) ======

  if (userPill) {
    userPill.addEventListener('click', () => {
      console.log('[Profile] User pill clicked, navigating to profile');
      
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

        // Haptic feedback
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.impactOccurred('light');
        }
      }
    });
  }

  // ====== TONCONNECT LISTENER ======

  function setupTonConnectListener() {
    const tc = window.__wtTonConnect;
    if (tc) {
      tc.onStatusChange((wallet) => {
        console.log('[Profile] TonConnect status changed:', wallet ? 'connected' : 'disconnected');
        updateWalletUI();
      });
      
      // Обновляем сразу
      updateWalletUI();
    }
  }

  // ====== CURRENCY CHANGE LISTENER ======

  window.addEventListener('currency:changed', (e) => {
    console.log('[Profile] Currency changed:', e.detail.currency);
    updateBalanceUI();
  });

  // ====== BALANCE UPDATE LISTENER ======

  window.addEventListener('balance:update', (e) => {
    console.log('[Profile] Balance updated:', e.detail);
    updateBalanceUI();
  });

  // ====== INIT ======

  function init() {
    console.log('[Profile] Initializing profile module');
    
    // Обновляем информацию о пользователе
    updateUserUI();
    
    // Обновляем баланс
    updateBalanceUI();
    
    // Если TonConnect уже готов, настраиваем слушатель
    if (window.__wtTonConnect) {
      setupTonConnectListener();
    } else {
      // Ждём готовности TonConnect
      window.addEventListener('wt-tc-ready', () => {
        console.log('[Profile] TonConnect ready, setting up listener');
        setupTonConnectListener();
      });
    }
    
    console.log('[Profile] ✅ Profile module ready');
  }

  // Запускаем инициализацию
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ====== EXPORT ======

  window.WTProfile = {
    updateUserUI,
    updateWalletUI,
    updateBalanceUI,
    getTelegramUser
  };

  console.log('[Profile] Profile module loaded');
})();