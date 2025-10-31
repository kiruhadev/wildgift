// /public/js/wheel.js
// Idle spin + countdown + accelerate + smooth decel to server slice + history-after-stop + clear bets + IMAGES

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

// Пути к изображениям для каждого типа
const IMAGES = {
  '1x'       : '/images/bets/1x.png',
  '3x'       : '/images/bets/3x.png',
  '7x'       : '/images/bets/7x.png',
  '11x'      : '/images/bets/11x.png',
  '50&50'    : '/images/bets/50-50.png',
  'Loot Rush': '/images/bets/loot.png',
  'Wild Time': '/images/bets/wild.png'
};

const LABELS = { 
  '1x':'1×','3x':'3×','7x':'7×','11x':'11×',
  '50&50':'50&50','Loot Rush':'Loot','Wild Time':'Wild' 
};

// Поздравительные сообщения
const WIN_MESSAGES = {
  '1x': '🎉 Удача на твоей стороне!',
  '3x': '🎊 Отличный результат!',
  '7x': '✨ Невероятно! Множитель 7x!',
  '11x': '🌟 Фантастика! Множитель 11x!',
  '50&50': '🎁 Бонус 50&50! Попробуй удачу!',
  'Loot Rush': '💎 Loot Rush! Время сокровищ!',
  'Wild Time': '🔥 WILD TIME! Максимальный бонус!'
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

// Скорости
const IDLE_OMEGA = 0.35;
const FAST_OMEGA = 9.0;
let omega = IDLE_OMEGA;

// Фазы: 'betting' | 'accelerate' | 'decelerate'
let phase = 'betting';

// Торможение
let decel = null;

/* ===== Ставки ===== */
const betsMap = new Map();
let currentAmount = 0.5;

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
          resolve(); // Продолжаем даже если изображение не загрузилось
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
  // DOM
  canvas       = document.getElementById('wheelCanvas');
  betOverlay   = document.getElementById('betOverlay');
  historyList  = document.getElementById('historyList');
  countdownBox = document.getElementById('countdown');
  countNumEl   = document.getElementById('countNum') || countdownBox?.querySelector('span');
  amountBtns   = Array.from(document.querySelectorAll('.amount-btn'));
  betTiles     = Array.from(document.querySelectorAll('.bet-tile'));

  if (!canvas) return;

  // Предзагрузка изображений
  await preloadImages();

  // Canvas prep
  prepareCanvas();
  drawWheel(currentAngle);

  // Betting UI
  initBettingUI();

  // Idle loop
  lastTs = performance.now();
  rafId = requestAnimationFrame(tick);

  // Start first countdown
  startCountdown(9);

  // Resize
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

  // Action buttons
  const undoBtn = document.querySelector('[data-action="undo"]');
  const clearBtn = document.querySelector('[data-action="clear"]');
  const repeatBtn = document.querySelector('[data-action="repeat"]');

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (phase !== 'betting') return;
      // Простая реализация: удаляем последнюю ставку
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

  // Glow
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

    // Сектор
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,R,a0,a1,false);
    ctx.closePath();
    ctx.fillStyle = col.fill; 
    ctx.fill();

    // Разделитель
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.stroke();

    // Изображение в секторе
    if (imagesLoaded && loadedImages.has(key)) {
      ctx.save();
      const mid = a0 + SLICE_ANGLE/2;
      ctx.rotate(mid);
      
      const img = loadedImages.get(key);
      const imgSize = R * 0.35; // Размер изображения
      const imgX = R * 0.55; // Позиция от центра
      
      ctx.translate(imgX, 0);
      ctx.rotate(-mid - angle); // Компенсируем вращение для вертикального изображения
      
      // Рисуем изображение
      ctx.drawImage(img, -imgSize/2, -imgSize/2, imgSize, imgSize);
      
      ctx.restore();
    } else {
      // Fallback: текстовая подпись
      ctx.save();
      const mid = a0 + SLICE_ANGLE/2;
      ctx.rotate(mid);
      ctx.textAlign='right';
      ctx.textBaseline='middle';
      ctx.fillStyle = col.text;
      ctx.font='bold 14px mf, system-ui, sans-serif';
      ctx.fillText(LABELS[key] || key, R-12, 0);
      ctx.restore();
    }
  }

  // Center cap
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
      // Полная остановка
      currentAngle = decel.end; // Фиксируем финальный угол
      const typeFinished = decel.resultType;
      const resolveFn = decel.resolve;
      decel = null;

      phase = 'betting';
      omega = IDLE_OMEGA;
      setBetPanel(true);

      // Показываем поздравление
      if (typeFinished) {
        showWinMessage(typeFinished);
        setTimeout(() => {
          pushHistory(typeFinished);
          clearBets();
          startCountdown(9);
        }, 2500); // Показываем сообщение 2.5 секунды
      } else {
        clearBets();
        startCountdown(9);
      }

      if (resolveFn) resolveFn();
    }
  } else if (phase === 'betting' || phase === 'accelerate') {
    // Idle / accelerate - крутим равномерно
    currentAngle += omega * dt;
  }

  drawWheel(currentAngle);
  rafId = requestAnimationFrame(tick);
}

