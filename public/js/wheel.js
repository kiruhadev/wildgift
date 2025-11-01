// wheel.js - TEST MODE VERSION - Тестовый режим без проверки баланса

/* ===== CONFIG ===== */
const TEST_MODE = true; // 🔥 ТЕСТОВЫЙ РЕЖИМ - ставки без проверки баланса

const WHEEL_ORDER = [
  'Wild Time','1x','3x','Loot Rush','1x','7x','50&50','1x',
  '3x','11x','1x','3x','Loot Rush','1x','7x','50&50',
  '1x','3x','1x','11x','3x','1x','7x','50&50'
];

const COLORS = {
  '1x'       : { fill: '#6f6a00', text: '#fff' },
  '3x'       : { fill: '#6e4200', text: '#fff' },
  '7x'       : { fill: '#0f5a2e', text: '#fff' },
  '11x'      : { fill: '#0a3f64', text: '#fff' },
  '50&50'    : { fill: '#d9197a', text: '#fff' },
  'Loot Rush': { fill: '#6c2bd9', text: '#fff' },
  'Wild Time': { fill: '#c5161d', text: '#fff' }
};

const IMAGES = {
  '50&50'    : '/images/bets/50-50.png',
  'Loot Rush': '/images/bets/loot.png',
  'Wild Time': '/images/bets/wild.png'
};

const LABELS = { 
  '1x':'1×','3x':'3×','7x':'7×','11x':'11×',
  '50&50':'50&50','Loot Rush':'Loot','Wild Time':'Wild' 
};

/* ===== DOM refs ===== */
let canvas, ctx, DPR = 1;
let userBalance = { ton: 0, stars: 0 }; // Баланс (не используется в TEST_MODE)
let betOverlay, historyList, countdownBox, countNumEl;
let amountBtns = [], betTiles = [];

/* ===== wheel state ===== */
let currentAngle = 0;
let rafId = 0;
let lastTs = 0;

const SLICE_COUNT   = WHEEL_ORDER.length;
const SLICE_ANGLE   = (2*Math.PI)/SLICE_COUNT;
const POINTER_ANGLE = -Math.PI/2;

const IDLE_OMEGA = 0.35;
const FAST_OMEGA = 9.0;
let omega = IDLE_OMEGA;

let phase = 'betting';
let decel = null;

/* ===== Ставки ===== */
const betsMap = new Map();
let currentAmount = 0.5;
let currentCurrency = 'ton';
let lastRoundResult = null;

/* ===== Предзагрузка изображений ===== */
const loadedImages = new Map();
let imagesLoaded = false;

