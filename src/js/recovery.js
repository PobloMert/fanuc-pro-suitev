(() => {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  if (params.get('recovery') !== 'renderer') return;
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('recovery-overlay');
    const reason = document.getElementById('recovery-reason');
    if (reason) reason.textContent = `Neden: ${params.get('reason') || 'bilinmiyor'}`;
    if (overlay) { overlay.hidden = false; overlay.style.display = 'grid'; }
    document.getElementById('recovery-reload')?.addEventListener('click', () => {
      window.location.href = window.location.pathname;
    });
  }, { once: true });
})();
