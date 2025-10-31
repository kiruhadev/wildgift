// wheel.js - Исправленная система ставок с точным совпадением

/* ===== CONFIG ===== */
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

// Сообщения для выигрыша и проигрыша
const WIN_MESSAGES = {
  '1x': '🎉 You won with 1×!',
  '3x': '🎊 Great! 3× multiplier!',
  '7x': '✨ Amazing! 7× multiplier!',
  '11x': '🌟 Fantastic! 11× multiplier!',
  '50&50': '🎁 50&50 Bonus! Try your luck!',
  'Loot Rush': '💎 Loot Rush! Treasure time!',
  'Wild Time': '🔥 WILD TIME! Maximum bonus!'
};

const LOSS_MESSAGES = {
  default: '😔 Not this time... Try again!',
  close: '😕 So close! Better luck next time!'
};

/* ===== DOM refs ===== */
let canvas, ctx, DPR = 1;
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
let lastRoundResult = null; // Для хранения результата последнего раунда

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

  betTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      if (phase !== 'betting') return;
      const seg = tile.dataset.seg;
      const cur = betsMap.get(seg) || 0;
      const next = +(cur + currentAmount).toFixed(2);
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
        setTimeout(() => {
          pushHistory(typeFinished);
          clearBets();
          startCountdown(9);
        }, 3000);
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
  
  // Если нет ставок - просто показываем что выпало
  if (totalBets <= 0) {
    console.log('No bets placed');
    showResultMessage(resultType, false, 0, 0);
    return;
  }

  // Проверяем, была ли ставка на выпавший результат
  const betOnResult = betsMap.get(resultType) || 0;
  
  if (betOnResult > 0) {
    // ВЫИГРЫШ! Ставка совпала
    const multiplier = getMultiplier(resultType);
    const winAmount = betOnResult * multiplier;
    
    console.log('🎉 WIN!', {
      result: resultType,
      betAmount: betOnResult,
      multiplier,
      winAmount,
      totalBets
    });
    
    showResultMessage(resultType, true, betOnResult, winAmount);
  } else {
    // ПРОИГРЫШ - ставка не совпала
    console.log('😔 LOSS', {
      result: resultType,
      yourBets: Array.from(betsMap.entries()).map(([k,v]) => `${k}: ${v}`),
      totalLost: totalBets
    });
    
    showResultMessage(resultType, false, totalBets, 0);
  }
}

/* ===== Получить множитель для типа ===== */
function getMultiplier(type) {
  const multipliers = {
    '1x': 1,
    '3x': 3,
    '7x': 7,
    '11x': 11,
    '50&50': 2,      // Бонусная игра
    'Loot Rush': 5,  // Бонусная игра
    'Wild Time': 10  // Максимальный бонус
  };
  return multipliers[type] || 1;
}

/* ===== Показ результата (выигрыш/проигрыш) ===== */
function showResultMessage(typeKey, isWin, betAmount, winAmount) {
  const toast = document.createElement('div');
  
  // Разные стили для выигрыша и проигрыша
  if (isWin) {
    const color = COLORS[typeKey]?.fill || '#00a6ff';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      z-index: 10000;
      background: linear-gradient(135deg, ${color}, ${adjustColor(color, -20)});
      border: 2px solid ${color};
      border-radius: 20px;
      padding: 20px 28px;
      min-width: 300px;
      max-width: 90%;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px ${color}40;
      backdrop-filter: blur(12px);
      animation: slideDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px; animation: bounce 0.6s ease;">${WIN_MESSAGES[typeKey].split(' ')[0]}</div>
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
            ${WIN_MESSAGES[typeKey].substring(2)}
          </div>
          <div style="font-size: 14px; color: rgba(255,255,255,0.9); margin-bottom: 8px;">
            Bet: ${betAmount} TON
          </div>
          <div style="font-size: 24px; font-weight: 900; color: #ffffff;">
            +${winAmount.toFixed(2)} TON
          </div>
        </div>
      </div>
    `;
  } else {
    // Проигрыш
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      z-index: 10000;
      background: linear-gradient(135deg, #3a3a3a, #2a2a2a);
      border: 2px solid #555;
      border-radius: 20px;
      padding: 20px 28px;
      min-width: 300px;
      max-width: 90%;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(12px);
      animation: slideDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;

    const resultColor = COLORS[typeKey]?.fill || '#888';
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">😔</div>
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
            ${LOSS_MESSAGES.default}
          </div>
          <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 8px;">
            Result: <span style="color: ${resultColor}; font-weight: 700;">${LABELS[typeKey]}</span>
          </div>
          <div style="font-size: 20px; font-weight: 700; color: #ff6b6b;">
            -${betAmount.toFixed(2)} TON
          </div>
        </div>
      </div>
    `;
  }

  // Добавляем стили для анимаций
  if (!document.getElementById('result-animations')) {
    const style = document.createElement('style');
    style.id = 'result-animations';
    style.textContent = `
      @keyframes slideDown {
        from { 
          transform: translateX(-50%) translateY(-100px);
          opacity: 0;
        }
        to { 
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from { 
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        to { 
          transform: translateX(-50%) translateY(-100px);
          opacity: 0;
        }
      }
      @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Удаляем через 3 секунды
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2700);
}

function adjustColor(color, amount) {
  const clamp = (num) => Math.min(255, Math.max(0, num));
  
  const hex = color.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  r = clamp(r + amount);
  g = clamp(g + amount);
  b = clamp(b + amount);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
}