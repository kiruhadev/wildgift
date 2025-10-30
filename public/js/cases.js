/**
 * cases.js - Cases System (TEST VERSION)
 * 3 тестовых кейса со стоимостью 0 звёзд
 */

(function() {
  'use strict';

  // ================== TELEGRAM GIFTS DATA ==================
  const TELEGRAM_GIFTS = {
    // Common gifts
    green_star: { name: 'Green Star', emoji: '⭐', value: 15, rarity: 'common' },
    christmas_tree: { name: 'Christmas Tree', emoji: '🎄', value: 15, rarity: 'common' },
    gift_box: { name: 'Gift Box', emoji: '🎁', value: 25, rarity: 'common' },
    champagne: { name: 'Champagne', emoji: '🍾', value: 50, rarity: 'common' },
    
    // Rare gifts
    diamond: { name: 'Diamond', emoji: '💎', value: 100, rarity: 'rare' },
    letter: { name: 'Love Letter', emoji: '💌', value: 310, rarity: 'rare' },
    clover: { name: 'Four-leaf Clover', emoji: '🍀', value: 440, rarity: 'rare' },
    rocket: { name: 'Rocket', emoji: '🚀', value: 480, rarity: 'rare' },
    
    // Epic gifts
    crystal: { name: 'Crystal', emoji: '🔮', value: 810, rarity: 'epic' },
    teddy_bear: { name: 'Teddy Bear', emoji: '🧸', value: 1500, rarity: 'epic' },
    gold_bars: { name: 'Gold Bars', emoji: '🏆', value: 999, rarity: 'epic' },
    peach: { name: 'Juicy Peach', emoji: '🍑', value: 1499, rarity: 'epic' }
  };

  // ================== TEST CASES DATA ==================
  const CASES_DATA = {
    1: {
      id: 1,
      name: 'Starter Pack',
      price: 0, // FREE для тестирования
      image: '/images/cases/case-01.png',
      description: 'Perfect for testing! Try your luck with common gifts.',
      rewards: [
        { gift: 'green_star', chance: 40.0 },
        { gift: 'christmas_tree', chance: 30.0 },
        { gift: 'gift_box', chance: 20.0 },
        { gift: 'champagne', chance: 8.0 },
        { gift: 'diamond', chance: 2.0 }
      ]
    },
    2: {
      id: 2,
      name: 'Lucky Box',
      price: 0, // FREE для тестирования
      image: '/images/cases/case-02.png',
      description: 'Test your luck with rare rewards!',
      rewards: [
        { gift: 'champagne', chance: 30.0 },
        { gift: 'diamond', chance: 25.0 },
        { gift: 'letter', chance: 20.0 },
        { gift: 'rocket', chance: 15.0 },
        { gift: 'crystal', chance: 8.0 },
        { gift: 'teddy_bear', chance: 2.0 }
      ]
    },
    3: {
      id: 3,
      name: 'Epic Chest',
      price: 0, // FREE для тестирования
      image: '/images/cases/case-03.png',
      description: 'Maximum luck! Epic gifts await!',
      rewards: [
        { gift: 'diamond', chance: 30.0 },
        { gift: 'rocket', chance: 25.0 },
        { gift: 'crystal', chance: 20.0 },
        { gift: 'clover', chance: 15.0 },
        { gift: 'gold_bars', chance: 7.0 },
        { gift: 'teddy_bear', chance: 3.0 }
      ]
    }
  };

  // ================== STATE ==================
  let currentCaseId = null;
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
    console.log('[Cases] Initializing cases system...');
    
    loadUserData();
    attachEventListeners();
    updateInventoryDisplay();
    
    console.log('[Cases] Cases system ready');
  }

  // ================== EVENT LISTENERS ==================
  function attachEventListeners() {
    // Клики по карточкам кейсов
    const caseCards = document.querySelectorAll('.case-card[data-case-id]');
    caseCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const caseId = parseInt(card.dataset.caseId);
        openCaseDetail(caseId);
      });
    });

    // Кнопка "Назад"
    const backBtn = document.getElementById('caseBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', closeCaseDetail);
    }

    // Кнопка "Открыть кейс"
    const openBtn = document.getElementById('openCaseBtn');
    if (openBtn) {
      openBtn.addEventListener('click', handleOpenCase);
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
    console.log('[Cases] Opening case detail:', caseData.name);

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
    console.log('[Cases] Closing case detail');

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
    // Обновляем изображение
    const image = document.getElementById('caseDetailImage');
    if (image) {
      image.src = caseData.image;
      image.alt = caseData.name;
      image.onerror = () => {
        // Если изображения нет, показываем плейсхолдер
        image.style.display = 'none';
        image.parentElement.style.background = 'linear-gradient(135deg, #00a6ff22, #0d68c322)';
      };
    }

    // Обновляем заголовок
    const title = document.getElementById('caseDetailTitle');
    if (title) {
      title.textContent = caseData.name;
    }

    // Обновляем описание
    const description = document.getElementById('caseDetailDescription');
    if (description) {
      description.textContent = caseData.description;
    }

    // Обновляем цену (FREE для тестирования)
    const price = document.getElementById('caseDetailPrice');
    if (price) {
      price.textContent = caseData.price === 0 ? 'FREE' : caseData.price;
    }

    const openPrice = document.getElementById('openCasePrice');
    if (openPrice) {
      openPrice.textContent = caseData.price === 0 ? 'FREE' : caseData.price;
    }

    // Генерируем список наград
    const rewardsList = document.getElementById('caseRewardsList');
    if (rewardsList) {
      rewardsList.innerHTML = '';
      
      caseData.rewards.forEach(reward => {
        const gift = TELEGRAM_GIFTS[reward.gift];
        const rewardItem = createRewardItem(gift, reward.chance);
        rewardsList.appendChild(rewardItem);
      });
    }
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
  async function handleOpenCase() {
    if (!currentCaseId) {
      console.error('[Cases] No case selected');
      return;
    }

    const caseData = CASES_DATA[currentCaseId];
    console.log('[Cases] Opening case:', caseData.name);

    // Для тестирования проверка баланса отключена (цена = 0)
    if (caseData.price > 0) {
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

    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }

    try {
      // Выбираем случайный подарок
      const wonGift = selectRandomGift(caseData);
      
      console.log('[Cases] Won gift:', wonGift);

      // Обновляем баланс (только если цена > 0)
      if (caseData.price > 0 && window.WildTimeCurrency) {
        const balance = window.WildTimeCurrency.balance.stars;
        const newBalance = balance - caseData.price;
        window.WildTimeCurrency.setBalance('stars', newBalance);
      }

      // Добавляем в инвентарь
      userInventory.push({
        ...wonGift,
        timestamp: Date.now(),
        caseId: caseData.id,
        caseName: caseData.name
      });

      // Обновляем статистику
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

      // Показываем результат
      showResult(wonGift, caseData);

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }

    } catch (error) {
      console.error('[Cases] Error opening case:', error);
      
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
    // Weighted random selection
    const totalChance = caseData.rewards.reduce((sum, r) => sum + r.chance, 0);
    let random = Math.random() * totalChance;

    for (const reward of caseData.rewards) {
      random -= reward.chance;
      if (random <= 0) {
        const gift = TELEGRAM_GIFTS[reward.gift];
        return { ...gift, key: reward.gift };
      }
    }

    // Fallback
    const fallbackGift = TELEGRAM_GIFTS[caseData.rewards[0].gift];
    return { ...fallbackGift, key: caseData.rewards[0].gift };
  }

  function showResult(gift, caseData) {
    // Используем Telegram popup если доступен
    if (tg?.showPopup) {
      tg.showPopup({
        title: `${gift.emoji} Congratulations!`,
        message: `You won ${gift.name} from ${caseData.name}!\nValue: ${gift.value} ⭐`,
        buttons: [
          { id: 'again', type: 'default', text: 'Open Another' },
          { id: 'close', type: 'close', text: 'Close' }
        ]
      }, (buttonId) => {
        if (buttonId === 'again') {
          handleOpenCase();
        }
      });
    } else {
      // Fallback для браузера
      const openAnother = confirm(
        `🎉 Congratulations!\n\n` +
        `You won: ${gift.emoji} ${gift.name}\n` +
        `Value: ${gift.value} ⭐\n` +
        `From: ${caseData.name}\n\n` +
        `Open another case?`
      );
      
      if (openAnother) {
        handleOpenCase();
      }
    }
  }

  // ================== INVENTORY ==================
  function updateInventoryDisplay() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    if (userInventory.length === 0) {
      grid.innerHTML = `
        <div class="inv-empty">
          <div class="inv-empty__icon">🎁</div>
          <div class="inv-empty__text">No gifts yet</div>
          <div class="inv-empty__hint">Open cases to get gifts!</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    
    // Группируем подарки по типу
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

    // Отображаем сгруппированные подарки
    Object.values(groupedGifts).forEach(group => {
      const card = document.createElement('div');
      card.className = `inv-card inv-card--${group.gift.rarity}`;
      card.innerHTML = `
        <div class="inv-card__emoji">${group.gift.emoji}</div>
        <div class="inv-card__name">${group.gift.name}</div>
        <div class="inv-card__value">
          <img src="/icons/stars.svg" alt="" class="inv-value-icon" />
          <span>${group.gift.value}</span>
        </div>
        ${group.count > 1 ? `<div class="inv-card__count">x${group.count}</div>` : ''}
      `;
      grid.appendChild(card);
    });

    // Обновляем статистику инвентаря
    const totalEl = document.getElementById('invTotal');
    const valueEl = document.getElementById('invValue');
    
    if (totalEl) totalEl.textContent = userInventory.length;
    if (valueEl) valueEl.textContent = userStats.totalValue;
  }

  // ================== STORAGE ==================
  function saveUserData() {
    try {
      localStorage.setItem('wt-inventory', JSON.stringify(userInventory));
      localStorage.setItem('wt-stats', JSON.stringify(userStats));
      console.log('[Cases] Data saved');
    } catch (e) {
      console.warn('[Cases] Failed to save data:', e);
    }
  }

  function loadUserData() {
    try {
      const savedInventory = localStorage.getItem('wt-inventory');
      const savedStats = localStorage.getItem('wt-stats');
      
      if (savedInventory) {
        userInventory = JSON.parse(savedInventory);
        console.log('[Cases] Loaded inventory:', userInventory.length, 'items');
      }
      if (savedStats) {
        userStats = JSON.parse(savedStats);
        console.log('[Cases] Loaded stats:', userStats);
      }
    } catch (e) {
      console.warn('[Cases] Failed to load data:', e);
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