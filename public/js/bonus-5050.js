// public/js/bonus-5050.js - Бонус 50&50 (ИСПРАВЛЕНО)
(() => {
    'use strict';
  
    console.log('[50&50] 🎰 Bonus module loading...');
  
    // ====== CONFIG ======
    const MULTIPLIERS = [
      { value: 1, color: 'red' },
      { value: 2, color: 'red' },
      { value: 3, color: 'red' },
      { value: 4, color: 'red' },
      { value: 9, color: 'green' },
      { value: 12, color: 'green' },
      { value: 15, color: 'green' },
      { value: 20, color: 'green' }
    ];
  
    const ITEM_HEIGHT = 100;
    
    // ====== STATE ======
    let isActive = false;
    let winningMultiplier = null;
    let currentCurrency = 'ton';
    let animationFrame = null;
  
    // ====== ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА ======
    window.start5050Bonus = async function(betAmount = 0) {
      if (isActive) {
        console.log('[50&50] ⚠️ Bonus already active');
        return;
      }
  
      console.log('[50&50] 🎰 Starting bonus with bet:', betAmount);
      isActive = true;
  
      if (window.WildTimeCurrency) {
        currentCurrency = window.WildTimeCurrency.current || 'ton';
      }
  
      winningMultiplier = generateWinningMultiplier();
      console.log('[50&50] 🎲 Winning:', winningMultiplier);
  
      createBonusOverlay();
      await animateIntro();
      await spinReel();
      await showWinAmount(betAmount);
      
      closeBonusOverlay();
      isActive = false;
    };
  
    // ====== ГЕНЕРАЦИЯ РЕЗУЛЬТАТА ======
    function generateWinningMultiplier() {
      const randomIndex = Math.floor(Math.random() * MULTIPLIERS.length);
      return MULTIPLIERS[randomIndex];
    }
  
    // ====== СОЗДАНИЕ ОВЕРЛЕЯ ======
    function createBonusOverlay() {
      const overlay = document.createElement('div');
      overlay.id = 'bonus-5050-overlay';
      overlay.innerHTML = `
        <div class="bonus-backdrop"></div>
        <div class="bonus-content">
          <div class="bonus-title">
            <div class="bonus-title-icon">50&50</div>
            <div class="bonus-title-text">Bonus Round!</div>
          </div>
          <div class="reel-container">
            <div class="reel">
              <div class="reel-inner" id="main-reel"></div>
              <div class="reel-mask"></div>
              <div class="reel-indicator"></div>
            </div>
          </div>
          <div class="bonus-hint">Watch the reel spin...</div>
        </div>
      `;
      document.body.appendChild(overlay);
      injectStyles();
    }
  
    // ====== АНИМАЦИЯ ПОЯВЛЕНИЯ ======
    function animateIntro() {
      return new Promise(resolve => {
        const overlay = document.getElementById('bonus-5050-overlay');
        const title = overlay.querySelector('.bonus-title');
        const hint = overlay.querySelector('.bonus-hint');
        const reel = overlay.querySelector('.reel-container');
        
        setTimeout(() => overlay.classList.add('active'), 50);
        setTimeout(() => title.classList.add('animate-in'), 300);
        setTimeout(() => reel.classList.add('animate-in'), 500);
        setTimeout(() => hint.classList.add('animate-in'), 800);
        
        // 🔥 ГЕНЕРАЦИЯ БАРАБАНА
        setTimeout(() => {
          const reelInner = document.getElementById('main-reel');
          let html = '';
          
          // Генерируем 50 случайных элементов
          for (let i = 0; i < 50; i++) {
            const randomIndex = Math.floor(Math.random() * MULTIPLIERS.length);
            const mult = MULTIPLIERS[randomIndex];
            const colorClass = mult.color === 'green' ? 'good' : 'bad';
            html += `<div class="reel-number ${colorClass}" data-value="${mult.value}">${mult.value}×</div>`;
          }
          
          // 🎯 ДОБАВЛЯЕМ ПОБЕДНЫЙ ЭЛЕМЕНТ В ПОЗИЦИЮ 30-35
          const insertPosition = 30 + Math.floor(Math.random() * 5);
          const items = html.split('</div>').filter(s => s.trim());
          const colorClass = winningMultiplier.color === 'green' ? 'good' : 'bad';
          const winnerHTML = `<div class="reel-number ${colorClass}" data-value="${winningMultiplier.value}" data-winner="true">${winningMultiplier.value}×</div>`;
          items.splice(insertPosition, 0, winnerHTML);
          
          // Добавляем ещё 20 элементов после победителя
          for (let i = 0; i < 20; i++) {
            const randomIndex = Math.floor(Math.random() * MULTIPLIERS.length);
            const mult = MULTIPLIERS[randomIndex];
            const colorClass = mult.color === 'green' ? 'good' : 'bad';
            items.push(`<div class="reel-number ${colorClass}" data-value="${mult.value}">${mult.value}×</div>`);
          }
          
          reelInner.innerHTML = items.join('');
          reelInner.style.opacity = '0';
          
          // Плавное появление
          setTimeout(() => {
            reelInner.style.transition = 'opacity 0.8s ease';
            reelInner.style.opacity = '1';
          }, 100);
        }, 1000);
        
        setTimeout(resolve, 2500);
      });
    }
  
    // ====== ОСНОВНАЯ АНИМАЦИЯ БАРАБАНА ======
    function spinReel() {
      return new Promise(resolve => {
        console.log('[50&50] 🎰 Starting spin...');
        
        const reel = document.getElementById('main-reel');
        const hint = document.querySelector('.bonus-hint');
        if (hint) hint.style.opacity = '0';
  
        // Ждём 0.5 сек чтобы числа появились
        setTimeout(() => {
          // Находим победный элемент
          const targetItem = reel.querySelector('[data-winner="true"]');
          
          if (!targetItem) {
            console.error('[50&50] Winner element not found!');
            resolve();
            return;
          }
    
          const items = Array.from(reel.querySelectorAll('.reel-number'));
          const targetIndex = items.indexOf(targetItem);
          const targetPosition = -(targetIndex * ITEM_HEIGHT) + 75;
    
          console.log('[50&50] Target at position:', targetIndex, 'of', items.length);
    
          let position = 0;
          let speed = 0;
          let startTime = performance.now();
          let totalTime = 0;
          let phase = 'accel'; // accel -> fast -> decel
    
          function animate(currentTime) {
            const elapsed = currentTime - startTime;
            totalTime += elapsed / 1000;
            startTime = currentTime;
    
            // 1️⃣ РАЗГОН (0-0.8 сек): 0 -> 25
            if (phase === 'accel') {
              const progress = totalTime / 0.8;
              speed = 25 * easeInQuad(Math.min(1, progress));
              
              if (totalTime >= 0.8) {
                phase = 'fast';
                totalTime = 0;
                startTime = currentTime;
              }
            }
            // 2️⃣ БЫСТРАЯ ПРОКРУТКА (0.8-2 сек): speed = 25
            else if (phase === 'fast') {
              speed = 25;
              
              if (totalTime >= 1.2) {
                phase = 'decel';
                totalTime = 0;
                startTime = currentTime;
              }
            }
            // 3️⃣ ТОРМОЖЕНИЕ (2-4 сек): 25 -> 0
            else if (phase === 'decel') {
              const distanceLeft = Math.abs(targetPosition - position);
              
              // Плавное торможение
              const progress = totalTime / 2;
              speed = 25 * (1 - easeOutCubic(Math.min(1, progress)));
              
              // Если очень близко - точная остановка
              if (distanceLeft < 10 && speed < 2) {
                position = targetPosition;
                reel.style.transform = `translateY(${position}px)`;
                
                setTimeout(() => {
                  document.querySelector('.reel').classList.add('winner');
                  targetItem.classList.add('winner-number');
                }, 200);
                
                setTimeout(resolve, 1500);
                return;
              }
            }
    
            position -= speed;
            reel.style.transform = `translateY(${position}px)`;
            animationFrame = requestAnimationFrame(animate);
          }
    
          animationFrame = requestAnimationFrame(animate);
        }, 500);
      });
    }
  
    // ====== ПОКАЗ ВЫИГРЫША ======
    function showWinAmount(betAmount) {
      return new Promise(resolve => {
        const totalWin = betAmount * winningMultiplier.value;
        const currencySymbol = currentCurrency === 'ton' ? 'TON' : '⭐';
        const formattedAmount = currentCurrency === 'stars' 
          ? Math.round(totalWin) 
          : totalWin.toFixed(2);
        
        const overlay = document.getElementById('bonus-5050-overlay');
        const content = overlay.querySelector('.bonus-content');
  
        const winDiv = document.createElement('div');
        winDiv.className = 'bonus-win-amount';
        winDiv.innerHTML = `<div class="win-amount-text">+${formattedAmount} ${currencySymbol}</div>`;
  
        content.appendChild(winDiv);
        setTimeout(() => winDiv.classList.add('show'), 100);
        setTimeout(() => winDiv.classList.add('fade-out'), 2500);
        setTimeout(resolve, 3000);
      });
    }
  
    // ====== ЗАКРЫТИЕ ======
    function closeBonusOverlay() {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      const overlay = document.getElementById('bonus-5050-overlay');
      if (overlay) {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 500);
      }
    }
  
    // ====== EASING ======
    function easeInQuad(t) { return t * t; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  
    // ====== СТИЛИ ======
    function injectStyles() {
      if (document.getElementById('bonus-5050-styles')) return;
      const style = document.createElement('style');
      style.id = 'bonus-5050-styles';
      style.textContent = `
        #bonus-5050-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.5s ease;
        }
        #bonus-5050-overlay.active { opacity: 1; }
        #bonus-5050-overlay.closing { opacity: 0; }
        .bonus-backdrop {
          position: absolute; inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
        }
        .bonus-content {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: center; gap: 40px; padding: 20px;
          max-width: 500px; width: 100%;
        }
        .bonus-title {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          opacity: 0; transform: translateY(-30px);
          transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .bonus-title.animate-in { opacity: 1; transform: translateY(0); }
        .bonus-title-icon {
          font-size: 42px; font-weight: 900;
          background: linear-gradient(135deg, #d9197a, #ff1493);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 12px rgba(217, 25, 122, 0.5));
        }
        .bonus-title-text {
          font-size: 22px; font-weight: 700; color: white;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
        }
        .reel-container {
          opacity: 0; transform: scale(0.8);
          transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .reel-container.animate-in { opacity: 1; transform: scale(1); }
        .reel {
          position: relative; width: 200px; height: 250px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border: 3px solid rgba(255, 255, 255, 0.15); border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), inset 0 0 40px rgba(100, 100, 255, 0.05);
          transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .reel.winner {
          border-color: #10b981;
          box-shadow: 0 0 60px rgba(16, 185, 129, 0.8), inset 0 0 60px rgba(16, 185, 129, 0.2);
          animation: reelWinnerPulse 1.5s ease-in-out infinite;
        }
        @keyframes reelWinnerPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.05); filter: brightness(1.3); }
        }
        .reel-inner {
          position: absolute; width: 100%;
          display: flex; flex-direction: column; align-items: center;
          will-change: transform;
        }
        .reel-number {
          width: 100%; height: 100px;
          display: flex; align-items: center; justify-content: center;
          font-size: 48px; font-weight: 900;
          transition: all 0.3s ease; flex-shrink: 0;
        }
        .reel-number.good {
          color: #10b981;
          text-shadow: 0 0 20px rgba(16, 185, 129, 0.8), 0 0 40px rgba(16, 185, 129, 0.4);
        }
        .reel-number.bad {
          color: #ef4444;
          text-shadow: 0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(239, 68, 68, 0.4);
        }
        .reel-number.winner-number {
          font-size: 64px;
          animation: winnerNumberPulse 1s ease-in-out infinite;
        }
        @keyframes winnerNumberPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .reel-mask {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(15, 23, 42, 0.95) 0%, transparent 25%,
            transparent 75%, rgba(15, 23, 42, 0.95) 100%);
          pointer-events: none;
        }
        .reel-indicator {
          position: absolute; top: 50%; left: 0; right: 0; height: 3px;
          background: rgba(255, 255, 255, 0.4); transform: translateY(-50%);
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.8), 0 0 30px rgba(255, 255, 255, 0.4);
          z-index: 10;
        }
        .bonus-hint {
          font-size: 16px; font-weight: 600; color: rgba(255, 255, 255, 0.6);
          text-align: center; opacity: 0; transform: translateY(20px);
          transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .bonus-hint.animate-in { opacity: 1; transform: translateY(0); }
        .bonus-win-amount {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) scale(0); opacity: 0;
          transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: 100;
        }
        .bonus-win-amount.show {
          transform: translate(-50%, -50%) scale(1); opacity: 1;
        }
        .bonus-win-amount.fade-out {
          transform: translate(-50%, -60%) scale(0.9); opacity: 0;
        }
        .win-amount-text {
          font-size: 72px; font-weight: 900; color: #10b981;
          text-shadow: 0 0 30px rgba(16, 185, 129, 1), 0 0 60px rgba(16, 185, 129, 0.6),
            0 4px 20px rgba(0, 0, 0, 0.8);
          animation: winAmountFloat 2s ease-in-out infinite;
          white-space: nowrap;
        }
        @keyframes winAmountFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @media (max-width: 480px) {
          .bonus-title-icon { font-size: 36px; }
          .bonus-title-text { font-size: 18px; }
          .reel { width: 160px; height: 220px; }
          .reel-number { font-size: 40px; height: 88px; }
          .reel-number.winner-number { font-size: 56px; }
          .win-amount-text { font-size: 56px; }
        }
      `;
      document.head.appendChild(style);
    }
  
    window.Bonus5050 = {
      start: (betAmount) => window.start5050Bonus(betAmount),
      isActive: () => isActive
    };
  
    console.log('[50&50] ✅ Bonus loaded');
  })();