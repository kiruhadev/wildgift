// public/js/splash.js - Fast Splash Screen (1.2 seconds)
(function () {
  console.log('[SPLASH] 🎨 Initializing fast splash (1.2s)');

  const splash = document.getElementById('splash');
  if (!splash) {
    console.warn('[SPLASH] Splash element not found');
    return;
  }

  const fill = document.getElementById('splash-fill');
  const percentEl = document.getElementById('splash-percent');
  
  if (!fill) {
    console.warn('[SPLASH] Progress fill element not found');
    return;
  }

  // ====== КОНФИГУРАЦИЯ ======
  const TOTAL_DURATION = 1200; // 1.2 секунды
  const HIDE_DELAY = 200; // Задержка перед скрытием
  const REMOVE_DELAY = 300; // Задержка перед удалением из DOM

  let currentProgress = 0;
  let isComplete = false;
  let startTime = performance.now();
  let animationFrame = null;

  // ====== ЭТАПЫ ПРОГРЕССА (всего 1.2 сек) ======
  const stages = [
    { percent: 20, time: 150 },   // 0-150ms: Быстрый старт
    { percent: 40, time: 300 },   // 150-300ms: Загрузка
    { percent: 55, time: 500 },   // 300-500ms: Пауза
    { percent: 70, time: 700 },   // 500-700ms: Продолжение
    { percent: 85, time: 900 },   // 700-900ms: Почти готово
    { percent: 95, time: 1100 },  // 900-1100ms: Финал
    { percent: 100, time: 1200 }  // 1100-1200ms: Завершение
  ];

  let currentStage = 0;

  // ====== ВЫЧИСЛЕНИЕ ПРОГРЕССА ПО ВРЕМЕНИ ======
  function calculateProgress(elapsed) {
    // Если время вышло - 100%
    if (elapsed >= TOTAL_DURATION) {
      return 100;
    }

    // Находим текущий и следующий этап
    let prevStage = { percent: 0, time: 0 };
    let nextStage = stages[0];

    for (let i = 0; i < stages.length; i++) {
      if (elapsed < stages[i].time) {
        nextStage = stages[i];
        if (i > 0) prevStage = stages[i - 1];
        break;
      }
      prevStage = stages[i];
    }

    // Интерполяция между этапами
    const stageDuration = nextStage.time - prevStage.time;
    const stageElapsed = elapsed - prevStage.time;
    const stageProgress = stageElapsed / stageDuration;

    // Плавный переход с easing
    const easedProgress = easeInOutCubic(stageProgress);
    
    const percentDiff = nextStage.percent - prevStage.percent;
    const progress = prevStage.percent + (percentDiff * easedProgress);

    return Math.min(100, Math.max(0, progress));
  }

  // ====== EASING ФУНКЦИЯ ======
  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ====== ОБНОВЛЕНИЕ UI ======
  function updateUI(progress) {
    const p = Math.round(progress);
    
    fill.style.width = p + '%';
    
    if (percentEl && !percentEl.hidden) {
      percentEl.textContent = p + '%';
    }
  }

  // ====== АНИМАЦИЯ ПРОГРЕССА ======
  function animate() {
    if (isComplete) return;

    const elapsed = performance.now() - startTime;
    const progress = calculateProgress(elapsed);

    currentProgress = progress;
    updateUI(progress);

    // Если достигли 100% или время вышло
    if (progress >= 100 || elapsed >= TOTAL_DURATION) {
      completeSplash();
      return;
    }

    animationFrame = requestAnimationFrame(animate);
  }

  // ====== ЗАВЕРШЕНИЕ SPLASH ======
  function completeSplash() {
    if (isComplete) return;
    
    console.log('[SPLASH] ✅ Complete! (', Math.round(performance.now() - startTime), 'ms)');
    
    isComplete = true;
    currentProgress = 100;
    updateUI(100);
    
    // Небольшая задержка перед скрытием
    setTimeout(() => {
      splash.classList.add('splash--hide');
      
      // Удаляем элемент после анимации
      setTimeout(() => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        splash.remove();
        console.log('[SPLASH] Removed from DOM');
        
        // Уведомляем приложение что splash завершён
        window.dispatchEvent(new Event('splash:complete'));
      }, REMOVE_DELAY);
    }, HIDE_DELAY);
  }

  // ====== ПУБЛИЧНАЯ ФУНКЦИЯ ======
  window.setSplashProgress = function (p) {
    // В режиме 1.2 секунды ручной контроль не используется
    // Но функция доступна для совместимости
    console.log('[SPLASH] Manual progress ignored in timed mode:', p + '%');
  };

  // ====== ПРИНУДИТЕЛЬНОЕ ЗАВЕРШЕНИЕ ======
  window.completeSplash = completeSplash;

  // ====== СОБЫТИЯ ЗАГРУЗКИ ======
  
  // Если страница загрузилась быстрее 1.2 сек - всё равно ждём
  let loadComplete = false;
  
  window.addEventListener('load', () => {
    loadComplete = true;
    console.log('[SPLASH] Page loaded at', Math.round(performance.now() - startTime), 'ms');
    
    // Если уже прошло 1.2 сек - завершаем сразу
    const elapsed = performance.now() - startTime;
    if (elapsed >= TOTAL_DURATION) {
      completeSplash();
    }
  });

  // ====== ТАЙМАУТ БЕЗОПАСНОСТИ ======
  // Если что-то пошло не так - принудительно закрываем через 3 секунды
  const safetyTimeout = setTimeout(() => {
    if (!isComplete) {
      console.warn('[SPLASH] ⏱️ Safety timeout - force complete');
      completeSplash();
    }
  }, 3000);

  // ====== СТАРТ АНИМАЦИИ ======
  console.log('[SPLASH] Starting animation (target: ' + TOTAL_DURATION + 'ms)');
  startTime = performance.now();
  animate();

  // ====== ЭКСПОРТ ======
  window.WTSplash = {
    complete: completeSplash,
    getCurrentProgress: () => Math.round(currentProgress),
    getElapsedTime: () => Math.round(performance.now() - startTime),
    getDuration: () => TOTAL_DURATION
  };

  // ====== DEBUG ======
  if (window.location.search.includes('debug')) {
    console.log('[SPLASH] Debug mode enabled');
    if (percentEl) percentEl.hidden = false;
    
    // Показываем время каждые 100мс
    const debugInterval = setInterval(() => {
      if (isComplete) {
        clearInterval(debugInterval);
        return;
      }
      const elapsed = performance.now() - startTime;
      console.log('[SPLASH] Progress:', Math.round(currentProgress) + '%', 'Time:', Math.round(elapsed) + 'ms');
    }, 100);
  }

  console.log('[SPLASH] ✅ Initialized');
})();