/* ===== Win Message ===== */
function showWinMessage(typeKey) {
  const message = WIN_MESSAGES[typeKey] || '🎉 Поздравляем!';
  
  // Создаём overlay для сообщения
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    animation: fadeIn 0.3s ease;
  `;

  const messageBox = document.createElement('div');
  messageBox.style.cssText = `
    background: linear-gradient(135deg, #1a2332, #0f1620);
    border: 2px solid ${COLORS[typeKey]?.fill || '#00a6ff'};
    border-radius: 24px;
    padding: 40px 32px;
    text-align: center;
    max-width: 90%;
    animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px ${COLORS[typeKey]?.fill || '#00a6ff'}40;
  `;

  const icon = document.createElement('div');
  icon.style.cssText = `
    font-size: 80px;
    line-height: 1;
    margin-bottom: 20px;
    animation: bounce 0.6s ease;
  `;
  icon.textContent = message.split(' ')[0]; // Берём emoji

  const text = document.createElement('div');
  text.style.cssText = `
    font-size: 24px;
    font-weight: 900;
    color: #ffffff;
    margin-bottom: 10px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  `;
  text.textContent = message.substring(2); // Текст без emoji

  const result = document.createElement('div');
  result.style.cssText = `
    font-size: 32px;
    font-weight: 900;
    color: ${COLORS[typeKey]?.fill || '#00a6ff'};
    margin-top: 16px;
    text-shadow: 0 0 20px ${COLORS[typeKey]?.fill || '#00a6ff'};
  `;
  result.textContent = LABELS[typeKey] || typeKey;

  messageBox.appendChild(icon);
  messageBox.appendChild(text);
  messageBox.appendChild(result);
  overlay.appendChild(messageBox);
  document.body.appendChild(overlay);

  // Добавляем стили для анимаций
  if (!document.getElementById('win-animations')) {
    const style = document.createElement('style');
    style.id = 'win-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
  }

  // Удаляем через 2.5 секунды
  setTimeout(() => {
    overlay.style.animation = 'fadeIn 0.3s ease reverse';
    setTimeout(() => overlay.remove(), 300);
  }, 2200);
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

      // Ускоряемся
      phase = 'accelerate';
      setBetPanel(false);
      
      try {
        await accelerateTo(FAST_OMEGA, 1200);
        console.log('Acceleration complete');

        // Берём исход
        const { sliceIndex, type } = await fetchRoundOutcome();
        console.log('Round outcome:', { sliceIndex, type });

        // Долго и плавно тормозим
        const dur = 5000 + Math.floor(Math.random()*2000);
        console.log('Starting deceleration, duration:', dur);
        await decelerateToSlice(sliceIndex, dur, 4, type);
        console.log('Deceleration complete');
      } catch (error) {
        console.error('Error during spin:', error);
        // Восстанавливаем состояние в случае ошибки
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
    // Нормализуем текущий угол
    const normalizedCurrent = currentAngle % (2 * Math.PI);
    
    // Вычисляем целевой угол
    const sliceCenter = sliceIndex * SLICE_ANGLE + SLICE_ANGLE / 2;
    
    // Разница между указателем и центром сектора
    let deltaToTarget = POINTER_ANGLE - normalizedCurrent - sliceCenter;
    
    // Нормализуем разницу
    while (deltaToTarget > Math.PI) deltaToTarget -= 2 * Math.PI;
    while (deltaToTarget < -Math.PI) deltaToTarget += 2 * Math.PI;
    
    // Добавляем дополнительные обороты
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
    omega = 0; // Останавливаем автоматическое вращение
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
    
    // Проверяем, есть ли в ответе нужные поля
    if (data?.ok && typeof data.sliceIndex === 'number' && data.type) {
      return data;
    }
    
    console.warn('Invalid server response, using fallback');
    throw new Error('Invalid response');
  } catch(e) {
    console.warn('Failed to fetch round outcome, using local fallback:', e);
  }
  
  // Fallback локально
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
  historyList.prepend(item);
  
  const all = historyList.querySelectorAll('.history-item');
  if (all.length > 20) all[all.length-1].remove();
}

function clearBets(){
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