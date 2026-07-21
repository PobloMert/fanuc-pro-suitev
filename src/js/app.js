/**
 * MTB Elektrik Bakım — ES6 Main Application Bootstrapper
 */

import { State } from './state.js';
import { addStyle } from './utils.js';
import { applyTheme } from './ui/theme.js';
import { loadData, loadSettings, loadUsers } from './data_loader.js';
import { showLoginScreen } from './ui/auth.js';
import { openSpotlight, closeSpotlight, spotlightSearch } from './ui/spotlight.js';
import { toggleNotifPanel, closeNotifPanel, organizeNavigation, initRippleEffect } from './ui/navigation.js';

// Global error handler
window.onerror = function(message, source, lineno, colno, error) {
  const errText = `UI Error: ${message}\nSource: ${source}\nLine: ${lineno}:${colno}\nStack: ${error ? error.stack : 'No stack'}\n\n`;
  try {
    if (window.electronAPI && window.electronAPI.writeFile) {
      window.electronAPI.writeFile('./data/ui_error_log.txt', errText);
    }
  } catch (e) {}
  alert('Sistem Hatası: ' + message + '\nDetay için data/ui_error_log.txt dosyasını kontrol edin.');
};

document.addEventListener('DOMContentLoaded', async () => {
  await init();
});

async function init() {
  // Inject extra layout & adapter badge styles
  addStyle(`
    .book-card { cursor: pointer; }
    .book-card:hover { border-color: var(--border-light); transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .book-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    [id^="page-"] .page-body .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    [id^="page-"] .page-body .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    @media (max-width: 900px) {
      [id^="page-"] .page-body .grid-2 { grid-template-columns: 1fr !important; }
      [id^="page-"] .page-body .grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 600px) {
      [id^="page-"] .page-body .grid-3 { grid-template-columns: 1fr !important; }
    }

    /* Telemetry Adapter Badge */
    .tb-adapter-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px !important;
      margin: 0 4px;
      height: 24px !important;
      width: auto !important;
      min-width: max-content;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border);
      font-size: 11.5px;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all 0.2s ease;
      cursor: pointer;
      align-self: center;
      white-space: nowrap;
    }
    .tb-adapter-badge:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: var(--border-light);
      color: var(--text-primary);
    }

    .adapter-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }
    .adapter-status-dot.running { background: #10b981; box-shadow: 0 0 6px #10b981; }
    .adapter-status-dot.restarting, .adapter-status-dot.starting { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; animation: pulse 1s infinite alternate; }
    .adapter-status-dot.error { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
    .adapter-status-dot.stopped { background: #6b7280; }

    @keyframes pulse {
      from { opacity: 0.4; }
      to { opacity: 1.0; }
    }
  `);

  // Window controls
  const btnMin = document.getElementById('btn-minimize');
  const btnMax = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  if (btnMin) btnMin.addEventListener('click', () => window.electronAPI.minimize());
  if (btnMax) btnMax.addEventListener('click', () => window.electronAPI.maximize());
  if (btnClose) btnClose.addEventListener('click', () => window.electronAPI.close());

  // App data dir
  if (window.electronAPI && window.electronAPI.getAppDataDir) {
    State.appDataDir = await window.electronAPI.getAppDataDir();
  }

  // Load data & settings
  await loadData();
  await loadSettings();
  applyTheme(State.settings.theme || 'dark');
  await loadUsers();
  showLoginScreen();

  // Telemetry Adapter Status Monitor
  setupAdapterStatusMonitor();

  // Spotlight search
  const btnSpotlight = document.getElementById('btn-spotlight');
  if (btnSpotlight) btnSpotlight.addEventListener('click', openSpotlight);
  
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSpotlight(); }
    if (e.key === 'Escape') { closeSpotlight(); closeNotifPanel(); }
  });

  const spotlightInput = document.getElementById('spotlight-input');
  if (spotlightInput) {
    spotlightInput.addEventListener('input', (e) => spotlightSearch(e.target.value));
  }

  // Notification bell
  const btnNotif = document.getElementById('btn-notif');
  if (btnNotif) btnNotif.addEventListener('click', toggleNotifPanel);

  // User avatar → switch user
  const userAvatarBtn = document.getElementById('user-avatar-btn');
  if (userAvatarBtn) userAvatarBtn.addEventListener('click', showLoginScreen);

  // Initialize ripple click animations
  initRippleEffect();
  organizeNavigation();

  // Sidebar Navigation Click Handlers
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof window.navigate === 'function') {
        window.navigate(btn.dataset.page);
      }
    });
  });
}

function setupAdapterStatusMonitor() {
  const btn = document.getElementById('btn-adapter-status');
  const dot = document.getElementById('adapter-status-dot');
  const text = document.getElementById('adapter-status-text');

  function updateStatusUI(status) {
    if (!status || !dot || !text) return;

    dot.className = 'adapter-status-dot ' + (status.state || 'stopped');

    if (status.state === 'running') {
      text.textContent = 'Telemetri';
      if (btn) btn.title = 'Telemetri Servisi: Çalışıyor (Çevrimiçi)';
    } else if (status.state === 'restarting' || status.state === 'starting') {
      const attemptsInfo = status.attempts ? ` (${status.attempts}/${status.maxAttempts || 10})` : '';
      text.textContent = `Yeniden Başlatılıyor${attemptsInfo}`;
      if (btn) btn.title = `Telemetri Servisi Yeniden Başlatılıyor${attemptsInfo}...`;
    } else if (status.state === 'error') {
      text.textContent = 'Telemetri Hatası';
      if (btn) btn.title = `Telemetri Servisi Hatası: ${status.lastError || 'Servis başlatılamadı'}. Yeniden başlatmak için tıklayın.`;
    } else {
      text.textContent = 'Çevrimdışı';
      if (btn) btn.title = 'Telemetri Servisi Kapalı. Yeniden başlatmak için tıklayın.';
    }
  }

  // Initial fetch
  if (window.electronAPI && window.electronAPI.getAdapterStatus) {
    window.electronAPI.getAdapterStatus().then(res => {
      if (res && res.ok) updateStatusUI(res.data);
    });
  }

  // Status push events from Main Process
  if (window.electronAPI && window.electronAPI.onAdapterStatusChanged) {
    window.electronAPI.onAdapterStatusChanged((status) => {
      updateStatusUI(status);
    });
  }

  // Click handler to manual restart adapter
  if (btn) {
    btn.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.restartAdapter) {
        text.textContent = 'Başlatılıyor...';
        dot.className = 'adapter-status-dot restarting';
        const res = await window.electronAPI.restartAdapter();
        if (res && res.ok) {
          if (typeof window.showToast === 'function') {
            window.showToast('Telemetri servisi yeniden başlatıldı ✓', 'success');
          }
        } else {
          if (typeof window.showToast === 'function') {
            window.showToast('Telemetri servisi başlatılamadı: ' + (res?.error || 'Bilinmeyen hata'), 'error');
          }
        }
      }
    });
  }
}
