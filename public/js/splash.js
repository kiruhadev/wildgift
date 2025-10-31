// Splash logic
(function () {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const fill = document.getElementById('splash-fill');
  const percentEl = document.getElementById('splash-percent');
  let current = 0;

  // Глобальная функция: вызывай из любой части приложения
  window.setSplashProgress = function (p) {
    current = Math.max(0, Math.min(100, (p|0)));
    fill.style.width = current + '%';
    percentEl.textContent = current + '%';

    if (current >= 100) {
      requestAnimationFrame(() => {
        splash.classList.add('splash--hide');
        setTimeout(() => splash.remove(), 500);
      });
    }
  };

  // Демо-имитация прогресса, пока инициализируется приложение
  let demo = 0;
  const timer = setInterval(() => {
    demo += Math.random() * 12;
    setSplashProgress(demo);
    if (demo >= 95) clearInterval(timer);
  }, 200);

  // Когда страница и ресурсы загружены — доводим до 100
  window.addEventListener('load', () => {
    setSplashProgress(100);
  });
})();