function preloadImages() {
  return Promise.all(
    Object.entries(IMAGES).map(([key, src]) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedImages.set(key, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load image: ${src}`);
          resolve();
        };
        img.src = src;
      });
    })
  ).then(() => {
    imagesLoaded = true;
    console.log('All wheel images loaded');
  });
}

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', async () => {
  canvas       = document.getElementById('wheelCanvas');
  betOverlay   = document.getElementById('betOverlay');
  historyList  = document.getElementById('historyList');
  countdownBox = document.getElementById('countdown');
  countNumEl   = document.getElementById('countNum') || countdownBox?.querySelector('span');
  amountBtns   = Array.from(document.querySelectorAll('.amount-btn'));
  betTiles     = Array.from(document.querySelectorAll('.bet-tile'));

  if (!canvas) return;

  // 🔥 ТЕСТОВЫЙ РЕЖИМ - показываем уведомление
  if (TEST_MODE) {
    console.log('🧪 TEST MODE ACTIVE - Unlimited betting enabled');
    showTestModeNotification();
  }

  await preloadImages();

  prepareCanvas();
  drawWheel(currentAngle);

  initBettingUI();

  lastTs = performance.now();
  rafId = requestAnimationFrame(tick);

  startCountdown(9);

  window.addEventListener('resize', () => {
    prepareCanvas();
    drawWheel(currentAngle);
  });
});

/* ===== 🔥 НОВАЯ ФУНКЦИЯ - Уведомление о тестовом режиме ===== */
function showTestModeNotification() {
  const existing = document.getElementById('test-mode-toast');
  if (existing) return;
  
  const toast = document.createElement('div');
  toast.id = 'test-mode-toast';
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1));
    backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 16px;
    padding: 12px 20px;
    font-size: 13px;
    font-weight: 600;
    color: #fbbf24;
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.2);
    animation: testModeSlideIn 0.5s ease forwards;
    pointer-events: none;
  `;
  toast.textContent = '🧪 Test Mode: Unlimited Balance';
  
  if (!document.getElementById('test-mode-animations')) {
    const style = document.createElement('style');
    style.id = 'test-mode-animations';
    style.textContent = `
      @keyframes testModeSlideIn {
        from { 
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to { 
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Убираем через 5 секунд
  setTimeout(() => {
    toast.style.animation = 'testModeSlideIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/* ===== Betting UI ===== */
function initBettingUI(){
  const active = amountBtns.find(b => b.classList.contains('active'));
  if (active) currentAmount = parseFloat(active.dataset.amount || '0.5');

  amountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (phase !== 'betting') return;
      amountBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAmount = parseFloat(btn.dataset.amount);
    });
  });

  // 🔥 Слушаем обновление баланса (только для отображения, не для проверки)
  window.addEventListener('balance:loaded', (e) => {
    if (e.detail) {
      userBalance.ton = e.detail.ton || 0;
      userBalance.stars = e.detail.stars || 0;
      if (!TEST_MODE) {
        console.log('[Wheel] Balance loaded:', userBalance);
      }
    }
  });

  window.addEventListener('balance:update', (e) => {
    if (e.detail) {
      if (e.detail.ton !== undefined) userBalance.ton = e.detail.ton;
      if (e.detail.stars !== undefined) userBalance.stars = e.detail.stars;
      if (!TEST_MODE) {
        console.log('[Wheel] Balance updated:', userBalance);
      }
    }
  });

  // Слушаем смену валюты
  window.addEventListener('currency:changed', (e) => {
    if (e.detail && e.detail.currency) {
      currentCurrency = e.detail.currency;
      console.log('[Wheel] Currency changed to:', currentCurrency);
    }
  });

  // 🔥 ОБНОВЛЕННЫЙ обработчик ставок - БЕЗ проверки баланса в TEST_MODE
  betTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      if (phase !== 'betting') return;
      
      const seg = tile.dataset.seg;
      const cur = betsMap.get(seg) || 0;
      
      // 🔥 ПРОВЕРКА БАЛАНСА ОТКЛЮЧЕНА В ТЕСТОВОМ РЕЖИМЕ
      if (!TEST_MODE) {
        const balance = userBalance[currentCurrency] || 0;
        
        if (balance < currentAmount) {
          // ❌ Недостаточно средств
          tile.classList.add('insufficient-balance');
          setTimeout(() => tile.classList.remove('insufficient-balance'), 800);
          
          showInsufficientBalanceNotification();
          return;
        }
      }
      
      // ✅ Добавляем ставку (в тестовом режиме всегда разрешено)
      const next = currentCurrency === 'stars' 
        ? Math.round(cur + currentAmount)
        : +(cur + currentAmount).toFixed(2);
      betsMap.set(seg, next);

      let badge = tile.querySelector('.bet-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'bet-badge';
        badge.dataset.badgeFor = seg;
        tile.appendChild(badge);
      }
      badge.textContent = next;
      badge.hidden = false;

      tile.classList.add('has-bet');
      setTimeout(() => tile.classList.remove('active'), 160);
    });
  });

  const undoBtn = document.querySelector('[data-action="undo"]');
  const clearBtn = document.querySelector('[data-action="clear"]');

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (phase !== 'betting') return;
      const lastSeg = Array.from(betsMap.keys()).pop();
      if (lastSeg) {
        const cur = betsMap.get(lastSeg) || 0;
        const next = Math.max(0, cur - currentAmount);
        if (next > 0) {
          betsMap.set(lastSeg, next);
          updateBadge(lastSeg, next);
        } else {
          betsMap.delete(lastSeg);
          updateBadge(lastSeg, 0);
        }
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (phase !== 'betting') return;
      clearBets();
    });
  }
}

function updateBadge(seg, amount) {
  const tile = Array.from(betTiles).find(t => t.dataset.seg === seg);
  if (!tile) return;
  
  const badge = tile.querySelector('.bet-badge');
  if (badge) {
    if (amount > 0) {
      badge.textContent = amount;
      badge.hidden = false;
      tile.classList.add('has-bet');
    } else {
      badge.hidden = true;
      tile.classList.remove('has-bet');
    }
  }
}

/* ===== Canvas ===== */
function prepareCanvas(){
  DPR = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 420;
  const cssH = canvas.clientHeight|| 420;
  canvas.width  = Math.round(cssW * DPR);
  canvas.height = Math.round(cssH * DPR);
  ctx = canvas.getContext('2d');
  ctx.setTransform(DPR,0,0,DPR,0,0);
}

function drawWheel(angle=0){
  if (!ctx) return;
  const w = canvas.width / DPR, h = canvas.height / DPR;
  const cx = w/2, cy = h/2, R  = Math.min(cx,cy) - 6;

  ctx.save();
  ctx.clearRect(0,0,w,h);

  const g = ctx.createRadialGradient(cx,cy,R*0.25, cx,cy,R);
  g.addColorStop(0,'rgba(0,170,255,.12)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = g; 
  ctx.fillRect(0,0,w,h);

  ctx.translate(cx,cy);
  ctx.rotate(angle);

  for (let i=0; i<SLICE_COUNT; i++){
    const key = WHEEL_ORDER[i];
    const col = COLORS[key] || { fill:'#333', text:'#fff' };
    const a0 = i*SLICE_ANGLE, a1 = a0+SLICE_ANGLE;

    ctx.save();
    
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,R,a0,a1,false);
    ctx.closePath();
    
    if (imagesLoaded && loadedImages.has(key)) {
      const img = loadedImages.get(key);
      
      ctx.save();
      ctx.clip();
      
      const mid = a0 + SLICE_ANGLE/2;
      ctx.rotate(mid);
      
      const imgWidth = R * 1.2;
      const imgHeight = R * Math.tan(SLICE_ANGLE/2) * 2.2;
      
      ctx.drawImage(
        img, 
        0, -imgHeight/2,
        imgWidth, imgHeight
      );
      
      ctx.restore();
      
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = col.fill;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = col.fill; 
      ctx.fill();
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.stroke();

    const mid = a0 + SLICE_ANGLE/2;
    ctx.rotate(mid);
    ctx.textAlign='right';
    ctx.textBaseline='middle';
    ctx.fillStyle = col.text;
    ctx.font='bold 16px mf, system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(LABELS[key] || key, R-16, 0);
    ctx.shadowBlur = 0;
    
    ctx.restore();
  }

  ctx.beginPath(); 
  ctx.arc(0,0,20,0,2*Math.PI);
  ctx.fillStyle='#121212'; 
  ctx.fill();
  ctx.lineWidth=2; 
  ctx.strokeStyle='rgba(255,255,255,.25)'; 
  ctx.stroke();

  ctx.restore();
}

/* ===== Animation loop ===== */
function tick(ts){
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs)/1000);
  lastTs = ts;

  if (phase === 'decelerate' && decel){
    const elapsed = ts - decel.t0;
    const t = Math.min(1, elapsed / decel.dur);
    const eased = easeOutCubic(t);
    currentAngle = decel.start + (decel.end - decel.start) * eased;

    if (t >= 1){
  currentAngle = decel.end;
  const typeFinished = decel.resultType;
  const resolveFn = decel.resolve;
  decel = null;

  phase = 'betting';
  omega = IDLE_OMEGA;
  setBetPanel(true);

  // Проверяем результат раунда
  if (typeFinished) {
    checkBetsAndShowResult(typeFinished);
    
    // 🎰 ПРОВЕРКА НА БОНУС 50&50
    if (typeFinished === '50&50') {
      // Запускаем бонус через 3 секунды после показа результата
      setTimeout(async () => {
        console.log('[Wheel] 🎰 Starting 50&50 bonus...');
        
        // Получаем ставку на 50&50
        const betOn5050 = betsMap.get('50&50') || 0;
        
        // Запускаем бонус
        if (window.start5050Bonus) {
          await window.start5050Bonus(betOn5050);
        } else {
          console.error('[Wheel] ❌ Bonus 50&50 not loaded!');
        }
        
        // После бонуса продолжаем как обычно
        pushHistory(typeFinished);
        clearBets();
        startCountdown(9);
      }, 3000);
    } else {
      // Обычный результат - продолжаем через 3 секунды
      setTimeout(() => {
        pushHistory(typeFinished);
        clearBets();
        startCountdown(9);
      }, 3000);
    }
  } else {
    clearBets();
    startCountdown(9);
  }

  if (resolveFn) resolveFn();
}
  } else if (phase === 'betting' || phase === 'accelerate') {
    currentAngle += omega * dt;
  }

  drawWheel(currentAngle);
  rafId = requestAnimationFrame(tick);
}

/* ===== Проверка ставок и показ результата ===== */
function checkBetsAndShowResult(resultType) {
  const totalBets = Array.from(betsMap.values()).reduce((sum, val) => sum + val, 0);
  
  if (totalBets <= 0) {
    console.log('No bets placed - skipping notification');
    return;
  }

  const betOnResult = betsMap.get(resultType) || 0;
  
  if (betOnResult > 0) {
    const multiplier = getMultiplier(resultType);
    const winAmount = betOnResult * multiplier;
    
    console.log('🎉 WIN!', {
      result: resultType,
      betAmount: betOnResult,
      multiplier,
      winAmount,
      totalBets,
      testMode: TEST_MODE
    });
    
    showWinNotification(winAmount);
  } else {
    console.log('😔 LOSS', {
      result: resultType,
      yourBets: Array.from(betsMap.entries()).map(([k,v]) => `${k}: ${v}`),
      totalLost: totalBets,
      testMode: TEST_MODE
    });
  }
}

function getMultiplier(type) {
  const multipliers = {
    '1x': 1,
    '3x': 3,
    '7x': 7,
    '11x': 11,
    '50&50': 2,
    'Loot Rush': 5,
    'Wild Time': 10
  };
  return multipliers[type] || 1;
}

function showWinNotification(winAmount) {
  const existing = document.getElementById('win-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'win-toast';
  
  const currencySymbol = currentCurrency === 'ton' ? 'TON' : '⭐';
  const formattedAmount = currentCurrency === 'stars' 
    ? Math.round(winAmount) 
    : winAmount.toFixed(2);
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-100px);
    z-index: 10000;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.08));
    backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 20px;
    padding: 18px 28px;
    font-size: 26px;
    font-weight: 900;
    color: #10b981;
    box-shadow: 
      0 12px 32px rgba(16, 185, 129, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    animation: winJellyIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
    text-shadow: 0 2px 12px rgba(16, 185, 129, 0.4);
    letter-spacing: 0.5px;
  `;
  
  toast.textContent = `+${formattedAmount} ${currencySymbol}`;
  
  if (!document.getElementById('win-animations')) {
    const style = document.createElement('style');
    style.id = 'win-animations';
    style.textContent = `
      @keyframes winJellyIn {
        0% { 
          transform: translateX(-50%) translateY(-100px) scale(0.3);
          opacity: 0;
        }
        50% { 
          transform: translateX(-50%) translateY(0) scale(1.08);
          opacity: 1;
        }
        65% { 
          transform: translateX(-50%) translateY(0) scale(0.95);
        }
        80% { 
          transform: translateX(-50%) translateY(0) scale(1.02);
        }
        100% { 
          transform: translateX(-50%) translateY(0) scale(1);
          opacity: 1;
        }
      }
      @keyframes winJellyOut {
        0% { 
          transform: translateX(-50%) translateY(0) scale(1);
          opacity: 1;
        }
        20% {
          transform: translateX(-50%) translateY(0) scale(1.05);
          opacity: 1;
        }
        100% { 
          transform: translateX(-50%) translateY(-80px) scale(0.7);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'winJellyOut 0.6s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards';
    setTimeout(() => toast.remove(), 600);
  }, 2500);
}

function showInsufficientBalanceNotification() {
  const existing = document.getElementById('insufficient-balance-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'insufficient-balance-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-80px);
    z-index: 10000;
    background: linear-gradient(135deg, rgba(127, 29, 29, 0.15), rgba(153, 27, 27, 0.1));
    backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(185, 28, 28, 0.2);
    border-radius: 18px;
    padding: 14px 24px;
    font-size: 14px;
    font-weight: 600;
    color: #ef4444;
    box-shadow: 0 10px 30px rgba(127, 29, 29, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    animation: insufficientJellyIn 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
    pointer-events: none;
    text-shadow: 0 1px 8px rgba(239, 68, 68, 0.3);
    letter-spacing: 0.3px;
    white-space: nowrap;
  `;
  toast.textContent = 'Insufficient balance';
  
  if (!document.getElementById('insufficient-animations')) {
    const style = document.createElement('style');
    style.id = 'insufficient-animations';
    style.textContent = `
      @keyframes insufficientJellyIn {
        0% { 
          transform: translateX(-50%) translateY(-80px) scale(0.4);
          opacity: 0;
        }
        50% { 
          transform: translateX(-50%) translateY(0) scale(1.06);
          opacity: 1;
        }
        65% { 
          transform: translateX(-50%) translateY(0) scale(0.96);
        }
        80% { 
          transform: translateX(-50%) translateY(0) scale(1.02);
        }
        100% { 
          transform: translateX(-50%) translateY(0) scale(1);
          opacity: 1;
        }
      }
      @keyframes insufficientJellyOut {
        0% { 
          transform: translateX(-50%) translateY(0) scale(1);
          opacity: 1;
        }
        100% { 
          transform: translateX(-50%) translateY(-60px) scale(0.85);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'insufficientJellyOut 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards';
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}

/* ===== Countdown ===== */
let cInt = null;
let isCountdownActive = false;

function startCountdown(sec=9){
  if (!countdownBox || !countNumEl) {
    console.warn('Countdown elements not found');
    return;
  }
  if (isCountdownActive) {
    console.log('Countdown already active, skipping');
    return;
  }

  console.log('Starting countdown:', sec);
  stopCountdown();
  isCountdownActive = true;
  phase = 'betting';
  omega = IDLE_OMEGA;
  setBetPanel(true);

  countdownBox.classList.add('visible');
  let left = sec;
  countNumEl.textContent = String(left);

  cInt = setInterval(async () => {
    left--;
    console.log('Countdown:', left);
    
    if (left >= 0) {
      countNumEl.textContent = String(left);
      countdownBox.classList.remove('pulse'); 
      void countdownBox.offsetWidth; 
      countdownBox.classList.add('pulse');
    }
    
    if (left <= 0) {
      console.log('Countdown finished, starting spin');
      stopCountdown();

      phase = 'accelerate';
      setBetPanel(false);
      
      try {
        await accelerateTo(FAST_OMEGA, 1200);
        console.log('Acceleration complete');

        const { sliceIndex, type } = await fetchRoundOutcome();
        console.log('Round outcome:', { sliceIndex, type });

        const dur = 5000 + Math.floor(Math.random()*2000);
        console.log('Starting deceleration, duration:', dur);
        await decelerateToSlice(sliceIndex, dur, 4, type);
        console.log('Deceleration complete');
      } catch (error) {
        console.error('Error during spin:', error);
        phase = 'betting';
        omega = IDLE_OMEGA;
        setBetPanel(true);
        isCountdownActive = false;
        startCountdown(9);
      }
    }
  }, 1000);
}

function stopCountdown(){
  if (cInt) {
    console.log('Stopping countdown');
    clearInterval(cInt);
    cInt = null;
  }
  isCountdownActive = false;
}

/* ===== Accel/Decel ===== */
function accelerateTo(targetOmega=FAST_OMEGA, ms=1200){
  return new Promise(res=>{
    console.log('Accelerating from', omega, 'to', targetOmega);
    const start = omega;
    const t0 = performance.now();
    
    const step = ()=>{
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / ms);
      const eased = easeInQuad(t);
      omega = start + (targetOmega - start) * eased;
      
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        omega = targetOmega;
        console.log('Acceleration done, omega:', omega);
        res();
      }
    };
    requestAnimationFrame(step);
  });
}

function decelerateToSlice(sliceIndex, ms=6000, extraTurns=4, typeForHistory=null){
  console.log('Decelerating to slice:', sliceIndex, 'type:', typeForHistory);
  
  return new Promise(resolve=>{
    const normalizedCurrent = currentAngle % (2 * Math.PI);
    const sliceCenter = sliceIndex * SLICE_ANGLE + SLICE_ANGLE / 2;
    
    let deltaToTarget = POINTER_ANGLE - normalizedCurrent - sliceCenter;
    
    while (deltaToTarget > Math.PI) deltaToTarget -= 2 * Math.PI;
    while (deltaToTarget < -Math.PI) deltaToTarget += 2 * Math.PI;
    
    const endAngle = currentAngle + deltaToTarget + extraTurns * 2 * Math.PI;
    
    console.log('Deceleration params:', {
      currentAngle,
      normalizedCurrent,
      sliceCenter,
      deltaToTarget,
      endAngle,
      totalRotation: endAngle - currentAngle
    });
    
    decel = { 
      start: currentAngle, 
      end: endAngle, 
      t0: performance.now(), 
      dur: ms, 
      resolve, 
      resultType: typeForHistory 
    };
    
    phase = 'decelerate';
    omega = 0;
  });
}

/* ===== Server outcome ===== */
async function fetchRoundOutcome(){
  try{
    const r = await fetch('/api/round/start', { 
      cache: 'no-store',
      method: 'GET'
    });
    
    if (!r.ok) {
      console.error('Server returned error:', r.status);
      throw new Error('Server error');
    }
    
    const data = await r.json();
    console.log('Server response:', data);
    
    if (data?.ok && typeof data.sliceIndex === 'number' && data.type) {
      return data;
    }
    
    console.warn('Invalid server response, using fallback');
    throw new Error('Invalid response');
  } catch(e) {
    console.warn('Failed to fetch round outcome, using local fallback:', e);
  }
  
  const sliceIndex = Math.floor(Math.random() * SLICE_COUNT);
  const type = WHEEL_ORDER[sliceIndex];
  console.log('Local fallback result:', { sliceIndex, type });
  return { sliceIndex, type, ok: true };
}

/* ===== Helpers ===== */
function normalizeAngle(a){
  while (a <= -Math.PI) a += 2*Math.PI;
  while (a > Math.PI)   a -= 2*Math.PI;
  return a;
}
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function easeInQuad(t){ return t*t; }

/* ===== Bet panel modes ===== */
function setBetPanel(enable){
  if (!betOverlay) return;
  const app = document.querySelector('.app');
  
  if (enable){
    betOverlay.classList.remove('disabled');
    betOverlay.style.pointerEvents = 'auto';
    if (app) app.classList.remove('is-spinning');
  } else {
    betOverlay.classList.add('disabled');
    betOverlay.style.pointerEvents = 'none';
    if (app) app.classList.add('is-spinning');
  }
}

/* ===== History & Clear bets ===== */
function pushHistory(typeKey){
  if (!historyList) return;
  const item = document.createElement('div');
  item.className = 'history-item';
  item.textContent = LABELS[typeKey] || typeKey;
  item.style.background = (COLORS[typeKey]?.fill)||'#444';
  item.style.color='#fff';
  item.style.padding='6px 10px';
  item.style.borderRadius='8px';
  item.style.font='600 12px/1 mf,system-ui,sans-serif';
  item.style.marginRight='6px';
  item.style.flexShrink='0';
  historyList.prepend(item);
  
  const all = historyList.querySelectorAll('.history-item');
  if (all.length > 20) all[all.length-1].remove();
}

function clearBets(){
  console.log('Clearing all bets');
  betsMap.clear();
  betTiles.forEach(tile=>{
    const badge = tile.querySelector('.bet-badge');
    if (badge) { 
      badge.textContent = '0'; 
      badge.hidden = true; 
    }
    tile.classList.remove('active', 'has-bet');
  });
}

function hasBets() {
  const total = Array.from(betsMap.values()).reduce((sum, val) => sum + val, 0);
  return total > 0;











/* ===== ИНТЕГРАЦИЯ БОНУСОВ ===== */

// Проверка выпадения бонуса
function checkBonusTrigger(resultType) {
  console.log('[Wheel] Checking bonus trigger for:', resultType);
  
  // Если выпал бонус 50&50
  if (resultType === '50&50') {
    console.log('[Wheel] 🎰 Triggering 50&50 bonus!');
    
    // Запускаем бонус после задержки
    setTimeout(() => {
      if (window.Bonus5050) {
        window.Bonus5050.start();
      } else {
        console.error('[Wheel] ❌ Bonus5050 module not loaded!');
      }
    }, 1500);
  }
  
  // Если выпал Loot Rush
  if (resultType === 'Loot Rush') {
    console.log('[Wheel] 🎁 Triggering Loot Rush bonus!');
    // TODO: Добавим позже
  }
  
  // Если выпал Wild Time
  if (resultType === 'Wild Time') {
    console.log('[Wheel] 🔥 Triggering Wild Time bonus!');
    // TODO: Добавим позже
  }
}

// ====== ОБНОВИ ФУНКЦИЮ checkBetsAndShowResult ======
// Найди эту функцию и замени на:

function checkBetsAndShowResult(resultType) {
  const totalBets = Array.from(betsMap.values()).reduce((sum, val) => sum + val, 0);
  
  // 🔥 ПРОВЕРКА БОНУСА
  const isBonusRound = ['50&50', 'Loot Rush', 'Wild Time'].includes(resultType);
  
  if (isBonusRound) {
    console.log('🎰 BONUS ROUND!', resultType);
    
    // Показываем уведомление о бонусе
    showBonusNotification(resultType);
    
    // Запускаем бонус
    setTimeout(() => {
      checkBonusTrigger(resultType);
    }, 2000);
    
    return;
  }
  
  // Обычный раунд
  if (totalBets <= 0) {
    console.log('No bets placed - skipping notification');
    return;
  }

  const betOnResult = betsMap.get(resultType) || 0;
  
  if (betOnResult > 0) {
    const multiplier = getMultiplier(resultType);
    const winAmount = betOnResult * multiplier;
    
    console.log('🎉 WIN!', {
      result: resultType,
      betAmount: betOnResult,
      multiplier,
      winAmount,
      totalBets,
      testMode: TEST_MODE
    });
    
    showWinNotification(winAmount);
  } else {
    console.log('😔 LOSS', {
      result: resultType,
      yourBets: Array.from(betsMap.entries()).map(([k,v]) => `${k}: ${v}`),
      totalLost: totalBets,
      testMode: TEST_MODE
    });
  }
}

// ====== НОВАЯ ФУНКЦИЯ - Уведомление о бонусе ======
function showBonusNotification(bonusType) {
  const existing = document.getElementById('bonus-trigger-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'bonus-trigger-toast';
  
  toast.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    z-index: 9999;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(219, 39, 119, 0.95));
    backdrop-filter: blur(16px) saturate(180%);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 24px;
    padding: 30px 50px;
    font-size: 48px;
    font-weight: 900;
    color: white;
    box-shadow: 
      0 20px 60px rgba(168, 85, 247, 0.6),
      inset 0 2px 0 rgba(255, 255, 255, 0.2);
    animation: bonusTrigger 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    text-align: center;
  `;
  
  toast.innerHTML = `
    <div style="margin-bottom: 10px;">${bonusType}</div>
    <div style="font-size: 18px; font-weight: 600; opacity: 0.9;">Bonus Round</div>
  `;
  
  if (!document.getElementById('bonus-trigger-animations')) {
    const style = document.createElement('style');
    style.id = 'bonus-trigger-animations';
    style.textContent = `
      @keyframes bonusTrigger {
        0% { 
          transform: translate(-50%, -50%) scale(0) rotate(-180deg);
          opacity: 0;
        }
        50% { 
          transform: translate(-50%, -50%) scale(1.15) rotate(10deg);
          opacity: 1;
        }
        70% {
          transform: translate(-50%, -50%) scale(0.95) rotate(-5deg);
        }
        85% {
          transform: translate(-50%, -50%) scale(1.05) rotate(2deg);
        }
        100% { 
          transform: translate(-50%, -50%) scale(1) rotate(0deg);
          opacity: 1;
        }
      }
      
      @keyframes bonusTriggerOut {
        0% { 
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        100% { 
          transform: translate(-50%, -50%) scale(1.5);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'bonusTriggerOut 0.5s ease forwards';
    setTimeout(() => toast.remove(), 500);
  }, 1500);
}
}