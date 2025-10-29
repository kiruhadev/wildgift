/**
 * cases.js - Cases System with Smooth Animations
 * Оптимизировано для Telegram WebApp
 */

(function() {
  'use strict';

  // ================== TELEGRAM GIFTS DATA ==================
  const TELEGRAM_GIFTS = {
    // Common gifts
    green_star: { name: 'Green Star', emoji: '⭐', value: 15, rarity: 'common' },
    christmas_tree: { name: 'Christmas Tree', emoji: '🎄', value: 20, rarity: 'common' },
    gift_box: { name: 'Gift Box', emoji: '🎁', value: 25, rarity: 'common' },
    blue_star: { name: 'Blue Star', emoji: '💫', value: 30, rarity: 'common' },
    party_popper: { name: 'Party Popper', emoji: '🎉', value: 35, rarity: 'common' },
    balloon: { name: 'Balloon', emoji: '🎈', value: 40, rarity: 'common' },
    champagne: { name: 'Champagne', emoji: '🍾', value: 50, rarity: 'common' },
    cake: { name: 'Birthday Cake', emoji: '🎂', value: 60, rarity: 'common' },
    candy: { name: 'Candy', emoji: '🍬', value: 75, rarity: 'common' },
    sparkles: { name: 'Sparkles', emoji: '✨', value: 100, rarity: 'common' },
    
    // Rare gifts
    diamond: { name: 'Diamond', emoji: '💎', value: 150, rarity: 'rare' },
    letter: { name: 'Love Letter', emoji: '💌', value: 200, rarity: 'rare' },
    clover: { name: 'Four-leaf Clover', emoji: '🍀', value: 250, rarity: 'rare' },
    rocket: { name: 'Rocket', emoji: '🚀', value: 300, rarity: 'rare' },
    
    // Epic gifts
    crystal: { name: 'Crystal', emoji: '🔮', value: 500, rarity: 'epic' },
    teddy_bear: { name: 'Teddy Bear', emoji: '🧸', value: 750, rarity: 'epic' },
    gold_bars: { name: 'Gold Bars', emoji: '🏆', value: 1000, rarity: 'epic' },
    
    // Legendary main prizes
    plush_pepe: { name: 'PlushPepe', emoji: '🐸', value: 1000000, rarity: 'legendary' }
  };

  // ================== TEST CASES DATA ==================
  const CASES_DATA = {
    1: {
      id: 1,
      name: 'Starter Pack',
      price: 0,
      image: '/images/cases/case-01.png',
      description: 'Perfect for beginners! Try your luck with common gifts.',
      mainPrize: 'plush_pepe',
      rewards: [
        { gift: 'green_star', chance: 25.0 },
        { gift: 'christmas_tree', chance: 20.0 },
        { gift: 'gift_box', chance: 18.0 },
        { gift: 'blue_star', chance: 15.0 },
        { gift: 'party_popper', chance: 10.0 },
        { gift: 'champagne', chance: 7.0 },
        { gift: 'diamond', chance: 4.0 },
        { gift: 'crystal', chance: 0.99 },
        { gift: 'plush_pepe', chance: 0.01 }
      ]
    },
    2: {
      id: 2,
      name: 'Lucky Box',
      price: 0,
      image: '/images/cases/case-02.png',
      description: 'Test your luck with rare rewards!',
      mainPrize: 'plush_pepe',
      rewards: [
        { gift: 'balloon', chance: 22.0 },
        { gift: 'champagne', chance: 20.0 },
        { gift: 'cake', chance: 18.0 },
        { gift: 'candy', chance: 15.0 },
        { gift: 'sparkles', chance: 10.0 },
        { gift: 'diamond', chance: 8.0 },
        { gift: 'letter', chance: 4.0 },
        { gift: 'teddy_bear', chance: 2.0 },
        { gift: 'crystal', chance: 0.99 },
        { gift: 'plush_pepe', chance: 0.01 }
      ]
    },
    3: {
      id: 3,
      name: 'Epic Chest',
      price: 0,
      image: '/images/cases/case-03.png',
      description: 'Maximum luck! Epic gifts await!',
      mainPrize: 'plush_pepe',
      rewards: [
        { gift: 'sparkles', chance: 20.0 },
        { gift: 'diamond', chance: 18.0 },
        { gift: 'letter', chance: 16.0 },
        { gift: 'clover', chance: 14.0 },
        { gift: 'rocket', chance: 12.0 },
        { gift: 'crystal', chance: 10.0 },
        { gift: 'teddy_bear', chance: 6.0 },
        { gift: 'gold_bars', chance: 3.0 },
        { gift: 'plush_pepe', chance: 1.0 }
      ]
    }
  };

  // ================== STATE ==================
  let currentCaseId = null;
  let isDemoMode = false;
  let userInventory = [];
  let userStats = {
    casesOpened: 0,
    giftsWon: 0,
    totalValue: 0,
    recentOpenings: []
  };
  
  const tg = window.Telegram?.WebApp;

  // ================== INIT ==================
  function init() {
    console.log('[Cases] Initializing...');
    
    loadUserData();
    renderCasesGrid();
    attachEventListeners();
    updateInventoryDisplay();
    
    // Telegram WebApp setup
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
    }
    
    console.log('[Cases] Ready!');
  }

  // ================== RENDER CASES GRID ==================
  function renderCasesGrid() {
    const grid = document.getElementById('casesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    Object.values(CASES_DATA).forEach((caseData, index) => {
      const card = createCaseCard(caseData);
      card.style.animationDelay = `${index * 0.1}s`;
      grid.appendChild(card);
    });

    console.log('[Cases] Rendered', Object.keys(CASES_DATA).length, 'cases');
  }

  function createCaseCard(caseData) {
    const card = document.createElement('div');
    card.className = 'case-card';
    card.dataset.caseId = caseData.id;
    
    card.innerHTML = `
      <div class="case-card__image">
        <img class="case-img" src="${caseData.image}" alt="${caseData.name}" onerror="this.style.display='none'" />
        <div class="case-card__glow"></div>
      </div>
      <div class="case-card__info">
        <h3 class="case-card__title">${caseData.name}</h3>
        <div class="case-card__price">
          <img src="/icons/stars.svg" alt="" class="price-icon" />
          <span>${caseData.price === 0 ? 'FREE' : caseData.price}</span>
        </div>
      </div>
    `;
    
    return card;
  }

  // ================== EVENT LISTENERS ==================
  function attachEventListeners() {
    const casesGrid = document.getElementById('casesGrid');
    if (casesGrid) {
      casesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.case-card[data-case-id]');
        if (card) {
          const caseId = parseInt(card.dataset.caseId);
          openCaseDetail(caseId);
        }
      });
    }

    const backBtn = document.getElementById('caseBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', closeCaseDetail);
    }

    const openBtn = document.getElementById('openCaseBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => handleOpenCase(false));
    }

    const demoBtn = document.getElementById('demoCaseBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => handleOpenCase(true));
    }

    const resultClose = document.getElementById('resultClose');
    if (resultClose) {
      resultClose.addEventListener('click', closeResultModal);
    }

    const resultOpenAnother = document.getElementById('resultOpenAnother');
    if (resultOpenAnother) {
      resultOpenAnother.addEventListener('click', () => {
        closeResultModal();
        handleOpenCase(isDemoMode);
      });
    }

    const resultModal = document.getElementById('resultModal');
    if (resultModal) {
      resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal || e.target.classList.contains('result-modal__backdrop')) {
          closeResultModal();
        }
      });
    }
  }

  // ================== NAVIGATION ==================
  function openCaseDetail(caseId) {
    const caseData = CASES_DATA[caseId];
    if (!caseData) {
      console.error('[Cases] Case not found:', caseId);
      return;
    }

    currentCaseId = caseId;
    updateCaseDetailContent(caseData);

    const casesPage = document.getElementById('casesPage');
    const detailPage = document.getElementById('caseDetailPage');
    
    if (casesPage) casesPage.classList.remove('page-active');
    if (detailPage) detailPage.classList.add('page-active');

    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeCaseDetail() {
    const casesPage = document.getElementById('casesPage');
    const detailPage = document.getElementById('caseDetailPage');
    
    if (detailPage) detailPage.classList.remove('page-active');
    if (casesPage) casesPage.classList.add('page-active');

    currentCaseId = null;

    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ================== CONTENT UPDATE ==================
  function updateCaseDetailContent(caseData) {
    const image = document.getElementById('caseDetailImage');
    if (image) {
      image.src = caseData.image;
      image.alt = caseData.name;
      image.onerror = () => {
        image.style.display = 'none';
        image.parentElement.style.background = 'linear-gradient(135deg, #00a6ff22, #0d68c322)';
      };
    }

    const title = document.getElementById('caseDetailTitle');
    if (title) title.textContent = caseData.name;

    const description = document.getElementById('caseDetailDescription');
    if (description) description.textContent = caseData.description;

    const price = document.getElementById('caseDetailPrice');
    if (price) price.textContent = caseData.price === 0 ? 'FREE' : caseData.price;

    const openBtnText = document.querySelector('#openCaseBtn .btn__text');
    if (openBtnText) {
      openBtnText.textContent = `Open for ${caseData.price === 0 ? 'FREE' : caseData.price + ' ⭐'}`;
    }

    const mainPrize = document.getElementById('mainPrize');
    if (mainPrize) {
      const prize = TELEGRAM_GIFTS[caseData.mainPrize];
      mainPrize.innerHTML = createMainPrizeHTML(prize);
    }

    const rewardsList = document.getElementById('caseRewardsList');
    if (rewardsList) {
      rewardsList.innerHTML = '';
      
      caseData.rewards
        .filter(r => r.gift !== caseData.mainPrize)
        .forEach(reward => {
          const gift = TELEGRAM_GIFTS[reward.gift];
          const rewardItem = createRewardItem(gift, reward.chance);
          rewardsList.appendChild(rewardItem);
        });
    }
  }

  function createMainPrizeHTML(gift) {
    return `
      <div class="main-prize__card">
        <div class="main-prize__badge">MAIN PRIZE</div>
        <div class="main-prize__emoji">${gift.emoji}</div>
        <div class="main-prize__name">${gift.name}</div>
        <div class="main-prize__value">
          <img src="/icons/stars.svg" alt="" class="prize-value-icon" />
          <span>${gift.value.toLocaleString()}</span>
        </div>
        <div class="main-prize__glow"></div>
      </div>
    `;
  }

  function createRewardItem(gift, chance) {
    const item = document.createElement('div');
    item.className = 'reward-item';
    
    item.innerHTML = `
      <div class="reward-item__image">
        <div class="reward-item__emoji">${gift.emoji}</div>
        <div class="reward-item__rarity reward-item__rarity--${gift.rarity}"></div>
      </div>
      <div class="reward-item__info">
        <div class="reward-item__name">${gift.name}</div>
        <div class="reward-item__value">
          <img src="/icons/stars.svg" alt="" class="reward-value-icon" />
          <span>${gift.value}</span>
        </div>
      </div>
      <div class="reward-item__chance">${chance.toFixed(1)}%</div>
    `;
    
    return item;
  }

  // ================== OPEN CASE ==================
  async function handleOpenCase(demoMode = false) {
    if (!currentCaseId) {
      console.error('[Cases] No case selected');
      return;
    }

    const caseData = CASES_DATA[currentCaseId];
    isDemoMode = demoMode;
    
    console.log('[Cases] Opening:', caseData.name, demoMode ? '(DEMO)' : '');

    if (!demoMode && caseData.price > 0) {
      const balance = window.WildTimeCurrency?.balance?.stars || 0;
      if (balance < caseData.price) {
        if (tg?.showAlert) {
          tg.showAlert('Insufficient balance. Please buy Stars first.');
        } else {
          alert('Insufficient balance. Please buy Stars first.');
        }
        
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
        return;
      }
    }

    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }

    try {
      const wonGift = selectRandomGift(caseData);
      
      await showOpeningAnimation(caseData, wonGift);
      
      console.log('[Cases] Won:', wonGift.name, isDemoMode ? '(DEMO)' : '');

      if (!demoMode) {
        if (caseData.price > 0 && window.WildTimeCurrency) {
          const balance = window.WildTimeCurrency.balance.stars;
          const newBalance = balance - caseData.price;
          window.WildTimeCurrency.setBalance('stars', newBalance);
        }

        userInventory.push({
          ...wonGift,
          timestamp: Date.now(),
          caseId: caseData.id,
          caseName: caseData.name
        });

        userStats.casesOpened++;
        userStats.giftsWon++;
        userStats.totalValue += wonGift.value;
        userStats.recentOpenings.unshift({
          gift: wonGift,
          caseName: caseData.name,
          timestamp: Date.now()
        });
        if (userStats.recentOpenings.length > 10) {
          userStats.recentOpenings.pop();
        }

        saveUserData();
        updateInventoryDisplay();
      }

      showResult(wonGift, caseData, demoMode);

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }

    } catch (error) {
      console.error('[Cases] Error:', error);
      
      if (tg?.showAlert) {
        tg.showAlert('Failed to open case. Please try again.');
      } else {
        alert('Failed to open case. Please try again.');
      }

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
    }
  }

  function selectRandomGift(caseData) {
    const totalChance = caseData.rewards.reduce((sum, r) => sum + r.chance, 0);
    let random = Math.random() * totalChance;

    for (const reward of caseData.rewards) {
      random -= reward.chance;
      if (random <= 0) {
        const gift = TELEGRAM_GIFTS[reward.gift];
        return { ...gift, key: reward.gift };
      }
    }

    const fallbackGift = TELEGRAM_GIFTS[caseData.rewards[0].gift];
    return { ...fallbackGift, key: caseData.rewards[0].gift };
  }

  // ================== SMOOTH OPENING ANIMATION ==================
  async function showOpeningAnimation(caseData, wonGift) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('openingOverlay');
      const reel = document.getElementById('openingReel');
      
      if (!overlay || !reel) {
        console.warn('[Cases] Animation elements not found');
        resolve();
        return;
      }

      // Генерируем барабан с призами
      reel.innerHTML = '';
      const prizes = [];
      const totalItems = 30; // Увеличиваем количество элементов для плавности
      
      // Добавляем случайные призы
      for (let i = 0; i < totalItems; i++) {
        let gift;
        
        // Выигрышный приз будет в конце (в центре после анимации)
        if (i === totalItems - 3) {
          gift = wonGift;
        } else {
          const reward = caseData.rewards[Math.floor(Math.random() * caseData.rewards.length)];
          gift = TELEGRAM_GIFTS[reward.gift];
        }
        
        prizes.push(gift);
      }

      // Создаём элементы барабана
      prizes.forEach((gift, index) => {
        const item = document.createElement('div');
        item.className = `opening-item opening-item--${gift.rarity}`;
        item.innerHTML = `
          <div class="opening-item__emoji">${gift.emoji}</div>
          <div class="opening-item__name">${gift.name}</div>
        `;
        reel.appendChild(item);
      });

      // Добавляем указатель
      const pointer = document.createElement('div');
      pointer.className = 'opening-pointer';
      pointer.textContent = '▼';
      overlay.querySelector('.opening-content').appendChild(pointer);

      // Показываем оверлей
      overlay.hidden = false;
      overlay.style.opacity = '1';

      // Запускаем анимацию прокрутки
      reel.style.transition = 'none';
      reel.style.transform = 'translateX(0)';
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Вычисляем финальную позицию (выигрышный приз в центре)
          const itemWidth = 120 + 20; // ширина + gap
          const winningIndex = totalItems - 3;
          const distance = -(winningIndex * itemWidth - window.innerWidth / 2 + 60);
          
          reel.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
          reel.style.transform = `translateX(${distance}px)`;
          
          // Вибрация в ключевые моменты
          if (tg?.HapticFeedback) {
            setTimeout(() => tg.HapticFeedback.impactOccurred('light'), 1000);
            setTimeout(() => tg.HapticFeedback.impactOccurred('light'), 2000);
            setTimeout(() => tg.HapticFeedback.impactOccurred('medium'), 3000);
            setTimeout(() => tg.HapticFeedback.impactOccurred('heavy'), 3800);
          }
        });
      });

      // Скрываем после завершения
      setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.hidden = true;
          if (pointer.parentNode) {
            pointer.remove();
          }
          resolve();
        }, 300);
      }, 4500);
    });
  }

  // ================== RESULT MODAL ==================
  function showResult(gift, caseData, isDemoMode) {
    const modal = document.getElementById('resultModal');
    const giftIcon = document.getElementById('resultGiftIcon');
    const giftName = document.getElementById('resultGiftName');
    const giftValue = document.getElementById('resultGiftValue');
    const openAnotherBtn = document.getElementById('resultOpenAnother');

    if (!modal) return;

    if (giftIcon) giftIcon.textContent = gift.emoji;
    if (giftName) giftName.textContent = gift.name;
    if (giftValue) {
      giftValue.innerHTML = `<img src="/icons/stars.svg" alt="" /> <span>${gift.value.toLocaleString()}</span>`;
    }

    if (openAnotherBtn) {
      openAnotherBtn.textContent = isDemoMode ? '🎮 Try Demo Again' : '🎁 Try Again';
    }

    modal.hidden = false;
    modal.style.opacity = '1';

    if (gift.rarity === 'epic' || gift.rarity === 'legendary') {
      launchConfetti();
    }
  }

  function closeResultModal() {
    const modal = document.getElementById('resultModal');
    if (!modal) return;

    modal.style.opacity = '0';
    setTimeout(() => {
      modal.hidden = true;
    }, 300);
  }

  function launchConfetti() {
    const confettiContainer = document.querySelector('.result-confetti');
    if (!confettiContainer) return;

    confettiContainer.innerHTML = '';
    
    const colors = ['#ffd700', '#ff6b6b', '#4299e1', '#9f7aea', '#48bb78'];
    
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 0.5 + 's';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.width = (Math.random() * 8 + 6) + 'px';
      confetti.style.height = confetti.style.width;
      confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
      confettiContainer.innerHTML = '';
    }, 3500);
  }

  // ================== INVENTORY ==================
  function updateInventoryDisplay() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    if (userInventory.length === 0) {
      grid.innerHTML = `
        <div class="inv-empty" style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
          <div style="font-size: 64px; margin-bottom: 16px;">🎁</div>
          <div style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 8px;">No gifts yet</div>
          <div style="font-size: 13px; color: var(--muted);">Open cases to get gifts!</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    
    const groupedGifts = {};
    userInventory.forEach(gift => {
      if (!groupedGifts[gift.key]) {
        groupedGifts[gift.key] = {
          gift: gift,
          count: 0
        };
      }
      groupedGifts[gift.key].count++;
    });

    Object.values(groupedGifts).forEach(group => {
      const card = document.createElement('div');
      card.className = `inv-card inv-card--${group.gift.rarity}`;
      card.style.cssText = `
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        text-align: center;
        position: relative;
      `;
      
      card.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 12px;">${group.gift.emoji}</div>
        <div style="font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 6px;">${group.gift.name}</div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px; color: var(--accent); font-weight: 700;">
          <img src="/icons/stars.svg" style="width: 14px; height: 14px;" />
          <span>${group.gift.value}</span>
        </div>
        ${group.count > 1 ? `<div style="position: absolute; top: 8px; right: 8px; background: var(--accent); color: #000; font-size: 11px; font-weight: 900; padding: 4px 8px; border-radius: 999px;">x${group.count}</div>` : ''}
      `;
      grid.appendChild(card);
    });

    const totalEl = document.getElementById('invTotal');
    const valueEl = document.getElementById('invValue');
    
    if (totalEl) totalEl.textContent = userInventory.length;
    if (valueEl) valueEl.textContent = userStats.totalValue.toLocaleString();
  }

  // ================== STORAGE ==================
  function saveUserData() {
    try {
      localStorage.setItem('wt-inventory', JSON.stringify(userInventory));
      localStorage.setItem('wt-stats', JSON.stringify(userStats));
    } catch (e) {
      console.warn('[Cases] Save failed:', e);
    }
  }

  function loadUserData() {
    try {
      const savedInventory = localStorage.getItem('wt-inventory');
      const savedStats = localStorage.getItem('wt-stats');
      
      if (savedInventory) userInventory = JSON.parse(savedInventory);
      if (savedStats) userStats = JSON.parse(savedStats);
    } catch (e) {
      console.warn('[Cases] Load failed:', e);
    }
  }

  // ================== PUBLIC API ==================
  window.WildTimeCases = {
    openCase: openCaseDetail,
    closeCase: closeCaseDetail,
    getCurrentCase: () => currentCaseId,
    getCaseData: (id) => CASES_DATA[id],
    getInventory: () => [...userInventory],
    getStats: () => ({ ...userStats }),
    clearData: () => {
      userInventory = [];
      userStats = {
        casesOpened: 0,
        giftsWon: 0,
        totalValue: 0,
        recentOpenings: []
      };
      saveUserData();
      updateInventoryDisplay();
      console.log('[Cases] Data cleared');
    }
  };

  // ================== AUTO-INIT ==================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();