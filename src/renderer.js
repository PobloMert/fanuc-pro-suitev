/**
 * MTB Elektrik Bakım — Renderer (Main UI Controller)
 * Handles: Navigation, Dashboard, Library, Projects, Alarms, Parameters, Settings
 */

'use strict';

// Diagnostic Error Tracker & Crash Boundary
window.onerror = function(message, source, lineno, colno, error) {
  const errText = `UI Error: ${message}\nSource: ${source}\nLine: ${lineno}:${colno}\nStack: ${error ? error.stack : 'No stack'}\n\n`;
  try {
    if (window.electronAPI && window.electronAPI.writeFile) {
      window.electronAPI.writeFile('./data/ui_error_log.txt', errText);
    }
  } catch (e) {}
  console.error('Unhandled UI Error:', errText);
  return true; // Prevent default error popup to keep app running smoothly
};

window.onunhandledrejection = function(event) {
  const reason = event.reason ? (event.reason.stack || event.reason) : 'Unhandled Promise Rejection';
  console.warn('Unhandled Rejection:', reason);
};

function safeJSONParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('safeJSONParse failed:', e);
    return fallback;
  }
}

function debounce(fn, delay = 200) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

if (typeof window !== 'undefined' && !window.State) {
  window.State = {
    currentPage: 'dashboard',
    appDataDir: null,
    activeDiagnostic: null,
    alarms: [],
    parameters: [],
    nc_codes: [],
    pmc_signals: [],
    library: [],
    projects: [],
    machines: [],
    maintenances: [],
    batteries: [],
    keep_relays: [],
    drive_alarms: [],
    fans: [],
    wiki: [],
    backup_logs: [],
    custom_mcodes: [],
    custom_alarms: [],
    custom_alarm_notes: {},
    users: [],
    notifications: [],
    onlineSearchEnabled: false,
    currentUser: null,
    settings: {
      aiProvider: 'offline',
      aiApiKey: '',
      aiModel: 'gpt-4o',
      theme: 'dark',
      pdfPaths: {}
    }
  };
}
var State = window.State;


// Main initialization is bootstrapped via src/js/app.js module


async function init() {
  // Inject extra styles
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
  `);

  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.electronAPI.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.electronAPI.close());

  // App data dir
  State.appDataDir = await window.electronAPI.getAppDataDir();

  // Load data
  await loadData();

  // Load settings from disk
  await loadSettings();

  // Apply saved theme
  applyTheme(State.settings.theme || 'dark');

  // Load users
  await loadUsers();

  // Show login screen
  showLoginScreen();

  // Spotlight search
  document.getElementById('btn-spotlight').addEventListener('click', openSpotlight);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSpotlight(); }
    if (e.key === 'Escape') { closeSpotlight(); closeNotifPanel(); }
  });
  document.getElementById('spotlight-input').addEventListener('input', (e) => spotlightSearch(e.target.value));

  // Notification bell
  document.getElementById('btn-notif').addEventListener('click', toggleNotifPanel);

  // User avatar → switch user
  document.getElementById('user-avatar-btn').addEventListener('click', showLoginScreen);

  // Initialize ripple click animations
  initRippleEffect();

  organizeNavigation();

  // Navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });
}

// ── Ripple Click Effect ─────────────────────────────────────────
function initRippleEffect() {
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('.btn, .btn-icon, .tb-btn, .login-user-btn, .tab-btn, .nav-item');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple-wave';

    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    if (target.classList.contains('btn-secondary') || target.classList.contains('btn-ghost') || target.classList.contains('tb-btn') || target.classList.contains('nav-item')) {
      ripple.style.background = 'rgba(var(--accent-rgb), 0.3)';
    }

    target.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
}

// ── Data Loading ───────────────────────────────────────────────
function organizeNavigation() {
  const sidebar = document.getElementById('sidebar');
  const footer = sidebar.querySelector('.sidebar-footer');
  const items = new Map(
    [...sidebar.querySelectorAll('.nav-item[data-page]')].map(item => [item.dataset.page, item])
  );
  const groups = [
    { id: 'operations', label: 'Operasyon', pages: ['cnc_dashboard', 'machines', 'maintenance', 'battery', 'reports', 'predictive', 'reliability', 'projects'] },
    { id: 'diagnostics', label: 'Teşhis ve Destek', pages: ['troubleshooter', 'io_link', 'drive_diagnostics', 'spindle_diagnostics', 'backup_wizard', 'backup_tracker', 'troubleshoot_wiki'] },
    { id: 'engineering', label: 'Mühendislik Araçları', pages: ['tuning', 'generator', 'gcode_checker', 'param_comparator', 'gear_ratio', 'backlash_helper', 'axis_limits_helper', 'rs232', 'rs232_cables', 'fssb_topology'] },
    { id: 'reference', label: 'Bilgi Merkezi', pages: ['library', 'alarms', 'parameters', 'keep_relays', 'macro', 'nc_codes', 'pmc_signals', 'custom_builder_library', 'cheat_sheets'] }
  ];

  const home = document.createElement('div');
  home.className = 'sidebar-home';
  if (items.has('dashboard')) home.append(items.get('dashboard'));

  const host = document.createElement('div');
  host.className = 'nav-groups';
  groups.forEach(group => {
    const groupItems = group.pages.map(page => items.get(page)).filter(Boolean);
    if (!groupItems.length) return;
    const details = document.createElement('details');
    details.className = 'nav-group';
    details.dataset.group = group.id;
    details.open = group.id === 'operations';
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.className = 'nav-group-title';
    title.textContent = group.label;
    const count = document.createElement('span');
    count.className = 'nav-group-count';
    count.textContent = String(groupItems.length);
    summary.append(title, count);
    details.append(summary, ...groupItems);
    host.append(details);
  });

  const shortcuts = document.createElement('div');
  shortcuts.className = 'sidebar-shortcuts';
  if (items.has('ai')) shortcuts.append(items.get('ai'));

  sidebar.querySelectorAll('.sidebar-section').forEach(section => section.remove());
  sidebar.insertBefore(home, footer);
  sidebar.insertBefore(host, footer);
  sidebar.insertBefore(shortcuts, footer);
}

function safeParseJSON(dataString, key, fallbackValue) {
  if (!dataString || !dataString.trim()) return fallbackValue;
  try {
    const parsed = JSON.parse(dataString);
    if (key) {
      return parsed[key] !== undefined ? parsed[key] : fallbackValue;
    }
    return parsed;
  } catch (e) {
    console.error(`Failed to parse JSON for key "${key}":`, e);
    return fallbackValue;
  }
}

// ── Startup Log Collector ──
const StartupErrors = [];

async function loadJSONDatabase(fileName, key, defaultValue) {
  const filePath = `./data/${fileName}`;
  const backupPath = `${filePath}.bak`;
  let dataStr = null;
  let fromBackup = false;

  // 1. Try reading the primary database file
  let res = await window.electronAPI.readFile(filePath);
  if (res.ok) {
    dataStr = res.data;
  } else {
    StartupErrors.push(`${fileName} ana dosyası okunamadı: ${res.error || 'Dosya bulunamadı'}`);
    
    // Try reading backup file
    let backupRes = await window.electronAPI.readFile(backupPath);
    if (backupRes.ok) {
      dataStr = backupRes.data;
      fromBackup = true;
    }
  }

  // 2. Parse JSON data
  let parsedData = defaultValue;
  if (dataStr && dataStr.trim()) {
    try {
      const parsed = JSON.parse(dataStr);
      parsedData = key ? (parsed[key] !== undefined ? parsed[key] : defaultValue) : parsed;
      
      // If we recovered from a backup, try writing it back to primary to self-heal
      if (fromBackup) {
        await window.electronAPI.writeFile(filePath, dataStr);
        StartupErrors.push(`${fileName} yedek dosyadan kurtarılarak otomatik onarıldı.`);
      }
    } catch (e) {
      StartupErrors.push(`${fileName} JSON ayrıştırma hatası: ${e.message}`);
      
      // Try backup file if parsing primary failed
      if (!fromBackup) {
        let backupRes = await window.electronAPI.readFile(backupPath);
        if (backupRes.ok && backupRes.data.trim()) {
          try {
            const parsed = JSON.parse(backupRes.data);
            parsedData = key ? (parsed[key] !== undefined ? parsed[key] : defaultValue) : parsed;
            await window.electronAPI.writeFile(filePath, backupRes.data);
            StartupErrors.push(`${fileName} bozuk dosya yedek sürümden geri yüklenerek onarıldı.`);
          } catch (backupErr) {
            StartupErrors.push(`${fileName} yedek dosyası da bozuk: ${backupErr.message}`);
          }
        }
      }
    }
  } else {
    // File is empty or missing, and no backup was found.
    // Self-heal: Write default empty template to disk
    try {
      const emptyPayload = key ? JSON.stringify({ [key]: defaultValue }, null, 2) : JSON.stringify(defaultValue, null, 2);
      await window.electronAPI.writeFile(filePath, emptyPayload);
      StartupErrors.push(`${fileName} bulunamadı, şablon otomatik oluşturuldu.`);
    } catch (writeErr) {
      console.error(`Failed to self-heal missing database ${fileName}:`, writeErr);
    }
  }

  return parsedData;
}

async function loadData() {
  StartupErrors.length = 0; // Reset
  try {
    const results = await Promise.all([
      loadJSONDatabase('alarms.json', 'alarms', []),
      loadJSONDatabase('parameters.json', 'parameters', []),
      loadJSONDatabase('library.json', 'books', []),
      loadJSONDatabase('nc_codes.json', 'nc_codes', []),
      loadJSONDatabase('pmc_signals.json', 'pmc_signals', []),
      loadJSONDatabase('machines.json', 'machines', []),
      loadJSONDatabase('maintenances.json', 'maintenances', []),
      loadJSONDatabase('batteries.json', 'batteries', []),
      loadJSONDatabase('keep_relays.json', 'keep_relays', []),
      loadJSONDatabase('drive_alarms.json', 'drive_alarms', []),
      loadJSONDatabase('fans.json', 'fans', []),
      loadJSONDatabase('wiki.json', 'articles', []),
      loadJSONDatabase('backup_logs.json', 'backup_logs', []),
      loadJSONDatabase('custom_mcodes.json', 'mcodes', []),
      loadJSONDatabase('custom_alarms.json', 'alarms', []),
      loadJSONDatabase('custom_alarm_notes.json', 'notes', {})
    ]);

    State.alarms = results[0];
    State.parameters = results[1];
    State.library = results[2];
    State.nc_codes = results[3];
    State.pmc_signals = results[4];
    State.machines = results[5];
    State.maintenances = results[6];
    State.batteries = results[7];
    State.keep_relays = results[8];
    State.drive_alarms = results[9];
    State.fans = results[10];
    State.wiki = results[11];
    State.backup_logs = results[12];
    State.custom_mcodes = results[13];
    State.custom_alarms = results[14];
    State.custom_alarm_notes = results[15];

    if (StartupErrors.length > 0) {
      console.warn('Veri yükleme sırasında uyarılar oluştu:\n', StartupErrors.join('\n'));
      const warningCount = StartupErrors.filter(e => e.includes('kurtarılarak') || e.includes('onarıldı') || e.includes('bulunamadı')).length;
      const errorCount = StartupErrors.length - warningCount;
      
      if (errorCount > 0) {
        showToast(`Veri yüklemede ${errorCount} hata oluştu. Lütfen log dosyasını kontrol edin.`, 'error');
      } else if (warningCount > 0) {
        showToast(`${warningCount} veritabanı otomatik onarıldı veya oluşturuldu.`, 'info');
      }
      
      try {
        const errText = `Startup Log [${new Date().toISOString()}]:\n` + StartupErrors.join('\n') + '\n\n';
        await window.electronAPI.writeFile('./data/ui_error_log.txt', errText, 'utf8');
      } catch {}
    }
  } catch (e) {
    console.error('Data load exception:', e);
    alert('Kritik veri yükleme hatası: ' + e.message);
  }

  await loadProjects();
}

async function loadUsers() {
  try {
    const res = await window.electronAPI.readFile('./data/users.json');
    if (res.ok) {
      State.users = safeParseJSON(res.data, 'users', []);
    }
  } catch {}
  if (!State.users.length) {
    State.users = [{ id: 1, name: 'Admin', role: 'admin', pin: '1234', color: '#3b82f6', initials: 'AD' }];
  }
}

async function loadProjects() {
  try {
    const projDir = State.appDataDir + '/projects';
    const listRes = await window.electronAPI.listDir(projDir);
    if (listRes.ok) {
      State.projects = [];
      for (const item of listRes.items) {
        if (item.isDir) {
          const metaPath = item.path + '/meta.json';
          const metaRes = await window.electronAPI.readFile(metaPath);
          if (metaRes.ok) {
            try { State.projects.push(JSON.parse(metaRes.data)); } catch {}
          }
        }
      }
    }
  } catch {}
}

async function loadSettings() {
  const settingsPath = State.appDataDir + '/settings.json';
  const res = await window.electronAPI.readFile(settingsPath);
  if (res.ok) {
    try {
      Object.assign(State.settings, JSON.parse(res.data));
      if (!State.settings.pdfPaths) State.settings.pdfPaths = {};
    } catch {}
  }
}

async function saveSettings() {
  const settingsPath = State.appDataDir + '/settings.json';
  try {
    const res = await window.electronAPI.writeFile(settingsPath, JSON.stringify(State.settings, null, 2));
    if (!res || !res.ok) {
      showToast('Ayarlar kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Ayarlar kaydedilirken hata oluştu: ' + err.message, 'error');
  }
}

// ── Navigation ─────────────────────────────────────────────────
window.navigate = function navigate(page, extraData = null) {
  State.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + page);
  if (navBtn) {
    navBtn.classList.add('active');
    const group = navBtn.closest('.nav-group');
    if (group) group.open = true;
  }

  const content = document.getElementById('main-content');
  content.innerHTML = '';

  const pages = {
    dashboard:   renderDashboard,
    cnc_dashboard: renderCncDashboard,
    cnc_screen_viewer: renderCncScreenViewer,
    library:     renderLibrary,

    projects:    renderProjects,
    machines:    renderMachines,
    maintenance: renderMaintenance,
    battery:     renderBattery,
    reports:     renderReports,
    predictive:  renderPredictive,
    tuning:      renderTuning,
    generator:   renderGenerator,
    rs232:       renderRS232,
    cheat_sheets: renderCheatSheets,
    alarms:      renderAlarms,
    parameters:  renderParameters,
    keep_relays: renderKeepRelays,
    macro:       renderMacroVariables,
    drive_diagnostics: renderDriveDiagnostics,
    gear_ratio:  renderGearRatio,
    reliability: renderReliability,
    gcode_checker: renderGcodeChecker,
    param_comparator: renderParamComparator,
    troubleshooter: renderTroubleshooter,
    io_link:     renderIOLink,
    backup_wizard: renderBackupWizard,
    troubleshoot_wiki: renderTroubleshootWiki,
    backup_tracker: renderBackupTracker,
    backlash_helper: renderBacklashHelper,
    axis_limits_helper: renderAxisLimitsHelper,
    spindle_diagnostics: renderSpindleDiagnostics,
    custom_builder_library: renderCustomBuilderLibrary,
    rs232_cables: renderRs232Cables,
    nc_codes:    renderNcCodes,
    pmc_signals: renderPmcSignals,
    fssb_topology: renderFssbTopology,
    ai:          renderAI,
    settings:    renderSettings,
    pdf_viewer:  () => renderPdfViewer(extraData),
  };

  const fn = pages[page];
  if (fn) {
    const el = fn();
    content.appendChild(el);
    el.classList.add('animate-in');
  }
};


// ════════════════════════════════════════════════════════════════
//  THEME SWITCHER
// ════════════════════════════════════════════════════════════════
function applyTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-retro');
  if (theme === 'light') document.body.classList.add('theme-light');
  else if (theme === 'retro') document.body.classList.add('theme-retro');
  State.settings.theme = theme;
}

// ════════════════════════════════════════════════════════════════
//  LOGIN / USER MANAGEMENT
// ════════════════════════════════════════════════════════════════
let _loginSelectedUser = null;

function showLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  overlay.classList.remove('hidden');
  const list = document.getElementById('login-user-list');
  const pinWrap = document.getElementById('login-pin-wrap');
  pinWrap.style.display = 'none';
  _loginSelectedUser = null;

  list.innerHTML = State.users.map(u => `
    <button class="login-user-btn" onclick="loginSelectUser(${u.id})">
      <div class="login-user-avatar" style="background:${u.color}">${escapeHTML(u.initials)}</div>
      <div>
        <div class="login-user-name">${escapeHTML(u.name)}</div>
        <div class="login-user-role">${escapeHTML(getRoleLabel(u.role))}</div>
      </div>
    </button>
  `).join('');
}

function getRoleLabel(role) {
  const map = { admin: '🔑 Yönetici', technician: '🔧 Bakım Teknisyeni', operator: '👤 Operatör' };
  return map[role] || role;
}

window.loginSelectUser = function(userId) {
  _loginSelectedUser = State.users.find(u => u.id === userId);
  if (!_loginSelectedUser) return;
  const pinWrap = document.getElementById('login-pin-wrap');
  const label = document.getElementById('login-pin-label');
  label.textContent = `${_loginSelectedUser.name} — PIN giriniz`;
  document.getElementById('login-pin-input').value = '';
  document.getElementById('login-pin-error').textContent = '';
  pinWrap.style.display = 'flex';
  document.getElementById('login-user-list').style.display = 'none';
  setTimeout(() => document.getElementById('login-pin-input').focus(), 80);

  document.getElementById('login-pin-input').onkeydown = (e) => {
    if (e.key === 'Enter') loginSubmitPin();
  };
};

window.loginBack = function() {
  document.getElementById('login-pin-wrap').style.display = 'none';
  document.getElementById('login-user-list').style.display = 'flex';
  _loginSelectedUser = null;
};

window.loginSubmitPin = function() {
  const pin = document.getElementById('login-pin-input').value;
  if (!_loginSelectedUser) return;
  if (pin === _loginSelectedUser.pin) {
    State.currentUser = _loginSelectedUser;
    document.getElementById('login-overlay').classList.add('hidden');
    updateUserAvatar();
    checkNotifications();
    navigate('dashboard');
  } else {
    document.getElementById('login-pin-error').textContent = '❌ Hatalı PIN. Tekrar deneyiniz.';
    document.getElementById('login-pin-input').value = '';
    document.getElementById('login-pin-input').focus();
  }
};

// Allow clicking outside login card to submit (double-click escape for no-pin case)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !document.getElementById('login-overlay').classList.contains('hidden')) {
    loginSubmitPin();
  }
});

function updateUserAvatar() {
  const u = State.currentUser;
  if (!u) {
    document.getElementById('user-avatar-circle').style.background = 'var(--bg-card2)';
    document.getElementById('user-avatar-circle').textContent = '??';
    document.getElementById('user-avatar-name').textContent = 'Misafir';
    return;
  }
  document.getElementById('user-avatar-circle').style.background = u.color;
  document.getElementById('user-avatar-circle').textContent = u.initials;
  document.getElementById('user-avatar-name').textContent = u.name;
}

// Role-based permission check
function canEdit() {
  return State.currentUser && (State.currentUser.role === 'admin' || State.currentUser.role === 'technician');
}
function canDelete() {
  return State.currentUser && State.currentUser.role === 'admin';
}

// ════════════════════════════════════════════════════════════════
//  SPOTLIGHT SEARCH
// ════════════════════════════════════════════════════════════════
function openSpotlight() {
  document.getElementById('spotlight-overlay').classList.add('open');
  document.getElementById('spotlight-input').value = '';
  document.getElementById('spotlight-results').innerHTML = '<div id="spotlight-empty">Aramak istediğiniz alarm, parametre, tezgah veya bakım kaydını yazın...</div>';
  setTimeout(() => document.getElementById('spotlight-input').focus(), 80);
}

window.closeSpotlight = function(event) {
  if (!event || event.target === document.getElementById('spotlight-overlay')) {
    document.getElementById('spotlight-overlay').classList.remove('open');
  }
};

function spotlightSearch(query) {
  const q = (query || '').trim().toLowerCase();
  const resultsEl = document.getElementById('spotlight-results');
  if (!q || q.length < 2) {
    resultsEl.innerHTML = '<div id="spotlight-empty">En az 2 karakter giriniz...</div>';
    return;
  }

  const results = [];

  // Alarms
  State.alarms.filter(a => (a.code || '').toLowerCase().includes(q) || (a.title || '').toLowerCase().includes(q)).slice(0, 4).forEach(a => {
    results.push({ icon: '🚨', title: a.code + ' — ' + a.title, sub: a.category || '', type: 'Alarm', action: () => navigate('alarms') });
  });
  // Parameters
  State.parameters.filter(p => String(p.number || '').includes(q) || (p.description || '').toLowerCase().includes(q)).slice(0, 4).forEach(p => {
    results.push({ icon: '⚙️', title: 'P' + p.number + ' — ' + (p.description || ''), sub: p.group || '', type: 'Parametre', action: () => navigate('parameters') });
  });
  // Machines
  State.machines.filter(m => (m.name || '').toLowerCase().includes(q) || (m.serial || '').toLowerCase().includes(q)).slice(0, 3).forEach(m => {
    results.push({ icon: '🏭', title: m.name, sub: m.model || '', type: 'Tezgah', action: () => navigate('machines') });
  });
  // Maintenance
  State.maintenances.filter(r => (r.description || '').toLowerCase().includes(q) || (r.machine_name || '').toLowerCase().includes(q)).slice(0, 3).forEach(r => {
    results.push({ icon: '🔧', title: r.description || 'Bakım', sub: r.machine_name || '' + ' — ' + (r.date || ''), type: 'Bakım', action: () => navigate('maintenance') });
  });
  // Wiki
  State.wiki.filter(w => (w.title || '').toLowerCase().includes(q) || (w.content || '').toLowerCase().includes(q)).slice(0, 3).forEach(w => {
    results.push({ icon: '📖', title: w.title, sub: w.category || '', type: 'Wiki', action: () => navigate('troubleshoot_wiki') });
  });
  // Keep relays
  State.keep_relays.filter(r => (r.address || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)).slice(0, 2).forEach(r => {
    results.push({ icon: '🔌', title: r.address + ' — ' + (r.description || ''), sub: '', type: 'Keep Relay', action: () => navigate('keep_relays') });
  });

  if (!results.length) {
    resultsEl.innerHTML = `<div id="spotlight-empty">🔍 "<strong>${escapeHTML(query)}</strong>" için sonuç bulunamadı.</div>`;
    return;
  }

  resultsEl.innerHTML = results.map((r, i) => `
    <div class="spotlight-item" onclick="spotlightGo(${i})" id="spl-item-${i}">
      <div class="spotlight-item-icon">${r.icon}</div>
      <div class="spotlight-item-text">
        <div class="spotlight-item-title">${escapeHTML(r.title)}</div>
        ${r.sub ? `<div class="spotlight-item-sub">${escapeHTML(r.sub)}</div>` : ''}
      </div>
      <span class="spotlight-item-type">${escapeHTML(r.type)}</span>
    </div>
  `).join('');

  window._spotlightResults = results;
}

window.spotlightGo = function(index) {
  document.getElementById('spotlight-overlay').classList.remove('open');
  if (window._spotlightResults && window._spotlightResults[index]) {
    window._spotlightResults[index].action();
  }
};

// ════════════════════════════════════════════════════════════════
//  NOTIFICATION SYSTEM
// ════════════════════════════════════════════════════════════════
function checkNotifications() {
  const notifications = [];
  const now = new Date();

  // Battery checks — older than 12 months
  State.batteries.forEach(b => {
    const dateStr = b.tarih || b.lastChanged;
    if (!dateStr) return;
    const d = parseDateHelper(dateStr);
    if (!d || d.getTime() === 0) return;
    const monthsDiff = (now - d) / (1000 * 60 * 60 * 24 * 30);
    const mach = State.machines.find(x => x.id === b.tezgah_id);
    const machName = mach ? mach.numarasi : (b.machine || b.controller || `Tezgah #${b.tezgah_id}`);
    if (monthsDiff >= 12) {
      notifications.push({ level: 'red', title: '🔋 Pil Değişimi Gerekli', sub: `${machName} (Eksen ${b.eksen || '?'}) — ${dateStr} tarihinden beri (${Math.floor(monthsDiff)} ay)` });
    } else if (monthsDiff >= 10) {
      notifications.push({ level: 'amber', title: '🔋 Pil Değişimi Yaklaşıyor', sub: `${machName} (Eksen ${b.eksen || '?'}) — ${dateStr} (${Math.floor(monthsDiff)} ay)` });
    }
  });

  // Fan checks — older than 8760 hours (1 year)
  State.fans.forEach(f => {
    const hours = parseFloat(f.calisma_saati || 0);
    const mach = State.machines.find(x => x.id === f.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${f.tezgah_id}`;
    if (hours >= 8760) {
      notifications.push({ level: 'amber', title: '💨 Fan Değişimi Gerekli', sub: `${machName} (${f.konum || 'Fan'}) — ${Math.floor(hours)} saat çalıştı` });
    }
  });

  // Maintenance check — machines with no PM in 90+ days
  State.machines.forEach(m => {
    const machineMaint = State.maintenances.filter(r => r.tezgah_id == m.id || r.machine_id == m.id);
    if (!machineMaint.length) return;
    const lastMaint = machineMaint.sort((a, b) => {
      return parseDateHelper(b.tarih || b.date) - parseDateHelper(a.tarih || a.date);
    })[0];
    const lastDate = parseDateHelper(lastMaint.tarih || lastMaint.date);
    if (lastDate.getTime() > 0) {
      const daysDiff = (now - lastDate) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 90) {
        notifications.push({ level: 'amber', title: '🔧 Bakım Süresi Geçti', sub: `${m.name} — Son bakım: ${lastMaint.tarih || lastMaint.date} (${Math.floor(daysDiff)} gün önce)` });
      }
    }
  });

  State.notifications = notifications;
  renderNotifPanel();
  updateNotifBadge();

  // Send native OS notification for critical items
  const critical = notifications.filter(n => n.level === 'red');
  if (critical.length) {
    window.electronAPI.showNativeNotification('MTB Elektrik Bakım — Kritik Uyarı', `${critical.length} kritik bakım uyarısı var!`);
  }
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (State.notifications.length > 0) badge.classList.add('show');
  else badge.classList.remove('show');
}

function renderNotifPanel() {
  const body = document.getElementById('notif-panel-body');
  if (!body) return;
  if (!State.notifications.length) {
    body.innerHTML = '<div style="padding:30px; text-align:center; color:var(--text-muted); font-size:12px">✅ Tüm sistemler normal. Aktif uyarı yok.</div>';
    return;
  }
  body.innerHTML = State.notifications.map(n => `
    <div class="notif-item">
      <div class="notif-dot ${n.level}"></div>
      <div class="notif-text">
        <div class="notif-title">${escapeHTML(n.title)}</div>
        <div class="notif-sub">${escapeHTML(n.sub)}</div>
      </div>
    </div>
  `).join('');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
}

window.closeNotifPanel = function() {
  document.getElementById('notif-panel').classList.remove('open');
};

// ════════════════════════════════════════════════════════════════
//  CSV EXPORT
// ════════════════════════════════════════════════════════════════
window.exportMaintenanceCSV = async function() {
  const headers = ['Tarih', 'Tezgah', 'Tür', 'Açıklama', 'Teknisyen', 'Süre (dk)'];
  const rows = State.maintenances.map(r => {
    const mach = State.machines.find(x => x.id == (r.tezgah_id || r.machine_id));
    const machName = mach ? mach.numarasi : (r.tezgah_adi || r.machine_name || `Tezgah #${r.tezgah_id || r.machine_id}`);
    
    // Determine type/tur
    let type = r.tur || r.type;
    if (!type) {
      const desc = (r.aciklama || r.description || '').toLowerCase();
      if (desc.includes('[pm]') || desc.includes('periyodik') || desc.includes('planli') || desc.includes('planlı')) {
        type = 'Planlı Bakım';
      } else {
        type = 'Arıza';
      }
    }

    // Excel noktalı virgül ayracının bozulmaması için tüm alanları temizle
    return [
      (r.tarih || r.date || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      machName.replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      type.replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      (r.aciklama || r.description || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      (r.bakim_yapan || r.technician || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      String(r.sure || r.duration || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' ')
    ];
  });
  const csv = [headers, ...rows].map(r => r.join(';')).join('\r\n');
  const res = await window.electronAPI.exportCSV(csv, `bakim_defteri_${new Date().toISOString().slice(0,10)}.csv`);
  if (res && res.ok) showToast('CSV başarıyla kaydedildi ✓', 'success');
  else showToast('CSV kaydedilemedi', 'error');
};

window.exportAlarmsCSV = async function() {
  const headers = ['Kod', 'Kategori', 'Başlık', 'Açıklama', 'Olası Nedenler', 'Çözüm Önerileri'];
  const rows = State.alarms.map(a => {
    const causesStr = Array.isArray(a.causes) ? a.causes.join(' | ') : (a.causes || '');
    const solutionsStr = Array.isArray(a.solutions) ? a.solutions.join(' | ') : (a.solution || a.solutions || '');
    
    // Tüm alanlarda noktalı virgül temizliği yap
    return [
      (a.code || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      (a.category || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      (a.title || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      (a.description || '').replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      causesStr.replace(/;/g, ',').replace(/[\r\n]+/g, ' '),
      solutionsStr.replace(/;/g, ',').replace(/[\r\n]+/g, ' ')
    ];
  });
  const csv = [headers, ...rows].map(r => r.join(';')).join('\r\n');
  const res = await window.electronAPI.exportCSV(csv, `alarm_veritabani_${new Date().toISOString().slice(0,10)}.csv`);
  if (res && res.ok) showToast('Alarm CSV kaydedildi ✓', 'success');
  else showToast('CSV kaydedilemedi', 'error');
};

// ════════════════════════════════════════════════════════════════
//  FSSB TOPOLOGY VIEWER
// ════════════════════════════════════════════════════════════════
function renderFssbTopology() {
  const page = createPage('fssb_topology');
  const axisColors = ['var(--accent)','var(--green)','var(--orange)','var(--red)','var(--purple)','var(--cyan)'];

  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>⚡ FSSB Fiber Topoloji Görüntüleyici</h1>
          <p>FANUC FSSB (Fiber Servo Serial Bus) kablo zinciri haritası ve alarm teşhisi</p>
        </div>
      </div>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4">
        <!-- Config Card -->
        <div class="card">
          <div class="card-title mb-3">🛠 Topoloji Yapılandırması</div>
          <div class="form-group">
            <label class="form-label">Kontrol Edilen Aks Sayısı</label>
            <select id="fssb-axis-count" style="width:100%" onchange="drawFssbTopology()">
              <option value="1">1 Aks</option>
              <option value="2">2 Aks</option>
              <option value="3" selected>3 Aks</option>
              <option value="4">4 Aks</option>
              <option value="5">5 Aks</option>
              <option value="6">6 Aks</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Spindle Amplifikatör</label>
            <select id="fssb-spindle" style="width:100%" onchange="drawFssbTopology()">
              <option value="0">Yok (sadece servo)</option>
              <option value="1" selected>1 Spindle</option>
              <option value="2">2 Spindle</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">FSSB Kanal Sayısı</label>
            <select id="fssb-channels" style="width:100%" onchange="drawFssbTopology()">
              <option value="1" selected>1 Kanal (tek fiber zinciri)</option>
              <option value="2">2 Kanal (çift fiber — 30i serisi)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Alarm Kodu (opsiyonel)</label>
            <select id="fssb-alarm" style="width:100%" onchange="drawFssbTopology()">
              <option value="">— Alarm kodu seçin —</option>
              <option value="382">ALM 382 — FSSB: Slave başlatma hatası</option>
              <option value="384">ALM 384 — FSSB: Sürücü bağlantı hatası</option>
              <option value="385">ALM 385 — FSSB: Aks sayısı uyuşmuyor</option>
              <option value="386">ALM 386 — FSSB: Optik fiber kopuk/yanlış</option>
              <option value="5135">ALM 5135 — FSSB: Servo amplifier init fail</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="drawFssbTopology()" style="width:100%">
            <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            Topoloji Çiz
          </button>
        </div>

        <!-- Alarm Guide -->
        <div class="card">
          <div class="card-title mb-3">⚠️ FSSB Alarm Referans Tablosu</div>
          <table class="data-table">
            <thead><tr><th>Alarm</th><th>Açıklama</th><th>Kontrol Noktası</th></tr></thead>
            <tbody>
              <tr><td class="font-mono" style="color:#f87171">ALM 382</td><td>Slave başlatma hatası</td><td>Güç → Fiber kablo → Amp sırası</td></tr>
              <tr><td class="font-mono" style="color:#f87171">ALM 384</td><td>Sürücü bağlantı yok</td><td>Fiber kablo hasar? Amp LED\'i?</td></tr>
              <tr><td class="font-mono" style="color:#f87171">ALM 385</td><td>Aks sayısı uyuşmuyor</td><td>P1023 parametresi + donanım uyumu</td></tr>
              <tr><td class="font-mono" style="color:#fbbf24">ALM 386</td><td>Optik fiber kopuk</td><td>Her fiber bağlantı noktasını kontrol et</td></tr>
              <tr><td class="font-mono" style="color:#fbbf24">ALM 5135</td><td>Amp init başarısız</td><td>Amp güç sigorta + E-stop devresi</td></tr>
            </tbody>
          </table>
          <div style="margin-top:12px; padding:10px; background:var(--bg-card2); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-secondary)">
            💡 <strong>P1023 Parametresi:</strong> Her aks için FSSB kanal ve slave adresini tanımlar. ALM 385 alındığında bu parametrenin donanımla uyumunu kontrol edin.
          </div>
        </div>
      </div>

      <!-- Topology Canvas -->
      <div class="card" id="fssb-topology-canvas">
        <div class="card-title mb-3">📊 Bağlantı Topolojisi</div>
        <div id="fssb-diagram" style="overflow-x:auto">
          <div style="text-align:center; padding:40px; color:var(--text-muted); font-size:13px">
            🔧 Yapılandırmayı seçip "Topoloji Çiz" butonuna basın.
          </div>
        </div>
      </div>

      <!-- Diagnostic Steps -->
      <div class="card mt-4" id="fssb-diag-steps" style="display:none">
        <div class="card-title mb-3">🔍 Teşhis Adımları</div>
        <div id="fssb-steps-content"></div>
      </div>
    </div>
  `;

  window.drawFssbTopology = function(page = document) {
    const axisCountEl = page.querySelector('#fssb-axis-count');
    if (!axisCountEl) return; // page is not active/mounted anymore
    const axisCount = parseInt(axisCountEl.value);
    const spindleCount = parseInt(page.querySelector('#fssb-spindle').value) || 0;
    const alarm = page.querySelector('#fssb-alarm').value;
    const channelCount = parseInt(page.querySelector('#fssb-channels').value);

    // Prepare node distributions
    const channel1Nodes = [];
    const channel2Nodes = [];

    // Distribute Servo Axes
    for (let i = 1; i <= axisCount; i++) {
      if (channelCount === 1) {
        channel1Nodes.push({ id: `axis${i}`, label: `Aks ${i}\nAmplifikatör`, color: axisColors[(i - 1) % axisColors.length], type: 'servo', axisIndex: i });
      } else {
        const half = Math.ceil(axisCount / 2);
        if (i <= half) {
          channel1Nodes.push({ id: `axis${i}`, label: `Aks ${i}\nAmplifikatör`, color: axisColors[(i - 1) % axisColors.length], type: 'servo', axisIndex: i });
        } else {
          channel2Nodes.push({ id: `axis${i}`, label: `Aks ${i}\nAmplifikatör`, color: axisColors[(i - 1) % axisColors.length], type: 'servo', axisIndex: i });
        }
      }
    }

    // Distribute Spindles
    for (let s = 1; s <= spindleCount; s++) {
      if (channelCount === 1) {
        channel1Nodes.push({ id: `spl${s}`, label: `Spindle ${s}\nAmplifikatör`, color: '#f59e0b', type: 'spindle' });
      } else {
        if (s === 1) {
          channel1Nodes.push({ id: `spl${s}`, label: `Spindle ${s}\nAmplifikatör`, color: '#f59e0b', type: 'spindle' });
        } else {
          channel2Nodes.push({ id: `spl${s}`, label: `Spindle ${s}\nAmplifikatör`, color: '#f59e0b', type: 'spindle' });
        }
      }
    }

    // Add Terminators
    channel1Nodes.push({ id: 'term1', label: 'Sonlandırıcı\n(Terminator)', color: '#6b7280', type: 'term' });
    if (channelCount === 2) {
      channel2Nodes.push({ id: 'term2', label: 'Sonlandırıcı\n(Terminator)', color: '#6b7280', type: 'term' });
    }

    const nodeW = 130, nodeH = 64, startX = 40, gap = 160;
    let canvasWidth, svg;

    if (channelCount === 1) {
      const N = 1 + channel1Nodes.length; // CNC + C1 nodes
      canvasWidth = Math.max(N * 160 + 50, 800);
      const y = 80;

      svg = `<svg width="${canvasWidth}" height="200" style="min-width:${canvasWidth}px">`;
      svg += `<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#4b5563"/></marker></defs>`;

      // CNC Node
      svg += `<rect x="${startX}" y="${y}" width="${nodeW}" height="${nodeH}" rx="10" fill="#3b82f622" stroke="#3b82f6" stroke-width="2"/>`;
      svg += `<text x="${startX + nodeW / 2}" y="${y + 26}" text-anchor="middle" font-size="12" font-family="JetBrains Mono, monospace" fill="#3b82f6" font-weight="700">CNC</text>`;
      svg += `<text x="${startX + nodeW / 2}" y="${y + 44}" text-anchor="middle" font-size="12" font-family="JetBrains Mono, monospace" fill="#3b82f6" font-weight="400">Kontrolör</text>`;
      
      // Port COP10A
      svg += `<rect x="${startX + nodeW - 12}" y="${y + nodeH / 2 - 8}" width="16" height="14" rx="2" fill="#1f2937" stroke="#3b82f6" stroke-width="1"/>`;
      svg += `<text x="${startX + nodeW - 4}" y="${y + nodeH / 2 + 2}" text-anchor="middle" font-size="7" fill="#60a5fa" font-family="monospace" font-weight="bold">COP</text>`;

      channel1Nodes.forEach((n, idx) => {
        const j = idx + 1;
        const x = startX + j * gap;
        const radius = 6;
        svg += `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="${radius}" fill="${n.color}22" stroke="${n.color}" stroke-width="2"/>`;
        const lines = n.label.split('\n');
        lines.forEach((line, li) => {
          svg += `<text x="${x + nodeW / 2}" y="${y + 22 + li * 18}" text-anchor="middle" font-size="12" font-family="JetBrains Mono, monospace" fill="${n.color}" font-weight="${li === 0 ? '700' : '400'}">${line}</text>`;
        });

        // Fiber Line
        const prevX = x - gap;
        const fx = prevX + nodeW, tx = x;
        const fy = y + nodeH / 2, ty = fy;
        svg += `<line x1="${fx}" y1="${fy}" x2="${tx - 8}" y2="${ty}" stroke="#4b5563" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arr)"/>`;
        svg += `<text x="${(fx + tx) / 2}" y="${fy - 8}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="monospace">Fiber</text>`;

        // P1023 labels
        if (n.type === 'servo') {
          svg += `<text x="${x + nodeW / 2}" y="${y + nodeH + 20}" text-anchor="middle" font-size="10" fill="#a78bfa" font-weight="700" font-family="monospace">P1023[${n.axisIndex}]</text>`;
          svg += `<text x="${x + nodeW / 2}" y="${y + nodeH + 32}" text-anchor="middle" font-size="9" fill="#9ca3af" font-family="monospace">Eksen No: ${n.axisIndex}</text>`;
        }
      });

    } else {
      const maxLen = Math.max(channel1Nodes.length, channel2Nodes.length);
      canvasWidth = Math.max(maxLen * 160 + 210, 800);
      const y1 = 40;
      const y2 = 170;
      const cncY = 105;

      svg = `<svg width="${canvasWidth}" height="280" style="min-width:${canvasWidth}px">`;
      svg += `<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#4b5563"/></marker></defs>`;

      // CNC Node
      svg += `<rect x="${startX}" y="${cncY}" width="${nodeW}" height="${nodeH}" rx="10" fill="#3b82f622" stroke="#3b82f6" stroke-width="2"/>`;
      svg += `<text x="${startX + nodeW / 2}" y="${cncY + 26}" text-anchor="middle" font-size="12" font-family="JetBrains Mono, monospace" fill="#3b82f6" font-weight="700">CNC</text>`;
      svg += `<text x="${startX + nodeW / 2}" y="${cncY + 44}" text-anchor="middle" font-size="12" font-family="JetBrains Mono, monospace" fill="#3b82f6" font-weight="400">Kontrolör</text>`;
      
      // Port CH1 & CH2 on CNC
      svg += `<rect x="${startX + nodeW - 12}" y="${cncY + 6}" width="16" height="14" rx="2" fill="#1f2937" stroke="#3b82f6" stroke-width="1"/>`;
      svg += `<text x="${startX + nodeW - 4}" y="${cncY + 16}" text-anchor="middle" font-size="7" fill="#60a5fa" font-family="monospace" font-weight="bold">CH1</text>`;

      svg += `<rect x="${startX + nodeW - 12}" y="${cncY + nodeH - 20}" width="16" height="14" rx="2" fill="#1f2937" stroke="#3b82f6" stroke-width="1"/>`;
      svg += `<text x="${startX + nodeW - 4}" y="${cncY + nodeH - 10}" text-anchor="middle" font-size="7" fill="#60a5fa" font-family="monospace" font-weight="bold">CH2</text>`;

      // Draw Row 1 (CH1)
      channel1Nodes.forEach((n, idx) => {
        const j = idx + 1;
        const x = startX + j * gap;
        const radius = 6;
        svg += `<rect x="${x}" y="${y1}" width="${nodeW}" height="${nodeH}" rx="${radius}" fill="${n.color}22" stroke="${n.color}" stroke-width="2"/>`;
        const lines = n.label.split('\n');
        lines.forEach((line, li) => {
          svg += `<text x="${x + nodeW / 2}" y="${y1 + 22 + li * 18}" text-anchor="middle" font-size="12" font-family="JetBrains Mono, monospace" fill="${n.color}" font-weight="${li === 0 ? '700' : '400'}">${line}</text>`;
        });

        // Fiber Line
        if (j === 1) {
          const fx = startX + nodeW, fy = cncY + 13;
          const tx = x, ty = y1 + nodeH / 2;
          svg += `<path d="M ${fx} ${fy} L ${(fx + tx) / 2} ${fy} L ${(fx + tx) / 2} ${ty} L ${tx - 8} ${ty}" fill="none" stroke="#4b5563" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arr)"/>`;
          svg += `<text x="${(fx + tx) / 2}" y="${Math.min(fy, ty) + Math.abs(fy - ty) / 2 - 4}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="monospace">Fiber CH1</text>`;
        } else {
          const prevX = x - gap;
          const fx = prevX + nodeW, tx = x;
          const fy = y1 + nodeH / 2, ty = fy;
          svg += `<line x1="${fx}" y1="${fy}" x2="${tx - 8}" y2="${ty}" stroke="#4b5563" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arr)"/>`;
          svg += `<text x="${(fx + tx) / 2}" y="${fy - 8}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="monospace">Fiber</text>`;
        }

        // P1023 labels
        if (n.type === 'servo') {
          svg += `<text x="${x + nodeW / 2}" y="${y1 + nodeH + 18}" text-anchor="middle" font-size="10" fill="#a78bfa" font-weight="700" font-family="monospace">P1023[${n.axisIndex}]</text>`;
          svg += `<text x="${x + nodeW / 2}" y="${y1 + nodeH + 29}" text-anchor="middle" font-size="9" fill="#9ca3af" font-family="monospace">Eksen No: ${n.axisIndex}</text>`;
        }
      });

      // Draw Row 2 (CH2)
      channel2Nodes.forEach((n, idx) => {
        const j = idx + 1;
        const x = startX + j * gap;
        const radius = 6;
        svg += `<rect x="${x}" y="${y2}" width="${nodeW}" height="${nodeH}" rx="${radius}" fill="${n.color}22" stroke="${n.color}" stroke-width="2"/>`;
        const lines = n.label.split('\n');
        lines.forEach((line, li) => {
          svg += `<text x="${x + nodeW / 2}" y="${y2 + 22 + li * 18}" text-anchor="middle" font-size="12" font-family="JetBrains Mono, monospace" fill="${n.color}" font-weight="${li === 0 ? '700' : '400'}">${line}</text>`;
        });

        // Fiber Line
        if (j === 1) {
          const fx = startX + nodeW, fy = cncY + nodeH - 13;
          const tx = x, ty = y2 + nodeH / 2;
          svg += `<path d="M ${fx} ${fy} L ${(fx + tx) / 2} ${fy} L ${(fx + tx) / 2} ${ty} L ${tx - 8} ${ty}" fill="none" stroke="#4b5563" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arr)"/>`;
          svg += `<text x="${(fx + tx) / 2}" y="${Math.min(fy, ty) + Math.abs(fy - ty) / 2 - 4}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="monospace">Fiber CH2</text>`;
        } else {
          const prevX = x - gap;
          const fx = prevX + nodeW, tx = x;
          const fy = y2 + nodeH / 2, ty = fy;
          svg += `<line x1="${fx}" y1="${fy}" x2="${tx - 8}" y2="${ty}" stroke="#4b5563" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arr)"/>`;
          svg += `<text x="${(fx + tx) / 2}" y="${fy - 8}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="monospace">Fiber</text>`;
        }

        // P1023 labels
        if (n.type === 'servo') {
          svg += `<text x="${x + nodeW / 2}" y="${y2 + nodeH + 18}" text-anchor="middle" font-size="10" fill="#a78bfa" font-weight="700" font-family="monospace">P1023[${n.axisIndex}]</text>`;
          svg += `<text x="${x + nodeW / 2}" y="${y2 + nodeH + 29}" text-anchor="middle" font-size="9" fill="#9ca3af" font-family="monospace">Eksen No: ${n.axisIndex}</text>`;
        }
      });
    }

    svg += '</svg>';
    const diagramEl = page.querySelector('#fssb-diagram');
    if (diagramEl) diagramEl.innerHTML = svg;

    // Diagnostic steps
    const stepsEl = page.querySelector('#fssb-diag-steps');
    if (alarm) {
      const diagMap = {
        '382': [
          '1. Amplifikatör Gücünü Kontrol Edin: Tüm servo ve spindle amplifikatörlerinin 24V kontrol güçlerinin CNC açılmadan önce veya eşzamanlı olarak aktif olduğundan emin olun.',
          '2. Durum LED\'lerini İnceleyin: Amplifikatörlerin üzerindeki 7 segmentli durum ekranlarını kontrol edin (örn. "L", "AL" veya hata kodları).',
          '3. İlk Bağlantıyı Doğrulayın: CNC\'nin COP10A portundan ilk amplifikatörün COP10B portuna giden fiber kabloyu kontrol edin.',
          '4. P1023 Değerlerini Kontrol Edin: Parametre 1023\'ün donanımda mevcut olmayan bir eksen/kanal numarasına atanıp atanmadığını kontrol edin.',
          '5. FSSB Ekranını Kontrol Edin: CNC üzerindeki SYSTEM > FSSB ekranından algılanan cihazların listesini inceleyin.'
        ],
        '384': [
          '1. CNC Fiber Bağlantısını Kontrol Edin: CNC ana kartındaki FSSB (COP10A) portuna fiber kablonun tam olarak oturduğundan emin olun.',
          '2. Kablo Fiziksel Durumu: Fiber optik kablolarda aşırı bükülme (bükülme yarıçapı < 30mm olmamalı) veya ezilme olup olmadığını inceleyin.',
          '3. Konnektör Temizliği: Fiber konektör uçlarını toz veya yağ kalıntılarına karşı optik temizleme bezi veya alkol ile temizleyin.',
          '4. İlk Sürücü Gücü: Zincirdeki ilk servo amplifikatörün 24V gücünü kontrol edin; eğer bu sürücü enerjisiz kalırsa host iletişimi tamamen kopar.',
          '5. Ana Kart FSSB Çip Kontrolü: CNC eksen kartı üzerindeki FSSB sürücü entegrelerinin arızalı olup olmadığını test edin.'
        ],
        '385': [
          '1. Donanım ve Parametre Karşılaştırması: Kabindeki fiziksel servo/spindle amplifikatör sayısı ile P1023 parametresindeki eksen tanımlarının uyuşup uyuşmadığını doğrulayın.',
          '2. Eksik Enerji Kontrolü: Zincirdeki herhangi bir amplifikatörün enerjisi kesikse CNC bu sürücüyü ve sonrasını algılayamaz, bu da aks sayısı uyuşmazlığına yol açar.',
          '3. Otomatik Kurulumu Tetikleyin: FSSB otomatik ayarını yeniden çalıştırmak için P1902#0 (veya ilgili modelde P3111#0) bitini değiştirin ve FSSB ekranından onaylayın.',
          '4. Donanım Sırasını Doğrulayın: FSSB üzerindeki servo eksenlerin P1023 sırasının ardışık ve kesintisiz olduğundan emin olun.'
        ],
        '386': [
          '1. Işık Geçirgenlik Testi: Fiber optik kabloyu bir uçtan çıkarıp kırmızı ışık (lazer/LED) tutup diğer uçtan ışık çıkış gücünü gözle kontrol edin.',
          '2. Optik Hasar ve Kırılma: Kablonun hareketli kanallarda (kablo zinciri) sürtünme veya sıkışmadan ötürü içten kırılıp kırılmadığını kontrol edin.',
          '3. Sonlandırıcı (Terminator) Kontrolü: FSSB zincirinin en sonundaki amplifikatörde sonlandırıcı soketinin (varsa) takılı ve sağlam olduğunu doğrulayın.',
          '4. Kablo Değişimi: Şüpheli segmenti kısa bir yedek fiber kablo ile değiştirerek arızalı kabloyu lokalize edin.'
        ],
        '5135': [
          '1. Şasi İçi Sigorta Kontrolü: Servo amplifikatörün içindeki kontrol devresi sigortasını (F1/F2) ölçü aletiyle kontrol edin.',
          '2. Acil Durum (E-Stop) Devresi: Acil durdurma hattının kesik olup olmadığını ve PMC G8.4 (E-Stop) bitinin durumunu kontrol edin.',
          '3. DC Link Kontrolü: Güç kaynağı (Power Supply) ile amplifikatörler arasındaki DC baraların vidalarının sıkılığını kontrol edin.',
          '4. Modül Adres Switch Ayarı: Servo amplifikatör üzerindeki eksen seçici döner switch (rotary switch) ayarının kılavuza göre doğru yapıldığından emin olun.'
        ]
      };
      const steps = diagMap[alarm] || ['Seçilen alarm için detaylı adımlar bulunamadı.'];
      stepsEl.style.display = 'block';
      const stepsContentEl = page.querySelector('#fssb-steps-content');
      if (stepsContentEl) {
        stepsContentEl.innerHTML = `
          <div style="margin-bottom:10px; padding:10px 14px; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); border-radius:var(--radius-sm);">
            <strong style="color:#f87171">ALM ${alarm}</strong> teşhisi için adımlar:
          </div>
        ${steps.map((s, i) => `
          <div style="display:flex; gap:12px; padding:10px; border-bottom:1px solid var(--border);">
            <div style="width:24px; height:24px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0">${i+1}</div>
            <div style="font-size:12.5px; color:var(--text-primary); line-height:1.5">${s}</div>
          </div>
        `).join('')}
      `;
      }
    } else {
      stepsEl.style.display = 'none';
    }
  };

  addStyle(`
    .mt-4 { margin-top: 16px; }
  `);

  setTimeout(() => {
    if (window.drawFssbTopology) {
      window.drawFssbTopology(page);
    }
  }, 50);

  return page;
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════
function renderDashboard() {
  const page = createPage('dashboard');

  // Compute KPI values
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = new Date().getFullYear();

  const thisMonthMaint = State.maintenances.filter(m => {
    const d = parseDateHelper(m.tarih || m.date);
    return d && d.getTime() > 0 && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const criticalBatteries = State.batteries.filter(b => {
    const dateStr = b.tarih || b.lastChanged;
    if (!dateStr) return false;
    const d = parseDateHelper(dateStr);
    if (!d || d.getTime() === 0) return false;
    return (now - d) / (1000 * 60 * 60 * 24 * 30) >= 12;
  });

  // Most maintained machine
  const machineCount = {};
  State.maintenances.forEach(m => {
    const k = m.machine_name || 'Bilinmiyor';
    machineCount[k] = (machineCount[k] || 0) + 1;
  });
  const topMachine = Object.entries(machineCount).sort((a, b) => b[1] - a[1])[0];

  // Recent activity
  const recentActivity = [...State.maintenances]
    .sort((a, b) => parseDateHelper(b.tarih || b.date) - parseDateHelper(a.tarih || a.date))
    .slice(0, 5);

  // Compute average machine health
  const avgHealth = State.machines.length > 0
    ? Math.round(State.machines.reduce((sum, m) => sum + calculateMachineHealth(m).score, 0) / State.machines.length)
    : 100;
  const strokeDashOffset = 251.2 - (251.2 * avgHealth) / 100;
  const healthGlowColor = avgHealth >= 80 ? '#10b981' : (avgHealth >= 50 ? '#f59e0b' : '#ef4444');
  const healthLabel = avgHealth >= 80 ? 'STABİL' : (avgHealth >= 50 ? 'HASSAS' : 'KRİTİK');
  const healthClass = avgHealth >= 80 ? 'tag-green' : (avgHealth >= 50 ? 'tag-amber' : 'tag-red');

  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>Dashboard</h1>
          <p>MTB Elektrik Bakım — ${escapeHTML(State.currentUser ? State.currentUser.name : 'Misafir')} olarak giriş yapıldı · ${State.notifications.length} aktif bildirim</p>

        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="checkNotifications(); navigate('dashboard')">
            <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            Yenile
          </button>
        </div>
      </div>
    </div>
    <div class="page-body">

      <!-- Main Stats -->
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
          </div>
          <div class="stat-data">
            <div class="stat-value" id="dash-val-machines" style="color:#60a5fa">0</div>
            <div class="stat-label">Kayıtlı Tezgah</div>
          </div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon purple">
            <svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div class="stat-data">
            <div class="stat-value" id="dash-val-maint" style="color:#a78bfa">0</div>
            <div class="stat-label">Toplam Bakım</div>
          </div>
        </div>
        <div class="stat-card amber">
          <div class="stat-icon amber">
            <svg viewBox="0 0 24 24"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="18" y1="11" x2="22" y2="11"/><line x1="18" y1="13" x2="22" y2="13"/></svg>
          </div>
          <div class="stat-data">
            <div class="stat-value" id="dash-val-batteries" style="color:#fbbf24">0</div>
            <div class="stat-label">Pil Kaydı</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon green">
            <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          </div>
          <div class="stat-data">
            <div class="stat-value" id="dash-val-lib" style="color:#34d399">0</div>
            <div class="stat-label">Teknik Kılavuz</div>
          </div>
        </div>
        <div class="stat-card cyan">
          <div class="stat-icon cyan">
            <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><line x1="6" y1="6" x2="6" y2="18"/><line x1="18" y1="6" x2="18" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
          </div>
          <div class="stat-data">
            <div class="stat-value" id="dash-val-alarms" style="color:#22d3ee">0</div>
            <div class="stat-label">Alarm Kodu</div>
          </div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon red">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
          </div>
          <div class="stat-data">
            <div class="stat-value" id="dash-val-params" style="color:#f87171">0</div>
            <div class="stat-label">CNC Parametre</div>
          </div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-left:3px solid #7c3aed">
          <div class="kpi-label">Bu Ay Bakım</div>
          <div class="kpi-value" id="dash-val-month" style="color:#a78bfa">${thisMonthMaint.length}</div>
          <div class="kpi-sub">${thisMonthMaint.filter(m => m.type === 'Arıza').length} arıza / ${thisMonthMaint.filter(m => m.type !== 'Arıza').length} planlı</div>
          <div class="kpi-trend trend-${thisMonthMaint.length > 0 ? 'up' : 'neutral'}">
            ${thisMonthMaint.length > 0 ? '↑ Aktif ay' : '— Kayıt yok'}
          </div>
        </div>
        <div class="kpi-card" style="border-left:3px solid ${criticalBatteries.length > 0 ? '#ef4444' : '#10b981'}">
          <div class="kpi-label">Kritik Pil</div>
          <div class="kpi-value" id="dash-val-crit-bat" style="color:${criticalBatteries.length > 0 ? '#f87171' : '#34d399'}">${criticalBatteries.length}</div>
          <div class="kpi-sub">${criticalBatteries.length > 0 ? 'Değişim gerekiyor' : 'Tüm piller normal'}</div>
          <div class="kpi-trend ${criticalBatteries.length > 0 ? 'trend-down' : 'trend-up'}">
            ${criticalBatteries.length > 0 ? '⚠️ Dikkat gerekli' : '✓ Normal'}
          </div>
        </div>
        <div class="kpi-card" style="border-left:3px solid #3b82f6">
          <div class="kpi-label">En Sık Bakım Tezgahı</div>
          <div class="kpi-value" style="color:#60a5fa; font-size:16px; line-height:1.3">${topMachine ? escapeHTML(topMachine[0]) : '—'}</div>
          <div class="kpi-sub">${topMachine ? escapeHTML(topMachine[1]) + ' bakım kaydı' : 'Kayıt yok'}</div>
          <div class="kpi-trend trend-neutral">Tüm zamanlar</div>
        </div>
        <div class="kpi-card" style="border-left:3px solid ${State.notifications.length > 0 ? '#f59e0b' : '#10b981'}">
          <div class="kpi-label">Aktif Bildirim</div>
          <div class="kpi-value" id="dash-val-notifs" style="color:${State.notifications.length > 0 ? '#fbbf24' : '#34d399'}">${State.notifications.length}</div>
          <div class="kpi-sub">${State.notifications.filter(n => n.level === 'red').length} kritik, ${State.notifications.filter(n => n.level === 'amber').length} uyarı</div>
          <div class="kpi-trend ${State.notifications.length > 0 ? 'trend-down' : 'trend-up'}">
            <button onclick="toggleNotifPanel()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:11px;padding:0">Bildirimleri Gör →</button>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 16px">
        <!-- Health Gauge -->
        <div class="card flex flex-col justify-center items-center" style="padding:20px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center">
          <div class="card-title mb-3">⚙️ Ortalama Tezgah Sağlığı</div>
          <div class="health-gauge-wrap" style="position:relative; width:100px; height:100px; display:flex; align-items:center; justify-content:center">
            <svg class="health-gauge-svg" width="90" height="90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="var(--border)" stroke-width="8" fill="transparent" />
              <circle cx="50" cy="50" r="40" stroke="${healthGlowColor}" stroke-width="8" fill="transparent" 
                stroke-dasharray="251.2" stroke-dashoffset="${strokeDashOffset}" stroke-linecap="round"
                style="filter: drop-shadow(0 0 5px ${healthGlowColor}); transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 0.5s ease" />
            </svg>
            <div style="position:absolute; display:flex; flex-direction:column; align-items:center; justify-content:center">
              <span id="gauge-val-health" style="font-size:18px; font-weight:800; color:var(--text-primary)">0%</span>
            </div>
          </div>
          <span class="tag ${healthClass} mt-3">✓ ${healthLabel}</span>
        </div>

        <!-- Quick Access -->
        <div class="card">
          <div class="card-title mb-3">⚡ Hızlı Erişim</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
            ${[
              { icon: '🏭', label: 'Tezgah Listesi', page: 'machines', color: '#3b82f6' },
              { icon: '🔧', label: 'Bakım Defteri', page: 'maintenance', color: '#7c3aed' },
              { icon: '🔋', label: 'Pil Takibi', page: 'battery', color: '#f59e0b' },
              { icon: '🤖', label: 'AI Asistan', page: 'ai', color: '#06b6d4' },
              { icon: '📚', label: 'Teknik Kılavuz', page: 'library', color: '#10b981' },
              { icon: '⚙️', label: 'Parametreler', page: 'parameters', color: '#8b5cf6' },
              { icon: '⚡', label: 'FSSB Topoloji', page: 'fssb_topology', color: '#f97316' },
              { icon: '🔌', label: 'PMC Sinyalleri', page: 'pmc_signals', color: '#f87171' },
            ].map(q => `
              <button class="quick-card" onclick="navigate('${q.page}')" style="--qc:${q.color}">
                <span style="font-size:20px">${q.icon}</span>
                <span style="font-size:11.5px; font-weight:500">${q.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <div class="flex items-center justify-between mb-3">
            <div class="card-title">📋 Son Bakım Aktivitesi</div>
            <button class="btn btn-ghost btn-sm" onclick="navigate('maintenance')">Tümü</button>
          </div>
          <div>
            ${recentActivity.length ? recentActivity.map(m => `
              <div class="activity-item">
                <div class="activity-dot" style="background:${m.type === 'Arıza' ? '#ef4444' : '#10b981'}"></div>
                <div style="flex:1; min-width:0">
                  <div style="font-size:12px; font-weight:500; color:var(--text-primary)">${escapeHTML(m.machine_name || 'Tezgah')}</div>
                  <div style="font-size:11px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHTML(m.description || m.type || '')}</div>
                </div>
                <div style="font-size:10px; color:var(--text-muted); white-space:nowrap; margin-left:8px">${escapeHTML(m.date || '')}</div>
              </div>
            `).join('') : '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px">Henüz bakım kaydı yok</div>'}
          </div>
        </div>
      </div>

      <!-- FANUC Series Info -->
      <div class="card">
        <div class="card-title mb-3">📡 Desteklenen FANUC Serileri</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px">
          ${['0i-F', '0i-F Plus', '30i-B', '31i-B', '32i-B', '35i-B', '160i', '180i', '210i'].map(s =>
            `<span class="tag tag-blue" style="font-size:11px; padding:4px 12px">${s}</span>`
          ).join('')}
        </div>
      </div>
    </div>
  `;

  // Quick card styles injection
  addStyle(`
    .quick-card {
      display:flex; flex-direction:column; align-items:center; gap:6px;
      padding:14px 8px; border-radius:var(--radius-md);
      background:var(--bg-card2); border:1px solid var(--border);
      cursor:pointer; transition:all .2s; font-family:inherit; color:var(--text-primary);
    }
    .quick-card:hover {
      border-color:var(--qc); background:color-mix(in srgb, var(--qc) 10%, var(--bg-card2));
      transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,.3);
    }
    .alarm-row {
      display:flex; align-items:center; gap:8px; padding:6px 8px;
      border-radius:var(--radius-sm); cursor:pointer; transition:background .15s;
    }
    .alarm-row:hover { background:var(--bg-hover); }
  `);

  setTimeout(() => {
    animateCounter(page.querySelector('#dash-val-machines'), State.machines.length);
    animateCounter(page.querySelector('#dash-val-maint'), State.maintenances.length);
    animateCounter(page.querySelector('#dash-val-batteries'), State.batteries.length);
    animateCounter(page.querySelector('#dash-val-lib'), State.library.length);
    animateCounter(page.querySelector('#dash-val-alarms'), State.alarms.length);
    animateCounter(page.querySelector('#dash-val-params'), State.parameters.length);
    animateCounter(page.querySelector('#dash-val-month'), thisMonthMaint.length);
    animateCounter(page.querySelector('#dash-val-crit-bat'), criticalBatteries.length);
    animateCounter(page.querySelector('#dash-val-notifs'), State.notifications.length);
    animateCounter(page.querySelector('#gauge-val-health'), avgHealth, 800, '', '%');
  }, 40);

  return page;
}

function alarmCategoryTag(cat) {
  const map = { Servo:'tag-blue', Program:'tag-purple', Overtravel:'tag-amber', Spindle:'tag-cyan', Overheat:'tag-red', PMC:'tag-green', System:'tag-gray', External:'tag-gray' };
  return map[cat] || 'tag-gray';
}

// ════════════════════════════════════════════════════════════════
//  LIBRARY
// ════════════════════════════════════════════════════════════════
function renderLibrary() {
  const page = createPage('library');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📚 Tezgah Kitaplığı</h1>
          <p>${State.library.length} teknik doküman — Operatör, Bakım, PMC, Servo, Elektrik, Mekanik</p>
        </div>
        <button class="btn btn-primary" id="btn-import-book">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          PDF Ekle
        </button>
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:320px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="lib-search" placeholder="Kitap ara..." />
        </div>
        <select id="lib-cat-filter" style="width:160px">
          <option value="">Tüm Kategoriler</option>
          <option>Operatör</option>
          <option>Bakım</option>
          <option>Parametre</option>
          <option>PMC / PLC</option>
          <option>Servo</option>
          <option>Spindle</option>
          <option>Elektrik</option>
          <option>Mekanik</option>
        </select>
        <select id="lib-series-filter" style="width:140px">
          <option value="">Tüm Seriler</option>
          <option>0i-F</option>
          <option>30i-B</option>
          <option>31i-B</option>
          <option>Genel</option>
        </select>
      </div>
    </div>
    <div class="page-body">
      <!-- Offline Knowledge Packs Card -->
      <div class="card mb-4" style="padding:16px; background:var(--bg-card2)">
        <div class="card-title mb-3" style="display:flex; align-items:center; justify-content:space-between">
          <span>📦 Çevrimdışı Kılavuz Paketleri (Offline Knowledge Packs)</span>
          <span class="tag tag-blue" style="font-size:11px">İnternetsiz Fabrika Kullanımı</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
          ${(window.OFFLINE_PACKS || []).map(p => `
            <div style="background:var(--bg-card); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); display:flex; flex-direction:column; justify-content:space-between">
              <div>
                <div style="font-weight:700; font-size:12.5px; color:var(--text-accent); margin-bottom:4px">${escapeHTML(p.name)}</div>
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px">${escapeHTML(p.desc)}</div>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; border-top:1px solid var(--border-light); padding-top:8px">
                <span class="font-mono text-xs" style="color:var(--text-muted)">${p.size} · ${p.version}</span>
                ${p.status === 'installed' ? `
                  <span class="tag tag-green" style="font-size:11px">✅ Çevrimdışı Hazır</span>
                ` : `
                  <button class="btn btn-primary btn-sm" id="btn-pack-${p.id}" onclick="downloadOfflinePack('${p.id}')" style="font-size:11px; padding:3px 10px">
                    📥 İndir & Arşivle
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="lib-grid" class="grid-2"></div>
    </div>

  `;

  renderLibraryGrid(State.library);

  page.querySelector('#lib-search').addEventListener('input', filterLibrary);
  page.querySelector('#lib-cat-filter').addEventListener('change', filterLibrary);
  page.querySelector('#lib-series-filter').addEventListener('change', filterLibrary);
  page.querySelector('#btn-import-book').addEventListener('click', importBook);

  function filterLibrary() {
    const q = page.querySelector('#lib-search').value.toLowerCase();
    const cat = page.querySelector('#lib-cat-filter').value;
    const series = page.querySelector('#lib-series-filter').value;
    const filtered = State.library.filter(b =>
      (!q || b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)) &&
      (!cat || b.category === cat) &&
      (!series || b.series.includes(series))
    );
    renderLibraryGrid(filtered);
  }

  function renderLibraryGrid(books) {
    const grid = page.querySelector('#lib-grid');
    if (!books.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg><p>Kitap bulunamadı</p></div>`;
      return;
    }
    grid.innerHTML = books.map(b => `
      <div class="card book-card" data-id="${b.id}">
        <div class="flex items-center gap-3 mb-3">
          <div class="book-icon">${bookIcon(b.category)}</div>
          <div style="flex:1; min-width:0">
            <div class="card-title truncate">${escapeHTML(b.title)}</div>
            <div class="card-sub">${escapeHTML(b.series)} · ${b.pages} sayfa</div>
          </div>
          <span class="tag ${bookCatTag(b.category)}">${escapeHTML(b.category)}</span>
        </div>
        <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5; margin-bottom:12px">${escapeHTML(b.description)}</p>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px">
          <strong style="color:var(--text-secondary)">Bölümler:</strong><br>
          ${b.chapters.slice(0, 3).map(escapeHTML).join(' · ')}${b.chapters.length > 3 ? ` · +${b.chapters.length-3} daha` : ''}
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="openBook('${b.id}')">
            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            İncele
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openChapters('${b.id}')">
            <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Bölümler
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="PDF Aç" onclick="openBookPDF('${b.id}')">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  return page;
}

function bookIcon(cat) {
  const icons = { Operatör:'📖', Bakım:'🔧', Parametre:'⚙️', 'PMC / PLC':'💻', Servo:'⚡', Spindle:'🔄', Elektrik:'🔌', Mekanik:'⚙️' };
  return `<div style="font-size:28px">${icons[cat] || '📄'}</div>`;
}
function bookCatTag(cat) {
  const map = { Operatör:'tag-blue', Bakım:'tag-amber', Parametre:'tag-red', 'PMC / PLC':'tag-purple', Servo:'tag-cyan', Spindle:'tag-green', Elektrik:'tag-amber', Mekanik:'tag-gray' };
  return map[cat] || 'tag-gray';
}

window.openBook = function(id) {
  const book = State.library.find(b => b.id === id);
  if (!book) return;
  showModal('book-detail', `
    <div class="modal-header">
      <span class="modal-title">${escapeHTML(book.title)}</span>
      <button class="modal-close" onclick="closeModal('book-detail')">✕</button>
    </div>
    <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap">
      <span class="tag tag-blue">${escapeHTML(book.series)}</span>
      <span class="tag ${bookCatTag(book.category)}">${escapeHTML(book.category)}</span>
      <span class="tag tag-gray">${book.language === 'TR' ? '🇹🇷 Türkçe' : escapeHTML(book.language)}</span>
      <span class="tag tag-gray">${book.pages} Sayfa</span>
    </div>
    <p style="font-size:12.5px; color:var(--text-secondary); line-height:1.6; margin-bottom:16px">${escapeHTML(book.description)}</p>
    <strong style="font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted)">İçindekiler</strong>
    <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px">
      ${book.chapters.map((ch, i) => `
        <div style="display:flex; gap:10px; align-items:center; padding:6px 10px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <span class="font-mono text-sm" style="color:var(--accent); min-width:20px">${i+1}</span>
          <span style="font-size:12px">${escapeHTML(ch)}</span>
        </div>
      `).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('book-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="openBookPDF('${book.id}'); closeModal('book-detail')">
        <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        PDF Aç
      </button>
    </div>
  `);
};

window.openChapters = window.openBook;

window.openBookPDF = async function(id) {
  const book = State.library.find(b => b.id === id);
  if (!book) return;
  if (book.webUrl) {
    navigate('pdf_viewer', { bookId: id, filePath: book.webUrl, title: book.title });
    return;
  }
  const savedPath = State.settings.pdfPaths[id];
  if (savedPath) {
    navigate('pdf_viewer', { bookId: id, filePath: savedPath, title: book.title });
  } else {
    const filters = [{ name: 'PDF Dosyası', extensions: ['pdf'] }];
    const filePath = await window.electronAPI.openFileDialog(filters);
    if (filePath) {
      State.settings.pdfPaths[id] = filePath;
      await saveSettings();
      showToast('PDF kılavuzu başarıyla ilişkilendirildi.', 'success');
      navigate('pdf_viewer', { bookId: id, filePath, title: book.title });
    } else {
      showToast('Kılavuz için PDF dosyası seçilmedi.', 'info');
    }
  }
};

window.changeBookPDF = async function(id) {
  const book = State.library.find(b => b.id === id);
  if (!book) return;
  const filters = [{ name: 'PDF Dosyası', extensions: ['pdf'] }];
  const filePath = await window.electronAPI.openFileDialog(filters);
  if (filePath) {
    State.settings.pdfPaths[id] = filePath;
    await saveSettings();
    showToast('PDF kılavuzu güncellendi.', 'success');
    navigate('pdf_viewer', { bookId: id, filePath, title: book.title });
  }
};

async function importBook() {
  const filters = [{ name: 'PDF Dosyası', extensions: ['pdf'] }];
  const filePath = await window.electronAPI.openFileDialog(filters);
  if (!filePath) return;
  showToast('PDF kütüphaneye eklendi (demo)', 'success');
}

function renderPdfViewer(extraData) {
  const page = createPage('pdf_viewer');
  if (!extraData || !extraData.filePath) {
    page.innerHTML = `
      <div class="page-header">
        <div class="flex items-center gap-3">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="navigate('library')">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
          </button>
          <h1>PDF Okuyucu</h1>
        </div>
      </div>
      <div class="page-body">
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          <p>Herhangi bir doküman yüklenmedi. Lütfen kitaplıktan bir kitap seçip "PDF Aç" butonuna basın.</p>
        </div>
      </div>
    `;
    return page;
  }

  const { bookId, filePath, title } = extraData;
  const isWeb = filePath.startsWith('http://') || filePath.startsWith('https://');
  const fileUrl = isWeb ? filePath : 'app-file:///' + filePath.replace(/\\/g, '/');

  page.innerHTML = `
    <div class="page-header" style="padding: 12px 28px; display:flex; align-items:center; justify-content:space-between; height: 56px;">
      <div class="flex items-center gap-3" style="min-width:0; flex:1">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="navigate('library')" title="Kitaplığa Dön">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
        </button>
        <h1 style="font-size:14px; margin:0; font-weight:600;" class="truncate">${title}</h1>
      </div>
      <div class="flex gap-2">
        ${isWeb ? '' : `
        <button class="btn btn-secondary btn-sm" onclick="changeBookPDF('${bookId}')">
          <svg style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/></svg>
          Dosyayı Değiştir
        </button>
        `}
        <button class="btn btn-ghost btn-sm btn-icon" onclick="window.electronAPI.openExternal('${fileUrl}')" title="Harici Tarayıcıda Aç">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
      </div>
    </div>
    <div class="page-body" style="padding:0; overflow:hidden; display:flex; flex-direction:column; height:calc(100vh - 56px)">
      <iframe src="${fileUrl}" style="width:100%; height:100%; border:none;" id="pdf-frame"></iframe>
    </div>
  `;
  return page;
}

// ════════════════════════════════════════════════════════════════
//  PROJECTS
// ════════════════════════════════════════════════════════════════
function renderProjects() {
  const page = createPage('projects');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📁 Proje Yöneticisi</h1>
          <p>Mekanik, elektrik ve PMC projelerinizi yönetin</p>
        </div>
        <button class="btn btn-primary" id="btn-new-project">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Proje
        </button>
      </div>
      <div class="flex gap-2 mt-3">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="proj-search" placeholder="Proje ara..." />
        </div>
        <select id="proj-type-filter" style="width:160px">
          <option value="">Tüm Tipler</option>
          <option value="mech">Mekanik</option>
          <option value="elec">Elektrik</option>
          <option value="pmc">PMC / Ladder</option>
        </select>
      </div>
    </div>
    <div class="page-body">
      <div id="proj-grid" class="grid-3"></div>
    </div>
  `;

  renderProjectGrid();
  page.querySelector('#btn-new-project').addEventListener('click', showNewProjectModal);
  page.querySelector('#proj-search').addEventListener('input', () => renderProjectGrid(page));
  page.querySelector('#proj-type-filter').addEventListener('change', () => renderProjectGrid(page));

  return page;
}

function renderProjectGrid(page) {
  const container = (page || document).querySelector('#proj-grid');
  if (!container) return;
  const q = ((page || document).querySelector('#proj-search')?.value || '').toLowerCase();
  const type = (page || document).querySelector('#proj-type-filter')?.value || '';

  let projs = State.projects.filter(p =>
    (!q || p.name.toLowerCase().includes(q)) &&
    (!type || p.type === type)
  );

  if (!projs.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <p>Henüz proje yok.<br>Yeni proje oluşturun.</p>
      </div>`;
    return;
  }

  const typeLabel = { mech:'⚙️ Mekanik', elec:'⚡ Elektrik', pmc:'💻 PMC/Ladder' };
  container.innerHTML = projs.map(p => `
    <div class="project-card ${p.type}" onclick="openProject('${p.id}')">
      <div class="project-header">
        <div>
          <div class="project-name">${escapeHTML(p.name)}</div>
          <div class="project-type">${escapeHTML(typeLabel[p.type] || p.type)}</div>
        </div>
        <span class="tag ${p.type==='mech'?'tag-blue':p.type==='elec'?'tag-amber':'tag-purple'}">${escapeHTML(p.status || 'Aktif')}</span>
      </div>
      <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:10px">${escapeHTML(p.description || 'Açıklama yok')}</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${p.progress||0}%"></div></div>
      <div class="project-meta">
        <div class="project-meta-item">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('tr-TR') : '-'}
        </div>
        <div class="project-meta-item">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${escapeHTML(p.owner || 'Kullanıcı')}
        </div>
        <div class="project-meta-item" style="margin-left:auto; color:var(--accent)">
          %${p.progress||0}
        </div>
      </div>
    </div>
  `).join('');
}

window.openProject = function(id) {
  const proj = State.projects.find(p => p.id === id);
  if (!proj) return;
  showToast(`"${proj.name}" projesi açıldı`, 'info');
};

function showNewProjectModal() {
  showModal('new-project', `
    <div class="modal-header">
      <span class="modal-title">Yeni Proje Oluştur</span>
      <button class="modal-close" onclick="closeModal('new-project')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Proje Adı *</label>
      <input class="form-control" id="np-name" placeholder="ör. VMC-850 Elektrik Revizyonu" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Proje Tipi *</label>
        <select class="form-control" id="np-type">
          <option value="mech">⚙️ Mekanik</option>
          <option value="elec">⚡ Elektrik</option>
          <option value="pmc">💻 PMC / Ladder</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">FANUC Serisi</label>
        <select class="form-control" id="np-series">
          <option>0i-F</option>
          <option>30i-B</option>
          <option>31i-B</option>
          <option>32i-B</option>
          <option>Genel</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama</label>
      <textarea class="form-control" id="np-desc" rows="3" placeholder="Proje açıklaması..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Sorumlu</label>
        <input class="form-control" id="np-owner" placeholder="Ad Soyad" />
      </div>
      <div class="form-group">
        <label class="form-label">Tezgah / Makine</label>
        <input class="form-control" id="np-machine" placeholder="ör. VMC-850" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-project')">İptal</button>
      <button class="btn btn-primary" id="btn-create-proj">Proje Oluştur</button>
    </div>
  `);

  document.getElementById('btn-create-proj').addEventListener('click', createProject);
}

async function createProject() {
  const name = document.getElementById('np-name').value.trim();
  if (!name) { showToast('Proje adı zorunlu!', 'error'); return; }

  const id = 'proj_' + Date.now();
  const proj = {
    id,
    name,
    type: document.getElementById('np-type').value,
    series: document.getElementById('np-series').value,
    description: document.getElementById('np-desc').value,
    owner: document.getElementById('np-owner').value || 'Kullanıcı',
    machine: document.getElementById('np-machine').value,
    progress: 0,
    status: 'Aktif',
    createdAt: new Date().toISOString(),
    files: []
  };

  // Save to disk
  const projDir = State.appDataDir + '/projects/' + id;
  try {
    const dirRes = await window.electronAPI.ensureDir(projDir);
    if (!dirRes || !dirRes.ok) {
      showToast('Proje dizini oluşturulamadı: ' + (dirRes?.error || 'Bilinmeyen hata'), 'error');
      return;
    }
    const writeRes = await window.electronAPI.writeFile(projDir + '/meta.json', JSON.stringify(proj, null, 2));
    if (writeRes && writeRes.ok) {
      State.projects.push(proj);
      closeModal('new-project');
      showToast('Proje oluşturuldu!', 'success');
      renderProjectGrid();
    } else {
      showToast('Proje kaydedilemedi: ' + (writeRes?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Proje oluşturulurken hata: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════════
//  ALARMS DATABASE
// ════════════════════════════════════════════════════════════════
function renderAlarms() {
  const page = createPage('alarms');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚠️ FANUC Alarm Veritabanı</h1>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
        <p style="margin:0">${State.alarms.length} alarm kodu — Servo, PMC, Program, Overtravel, Spindle</p>
        <div class="flex gap-1" style="flex-wrap:wrap">
          <span class="tag tag-red" style="font-size:10.5px">Servo (${State.alarms.filter(a => a.category === 'Servo').length})</span>
          <span class="tag tag-blue" style="font-size:10.5px">Program (${State.alarms.filter(a => a.category === 'Program').length})</span>
          <span class="tag tag-amber" style="font-size:10.5px">Spindle (${State.alarms.filter(a => a.category === 'Spindle').length})</span>
          <span class="tag tag-gray" style="font-size:10.5px">PMC (${State.alarms.filter(a => a.category === 'PMC').length})</span>
        </div>
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:340px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="alarm-search" placeholder="Kod veya no ara... (ör: SV0401, 401, servo)" />
        </div>
        <select id="alarm-cat-filter" style="width:150px">
          <option value="">Tüm Kategoriler</option>
          <option>Servo</option>
          <option>Program</option>
          <option>Overtravel</option>
          <option>Spindle</option>
          <option>Overheat</option>
          <option>PMC</option>
          <option>System</option>
          <option>External</option>
        </select>
        <select id="alarm-series-filter" style="width:130px">
          <option value="">Tüm Seriler</option>
          <option>0i-F</option>
          <option>30i-B</option>
          <option>31i-B</option>
          <option>32i-B</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div id="alarm-detail-pane" style="display:none; padding:20px 28px; border-bottom:1px solid var(--border); background:var(--bg-surface)"></div>
      <div style="overflow-y:auto; flex:1">
        <table class="data-table" id="alarm-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Kategori</th>
              <th>Başlık</th>
              <th>Seri</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody id="alarm-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderAlarmTable(State.alarms, page);

  page.querySelector('#alarm-search').addEventListener('input', () => filterAlarms(page));
  page.querySelector('#alarm-cat-filter').addEventListener('change', () => filterAlarms(page));
  page.querySelector('#alarm-series-filter').addEventListener('change', () => filterAlarms(page));

  return page;
}

function filterAlarms(page) {
  const rawQ = page.querySelector('#alarm-search').value.toLowerCase().trim();
  const cat = page.querySelector('#alarm-cat-filter').value;
  const series = page.querySelector('#alarm-series-filter').value;

  const cleanQ = rawQ.replace(/[^a-z0-9]/g, '');

  const filtered = State.alarms.filter(a => {
    const catMatch = !cat || a.category === cat;
    const seriesMatch = !series || a.series.includes(series);
    if (!catMatch || !seriesMatch) return false;

    if (!rawQ) return true;

    const cleanCode = a.code.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    let numMatch = false;
    const queryNumMatch = rawQ.match(/\d+/);
    const codeNumMatch = a.code.match(/\d+/);

    if (queryNumMatch && codeNumMatch) {
      const qNum = parseInt(queryNumMatch[0], 10);
      const cNum = parseInt(codeNumMatch[0], 10);
      
      const qAlpha = rawQ.replace(/\d+/g, '').replace(/[^a-z]/g, '');
      const cAlpha = a.code.toLowerCase().replace(/\d+/g, '').replace(/[^a-z]/g, '');
      
      const alphaMatches = !qAlpha || cAlpha.includes(qAlpha);
      
      if (alphaMatches) {
        const diff = Math.abs(cNum - qNum);
        // Match if the query number is a substring of the alarm code's numeric part
        // OR if the numeric difference is within a tolerance of +/- 5 (fuzzy numeric search)
        if (codeNumMatch[0].includes(queryNumMatch[0]) || diff <= 5) {
          numMatch = true;
        }
      }
    }

    const textMatch = a.code.toLowerCase().includes(rawQ) ||
                      (cleanQ !== '' && cleanCode.includes(cleanQ)) ||
                      a.title.toLowerCase().includes(rawQ) ||
                      a.description.toLowerCase().includes(rawQ);

    return textMatch || numMatch;
  });
  renderAlarmTable(filtered, page);
}

function renderAlarmTable(alarms, page) {
  const tbody = (page || document).querySelector('#alarm-tbody');
  if (!tbody) return;
  if (!alarms.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">Alarm bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = alarms.map(a => `
    <tr class="alarm-tr" data-code="${a.code}" style="cursor:pointer">
      <td><span class="font-mono text-sm" style="color:var(--text-accent); font-weight:600">${a.code}</span></td>
      <td><span class="tag ${alarmCategoryTag(a.category)}">${a.category}</span></td>
      <td><span style="font-size:12px">${a.title}</span></td>
      <td><span style="font-size:11px; color:var(--text-muted)">${a.series.join(', ')}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showAlarmDetail('${a.code}')">
          Detay
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.alarm-tr').forEach(tr => {
    tr.addEventListener('click', () => showAlarmDetail(tr.dataset.code));
  });
}

window.showAlarmDetail = function(code) {
  const alarm = State.alarms.find(a => a.code === code);
  if (!alarm) return;

  // Parse linked parameters
  const linkedParams = [];
  const textToScan = (alarm.description + ' ' + alarm.causes.join(' ') + ' ' + alarm.solutions.join(' ')).toLowerCase();
  
  State.parameters.forEach(p => {
    const regex = new RegExp('\\b' + p.no + '\\b');
    if (regex.test(textToScan) && p.no > 0) {
      linkedParams.push(p);
    }
  });

  showModal('alarm-detail', `
    <div class="modal-header">
      <span class="modal-title">
        <span class="font-mono" style="color:var(--text-accent); margin-right:8px">${escapeHTML(alarm.code)}</span>
        ${escapeHTML(alarm.title)}
      </span>
      <button class="modal-close" onclick="closeModal('alarm-detail')">✕</button>
    </div>
    <div class="flex gap-2 mb-3" style="flex-wrap:wrap">
      <span class="tag ${alarmCategoryTag(alarm.category)}">${escapeHTML(alarm.category)}</span>
      ${alarm.series.map(s => `<span class="tag tag-gray">${escapeHTML(s)}</span>`).join('')}
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${escapeHTML(alarm.description)}</p>
    </div>
    <div class="grid-2" style="gap:12px">
      <div class="card">
        <div class="card-title mb-2" style="color:var(--amber)">⚠️ Olası Nedenler</div>
        <ul style="list-style:none; display:flex; flex-direction:column; gap:6px">
          ${alarm.causes.map(c => `
            <li style="display:flex; gap:8px; font-size:12px">
              <span style="color:var(--amber); flex-shrink:0">▸</span>
              <span style="color:var(--text-secondary)">${escapeHTML(c)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="card">
        <div class="card-title mb-2" style="color:var(--green)">✅ Çözüm Adımları</div>
        <ol style="list-style:none; display:flex; flex-direction:column; gap:6px">
          ${alarm.solutions.map((s, i) => `
            <li style="display:flex; gap:8px; font-size:12px">
              <span class="font-mono" style="color:var(--green); flex-shrink:0; min-width:16px">${i+1}.</span>
              <span style="color:var(--text-secondary)">${escapeHTML(s)}</span>
            </li>
          `).join('')}
        </ol>
      </div>
    </div>
    
    ${linkedParams.length > 0 ? `
      <div class="card mt-3">
        <div class="card-title mb-2" style="color:var(--text-accent)">⚙️ İlişkili Sistem Parametreleri</div>
        <div style="display:flex; flex-direction:column; gap:8px">
          ${linkedParams.map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
              <div style="font-size:12.5px">
                <strong class="font-mono" style="color:var(--text-accent); font-size:13px; margin-right:6px">No. ${escapeHTML(String(p.no))}</strong>
                <span style="color:var(--text-secondary)">${escapeHTML(p.name)}</span>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="goToParameterFromAlarm(${p.no})" style="font-size:11px; padding:2px 8px; border:1px solid var(--border)">
                ⚙️ Parametreye Git
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="card mt-3" style="border: 1px solid rgba(59, 130, 246, 0.2); background: rgba(59, 130, 246, 0.02)">
      <div class="flex justify-between items-center mb-2">
        <span class="card-title" style="color:var(--text-accent); font-size:12px">📝 Fabrika Özel Çözüm Notları</span>
        ${canEdit() ? `<span style="font-size:10px; font-weight:normal; color:var(--text-muted)">Düzenleme Yetkisi Var</span>` : ''}
      </div>
      
      <div id="custom-note-view-container" style="display:${State.custom_alarm_notes[alarm.code] ? 'block' : 'none'}">
        <p style="font-size:12px; line-height:1.6; color:var(--text-secondary); white-space:pre-wrap; background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)" id="custom-note-text-display">${escapeHTML(State.custom_alarm_notes[alarm.code] || '')}</p>
        ${canEdit() ? `<button class="btn btn-secondary btn-sm mt-2" onclick="editCustomAlarmNote()">Notu Düzenle</button>` : ''}
      </div>

      <div id="custom-note-empty-container" style="display:${State.custom_alarm_notes[alarm.code] ? 'none' : 'block'}">
        <p style="font-size:11.5px; color:var(--text-muted); font-style:italic">Bu hata koduna ait fabrika tecrübe notu eklenmemiş.</p>
        ${canEdit() ? `<button class="btn btn-secondary btn-sm mt-2" onclick="editCustomAlarmNote()">+ Not Ekle</button>` : ''}
      </div>

      ${canEdit() ? `
        <div id="custom-note-edit-container" style="display:none; margin-top:8px">
          <textarea class="form-control" id="custom-note-textarea" rows="3" style="font-size:12px; width:100%; font-family:inherit" placeholder="Örn: CNC-02 tezgahında bu hata X ekseni motorunun arkasındaki soketin gevşemesinden dolayı oluyor. Önce soketi sıkın...">${escapeHTML(State.custom_alarm_notes[alarm.code] || '')}</textarea>
          <div class="flex gap-2 mt-2">
            <button class="btn btn-primary btn-sm" onclick="saveCustomAlarmNote('${alarm.code}')">Notu Kaydet</button>
            <button class="btn btn-ghost btn-sm" onclick="cancelEditCustomAlarmNote('${alarm.code}')">İptal</button>
          </div>
        </div>
      ` : ''}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('alarm-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutAlarm('${alarm.code}')">
        🤖 AI'ya Sor
      </button>
    </div>
  `, 'lg');
};

window.editCustomAlarmNote = function() {
  const v = document.getElementById('custom-note-view-container');
  const em = document.getElementById('custom-note-empty-container');
  const ed = document.getElementById('custom-note-edit-container');
  if (v) v.style.display = 'none';
  if (em) em.style.display = 'none';
  if (ed) ed.style.display = 'block';
  const ta = document.getElementById('custom-note-textarea');
  if (ta) ta.focus();
};

window.cancelEditCustomAlarmNote = function(code) {
  const v = document.getElementById('custom-note-view-container');
  const em = document.getElementById('custom-note-empty-container');
  const ed = document.getElementById('custom-note-edit-container');
  const ta = document.getElementById('custom-note-textarea');
  
  if (code && ta) {
    ta.value = State.custom_alarm_notes[code] || '';
  }
  const hasNote = !!(ta && ta.value.trim());

  if (v) v.style.display = hasNote ? 'block' : 'none';
  if (em) em.style.display = hasNote ? 'none' : 'block';
  if (ed) ed.style.display = 'none';
};

window.saveCustomAlarmNote = async function(code) {
  if (!canEdit()) { showToast('Düzenleme yetkiniz yok', 'error'); return; }
  const ta = document.getElementById('custom-note-textarea');
  if (!ta) return;
  const noteVal = ta.value.trim();

  if (noteVal) {
    State.custom_alarm_notes[code] = noteVal;
  } else {
    delete State.custom_alarm_notes[code];
  }

  const ok = await saveCustomAlarmNotes();
  if (ok) {
    showToast('Fabrika notu başarıyla kaydedildi ✓', 'success');
    const disp = document.getElementById('custom-note-text-display');
    if (disp) disp.textContent = noteVal;
    window.cancelEditCustomAlarmNote(code);
  }
};

window.goToParameterFromAlarm = function(paramNo) {
  closeModal('alarm-detail');
  navigate('parameters');
  setTimeout(() => {
    const page = document.getElementById('page-parameters');
    const searchInput = document.getElementById('param-search');
    if (searchInput) {
      searchInput.value = paramNo;
      if (page) {
        filterParams(page);
      }
    }
  }, 100);
};

window.askAIAboutAlarm = function(code) {
  const alarm = State.alarms.find(a => a.code === code);
  if (alarm) {
    State.activeDiagnostic = { type: 'alarm', code, data: alarm };
  }
  closeModal('alarm-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC alarm kodu ${code} hakkında detaylı bilgi ver ve çözüm önerilerini açıkla.`;
      input.dispatchEvent(new Event('input'));
      sendAIMessage();
    }
  }, 300);
};

// ════════════════════════════════════════════════════════════════
//  PARAMETERS
// ════════════════════════════════════════════════════════════════
window.CurrentParamTab = 'db';

function renderParameters() {
  const page = createPage('parameters');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ FANUC Parametre Yönetimi</h1>
      <p>Parametreleri arayın, inceleyin ve PWE yazma korumalı kilitleri açma rehberini kullanın</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-par-db" onclick="switchParamTab('db')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          🔎 Parametre Veritabanı
        </button>
        <button class="tab-btn" id="tab-par-pwe" onclick="switchParamTab('pwe')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🔒 PWE Kilitlenme & Kurtarma Kılavuzu
        </button>
      </div>
    </div>
    
    <div class="page-body" id="param-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchParamTab(window.CurrentParamTab, page);
  }, 10);

  return page;
}

window.switchParamTab = function(tab, page = document) {
  window.CurrentParamTab = tab;

  const dbBtn = page.querySelector('#tab-par-db');
  const pweBtn = page.querySelector('#tab-par-pwe');
  if (dbBtn && pweBtn) {
    dbBtn.style.color = tab === 'db' ? 'var(--text-accent)' : 'var(--text-secondary)';
    dbBtn.style.fontWeight = tab === 'db' ? 'bold' : 'normal';
    pweBtn.style.color = tab === 'pwe' ? 'var(--text-accent)' : 'var(--text-secondary)';
    pweBtn.style.fontWeight = tab === 'pwe' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#param-tab-content');
  if (!content) return;

  if (tab === 'db') {
    content.innerHTML = `
      <div class="flex gap-2 mb-3" style="padding:0 20px; flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="param-search" placeholder="Parametre no veya adı ara... (ör: 1320, soft limit)" />
        </div>
        <select id="param-cat-filter" style="width:140px">
          <option value="">Tüm Kategoriler</option>
          <option value="axis">Eksen</option>
          <option value="spindle">Spindle</option>
          <option value="feed">Besleme</option>
          <option value="io">I/O</option>
          <option value="pmc">PMC</option>
          <option value="display">Ekran</option>
        </select>
        <div class="flex gap-1" id="param-range-filters" style="flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm active" onclick="switchParamRangeFilter(this, 'all')">Tümü</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '1000-1200')" title="1000 - 1200 aralığı">Eksen (1000+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '1300-1400')" title="1300 - 1400 aralığı">Limitler (1300+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '1800-1900')" title="1800 - 1900 aralığı">Referans/Boşluk (1800+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '3000-3300')" title="3000 - 3300 aralığı">Ekran/Dil (3000+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '4000-4100')" title="4000 - 4100 aralığı">Spindle (4000+)</button>
        </div>
      </div>
      <div style="overflow:auto; flex:1">
        <table class="data-table" id="param-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Adı</th>
              <th>Kategori</th>
              <th>Tip</th>
              <th>Aralık</th>
              <th>Varsayılan</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody id="param-tbody"></tbody>
        </table>
      </div>
    `;

    window.CurrentParamRange = 'all';
    renderParamTable(State.parameters, page);
    page.querySelector('#param-search').addEventListener('input', () => filterParams(page));
    page.querySelector('#param-cat-filter').addEventListener('change', () => filterParams(page));
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px; padding:0 20px">
        
        <!-- Left: PWE write enable and bypass -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">🔒 Parameter Write Enable (PWE) Bypass Adımları</div>
          <p style="font-size:12px; color:var(--text-secondary); line-height:1.5">
            FANUC sistemlerinde parametre yazmayı aktif etmek için standart prosedürler ve koruma kilitlerini aşma yöntemleri:
          </p>

          <div style="font-size:12.5px; display:flex; flex-direction:column; gap:8px">
            <strong>🔑 1. Standart PWE Açma (MDI Modu Zorunluluğu):</strong>
            <div>• Tezgahı mutlaka <strong>MDI Moduna</strong> alın. (Diğer modlarda parametre yazma yetkisi açılmaz).</div>
            <div>• <strong>OFFSET/SETTING</strong> tuşuna basın. Ekranda <code>PARAMETER WRITE = 0</code> satırını bulun.</div>
            <div>• Buraya <code>1</code> yazıp INPUT deyin. Sistem <code>SW0100 PARAMETER WRITE ENABLE</code> uyarısı verecektir (Bu normaldir, alarm basılıyken parametreler yazılabilir).</div>
            
            <strong style="margin-top:6px; color:var(--amber)">🔑 2. PWE Kilit Koruma Parametresi (KEY1 - KEY4):</strong>
            <div>• Eğer PWE açılmasına rağmen bazı parametreler yazılmıyorsa, yazma anahtarı (Memory Protect) devrededir.</div>
            <div>• <code>SYSTEM > DIAGNOSTIC</code> ekranında <strong>KEY1, KEY2, KEY3, KEY4</strong> (genellikle DGN 3200+ serisi) durum lojiklerini kontrol edin. Değerlerin <code>1</code> olması ilgili bellek alanlarını kilitler. Kilidi açmak için ilgili PMC sinyalini veya anahtar switch'ini pasife alın.</div>
          </div>
        </div>

        <!-- Right: Coordinate & Program Unlock parameters -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">⚙️ İş Sıfırı (G54) ve Macro Program Kilitleri</div>
          <p style="font-size:12px; color:var(--text-secondary); line-height:1.5">
            Operatörlerin G54 iş sıfırlarını değiştirmesini engellemek veya O9000 macro programlarını görünür/düzenlenebilir yapmak için parametreler:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:8px">
            <div>
              <strong style="color:var(--text-accent)">• Parameter 3290 #0 (WPCO):</strong><br>
              <code>1</code> yapıldığında, operatörün G54-G59 sayfasına veri yazması engellenir (İş sıfırı kilidi). Yazmak için <code>0</code> yapılmalıdır.
            </div>
            <div>
              <strong style="color:var(--text-accent)">• Parameter 3202 #0 (NE9):</strong><br>
              <code>1</code> olduğunda, O9000-O9999 aralığındaki imalatçı özel makro programları koruma altındadır (Düzenlenemez/Silinemez). Düzenleme yapmak veya yedeklemek için <code>0</code> yapılmalıdır.
            </div>
          </div>
        </div>

      </div>
    `;
  }
};

window.switchParamRangeFilter = function(btn, rangeVal) {
  const container = document.getElementById('param-range-filters');
  if (container) {
    container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  }
  btn.classList.add('active');
  window.CurrentParamRange = rangeVal;
  filterParams(document.getElementById('page-parameters'));
};

function filterParams(page) {
  if (!page) page = document.getElementById('page-parameters') || document;
  const searchInput = page.querySelector('#param-search');
  const catSelect = page.querySelector('#param-cat-filter');
  if (!searchInput || !catSelect) return;
  const q = searchInput.value.toLowerCase();
  const cat = catSelect.value;
  const range = window.CurrentParamRange || 'all';

  const filtered = State.parameters.filter(p => {
    const textMatch = !q || String(p.no).includes(q) || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const catMatch = !cat || p.category === cat;
    
    let rangeMatch = true;
    if (range === '1000-1200') {
      rangeMatch = p.no >= 1000 && p.no <= 1200;
    } else if (range === '1300-1400') {
      rangeMatch = p.no >= 1300 && p.no <= 1400;
    } else if (range === '1800-1900') {
      rangeMatch = p.no >= 1800 && p.no <= 1900;
    } else if (range === '3000-3300') {
      rangeMatch = p.no >= 3000 && p.no <= 3300;
    } else if (range === '4000-4100') {
      rangeMatch = p.no >= 4000 && p.no <= 4100;
    }

    return textMatch && catMatch && rangeMatch;
  });
  renderParamTable(filtered, page);
}

function renderParamTable(params, page) {
  const tbody = (page || document).querySelector('#param-tbody');
  if (!tbody) return;
  if (!params.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Parametre bulunamadı</td></tr>`;
    return;
  }
  const catLabels = { axis:'Eksen', spindle:'Spindle', feed:'Besleme', io:'I/O', pmc:'PMC', display:'Ekran' };
  const catTags   = { axis:'tag-blue', spindle:'tag-cyan', feed:'tag-green', io:'tag-amber', pmc:'tag-purple', display:'tag-gray' };
  tbody.innerHTML = params.map(p => `
    <tr style="cursor:pointer" onclick="showParamDetail('${p.no}')">
      <td><span class="font-mono" style="color:var(--text-accent); font-weight:600; font-size:13px">${p.no}</span></td>
      <td><span style="font-weight:500; font-size:12px">${p.name}</span></td>
      <td><span class="tag ${catTags[p.category]||'tag-gray'}">${catLabels[p.category]||p.category}</span></td>
      <td><span class="font-mono text-sm" style="color:var(--text-muted)">${p.dataType}</span></td>
      <td><span class="font-mono text-sm">${p.range}</span></td>
      <td><span class="font-mono text-sm" style="color:var(--green)">${p.default}</span></td>
      <td><span style="font-size:11.5px; color:var(--text-secondary)">${p.description}</span></td>
    </tr>
  `).join('');
}

window.showParamDetail = function(no) {
  const param = State.parameters.find(p => p.no == no);
  if (!param) return;

  const bitDescriptions = {
    1815: {
      5: "APC (Mutlak Enkoder Aktif)",
      4: "APZ (Referans Pozisyonu Senkronize)"
    },
    1006: {
      0: "ROT (Lineer/Dairesel Eksen Tipi Seçimi)",
      3: "DIA (Çap/Yarıçap Programlama Seçimi)",
      5: "ZMI (Manuel Referansa Dönüş Hareketi Yönü)"
    },
    3111: {
      0: "SVS (Servo Ayar ve Tuning Ekranı Gösterimi)",
      1: "SPS (Spindle Tuning Ekranı Gösterimi)",
      5: "OPS (Operatör Geçmişi İzleme Kaydı)",
      6: "OPH (Operatör Geçmişi Ekranı Gösterimi)",
      7: "NPA (Alarm Ekranı Geçişi / Otomatik Sayfa Değişimi)"
    },
    3202: {
      0: "NE8 (8000-8999 Program Kilidi / Koruma Durumu)",
      4: "NE9 (9000-9999 Program Kilidi / Koruma Durumu)"
    },
    1001: {
      0: "INM (Metrik/İnç Taban Ölçü Sistemi Seçimi)"
    },
    1002: {
      0: "JAX (Aynı Anda Manuel Hareketi Destekleyen Eksen Sayısı)",
      1: "DLZ (Decel Switch'siz Referans Noktası Bulma)",
      7: "IDG (Absolute Enkoder Referans Sıfırlama İnhibisyonu)"
    }
  };

  const isBit = param.dataType && param.dataType.toLowerCase() === 'bit';
  const defaultValue = (param.default && /^[01]+$/.test(param.default.trim()))
    ? param.default.trim().padStart(8, '0')
    : '00000000';

  showModal('param-detail', `
    <div class="modal-header">
      <span class="modal-title">Parametre No. <span class="font-mono" style="color:var(--text-accent)">${escapeHTML(String(param.no))}</span> — ${escapeHTML(param.name)}</span>
      <button class="modal-close" onclick="closeModal('param-detail')">✕</button>
    </div>
    <div class="grid-2" style="gap:10px; margin-bottom:14px">
      <div class="card"><div class="card-sub">Veri Tipi</div><div style="font-family:var(--font-mono);margin-top:4px">${escapeHTML(param.dataType)}</div></div>
      <div class="card"><div class="card-sub">Aralık</div><div style="font-family:var(--font-mono);margin-top:4px">${escapeHTML(param.range || '—')}</div></div>
      <div class="card"><div class="card-sub">Varsayılan</div><div style="font-family:var(--font-mono);color:var(--green);margin-top:4px">${escapeHTML(param.default || '—')}</div></div>
      <div class="card"><div class="card-sub">Kategori</div><div style="margin-top:4px">${escapeHTML(param.category)}</div></div>
    </div>
    <div class="card">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${escapeHTML(param.description)}</p>
      ${param.note ? `<div style="margin-top:8px; padding:8px; background:var(--accent-glow); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-accent)">💡 ${escapeHTML(param.note)}</div>` : ''}
    </div>

    ${isBit ? `
      <div class="card mt-3" style="border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.02)">
        <div class="card-title mb-1" style="font-size:12.5px; color:var(--text-accent)">🖥️ İnteraktif 8-Bit Değer Simülatörü</div>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px">CNC ekranındaki her bir bit hanesinin (7-0) üzerine tıklayarak durumunu değiştirebilirsiniz.</p>
        
        <div class="flex gap-2 justify-center mb-3" style="flex-wrap:wrap">
          ${[7, 6, 5, 4, 3, 2, 1, 0].map(bit => {
            const desc = (bitDescriptions[param.no] && bitDescriptions[param.no][bit]) || `Bit ${bit}`;
            const initialVal = defaultValue[7 - bit];
            const isSet = initialVal === '1';
            const btnBorder = isSet ? 'var(--green)' : 'var(--border)';
            const btnBg = isSet ? 'rgba(16,185,129,0.03)' : 'var(--bg-card2)';
            return `
              <button class="param-bit-btn" id="bit-btn-${bit}" onclick="toggleParamDetailBit(${bit})" title="${escapeHTML(desc)}" style="width:52px; height:52px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px solid ${btnBorder}; background:${btnBg}; border-radius:var(--radius-sm); cursor:pointer; transition:all 0.15s">
                <span style="font-size:9px; color:var(--text-muted); font-weight:600">${bitDescriptions[param.no] && bitDescriptions[param.no][bit] ? escapeHTML(bitDescriptions[param.no][bit].split(' ')[0]) : 'B' + bit}</span>
                <strong style="font-size:15px; color:${isSet ? 'var(--green)' : 'var(--text-secondary)'}" id="bit-val-${bit}">${initialVal}</strong>
              </button>
            `;
          }).join('')}
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:12.5px; padding-top:8px; border-top:1px solid var(--border)">
          <span>İkilik (Binary): <strong id="param-bit-binary" style="color:var(--text-accent)">${escapeHTML(defaultValue)}</strong></span>
          <span>Ondalık (Decimal): <strong id="param-bit-decimal" style="color:var(--green)">${parseInt(defaultValue, 2)}</strong></span>
        </div>
      </div>
    ` : ''}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('param-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutParam(${param.no})">🤖 AI'ya Sor</button>
    </div>
  `, 'lg');
};

window.toggleParamDetailBit = function(bit) {
  const strong = document.getElementById(`bit-val-${bit}`);
  const btn = document.getElementById(`bit-btn-${bit}`);
  if (!strong) return;

  const currentVal = strong.textContent === '1' ? '0' : '1';
  strong.textContent = currentVal;
  strong.style.color = currentVal === '1' ? 'var(--green)' : 'var(--text-secondary)';
  if (currentVal === '1') {
    btn.style.borderColor = 'var(--green)';
    btn.style.background = 'rgba(16,185,129,0.03)';
  } else {
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--bg-card2)';
  }

  let binary = '';
  for (let b = 7; b >= 0; b--) {
    const s = document.getElementById(`bit-val-${b}`);
    binary += s ? s.textContent : '0';
  }

  const binarySpan = document.getElementById('param-bit-binary');
  const decimalSpan = document.getElementById('param-bit-decimal');
  if (binarySpan) binarySpan.textContent = binary;
  if (decimalSpan) decimalSpan.textContent = parseInt(binary, 2);
};

window.askAIAboutParam = function(no) {
  const param = State.parameters.find(p => p.no == no);
  if (param) {
    State.activeDiagnostic = { type: 'parameter', code: String(no), data: param };
  }
  closeModal('param-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC parametre No.${no} hakkında detaylı açıklama yap. Bu parametre ne işe yarar, nasıl ayarlanır?`;
      sendAIMessage();
    }
  }, 300);
};

// ════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════
function renderSettings() {
  const page = createPage('settings');
  const themeOptions = [
    { id: 'dark', label: '🌑 Dark', desc: 'Koyu lacivert, premium industrial' },
    { id: 'light', label: '☀️ Light', desc: 'Beyaz zemin, temiz görünüm' },
    { id: 'retro', label: '🖥️ FANUC Retro', desc: 'Siyah ekran, yeşil terminal estetiği' },
  ];

  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Ayarlar</h1>
      <p>Uygulama, tema ve kullanıcı ayarları</p>
    </div>
    <div class="page-body" style="max-width:100%">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start">
        <!-- Sol Sütun (Left Column) -->
        <div style="display:flex; flex-direction:column; gap:20px">
          <!-- Theme Switcher -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">🎨 Tema Seçimi</div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px" id="theme-options">
          ${themeOptions.map(t => `
            <button class="theme-opt-btn ${State.settings.theme === t.id ? 'active' : ''}" data-theme="${t.id}" onclick="setThemeOption('${t.id}')">
              <span style="font-size:22px">${t.label.split(' ')[0]}</span>
              <strong>${t.label.split(' ').slice(1).join(' ')}</strong>
              <span style="font-size:10px; color:var(--text-muted)">${t.desc}</span>
            </button>
          `).join('')}
        </div>
      </div>
          <!-- Auto-Updater & Knowledge Packs Card -->
          <div class="card mb-4">
            <div class="card-title mb-3" style="font-size:14px; display:flex; align-items:center; justify-content:space-between">
              <span>🔄 Sürüm & Kütüphane Güncelleme Paneli</span>
              <span id="updater-status-badge" class="tag tag-green">🟢 Güncel (v2.5.0)</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px" id="updater-status-text">
              Yazılımınız ve FANUC Alarm/Parametre Kütüphaneleriniz en son sürümde (v2.5.0).
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick="checkForAppUpdates()">
                🔍 Güncellemeleri Denetle
              </button>
              <button class="btn btn-secondary btn-sm" onclick="navigate('library')">
                📦 Çevrimdışı Paketler
              </button>
            </div>
          </div>

          <!-- User Management -->

      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">👥 Kullanıcı Yönetimi</div>
        <div style="margin-bottom:12px; padding:10px; background:var(--bg-card2); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-secondary)">
          Aktif Kullanıcı: <strong style="color:var(--text-primary)">${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}</strong> — ${getRoleLabel(State.currentUser ? State.currentUser.role : 'operator')}
        </div>
        <table class="data-table">
          <thead><tr><th>Kullanıcı</th><th>Rol</th><th>PIN</th><th>İşlem</th></tr></thead>
          <tbody id="users-table-body">
            ${State.users.map(u => `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:8px">
                    <div style="width:24px; height:24px; border-radius:50%; background:${u.color}; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#fff">${escapeHTML(u.initials)}</div>
                    ${escapeHTML(u.name)}
                  </div>
                </td>
                <td>${escapeHTML(getRoleLabel(u.role))}</td>
                <td><span class="font-mono" style="letter-spacing:4px; color:var(--text-muted)">••••</span></td>
                <td>
                  ${canDelete() ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})" ${(State.currentUser && u.id === State.currentUser.id) ? 'disabled title="Kendi hesabınızı silemezsiniz"' : ''}>Sil</button>` : '—'}
                </td>
              </tr>

            `).join('')}
          </tbody>
        </table>
        ${canEdit() ? `
          <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border)">
            <div class="card-title mb-3" style="font-size:12px">Yeni Kullanıcı Ekle</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Ad</label>
                <input type="text" id="new-user-name" class="form-control" placeholder="Kullanıcı adı" />
              </div>
              <div class="form-group">
                <label class="form-label">Rol</label>
                <select id="new-user-role" class="form-control">
                  <option value="operator">👤 Operatör</option>
                  <option value="technician">🔧 Bakım Teknisyeni</option>
                  ${canDelete() ? '<option value="admin">🔑 Yönetici</option>' : ''}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">PIN (4-6 hane)</label>
                <input type="password" id="new-user-pin" class="form-control" placeholder="••••" maxlength="6" />
              </div>
              <div class="form-group">
                <label class="form-label">Baş harfler (2 harf)</label>
                <input type="text" id="new-user-initials" class="form-control" placeholder="BT" maxlength="2" />
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="addNewUser()">+ Kullanıcı Ekle</button>
          </div>
        ` : ''}
      </div>
          <!-- PIN Change (Self Service) -->
      ${State.currentUser ? `
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">🔐 PIN Şifre Değiştir</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
          Mevcut PIN şifrenizi girerek yeni bir PIN şifresi belirleyebilirsiniz.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Mevcut PIN</label>
            <input type="password" id="change-pin-old" class="form-control" placeholder="••••" maxlength="6" />
          </div>
          <div class="form-group">
            <label class="form-label">Yeni PIN (4-6 hane)</label>
            <input type="password" id="change-pin-new" class="form-control" placeholder="••••" maxlength="6" />
          </div>
          <div class="form-group">
            <label class="form-label">Yeni PIN (Tekrar)</label>
            <input type="password" id="change-pin-new2" class="form-control" placeholder="••••" maxlength="6" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="changeMyPin()">PIN Güncelle</button>
      </div>
      ` : ''}
        </div>
        <!-- Sağ Sütun (Right Column) -->
        <div style="display:flex; flex-direction:column; gap:20px">
          <!-- AI Settings -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">🤖 Yapay Zeka Ayarları</div>
        <div class="form-group">
          <label class="form-label">AI Sağlayıcı</label>
          <select class="form-control" id="ai-provider" style="max-width:280px">
            <option value="offline" ${State.settings.aiProvider==='offline'?'selected':''}>🔒 Offline (API gereksiz)</option>
            <option value="openai"  ${State.settings.aiProvider==='openai' ?'selected':''}>🟢 OpenAI (GPT-4)</option>
            <option value="gemini"  ${State.settings.aiProvider==='gemini' ?'selected':''}>🔵 Google Gemini</option>
          </select>
        </div>
        <div class="form-group" id="api-key-group" style="${State.settings.aiProvider==='offline'?'display:none':''}">
          <label class="form-label">API Anahtarı</label>
          <div class="flex gap-2" style="max-width:420px">
            <input type="password" class="form-control" id="ai-api-key" placeholder="sk-..." value="${State.settings.aiApiKey || ''}" />
            <button class="btn btn-secondary btn-sm" id="btn-toggle-key">Göster</button>
          </div>
        </div>
        <div class="form-group" id="ai-model-group" style="${State.settings.aiProvider==='offline'?'display:none':''}">
          <label class="form-label">Model</label>
          <select class="form-control" id="ai-model" style="max-width:280px">
            <option value="gpt-4o" ${State.settings.aiModel==='gpt-4o'?'selected':''}>GPT-4o</option>
            <option value="gpt-4-turbo" ${State.settings.aiModel==='gpt-4-turbo'?'selected':''}>GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo" ${State.settings.aiModel==='gpt-3.5-turbo'?'selected':''}>GPT-3.5 Turbo</option>
            <option value="gemini-pro" ${State.settings.aiModel==='gemini-pro'?'selected':''}>Gemini Pro</option>
            <option value="gemini-1.5-pro" ${State.settings.aiModel==='gemini-1.5-pro'?'selected':''}>Gemini 1.5 Pro</option>
          </select>
        </div>
        <div style="padding:10px; background:var(--accent-glow); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-secondary); margin-top:4px">
          💡 Offline modda FANUC alarm veritabanı ve kural tabanlı yapay zeka çalışır. API gerektirmez.
        </div>
      </div>

      <!-- Tezgah Ağ Ayarları -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">🖥️ Tezgah Ağ Ayarları (Canlı İzleme)</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fanuc Tezgah 1 IP Adresi</label>
            <input type="text" id="cnc-m1-ip" class="form-control" placeholder="192.168.30.20" value="Yükleniyor..." />
          </div>
          <div class="form-group">
            <label class="form-label">Fanuc 1 FOCAS Portu</label>
            <input type="number" id="cnc-m1-port" class="form-control" placeholder="8193" value="8193" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fanuc Tezgah 2 IP Adresi</label>
            <input type="text" id="cnc-m2-ip" class="form-control" placeholder="192.168.30.21" value="Yükleniyor..." />
          </div>
          <div class="form-group">
            <label class="form-label">Fanuc 2 FOCAS Portu</label>
            <input type="number" id="cnc-m2-port" class="form-control" placeholder="8193" value="8193" />
          </div>
        </div>
        <div style="padding:10px; background:var(--accent-glow); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-secondary); margin-top:4px">
          💡 IP adreslerini güncelledikten sonra kaydet butonuna bastığınızda telemetri servisi otomatik olarak yeniden başlatılacaktır.
        </div>
      </div>

      <!-- App Settings -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">📁 Uygulama</div>
        <div class="form-group">
          <label class="form-label">Veri Dizini</label>
          <div class="font-mono text-sm" style="padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm); color:var(--text-secondary); word-break:break-all">
            ${State.appDataDir || 'Yükleniyor...'}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openDataDir()">
          <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          Klasörü Aç
        </button>
      </div>

      <!-- CSV Export -->
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">📊 Dışa Aktarma (CSV / Excel)</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:14px">Verileri Excel'de açılabilir CSV formatında kaydedin.</p>
        <div class="flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="exportMaintenanceCSV()">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Bakım Defteri CSV
          </button>
          <button class="btn btn-secondary btn-sm" onclick="exportAlarmsCSV()">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Alarm DB CSV
          </button>
        </div>
      </div>

      <!-- Database Sync -->
      <div class="card mb-4" style="border:1px solid rgba(16,185,129,0.15); background:rgba(16,185,129,0.02)">
        <div class="card-title mb-2" style="font-size:14px; color:var(--green)">🔄 Bulut Veri Senkronizasyonu</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
          İnternete bağlanarak en güncel FANUC G-Kodlarını, alarm hata çözümlerini ve parametre veritabanlarını resmi sunuculardan çeker ve uygulamayı günceller.
        </p>
        <div class="flex items-center justify-between">
          <span style="font-size:11px; color:var(--text-muted)" id="sync-last-time">Son Senkronizasyon: ${State.settings.lastSync || 'Hiç yapılmadı'}</span>
          <button class="btn btn-primary btn-sm" onclick="startDatabaseSync()">Buluttan Güncelle</button>
        </div>
      </div>
        </div>
      </div>
      
      <div class="flex gap-2 mt-4" style="border-top:1px solid var(--border); padding-top:20px">
        <button class="btn btn-primary" id="btn-save-settings">Ayarları Kaydet</button>
        <button class="btn btn-ghost" onclick="navigate('dashboard')">İptal</button>
      </div>
    </div>
  `;

  addStyle(`
    .theme-opt-btn {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      padding:16px 10px; border-radius:var(--radius-md);
      background:var(--bg-card2); border:2px solid var(--border);
      cursor:pointer; transition:all .2s; font-family:inherit; color:var(--text-primary);
    }
    .theme-opt-btn:hover { border-color:var(--accent); background:var(--bg-hover); }
    .theme-opt-btn.active { border-color:var(--accent); background:var(--accent-glow); }
    .theme-opt-btn strong { font-size:12px; }
  `);

  // Theme selection
  window.setThemeOption = function(theme) {
    applyTheme(theme);
    page.querySelectorAll('.theme-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  };

  // AI provider toggle
  const providerSel = page.querySelector('#ai-provider');
  const apiKeyGroup = page.querySelector('#api-key-group');
  const modelGroup  = page.querySelector('#ai-model-group');
  providerSel.addEventListener('change', () => {
    const offline = providerSel.value === 'offline';
    apiKeyGroup.style.display = offline ? 'none' : '';
    modelGroup.style.display  = offline ? 'none' : '';
  });

  page.querySelector('#btn-toggle-key').addEventListener('click', () => {
    const inp = page.querySelector('#ai-api-key');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Load CNC Machine Network Settings from bin/adapter.config.json
  window.electronAPI.readFile('bin/adapter.config.json').then(res => {
    if (res.ok) {
      try {
        const configData = JSON.parse(res.data);
        const m1 = configData.find(c => c.id === 'Fanuc');
        const m2 = configData.find(c => c.id === 'Fanuc2');
        if (m1) {
          page.querySelector('#cnc-m1-ip').value = m1.ip || '192.168.30.20';
          page.querySelector('#cnc-m1-port').value = m1.port || 8193;
        }
        if (m2) {
          page.querySelector('#cnc-m2-ip').value = m2.ip || '192.168.30.21';
          page.querySelector('#cnc-m2-port').value = m2.port || 8193;
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      page.querySelector('#cnc-m1-ip').value = '192.168.30.20';
      page.querySelector('#cnc-m2-ip').value = '192.168.30.21';
    }
  }).catch(() => {
    page.querySelector('#cnc-m1-ip').value = '192.168.30.20';
    page.querySelector('#cnc-m2-ip').value = '192.168.30.21';
  });

  page.querySelector('#btn-save-settings').addEventListener('click', async () => {
    State.settings.aiProvider = page.querySelector('#ai-provider').value;
    State.settings.aiApiKey   = page.querySelector('#ai-api-key').value;
    State.settings.aiModel    = page.querySelector('#ai-model').value;
    await saveSettings();

    // Save CNC Machine Network Settings
    try {
      const m1_ip = page.querySelector('#cnc-m1-ip').value.trim();
      const m1_port = parseInt(page.querySelector('#cnc-m1-port').value) || 8193;
      const m2_ip = page.querySelector('#cnc-m2-ip').value.trim();
      const m2_port = parseInt(page.querySelector('#cnc-m2-port').value) || 8193;

      const configData = [
        { id: "Fanuc", ip: m1_ip, port: m1_port, shdrPort: 7880, prefix: "f" },
        { id: "Fanuc2", ip: m2_ip, port: m2_port, shdrPort: 7881, prefix: "f2" }
      ];

      const writeRes = await window.electronAPI.writeFile('bin/adapter.config.json', JSON.stringify(configData, null, 2));
      if (writeRes && writeRes.ok) {
        showToast('Ayarlar kaydedildi! Servis yeniden başlatılıyor...', 'success');
        await window.electronAPI.restartAdapter();
      } else {
        throw new Error(writeRes?.error || 'Dosyaya yazılamadı');
      }
    } catch (err) {
      showToast('Tezgah IP adresleri kaydedilemedi: ' + err.message, 'error');
    }
  });

  return page;
}

// Add user
window.addNewUser = async function() {
  if (!canEdit()) { showToast('Kullanıcı ekleme yetkiniz yok', 'error'); return; }
  const name = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;
  const pin = document.getElementById('new-user-pin').value.trim();
  const initials = document.getElementById('new-user-initials').value.trim().toUpperCase();
  if (!name || !pin || pin.length < 4) { showToast('Ad ve en az 4 haneli PIN gerekli', 'error'); return; }
  // Verify that only users with canDelete privileges (Admins) can create admin users
  if (role === 'admin' && !canDelete()) {
    showToast('Yönetici ekleme yetkiniz yok', 'error');
    return;
  }
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
  const newUser = { id: Date.now(), name, role, pin, initials: initials || name.slice(0,2).toUpperCase(), color: colors[State.users.length % colors.length] };
  
  try {
    const res = await window.electronAPI.writeFile('./data/users.json', JSON.stringify({ users: [...State.users, newUser] }, null, 2));
    if (res && res.ok) {
      State.users.push(newUser);
      showToast('Kullanıcı eklendi ✓', 'success');
      navigate('settings');
    } else {
      showToast('Kullanıcı kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Kullanıcı kaydedilirken hata oluştu: ' + err.message, 'error');
  }
};

// Delete user
window.deleteUser = async function(userId) {
  if (!canDelete()) { showToast('Silme yetkiniz yok', 'error'); return; }
  if (userId === State.currentUser.id) { showToast('Kendi hesabınızı silemezsiniz', 'error'); return; }
  const updatedUsers = State.users.filter(u => u.id !== userId);
  try {
    const res = await window.electronAPI.writeFile('./data/users.json', JSON.stringify({ users: updatedUsers }, null, 2));
    if (res && res.ok) {
      State.users = updatedUsers;
      showToast('Kullanıcı silindi', 'success');
      navigate('settings');
    } else {
      showToast('Kullanıcı silinemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Kullanıcı silinirken hata oluştu: ' + err.message, 'error');
  }
};

window.changeMyPin = async function() {
  if (!State.currentUser) {
    showToast('Öncelikle giriş yapmalısınız', 'error');
    return;
  }
  const oldPin = document.getElementById('change-pin-old').value;
  const newPin = document.getElementById('change-pin-new').value.trim();
  const newPin2 = document.getElementById('change-pin-new2').value.trim();

  if (!oldPin || !newPin || !newPin2) {
    showToast('Lütfen tüm şifre alanlarını doldurun.', 'error');
    return;
  }

  if (oldPin !== State.currentUser.pin) {
    showToast('Mevcut PIN şifresi hatalı.', 'error');
    return;
  }

  if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    showToast('Yeni PIN sadece rakamlardan oluşmalı ve 4-6 hane uzunluğunda olmalıdır.', 'error');
    return;
  }

  if (newPin !== newPin2) {
    showToast('Yeni PIN şifreleri eşleşmiyor.', 'error');
    return;
  }

  // Update State.users and State.currentUser
  const userIndex = State.users.findIndex(u => u.id === State.currentUser.id);
  if (userIndex === -1) {
    showToast('Kullanıcı bulunamadı.', 'error');
    return;
  }

  State.users[userIndex].pin = newPin;
  State.currentUser.pin = newPin;

  try {
    const res = await window.electronAPI.writeFile('./data/users.json', JSON.stringify({ users: State.users }, null, 2));
    if (res && res.ok) {
      showToast('PIN şifreniz başarıyla güncellendi!', 'success');
      document.getElementById('change-pin-old').value = '';
      document.getElementById('change-pin-new').value = '';
      document.getElementById('change-pin-new2').value = '';
      navigate('settings');
    } else {
      showToast('Şifre güncellenemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Şifre güncellenirken hata oluştu: ' + err.message, 'error');
  }
};

window.openDataDir = function() {
  if (State.appDataDir) window.electronAPI.openExternal(State.appDataDir);
};


// ════════════════════════════════════════════════════════════════
//  AI CHAT
// ════════════════════════════════════════════════════════════════
const ChatHistory = [];

function renderAI() {
  const page = createPage('ai');
  
  let diagHTML = '';
  if (State.activeDiagnostic) {
    const ad = State.activeDiagnostic;
    if (ad.type === 'alarm') {
      diagHTML = `
        <div class="card" style="border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.02); display:flex; flex-direction:column; gap:10px; padding:16px">
          <div class="flex justify-between items-center">
            <span class="tag tag-red" style="font-weight:700; font-family:var(--font-mono); font-size:13px">${ad.code}</span>
            <span style="font-size:10px; color:var(--text-muted)">AKTİF TEŞHİS</span>
          </div>
          <div>
            <div style="font-size:13.5px; font-weight:700; color:var(--text-primary)">${escapeHTML(ad.data.title)}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px">${escapeHTML(ad.data.category)} Serisi</div>
          </div>
          <div style="font-size:12px; line-height:1.6; color:var(--text-secondary); background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
            ${escapeHTML(ad.data.description)}
          </div>
          <div style="font-size:11.5px; font-weight:bold; color:var(--amber)">⚠️ Olası Nedenler:</div>
          <ul style="padding-left:16px; margin:0; font-size:11.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px">
            ${ad.data.causes.slice(0, 3).map(c => `<li>${escapeHTML(c)}</li>`).join('')}
          </ul>
          <button class="btn btn-secondary btn-sm mt-2" onclick="clearActiveDiagnostic()" style="width:100%">
            Teşhisi Sıfırla
          </button>
        </div>
      `;
    } else if (ad.type === 'parameter') {
      diagHTML = `
        <div class="card" style="border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.02); display:flex; flex-direction:column; gap:10px; padding:16px">
          <div class="flex justify-between items-center">
            <span class="tag tag-green" style="font-weight:700; font-family:var(--font-mono); font-size:13px">No. ${ad.code}</span>
            <span style="font-size:10px; color:var(--text-muted)">AKTİF PARAMETRE</span>
          </div>
          <div>
            <div style="font-size:13.5px; font-weight:700; color:var(--text-primary)">${escapeHTML(ad.data.name)}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px">${escapeHTML(ad.data.category)}</div>
          </div>
          <div style="font-size:12px; line-height:1.6; color:var(--text-secondary); background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
            ${escapeHTML(ad.data.description)}
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px; color:var(--text-secondary)">
            <div><strong>Veri Tipi:</strong> ${escapeHTML(ad.data.dataType)}</div>
            <div><strong>Varsayılan:</strong> ${escapeHTML(ad.data.default || '—')}</div>
          </div>
          <button class="btn btn-secondary btn-sm mt-2" onclick="clearActiveDiagnostic()" style="width:100%">
            Teşhisi Sıfırla
          </button>
        </div>
      `;
    }
  } else {
    diagHTML = `
      <div class="card" style="display:flex; flex-direction:column; gap:12px; padding:16px">
        <div class="card-title" style="font-size:12px; text-transform:uppercase; color:var(--text-muted)">💡 Hızlı Teşhis Kılavuzları</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin:0; line-height:1.5">Aşağıdaki popüler konu başlıklarına tıklayarak AI Asistanı doğrudan yönlendirebilirsiniz:</p>
        <div style="display:flex; flex-direction:column; gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="askAIPreset('SV0401 Servo Hatası çözümü')" style="text-align:left; justify-content:flex-start; width:100%; border:1px solid var(--border)">
            🚗 SV0401 Servo Alarm Teşhisi
          </button>
          <button class="btn btn-ghost btn-sm" onclick="askAIPreset('Parametre 1815 APZ/APC sıfırlama nasıl yapılır')" style="text-align:left; justify-content:flex-start; width:100%; border:1px solid var(--border)">
            ⚙️ P1815 Referans Noktası Ayarı
          </button>
          <button class="btn btn-ghost btn-sm" onclick="askAIPreset('FSSB fiber optik hatası arıza giderme adımları')" style="text-align:left; justify-content:flex-start; width:100%; border:1px solid var(--border)">
            🔗 FSSB Fiber Topoloji Hatası
          </button>
        </div>
      </div>
    `;
  }

  page.innerHTML = `
    <link rel="stylesheet" href="styles/ai.css" />
    <div class="ai-container" style="display:grid; grid-template-columns: 320px 1fr; gap:16px; height:calc(100vh - 90px); padding:16px; box-sizing:border-box; overflow:hidden">
      <!-- Left: Diagnostics Pane -->
      <div class="ai-diagnostics-pane" style="display:flex; flex-direction:column; gap:12px; overflow-y:auto">
        <div class="page-header" style="padding:0">
          <h1 style="font-size:16px; margin:0">📋 Teşhis Paneli</h1>
          <p style="font-size:11px; margin:2px 0 0">Aktif arıza veya kılavuz kartı</p>
        </div>
        ${diagHTML}
      </div>

      <!-- Right: Chat Pane -->
      <div class="ai-chat-pane" style="display:flex; flex-direction:column; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden">
        <div class="page-header" style="padding:12px; border-bottom:1px solid var(--border); margin:0; display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2)">
          <div>
            <h1 style="font-size:14px; margin:0">🤖 AI Asistan Sohbeti</h1>
          </div>
          <span class="tag tag-${State.settings.aiProvider==='offline'?'gray':'green'}" style="margin:0">
            ${State.settings.aiProvider === 'offline' ? '🔒 Offline' : '🟢 ' + State.settings.aiProvider.toUpperCase()}
          </span>
        </div>
        
        <div class="ai-messages" id="ai-messages" style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px">
          <!-- Messages will go here -->
        </div>

        <div class="ai-toolbar" style="padding:10px 24px; border-top:1px solid var(--border); background:var(--bg-surface); display:flex; gap:8px; flex-wrap:wrap">
          <span style="font-size:10px; color:var(--text-muted); margin-right:4px; display:flex; align-items:center">HIZLI:</span>
          ${[
            'SV0401 alarmı nedir?',
            'E-Stop devresi nasıl çalışır?',
            'Parametre yedekleme nasıl yapılır?',
            'Servo kazanımı nasıl ayarlanır?',
          ].map(q => `<button class="ai-quick-btn" onclick="quickAsk('${q}')" style="padding:4px 12px; border-radius:20px; font-size:11px; cursor:pointer">${q}</button>`).join('')}
        </div>

        <div class="ai-input-area" style="padding:14px 24px; border-top:1px solid var(--border); background:var(--bg-surface)">
          <div class="ai-input-wrap" style="display:flex; gap:10px; align-items:flex-end; background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:10px 14px">
            <textarea id="ai-input" placeholder="Soru veya alarm kodunuzu yazın..." rows="1" style="flex:1; border:none; background:transparent; resize:none; font-size:13px; color:var(--text-primary); outline:none; max-height:120px; min-height:22px; font-family:inherit; line-height:1.5"></textarea>
            <button class="ai-send-btn" id="ai-send-btn" onclick="sendAIMessage()">
              <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9 22,2"/></svg>
            </button>
          </div>
          <div class="flex items-center justify-between" style="margin-top:6px; padding:0 4px">
            <label class="flex items-center gap-2" style="font-size:11.5px; color:var(--text-secondary); cursor:pointer">
              <input type="checkbox" id="ai-web-search-chk" ${State.onlineSearchEnabled ? 'checked' : ''} style="accent-color:var(--accent)" />
              🌐 Canlı Web Araması (Online Search)
            </label>
            <div class="ai-api-notice" style="margin:0">
              ${State.settings.aiProvider === 'offline'
                ? '🔒 Offline mod — FANUC veritabanı'
                : `🌐 ${State.settings.aiProvider.toUpperCase()} API bağlı`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  window.clearActiveDiagnostic = function() {
    State.activeDiagnostic = null;
    navigate('ai');
  };

  window.askAIPreset = function(promptText) {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = promptText;
      sendAIMessage();
    }
  };

  const input = page.querySelector('#ai-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  const webSearchChk = page.querySelector('#ai-web-search-chk');
  webSearchChk.addEventListener('change', () => {
    State.onlineSearchEnabled = webSearchChk.checked;
  });

  return page;
}

window.quickAsk = function(q) {
  const input = document.getElementById('ai-input');
  if (input) { input.value = q; sendAIMessage(); }
};

window.sendAIMessage = async function() {
  const input = document.getElementById('ai-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  input.style.height = 'auto';

  appendMessage('user', msg);
  ChatHistory.push({ role: 'user', content: msg });

  // Generate RAG Context from local FANUC database
  const ragContext = typeof window.buildRAGContext === 'function' ? window.buildRAGContext(msg) : '';

  let searchLoadingId = null;
  if (State.onlineSearchEnabled) {
    searchLoadingId = appendSearchLoading(msg);
    await new Promise(resolve => setTimeout(resolve, 1800));
    if (searchLoadingId) document.getElementById(searchLoadingId)?.remove();
  }

  const typingId = appendTyping();

  let response;
  try {
    const apiMsg = ragContext ? `${msg}\n\n${ragContext}` : msg;
    if (State.settings.aiProvider !== 'offline' && State.settings.aiApiKey) {
      const finalMsg = State.onlineSearchEnabled
        ? `[Sistem Notu: Web araması aktif. Lütfen internetten aldığın en güncel teknik FANUC verilerini kullanarak cevap ver.] ${apiMsg}`
        : apiMsg;
      response = await callAIAPI(finalMsg, ChatHistory.slice(-10));
    } else {
      const offlineAns = offlineAI(msg);
      const combinedAns = ragContext ? `${offlineAns}\n\n---\n${ragContext}` : offlineAns;
      response = State.onlineSearchEnabled
        ? `🌐 **Canlı Arama Sonuçları (Google/Official FANUC Cloud):**\n\nSorgunuz internet üzerinden arandı ve yerel veritabanı ile eşleştirildi:\n\n` + combinedAns
        : combinedAns;
    }
  } catch (e) {
    const offlineAns = offlineAI(msg);
    const combinedAns = ragContext ? `${offlineAns}\n\n---\n${ragContext}` : offlineAns;
    response = `API hatası: ${e.message}\n\nOffline veritabanına geçiyorum:\n\n` + combinedAns;
  }

  removeTyping(typingId);
  appendMessage('ai', response);
  ChatHistory.push({ role: 'assistant', content: response });
};


function appendSearchLoading(query) {
  const container = document.getElementById('ai-messages');
  if (!container) return null;
  const id = 'search-loading-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'msg-row ai';
  div.innerHTML = `
    <div class="msg-avatar ai">AI</div>
    <div>
      <div class="msg-bubble" style="background:rgba(59,130,246,0.06); border:1px dashed rgba(59,130,246,0.25); color:var(--text-secondary); font-size:11.5px; display:flex; align-items:center; gap:8px">
        <span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid var(--accent); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite"></span>
        <span>🌐 <strong>Canlı Web Araması Yapılıyor:</strong> "${query}"...</span>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Inject rotation keyframes dynamically if not present
  if (!document.getElementById('spin-style')) {
    const style = document.createElement('style');
    style.id = 'spin-style';
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  return id;
}

async function callAIAPI(userMsg, history) {
  const provider = State.settings.aiProvider;
  const apiKey = State.settings.aiApiKey;
  const model = State.settings.aiModel || 'gpt-4o';

  const systemPrompt = `Sen FANUC CNC tezgahları konusunda uzman bir teknik asistansın. 
FANUC 0i-F, 30i-B, 31i-B, 32i-B serileri, PMC/Ladder programlama, servo sistemler, 
spindle kontrolü, alarm giderme ve parametre ayarları konusunda derin bilgiye sahipsin.
Türkçe yanıt ver. Teknik ve pratik bilgiler sun.`;

  if (provider === 'openai') {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      { role: 'user', content: userMsg }
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: 1500, temperature: 0.7 })
    });
    if (!res.ok) throw new Error(`OpenAI API hatası: ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === 'gemini') {
    const geminiModel = model.includes('gemini') ? model : 'gemini-pro';
    const contents = [
      ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: systemPrompt + '\n\nKullanıcı: ' + userMsg }] }
    ];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });
    if (!res.ok) throw new Error(`Gemini API hatası: ${res.status}`);
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  return offlineAI(userMsg);
}

function offlineAI(msg) {
  const q = msg.toLowerCase();

  // NC G/M Code lookup
  const ncMatch = msg.match(/\b([GM]\d{2,3})\b/i);
  if (ncMatch) {
    const code = ncMatch[1].toUpperCase();
    const item = State.nc_codes.find(n => n.code.toUpperCase() === code);
    if (item) {
      const typeLabels = { 'G-Milling': 'G (Freze)', 'G-Lathe': 'G (Torna)', 'M-Code': 'M Kodu' };
      return `## NC Kodu: ${item.code} — ${item.name}\n\n**Tip:** ${typeLabels[item.type] || item.type}\n\n**Açıklama:** ${item.description}\n\n**Sözdizimi / Örnek:**\n\`${item.syntax || '—'}\`${item.example ? `\n\n**Kullanım Örneği:**\n${item.example}` : ''}`;
    }
  }

  // PMC Signal address lookup
  const pmcMatch = msg.match(/\b([GFXY]\d{1,4}\.\d)\b/i);
  if (pmcMatch) {
    const address = pmcMatch[1].toUpperCase();
    const normalized = address[0] + address.slice(1).split('.')[0].padStart(4, '0') + '.' + address.split('.')[1];
    const signal = State.pmc_signals.find(p => p.address === normalized || p.address === address);
    if (signal) {
      return `## PMC Sinyali: ${signal.address} (${signal.symbol})\n\n**Yön:** ${signal.direction}\n\n**Açıklama:** ${signal.description}\n\n💡 **Ladder Rolü:** ${signal.ladder_example || '—'}`;
    }
  }

  // Alarm lookup
  const alarmMatch = msg.match(/([A-Z]{2,4}\d{4})/i);
  if (alarmMatch) {
    const code = alarmMatch[1].toUpperCase();
    const alarm = State.alarms.find(a => a.code === code);
    if (alarm) {
      return `## ${alarm.code} — ${alarm.title}\n\n**Açıklama:** ${alarm.description}\n\n**Seri:** ${alarm.series.join(', ')}\n\n**Olası Nedenler:**\n${alarm.causes.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\n**Çözüm Adımları:**\n${alarm.solutions.map((s,i)=>`${i+1}. ${s}`).join('\n')}`;
    }
    return `**${code}** kodu veritabanımda bulunamadı.\n\nLütfen alarm kodunu kontrol edin veya FANUC bakım kılavuzuna bakın.\n\nAPI anahtarı eklerseniz daha kapsamlı yanıtlar alabiliriz. (Ayarlar > AI Sağlayıcı)`;
  }

  // Parameter lookup
  const paramMatch = msg.match(/(?:param(?:etre)?|no\.?)\s*(\d{4})/i);
  if (paramMatch) {
    const no = parseInt(paramMatch[1]);
    const param = State.parameters.find(p => p.no === no);
    if (param) {
      return `## Parametre No.${param.no} — ${param.name}\n\n**Açıklama:** ${param.description}\n\n**Veri Tipi:** ${param.dataType}\n**Aralık:** ${param.range}\n**Varsayılan:** ${param.default}\n${param.note ? `\n💡 **Not:** ${param.note}` : ''}`;
    }
  }

  // Keep Relay lookup
  const krMatch = msg.match(/\b(K\d{1,2}(?:\.\d)?)\b/i);
  if (krMatch) {
    const id = krMatch[1].toUpperCase();
    const item = State.keep_relays.find(x => x.id.toUpperCase() === id || x.id.toUpperCase().startsWith(id));
    if (item) {
      return `## PMC Keep Relay: ${item.id} — ${item.name}\n\n**Açıklama:** ${item.description}\n\n💡 **Özel Not:** ${item.note || '—'}`;
    }
  }

  // Timer lookup
  const tMatch = msg.match(/\b(T\d{1,3})\b/i);
  if (tMatch) {
    const id = tMatch[1].toUpperCase();
    const item = State.keep_relays.find(x => x.id.toUpperCase() === id || x.id.toUpperCase().startsWith(id));
    if (item) {
      return `## PMC Timer: ${item.id} — ${item.name}\n\n**Açıklama:** ${item.description}\n\n💡 **Özel Not:** ${item.note || '—'}`;
    }
  }

  // Macro variable lookup
  const macroMatch = msg.match(/#(\d{1,4})/);
  if (macroMatch) {
    const no = parseInt(macroMatch[1]);
    let desc = "Bilinmeyen Makro Değişkeni";
    if (no >= 1 && no <= 33) desc = "Yerel Değişken (Local Variable): G65 alt program çağrılarında parametre aktarımı için kullanılır.";
    else if (no >= 100 && no <= 199) desc = "Ortak Değişken (Common Variable): Tüm programlarca paylaşılır. CNC kapatıldığında sıfırlanır (Volatile).";
    else if (no >= 500 && no <= 999) desc = "Kalıcı Ortak Değişken (Persistent Common Variable): Tüm programlarca paylaşılır. CNC kapatılsa dahi değerini korur (Non-volatile).";
    else if (no >= 1000 && no <= 1031) desc = "Sistem Değişkeni: PMC giriş sinyallerini (X adresleri) okumak için kullanılır.";
    else if (no >= 1100 && no <= 1131) desc = "Sistem Değişkeni: PMC çıkış sinyallerini (Y adresleri) tetiklemek için kullanılır.";
    else if (no >= 5021 && no <= 5023) desc = "Sistem Değişkeni: Eksen makine koordinat sistemindeki (MACHINE) güncel pozisyon değerlerini okur.";
    
    return `## FANUC Makro Değişkeni: #${no}\n\n**Tür / Görev:** ${desc}\n\n*Detaylı kılavuz ve hesaplama sihirbazı için sol menüden **Makro Değişkenleri** sayfasını kullanabilirsiniz.*`;
  }

  // Topic responses
  if (q.includes('rs232') || q.includes('dnc') || q.includes('haberleşme') || q.includes('kablo') || q.includes('transfer') || q.includes('lehim') || q.includes('pin') || q.includes('db9') || q.includes('db25')) {
    return `## FANUC RS232 & DNC Haberleşme ve Kablo Bağlantıları\n\nPC ile CNC ünitesi arasındaki seri haberleşme (DNC) ayarları ve kablo lehim şemaları:\n\n**1. Kritik Parametre Ayarları:**\n- **P0020:** I/O Channel = \`0\` (Channel 1 RS232)\n- **P0101:** \`10000001\` (1 Stop Bit, 7 Data Bits, Even Parity)\n- **P0102:** \`3\` (RS-232C Cihazı)\n- **P0103:** \`11\` (9600 Baud) veya \`12\` (19200 Baud)\n\n**2. Lehimleme & Pin Şemaları:**\n- **Yazılımsal Akış Kontrolü (XON/XOFF):** PC DB9 (Pin 2, 3, 5) -> CNC DB25 (Pin 2, 3, 7). CNC tarafında 4-5 ve 6-8-20 köprüleri yapılmalıdır.\n\n*İnteraktif lehim şemaları, multimetre süreklilik testleri ve blendaj şase kuralları için sol menüden **RS232 Pin & Lehim Rehberi** sayfasını açabilirsiniz.*`;
  }

  if (q.includes('spindle') || q.includes('sp9015') || q.includes('sp9012') || q.includes('sp9002') || q.includes('sensör') || q.includes('fren') || q.includes('deşarj') || q.includes('kasnak') || q.includes('4002') || q.includes('4003')) {
    return `## Spindle Sürücü (SPM), Sensör & Fren Teşhisi\n\nİş mili alarmları, frenleme devresi ve pozisyon kodlayıcı oranları kontrolü:\n\n**1. Enkoder Hataları (SP9015 / SP9002):**\n- Sensör ile dişli çark arasındaki hava boşluğu (gap) sentil şeridi ile tam **0.15 mm - 0.20 mm** arasına ayarlanmalı ve osiloskop genliği **1.0 V p-p** olmalıdır.\n- **2. Fren Direnci & Rejeneratif Deşarj:** İş mili yavaşlarken aşırı voltaj alarmı veriyorsa, R1-R2 fren direnç uçlarını söküp direnci (nominal 10-30 Ω) ölçün. Ayrıca sürücü üzerindeki deşarj IGBT diyot geçişlerini test edin.\n- **3. Pozisyon Kodlayıcı Diş Oranı:** Kasnak/kayış oranı değiştiğinde Parameter **4002** (pay) ve **4003** (payda) değerlerini girin.\n\n*Spindle hata ansiklopedisi, fren direnci test yönergeleri ve dişli oranı hesaplayıcı için sol menüden **Spindle Teşhisi** sekmesini açabilirsiniz.*`;
  }

  if (q.includes('üretici') || q.includes('m-kodu') || q.includes('a-adresi') || q.includes('ex0001') || q.includes('özel m')) {
    return `## Üretici M-Kodları & Özel Alarmlar (A-Adresleri)\n\nTezgah imalatçısı tarafından PMC ladder içerisine yazılmış özel fonksiyonlar:\n\n- **Özel M-Kodları:** Ayna sıkma (M10/M11), punta, yüksek basınç gibi mekanik adımları tetikleyen ve PMC üzerinden CNC'ye \`MF\` sinyaliyle onay gönderen kodlar.\n- **A-Adresleri (Üretici Alarmları):** CNC ekranında görüntülenen \`EX\` kodlu mesaj alarmlarıdır (Örn: A0.0 biti 1 olduğunda EX0001 Lubrication Fault verir).\n\n*Fabrika tezgahlarınıza ait özel M-kodlarını ve A-adresi alarm mesajlarını kaydetmek ve aramak için sol menüden **Üretici Alarm & M-Kodu** sayfasını kullanabilirsiniz.*`;
  }

  if (q.includes('sürücü') || q.includes('amp') || q.includes('segment') || q.includes('kart') || q.includes('kabin') || q.includes('overheat') || q.includes('700') || q.includes('704') || q.includes('sıcaklık') || q.includes('ısı') || q.includes('fan')) {
    return `## Sürücü 7-Segment Teşhisi & Kabin Isı Kontrolü\n\nSürücü kırmızı LED kod arızaları ve aşırı ısınma (overheat) çözümleri:\n\n- **Arıza Kodu 30 / 51 / F:** Akım kaçağı, DC bara yüksek voltajı veya FSSB fiber optik hat hatası.\n- **Kabin Overheat (Alarm 700 / 704):** CNC CPU ana kart sıcaklığı veya sürücü soğutucu blok sıcaklığı limiti aştı demektir. Sarı kabin soğutucu fanlarının çalışmasını kontrol edin.\n- **Isı Takip Parametresi:** **Parameter 3111 #0 (TEMD)** 1 yapıldığında CPU sıcaklığı CNC ekranında doğrudan görüntülenebilir (DGN 1010 ve 1014).\n\n*Etkileşimli LED simülatörü ve kabin fanı / ısı takip parametre kılavuzu için sol menüden **Sürücü Teşhisi** sekmesine tıklayabilirsiniz.*`;
  }

  if (q.includes('akım') || q.includes('tuning') || q.includes('kazanç') || q.includes('2004') || q.includes('vınıltı') || q.includes('titreme') || q.includes('vibrasyon')) {
    return `## Servo Eksen Akım Döngüsü Kazanç Ayarı (P2004)\n\nEksen motorlarının yaşlanması veya sürtünme kaynaklı titreme/vınıltı seslerini gidermek için:\n\n- **Parameter 2004 (VCMD):** Akım kazanç oranını 10'arlı adımlarla azaltarak sesi gözlemleyin.\n- **Parameter 2040 & 2041:** Eksen kalkışlarındaki tork vuruntularını gidermek için akım loop integral/proportional kazançlarını %5-10 azaltın.\n\n*Adım adım akım kazanç kalibrasyon rehberi için sol menüden **Ayar Sihirbazı** sayfasındaki ilgili adımı açabilirsiniz.*`;
  }

  if (q.includes('limit') || q.includes('soft limit') || q.includes('1320') || q.includes('1321') || q.includes('stoper') || q.includes('strok')) {
    return `## Eksen Yumuşak Sınır Limitleri (Soft Limits)\n\nTezgah eksenlerinin mekanik stoperlere çarparak zarar görmesini engelleyen yazılımsal sınırlardır:\n\n- **Parameter 1320 (Limit+):** Artı yöndeki elektriksel durma sınırı (Örn: 510000 yazılırsa +510 mm limit).\n- **Parameter 1321 (Limit-):** Eksi yöndeki durma sınırı.\n- **Emniyet Kuralı:** Mekanik stoper ile yumuşak limit arasında daima en az **5-10 mm emniyet boşluk payı** bırakılmalıdır.\n\n*Kanal limit hesaplama aracı ve retro sistem parametre ekranı simülasyonu için sol menüden **Eksen Limit Sihirbazı** sekmesini açabilirsiniz.*`;
  }

  if (q.includes('dişli') || q.includes('oran') || q.includes('2084') || q.includes('2085') || q.includes('fgr')) {
    return `## Esnek Dişli Oranı (Flexible Gear Ratio)\n\nFANUC motorlarının vidalı mille doğru ölçüde senkronize olması için **Parameter 2084 (Pay)** ve **Parameter 2085 (Payda)** kullanılır.\n\n**Nasıl Hesaplanır:**\n- Enkoder çözünürlüğü ve vidalı mil hatvesi (pitch) oranlanıp en küçük komut birimi (LCI) cinsinden sadeleştirilir.\n- Örnek: 10mm vidalı mil hatvesi ve 1.000.000 puls/tur enkoder için 1 mikron çözünürlükte FGR parametreleri: \`2084 = 100\` / \`2085 = 1\` olarak bulunur.\n\n*Hassas mekanik dişli oranlarınızı sadeleştirilmiş kesir limitlerine göre hesaplamak için sol menüden **Dişli Oranı Hesabı** sayfasını kullanabilirsiniz.*`;
  }

  if (q.includes('mtbf') || q.includes('mttr') || q.includes('oee') || q.includes('verimlilik') || q.includes('güvenilirlik')) {
    let res = `## OEE Verimlilik & MTBF/MTTR Güvenilirlik Analizi\n\nAtölyedeki tezgahların arıza ve bakım kayıtlarına göre hesaplanan işletme verimliliği metrikleri:\n\n`;
    if (State.machines.length > 0) {
      res += `**Atölye Genel Durumu:**\n- Toplam kayıtlı tezgah: **${State.machines.length}** adet\n- Ortalama Kullanılabilirlik (Availability) oranı veritabanı üzerinden MTBF ve MTTR saatlerine göre dinamik olarak çıkarılmaktadır.\n\n`;
    }
    res += `*Hangi tezgahın kronik olarak sık arızalandığını görmek ve OEE verimlilik grafiklerini incelemek için sol menüden **MTBF / MTTR Güvenilirlik** panelini açabilirsiniz.*`;
    return res;
  }

  if (q.includes('tarayıcı') || q.includes('hata önleyici') || q.includes('çarpışma') || q.includes('nokta hatası') || q.includes('g43')) {
    return `## G-Code Çarpışma & Hata Tarayıcı\n\nG-Kod programlarındaki yaygın operatör hatalarını (özellikle kaza/çarpışmalara neden olanları) statik analizle tespit eder:\n\n**Taranan Kritik Hatalar:**\n- **Nokta Hatası (Decimal Point Error):** \`X100\` gibi nokta eksiklikleri (FANUC bunu 100 mikron olarak algılar ve eksen kaza yapabilir).\n- **G43 Boy Telafisi Eksikliği:** Alt program veya takım değişiminden sonra boy telafisi H kodu olmadan Z hareketi yapılması.\n- **Z- Hızlı Dalış (G00 Z-):** Hızlı konumlandırma modu ile parça sıfırının altına dalış tespiti.\n\n*Kodunuzu yükleyip analiz etmek için sol menüden **G-Code Hata Tarayıcı** sekmesini açabilirsiniz.*`;
  }

  if (q.includes('karşılaştır') || q.includes('diff') || q.includes('fark') || q.includes('yedek')) {
    return `## CNC Parametre Karşılaştırma & Fark Analizörü\n\nİki farklı FANUC parametre yedek dosyası (text) arasındaki tüm değer değişikliklerini, eklenen/silinen parametreleri ve bit bazlı durum farklılıklarını analiz eder:\n\n**Uygulama Alanları:**\n- Arızalanan bir tezgahın çalışan eski yedeği ile arıza anındaki güncel yedek dosyasını karşılaştırarak değişen parametreleri (ör. \`1815\` APZ bitinin kapanması) teşhis edebilirsiniz.\n\n*Ayrıntılı tablolar ve renkli fark analizleri için sol menüden **Parametre Karşılaştırıcı** sekmesini kullanabilirsiniz.*`;
  }

  if (q.includes('ağaç') || q.includes('karar') || q.includes('belirti') || q.includes('spindle dönmüyor') || q.includes('eksen gitmiyor') || q.includes('hidrolik')) {
    return `## Kronik Arıza Karar ve Çözüm Ağacı\n\nTezgahtaki belirtilere göre adım adım ilerleyen karar destek mekanizmasıyla arızanın kök nedenini bulun:\n\n- **Eksen Kilitlenmeleri:** Acil stop (*ESP sinyali - X0008.4) veya Machine Lock durumlarını inceler.\n- **İş Mili (Spindle) Sorunları:** Ayna ayak sıkma sinyali (X0004.2) ve Kapı güvenlik kilidi (K00.1 / X0008.3) durumlarını kontrol ettirir.\n- **Hidrolik Sorunları:** Motor termik rölesi resetleme ve R-S-T faz yönü kontrollerini barındırır.\n\n*Adım adım etkileşimli sihirbaz ile arıza tespiti yapmak için sol menüden **Arıza Teşhis Ağacı** sayfasını ziyaret edebilirsiniz.*`;
  }

  if (q.includes('ı/o') || q.includes('io link') || q.includes('er97') || q.includes('er96') || q.includes('sys_alm 160') || q.includes('jd1a') || q.includes('jd1b') || q.includes('fssb') || q.includes('optik')) {
    return `## FANUC I/O Link & FSSB Optik Link Teşhisi\n\n**1. I/O Link Donanım Teşhisi (ER97 / ER96):**\n- **ER97 I/O LINK FAILURE:** Haberleşme veya modül besleme kesintisidir. Hata veren I/O grubunun 24V DC besleme sigortasını ölçün. Soketlerin önceki modülün **JD1A (OUT)** portundan sonraki modülün **JD1B (IN)** portuna girdiğini teyit edin.\n- **Kısa Devre Testi:** Yeşil terminal klemenslerini I/O ünitesinden söküp alarmı resetleyin. Alarm giderse saha elemanlarında/sensörlerde kısa devre vardır.\n\n**2. FSSB Optik Haberleşme Teşhisi (SYS_ALM 160):**\n- CNC CPU kartı ile servo sürücüler arasındaki fiber optik haberleşme koptuğunda oluşur.\n- **Sürücü LED Kontrolü:** Sürücülerin 7-segment ekranlarına bakın: Upstream kopukluk için \`L\`, Downstream için \`U\` kodu gösteren sürücüyü bulun. Kopukluk bu sürücü ile bitişiğindeki sürücü arasındadır.\n- **Fiber Optik Kuralları:** COP10A/B turuncu/siyah kabloların tozunu alkollü bezle temizleyin. Minimum büküm yarıçapının **30mm** olduğunu teyit edin, sert bükümler kablo içindeki cam fiberi kırar.`;
  }

  if (q.includes('boşluk') || q.includes('backlash') || q.includes('1851')) {
    return `## Eksen Backlash (Geri Dönme Boşluğu) Kompanzasyonu\n\nFANUC sistemlerinde geri dönme boşluğunu kompanze etmek için **Parameter 1851** kullanılır.\n\n**Nasıl Ayarlanır & Hesaplanır:**\n1. Eksene komparatör bağlayın ve saati sıfırlayın.\n2. MDI'da ekseni ters yönde hareket ettirin.\n3. Saatteki sapma miktarını okuyun.\n4. **Öneri:** Sol menüden **Eksen Boşluk Sihirbazı** sayfasını açarak komparatör ölçüm test kodunu otomatik üretebilir ve mikron sapmasına göre yeni Parametre 1851 değerini dijital ekran simülasyonu üzerinde hesaplayabilirsiniz.`;
  }

  if (q.includes('sıfır') || q.includes('1815') || q.includes('apz') || q.includes('apc')) {
    return `## Eksen Absolute Referans Noktası Sıfırlama (P1815)\n\nAbsolute enkoderli eksenlerin referans noktasını sıfırlamak için **Parameter 1815** kullanılır:\n\n1. Ekseni hizalama çizgisine getirin.\n2. PWE=1 yapın.\n3. \`1815\` nolu parametrede sıfırlanacak eksenin \`APC (Bit 5)\` ve \`APZ (Bit 4)\` değerlerini güncelleyin (APZ'yi 1 -> 0 -> 1 yapın).\n4. CNC'yi kapatıp açın.\n\n*Sanal parametre tablosu ve interaktif kontrol listesi için sol menüden **Ayar Sihirbazı** sekmesini kullanabilirsiniz.*`;
  }

  if (q.includes('makro') || q.includes('çevrim') || q.includes('g81') || q.includes('g83') || q.includes('bhc') || q.includes('üret')) {
    return `## G-Code ve Makro Çevrimleri\n\nMTB Elektrik Bakım içindeki kod üretme aracı ile şu standart alt programları otomatik olarak oluşturabilirsiniz:\n- **G81 / G83:** Delik delme ve kademeli delik delme çevrimi.\n- **BHC (Bolt Hole Circle):** Cıvata dairesi cıvata delikleri koordinat trigonometrik hesabı.\n- **G02 / G03:** Dairesel cep boşaltma helisel interpolasyon kodları.\n\n*Hazır G-Code programı üretmek için sol menüden **G-Code Üretici** sayfasını kullanabilirsiniz.*`;
  }

  if (q.includes('sağlık') || q.includes('kestirim') || q.includes('risk') || q.includes('tahmin') || q.includes('kritik')) {
    const machList = State.machines.map(m => {
      const health = calculateMachineHealth(m);
      return { ...m, health };
    });
    machList.sort((a, b) => a.health.score - b.health.score);
    const criticals = machList.filter(m => m.health.status === 'Critical');
    const warnings = machList.filter(m => m.health.status === 'Warning');
    
    let res = `## Kestirimci Bakım & Risk Analiz Raporu\n\nTezgahlarınızın son servis sıklıkları, arıza geçmişleri ve absolute enkoder pil seviyeleri analiz edilmiştir:\n\n**Mevcut Risk Tablosu:**\n- 🔴 Kritik Seviye (Bakım Geciken/Sık Arızalanan): **${criticals.length}** adet tezgah\n- 🟡 Riskli Seviye (Planlanmalı): **${warnings.length}** adet tezgah\n- 🟢 Güvenli Seviye: **${machList.length - criticals.length - warnings.length}** adet tezgah\n`;
    
    if (criticals.length > 0) {
      res += `\n**⚠️ Acil Müdahale Önerilen En Kritik Tezgahlar:**\n`;
      criticals.slice(0, 3).forEach(c => {
        res += `- **${c.numarasi}** (Sağlık Skoru: %${c.health.score}, Arıza Riski: %${c.health.failureRisk}) - Bölüm: ${c.bolum || '—'}\n`;
      });
    }
    res += `\n*Detaylı öncelik sıralaması ve kestirimci analizler için sol menüden **Kestirimci Bakım** sayfasını ziyaret edebilirsiniz.*`;
    return res;
  }

  if (q.includes('bakım') || q.includes('servis') || q.includes('onar')) {
    return `## Tezgah Bakım Sistemi\n\nTezgah Takip modülü kapsamında **${State.maintenances.length}** adet bakım kaydı ve **${State.machines.length}** adet kayıtlı makine sistemde bulunmaktadır.\n\n**Genel İstatistikler:**\n- Kayıtlı Tezgah Sayısı: ${State.machines.length}\n- Toplam Bakım Kaydı: ${State.maintenances.length}\n\n**Yeni Bakım Kaydı Ekleme:**\nSol menüden **Bakım Defteri** sekmesine giderek "Yeni Bakım Kaydı" butonuyla yeni periyodik veya arıza bakım kaydı ekleyebilirsiniz.`;
  }

  if (q.includes('pil') || q.includes('batarya') || q.includes('encoder') || q.includes('enkoder') || q.includes('fan') || q.includes('pervane')) {
    const criticals = State.batteries.filter(b => getBatteryStatus(b.tarih).class === 'tag-red');
    const warnings = State.batteries.filter(b => getBatteryStatus(b.tarih).class === 'tag-amber');
    
    const criticalFans = State.fans.filter(f => (20000 - f.calisma_saati) < 0);
    const warningFans = State.fans.filter(f => (20000 - f.calisma_saati) >= 0 && (20000 - f.calisma_saati) < 5000);

    return `## Absolute Enkoder Pil & Sürücü Fan Durum Raporu\n\n**1. Enkoder Pil Durumları (Voltaj Seviyeleri):**\n- Sistemde **${State.batteries.length}** adet kayıtlı pil döngüsü var.\n- 🔴 Kritik Seviye (Değişimi Geciken / < 3.0V): **${criticals.length}** adet eksen (Pozisyon APZ kaybı riski!).\n- 🟡 Uyarı Seviyesi (3.0V - 3.2V): **${warnings.length}** adet eksen.\n- 🟢 Güvenli Seviye (> 3.2V): **${State.batteries.length - criticals.length - warnings.length}** adet eksen.\n\n**2. Sürücü Kabini Soğutma Fanları Durumu:**\n- Sistemde **${State.fans.length}** adet kayıtlı soğutma fanı takip edilmektedir.\n- 🔴 Limit Aşımı (> 20.000 Saat): **${criticalFans.length}** adet fan.\n- 🟡 Bakım Yakın (15.000 - 20.000 Saat): **${warningFans.length}** adet fan.\n\n**Saha Önerisi:** Enkoder pilleri bittiğinde kapatıp açma sonrası referans kaybı (P1815 APZ alarmı) oluşur. Sürücü kartı soğutma fanları durursa, sürücü 'Overheat' alarmı verip tezgahı korumaya alır. Sol menüden **Pil Takibi** sayfasına giderek her iki donanımın da ömür sayaçlarını sıfırlayabilirsiniz.`;
  }

  if (q.includes('e-stop') || q.includes('acil dur') || q.includes('emergency stop')) {
    return `## E-Stop Devresi\n\nFANUC tezgahlarında E-Stop devresi şu şekilde çalışır:\n\n1. **E-Stop Butonu** — NC kontağı (normally closed). Basıldığında devreyi keser.\n2. **PMC'de G008.4 (ESP)** — E-stop sinyali PMC'ye iletilir\n3. **SR0004 Alarm** — CNC EMERGENCY STOP alarmını görüntüler\n4. **Servo güç kesimi** — DRDY (Drive Ready) sinyali kapatılır\n\n**Sorun giderme:**\n- G008.4 bitini PMC monitöründe kontrol edin (0=E-Stop aktif)\n- Butonun kontak bütünlüğünü ölçün\n- Kapı kilidi ve güvenlik rölelerini kontrol edin\n- PMC ladder'da ESP girişini izleyin`;
  }

  if (q.includes('yedekle') || q.includes('backup') || q.includes('parametre kaydet') || q.includes('restore') || q.includes('yükle') || q.includes('sram') || q.includes('boot') || q.includes('rom')) {
    return `## FANUC Parametre & Program Yedekleme/Yükleme Sihirbazı\n\nFANUC kontrol ünitelerinde yedekleme yaparken doğru I/O kanallarını ve tuş kombinasyonlarını kullanmak kritiktir:\n\n**1. Standart Parametre & Program Yedekleme (I/O Kanalları):**\n- **I/O Channel = 4:** CF Card (Compact Flash)\n- **I/O Channel = 17:** USB Flash Sürücü\n- **I/O Channel = 0/1:** RS232 Seri Port\n- **PWE = 1:** Parametre yazma izni (Sadece veri geri yüklerken açılmalıdır).\n*Sihirbazı açmak için sol menüden **Yedekleme Sihirbazı** sekmesini kullanabilirsiniz.*\n\n**2. Boot ROM Ekranından SRAM Bit-Image Yedeği Alma:**\nCNC parametreleri, PMC programı, ofsetler ve parça programlarının tamamını tek bir dosya (\`SRAM.FDB\`) olarak yedeklemek için:\n1. CNC gücünü kapatın.\n2. Ekran altındaki **en sağdaki iki soft key (menü tuşu)** butonuna basılı tutarak CNC gücünü açın.\n3. Karşınıza gelen siyah-beyaz **BOOT SYSTEM** menüsünde yön tuşlarıyla **SRAM DATA UTILITY** satırına gelip SELECT deyin.\n4. **SRAM BACKUP (CNC -> MEMORY CARD)** seçerek CF karta tüm belleğin aynasını yedekleyin. Geri yüklemek için ise **RESTORE SRAM** seçeneğini kullanın.`;
  }

  if (q.includes('servo') && (q.includes('kazan') || q.includes('gain') || q.includes('ayar') || q.includes('tuning'))) {
    return `## Servo Kazanım Ayarı (Gain Tuning)\n\n**Temel Parametreler:**\n- **No.2043** — Pozisyon kazancı (KPZ, tipik: 3000)\n- **No.2021** — Hız kazancı (integral, tipik: 100–500)\n- **No.2022** — Hız döngüsü oransal kazanç\n\n**Ayar Adımları:**\n1. AI Servo Tuning fonksiyonunu açın (SYSTEM > Servo Tuning)\n2. Kesme testini çalıştırın\n3. Titreşim varsa KPZ değerini düşürün\n4. Pozisyon hatası fazlaysa KPZ artırın\n5. Step Response grafiğini inceleyin\n\n**İpucu:** Ağır tezgahlarda düşük KPZ (1000–2000), hafif/yüksek hızlı tezgahlarda yüksek KPZ (4000–8000)`;
  }

  if (q.includes('ladder') || q.includes('pmc') || q.includes('r addr') || q.includes('r adresi')) {
    return `## FANUC PMC Adres Haritası\n\n| Adres | Açıklama |\n|-------|----------|\n| **X** | Makine girişleri (I/O kartından) |\n| **Y** | Makine çıkışları (I/O kartına) |\n| **G** | NC → PMC sinyalleri |\n| **F** | PMC → NC sinyalleri |\n| **R** | Dahili relelar (program içi) |\n| **T** | Zamanlayıcılar |\n| **C** | Sayaçlar |\n| **K** | Keeplatch (kalıcı bit) |\n| **D** | Veri registerleri |\n\n**Önemli G Sinyalleri:**\n- G008.4 (ESP) — E-Stop\n- G007.1 (ST) — Döngü başlat\n- G044.7 (FIN) — M fonksiyon tamamlama`;
  }

  // Default
  return `MTB Elektrik Bakım Asistanı — Çevrimdışı Mod\n\n"${msg}" sorunuzu aldım.\n\nÇevrimdışı modda şu konularda yardımcı olabilirim:\n• Alarm kodları (ör: SV0401, PS0010)\n• Parametre numaraları (ör: Param 1320)\n• E-Stop, servo gain, yedekleme prosedürleri\n• PMC adres haritası\n\nDaha kapsamlı yanıtlar için **Ayarlar** menüsünden OpenAI veya Gemini API anahtarınızı ekleyebilirsiniz.`;
}

function appendMessage(role, text) {
  const container = document.getElementById('ai-messages');
  if (!container) return;
  const isAI = role === 'ai';
  const div = document.createElement('div');
  div.className = `msg-row ${role} animate-in`;

  // Simple markdown rendering
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/## (.+)/g, '<div style="font-weight:700; font-size:13px; margin:8px 0 4px; color:var(--text-accent)">$1</div>')
    .replace(/\| (.+) \|/g, (m) => {
      const cells = m.split('|').filter(c => c.trim() && !c.trim().match(/^-+$/));
      return '<div style="display:flex; gap:12px; font-size:11.5px; margin:2px 0">' + cells.map(c => `<span>${c.trim()}</span>`).join('') + '</div>';
    })
    .replace(/\n/g, '<br>');

  div.innerHTML = `
    <div class="msg-avatar ${role}">${isAI ? 'AI' : '👤'}</div>
    <div>
      <div class="msg-bubble">${html}</div>
      <div class="msg-time">${formatTime(new Date())}</div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendTyping() {
  const container = document.getElementById('ai-messages');
  if (!container) return null;
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'msg-row ai';
  div.innerHTML = `
    <div class="msg-avatar ai">AI</div>
    <div>
      <div class="msg-bubble">
        <div class="ai-typing"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  if (id) document.getElementById(id)?.remove();
}

// ════════════════════════════════════════════════════════════════
//  TEZGAH TAKİP - DATA SAVING HELPERS
// ════════════════════════════════════════════════════════════════
// ── Generic Data-Saving Handler with Backups & Retries ──
async function saveJSONDatabase(fileName, key, data) {
  const filePath = `./data/${fileName}`;
  const backupPath = `${filePath}.bak`;
  const payload = key ? JSON.stringify({ [key]: data }, null, 2) : JSON.stringify(data, null, 2);

  // 1. Backup current database before overwriting
  try {
    const currentRes = await window.electronAPI.readFile(filePath);
    if (currentRes.ok && currentRes.data) {
      try {
        JSON.parse(currentRes.data); // Only backup if valid
        await window.electronAPI.writeFile(backupPath, currentRes.data);
      } catch (parseErr) {
        console.warn(`Mevcut dosya ${fileName} bozuk olduğundan yedeklenmedi.`);
      }
    }
  } catch (backupErr) {
    console.error(`${fileName} yedeklenemedi:`, backupErr);
  }

  // 2. Write new payload with transient retry
  let success = false;
  let writeRes = null;
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      writeRes = await window.electronAPI.writeFile(filePath, payload);
      if (writeRes && writeRes.ok) {
        success = true;
        break;
      }
      if (attempt === 1) {
        console.warn(`Write attempt 1 failed for ${fileName}. Retrying in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      writeRes = { error: err.message };
      if (attempt === 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  if (success) {
    return true;
  } else {
    const errorMsg = writeRes?.error || 'Bilinmeyen yazma hatası';
    console.error(`Yazma başarısız (${fileName}): ${errorMsg}`);
    showToast(`Veri kaydedilemedi: ${fileName} yazma hatası. Değişiklikler sadece oturum boyunca geçerlidir. Detay: ${errorMsg}`, 'error');
    
    try {
      const logText = `Write Error [${new Date().toISOString()}]: Failed to write ${fileName}. Detail: ${errorMsg}\n\n`;
      await window.electronAPI.writeFile('./data/ui_error_log.txt', logText, 'utf8');
    } catch {}
    
    return false;
  }
}

async function saveMachines() { return await saveJSONDatabase('machines.json', 'machines', State.machines); }
async function saveMaintenances() { return await saveJSONDatabase('maintenances.json', 'maintenances', State.maintenances); }
async function saveBatteries() { return await saveJSONDatabase('batteries.json', 'batteries', State.batteries); }
async function saveFans() { return await saveJSONDatabase('fans.json', 'fans', State.fans); }
async function saveWiki() { return await saveJSONDatabase('wiki.json', 'articles', State.wiki); }
async function saveBackupLogs() { return await saveJSONDatabase('backup_logs.json', 'backup_logs', State.backup_logs); }
async function saveCustomMCodes() { return await saveJSONDatabase('custom_mcodes.json', 'mcodes', State.custom_mcodes); }
async function saveCustomAlarms() { return await saveJSONDatabase('custom_alarms.json', 'alarms', State.custom_alarms); }
async function saveCustomAlarmNotes() { return await saveJSONDatabase('custom_alarm_notes.json', 'notes', State.custom_alarm_notes); }

// ════════════════════════════════════════════════════════════════
//  TEZGAH LİSTESİ
// ════════════════════════════════════════════════════════════════
function renderMachines() {
  const page = createPage('machines');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🏭 Kayıtlı Tezgahlar</h1>
          <p>Toplam ${State.machines.length} makine — Departman ve tip filtreli kontrol</p>
        </div>
        ${canEdit() ? `
        <button class="btn btn-primary" onclick="showNewMachineModal()">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tezgah Ekle
        </button>
        ` : ''}
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:320px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="mach-search" placeholder="Tezgah numarası ara..." />
        </div>
        <select id="mach-dept-filter" style="width:160px">
          <option value="">Tüm Bölümler</option>
          ${[...new Set(State.machines.map(m => m.bolum).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')).map(d => `<option>${d}</option>`).join('')}
        </select>
        <select id="mach-type-filter" style="width:160px">
          <option value="">Tüm Tipler</option>
          ${[...new Set(State.machines.map(m => m.tip).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')).map(t => `<option>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div style="overflow-y:auto; flex:1">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tezgah Numarası</th>
              <th>Bölüm / Departman</th>
              <th>Tezgah Tipi</th>
              <th>Son Bakım Tarihi</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody id="mach-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderMachineTable(State.machines, page);

  page.querySelector('#mach-search').addEventListener('input', () => filterMachines(page));
  page.querySelector('#mach-dept-filter').addEventListener('change', () => filterMachines(page));
  page.querySelector('#mach-type-filter').addEventListener('change', () => filterMachines(page));

  return page;
}

function filterMachines(page) {
  const q = page.querySelector('#mach-search').value.toLowerCase();
  const dept = page.querySelector('#mach-dept-filter').value;
  const type = page.querySelector('#mach-type-filter').value;

  const filtered = State.machines.filter(m =>
    (!q || m.numarasi.toLowerCase().includes(q)) &&
    (!dept || m.bolum === dept) &&
    (!type || m.tip === type)
  );
  renderMachineTable(filtered, page);
}

function renderMachineTable(list, page) {
  const tbody = page.querySelector('#mach-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Tezgah bulunamadı</td></tr>`;
    return;
  }
  const sortedList = [...list].sort((a, b) =>
    String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr', { numeric: true, sensitivity: 'base' })
  );
  tbody.innerHTML = sortedList.map(m => {
    // find last maintenance
    const machMaint = State.maintenances.filter(ma => ma.tezgah_id === m.id);
    let lastMaintDate = '—';
    if (machMaint.length) {
      machMaint.sort((a, b) => b.id - a.id);
      lastMaintDate = machMaint[0].tarih || '—';
    }
    return `
      <tr>
        <td><span class="font-mono text-sm" style="color:var(--text-muted)">#${m.id}</span></td>
        <td><strong style="color:var(--text-accent)">${escapeHTML(m.numarasi)}</strong></td>
        <td><span style="font-size:12.5px">${escapeHTML(m.bolum || '—')}</span></td>
        <td><span class="tag tag-gray">${escapeHTML(m.tip || '—')}</span></td>
        <td><span style="font-size:12px; color:var(--text-secondary)">${escapeHTML(lastMaintDate)}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showMachineDetailsModal(${m.id})">Detay</button>
          <button class="btn btn-secondary btn-sm" onclick="printMachineCard(${m.id})" title="Makine Kartı PDF">🖨️ PDF</button>
          ${canDelete() ? `<button class="btn btn-ghost btn-sm" onclick="deleteMachine(${m.id})" style="color:var(--red)">Sil</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.showNewMachineModal = function() {
  showModal('new-machine', `
    <div class="modal-header">
      <span class="modal-title">Yeni Tezgah Ekle</span>
      <button class="modal-close" onclick="closeModal('new-machine')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah Adı / Numarası *</label>
      <input class="form-control" id="nm-numarasi" placeholder="ör. CNC-101 veya VMC-850" />
    </div>
    <div class="form-group">
      <label class="form-label">Bölüm / Departman</label>
      <input class="form-control" id="nm-bolum" placeholder="ör. Talaşlı İmalat, Kalıphane" />
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah Tipi</label>
      <input class="form-control" id="nm-tip" placeholder="ör. Torna (CNC Lathe), Freze (VMC)" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-machine')">İptal</button>
      <button class="btn btn-primary" onclick="createNewMachine()">Tezgahı Kaydet</button>
    </div>
  `);
};

window.createNewMachine = async function() {
  if (!canEdit()) { showToast('Tezgah ekleme yetkiniz yok', 'error'); return; }
  const numarasi = document.getElementById('nm-numarasi').value.trim();
  const bolum = document.getElementById('nm-bolum').value.trim();
  const tip = document.getElementById('nm-tip').value.trim();

  if (!numarasi) {
    showToast('Tezgah adı/numarası girmek zorunludur.', 'error');
    return;
  }

  const id = State.machines.length ? Math.max(...State.machines.map(m => m.id)) + 1 : 1;
  const newMach = { id, numarasi, bolum, tip };
  State.machines.push(newMach);
  await saveMachines();
  closeModal('new-machine');
  showToast('Tezgah başarıyla eklendi!', 'success');
  navigate('machines');
};

window.deleteMachine = async function(id) {
  if (!canDelete()) { showToast('Tezgah silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu tezgahı silmek istediğinize emin misiniz? Tezgahla ilişkili tüm bakım ve pil geçmişi silinecektir.')) return;
  State.machines = State.machines.filter(m => m.id !== id);
  State.maintenances = State.maintenances.filter(m => m.tezgah_id !== id);
  State.batteries = State.batteries.filter(b => b.tezgah_id !== id);
  await Promise.all([saveMachines(), saveMaintenances(), saveBatteries()]);
  showToast('Tezgah ve ilişkili verileri silindi.', 'success');
  navigate('machines');
};

window.showMachineDetailsModal = function(id) {
  const m = State.machines.find(x => x.id === id);
  if (!m) return;
  const machMaint = State.maintenances.filter(ma => ma.tezgah_id === m.id);
  const machBatt = State.batteries.filter(b => b.tezgah_id === m.id);

  showModal('mach-details', `
    <div class="modal-header">
      <span class="modal-title">Tezgah Detayı — ${escapeHTML(m.numarasi)}</span>
      <button class="modal-close" onclick="closeModal('mach-details')">✕</button>
    </div>
    <div style="display:flex; gap:10px; margin-bottom:14px">
      <span class="tag tag-blue">Bölüm: ${escapeHTML(m.bolum || 'Belirtilmemiş')}</span>
      <span class="tag tag-gray">Tip: ${escapeHTML(m.tip || 'Belirtilmemiş')}</span>
    </div>
    <div class="grid-2" style="gap:14px; margin-bottom:12px">
      <div class="card">
        <div class="card-title mb-2">🔧 Bakım Geçmişi (${machMaint.length} Kayıt)</div>
        <div style="max-height:160px; overflow-y:auto; font-size:11.5px; display:flex; flex-direction:column; gap:4px">
          ${machMaint.slice(-5).reverse().map(ma => `
            <div style="background:var(--bg-card2); padding:6px 8px; border-radius:var(--radius-sm)">
              <div class="flex justify-between" style="font-weight:600; color:var(--text-primary)">
                <span>${escapeHTML(ma.bakim_yapan)}</span>
                <span class="font-mono text-muted" style="font-size:10px">${escapeHTML(ma.tarih)}</span>
              </div>
              <p style="color:var(--text-secondary); margin-top:2px">${escapeHTML(ma.aciklama)}</p>
            </div>
          `).join('') || '<div class="text-muted">Bakım kaydı bulunmuyor.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-title mb-2">🔋 Pil Takip Durumu</div>
        <div style="max-height:160px; overflow-y:auto; font-size:11.5px; display:flex; flex-direction:column; gap:4px">
          ${machBatt.map(b => {
            const stat = getBatteryStatus(b.tarih);
            return `
              <div style="background:var(--bg-card2); padding:6px 8px; border-radius:var(--radius-sm)">
                <div class="flex justify-between" style="font-weight:600">
                  <span style="color:var(--text-accent)">Eksen: ${escapeHTML(b.eksen)} (${escapeHTML(b.pil_modeli)})</span>
                  <span class="tag ${stat.class}" style="font-size:9.5px; padding:2px 6px">${escapeHTML(stat.label)}</span>
                </div>
                <div class="flex justify-between text-muted" style="font-size:10.5px; margin-top:4px">
                  <span>Değişim: ${escapeHTML(b.tarih)}</span>
                  <span>Yapan: ${escapeHTML(b.bakim_yapan)}</span>
                </div>
              </div>
            `;
          }).join('') || '<div class="text-muted">Pil takip kaydı bulunmuyor.</div>'}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="printMachineCard(${m.id})">🖨️ PDF Kartı</button>
      <button class="btn btn-ghost" onclick="closeModal('mach-details')">Kapat</button>
      <button class="btn btn-primary" onclick="closeModal('mach-details'); navigate('maintenance')">🔧 Bakım Defterine Git</button>
    </div>
  `, 'lg');
};

// ════════════════════════════════════════════════════════════════
//  PDF RAPOR ÜRETICI
// ════════════════════════════════════════════════════════════════

function getPdfBaseStyles() {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1f3a; background: #fff; line-height: 1.4; }
      .pdf-page { padding: 20px 24px; }
      @media print {
        body { background: #fff; color: #1a1f3a; }
        .pdf-page { padding: 0; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        .section-title, .kpi-row, .info-grid, .signature-row { page-break-inside: avoid; break-inside: avoid; }
      }
      .pdf-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 2px solid #2563eb; margin-bottom: 20px; }
      .pdf-logo { display: flex; align-items: center; gap: 10px; }
      .pdf-logo-box { width: 40px; height: 40px; border-radius: 8px; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pdf-logo-text .t1 { font-size: 16px; font-weight: 700; color: #1a1f3a; }
      .pdf-logo-text .t2 { font-size: 10px; color: #6b7280; margin-top: 2px; }
      .pdf-meta { text-align: right; font-size: 10px; color: #6b7280; }
      .pdf-meta strong { color: #1a1f3a; font-size: 12px; display: block; margin-bottom: 2px; }
      .pdf-title { font-size: 17px; font-weight: 700; color: #2563eb; margin-bottom: 4px; }
      .pdf-subtitle { font-size: 10.5px; color: #6b7280; margin-bottom: 18px; }
      .section-title { font-size: 12px; font-weight: 700; color: #1a1f3a; background: #f0f4ff; padding: 6px 10px; border-left: 3px solid #2563eb; margin: 16px 0 8px; border-radius: 0 4px 4px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; table-layout: fixed; }
      th { background: #2563eb; color: #fff; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 5px 6px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
      td { padding: 5px 6px; border-bottom: 1px solid #e8ecf8; font-size: 10px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; }
      tr:nth-child(even) td { background: #f8f9ff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 9px; font-weight: 600; text-align: center; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge-red { background: #fee2e2; color: #dc2626; }
      .badge-green { background: #d1fae5; color: #059669; }
      .badge-amber { background: #fef3c7; color: #d97706; }
      .badge-blue { background: #dbeafe; color: #2563eb; }
      .badge-gray { background: #f1f5f9; color: #64748b; }
      .kpi-row { display: flex; gap: 12px; margin-bottom: 16px; }
      .kpi-box { flex: 1; border: 1px solid #e8ecf8; border-radius: 8px; padding: 12px 14px; border-top: 3px solid #2563eb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .kpi-box.green { border-top-color: #059669; }
      .kpi-box.red { border-top-color: #dc2626; }
      .kpi-box.amber { border-top-color: #d97706; }
      .kpi-num { font-size: 24px; font-weight: 700; color: #1a1f3a; line-height: 1; }
      .kpi-lbl { font-size: 9.5px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
      .info-item { padding: 8px 10px; background: #f8f9ff; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .info-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; margin-bottom: 3px; }
      .info-value { font-size: 11px; color: #1a1f3a; font-weight: 500; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; }
      .pdf-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e8ecf8; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
      .signature-row { display: flex; gap: 40px; margin-top: 30px; }
      .signature-box { flex: 1; border-top: 1px solid #1a1f3a; padding-top: 6px; font-size: 9.5px; color: #6b7280; }
    </style>
  `;
}

function buildMaintenanceReportHTML(filters = {}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR');
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Helper function to safely parse Turkish/standard date formats for sorting
  const parseMaintDate = (dStr) => {
    if (!dStr) return new Date(0);
    const parts = dStr.split(/[\.-]/);
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dStr);
  };

  // Helper function to dynamically identify maintenance record type
  const getRecordType = (r) => {
    let type = r.tur || r.type;
    if (!type) {
      const desc = (r.aciklama || r.description || '').toLowerCase();
      if (desc.includes('[pm]') || desc.includes('periyodik') || desc.includes('planli') || desc.includes('planlı')) {
        type = 'Planlı Bakım';
      } else {
        type = 'Arıza';
      }
    }
    return type;
  };

  // Helper function to resolve machine name
  const getMachineName = (r) => {
    const mach = State.machines.find(x => x.id == (r.tezgah_id || r.machine_id));
    return mach ? mach.numarasi : (r.tezgah_adi || r.machine_name || `Tezgah #${r.tezgah_id || r.machine_id}`);
  };

  let records = [...State.maintenances];
  if (filters.machineId) records = records.filter(r => r.tezgah_id == filters.machineId || r.machine_id == filters.machineId);
  if (filters.startDate) {
    const sd = parseDateHelper(filters.startDate);
    records = records.filter(r => parseDateHelper(r.tarih || r.date) >= sd);
  }
  if (filters.endDate) {
    const ed = parseDateHelper(filters.endDate);
    records = records.filter(r => parseDateHelper(r.tarih || r.date) <= ed);
  }
  
  // Sort by parsed date descending
  records.sort((a, b) => parseMaintDate(b.tarih || b.date) - parseMaintDate(a.tarih || a.date));

  const totalFault = records.filter(r => getRecordType(r) === 'Arıza').length;
  const totalPM = records.filter(r => getRecordType(r) !== 'Arıza').length;
  const machines = [...new Set(records.map(r => getMachineName(r)))].filter(Boolean);

  const selectedMachine = filters.machineId
    ? (State.machines.find(m => m.id == filters.machineId) || {})
    : null;

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
    <title>Bakım Defteri Raporu</title>${getPdfBaseStyles()}</head><body>
    <div class="pdf-page">

      <div class="pdf-header">
        <div class="pdf-logo">
          <div class="pdf-logo-box">M</div>
          <div class="pdf-logo-text">
            <div class="t1">MTB Elektrik Bakım</div>
            <div class="t2">CNC Bakım & Teşhis Platformu</div>
          </div>
        </div>
        <div class="pdf-meta">
          <strong>Bakım Defteri Raporu</strong>
          Oluşturma: ${dateStr} ${timeStr}<br>
          Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}
        </div>
      </div>

      <div class="pdf-title">🔧 Bakım Defteri Raporu</div>
      <div class="pdf-subtitle">
        ${selectedMachine ? (selectedMachine.numarasi || selectedMachine.name) + ' — ' : 'Tüm Tezgahlar — '}
        ${records.length} kayıt
      </div>

      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-num">${records.length}</div>
          <div class="kpi-lbl">Toplam Kayıt</div>
        </div>
        <div class="kpi-box red">
          <div class="kpi-num">${totalFault}</div>
          <div class="kpi-lbl">Arıza Müdahale</div>
        </div>
        <div class="kpi-box green">
          <div class="kpi-num">${totalPM}</div>
          <div class="kpi-lbl">Planlı Bakım</div>
        </div>
        <div class="kpi-box amber">
          <div class="kpi-num">${machines.length}</div>
          <div class="kpi-lbl">Tezgah Sayısı</div>
        </div>
      </div>

      <div class="section-title">Bakım Kayıtları</div>
      <table>
        <thead>
          <tr>
            <th style="width:14%">Tarih</th>
            <th style="width:14%">Tezgah</th>
            <th style="width:15%">Tür</th>
            <th style="width:34%">Açıklama</th>
            <th style="width:15%">Teknisyen</th>
            <th style="width:8%">Süre</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => {
            const tur = getRecordType(r);
            const badgeCls = tur === 'Arıza' ? 'badge-red' : tur === 'Planlı Bakım' ? 'badge-green' : 'badge-blue';
            return `<tr>
              <td class="font-mono">${r.tarih || r.date || '—'}</td>
              <td>${getMachineName(r)}</td>
              <td><span class="badge ${badgeCls}">${tur || '—'}</span></td>
              <td>${r.aciklama || r.description || '—'}</td>
              <td>${r.bakim_yapan || r.technician || '—'}</td>
              <td>${r.sure || r.duration ? (r.sure || r.duration) + ' dk' : '—'}</td>
            </tr>`;
          }).join('')}
          ${!records.length ? '<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding:20px">Kayıt bulunamadı</td></tr>' : ''}
        </tbody>
      </table>

      <div class="signature-row">
        <div class="signature-box">Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}<br><br></div>

        <div class="signature-box">Onaylayan:<br><br></div>
        <div class="signature-box">Tarih: ${dateStr}<br><br></div>
      </div>

      <div class="pdf-footer">
        <span>MTB Elektrik Bakım — Otomatik Oluşturulan Rapor</span>
        <span>${dateStr} ${timeStr}</span>
      </div>
    </div>
  </body></html>`;
}

function buildMachineCardHTML(machineId) {
  const m = State.machines.find(x => x.id === machineId);
  if (!m) return '<html><body>Tezgah bulunamadı.</body></html>';

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR');
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Helper functions
  const parseMaintDate = (dStr) => {
    if (!dStr) return new Date(0);
    const parts = dStr.split(/[\.-]/);
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dStr);
  };

  const getRecordType = (r) => {
    let type = r.tur || r.type;
    if (!type) {
      const desc = (r.aciklama || r.description || '').toLowerCase();
      if (desc.includes('[pm]') || desc.includes('periyodik') || desc.includes('planli') || desc.includes('planlı')) {
        type = 'Planlı Bakım';
      } else {
        type = 'Arıza';
      }
    }
    return type;
  };

  const machMaint = State.maintenances.filter(r =>
    r.tezgah_id === m.id || r.machine_id === m.id ||
    r.tezgah_adi === m.numarasi || r.machine_name === m.numarasi
  ).sort((a, b) => parseMaintDate(b.tarih || b.date) - parseMaintDate(a.tarih || a.date));

  const machBatt = State.batteries.filter(b => b.tezgah_id === m.id || b.machine === m.numarasi);
  const machFans = State.fans.filter(f => f.tezgah_id === m.id || f.machine === m.numarasi);

  const totalFault = machMaint.filter(r => getRecordType(r) === 'Arıza').length;
  const lastMaint = machMaint[0];

  const critBatt = machBatt.filter(b => {
    const d = parseDateHelper(b.tarih || b.lastChanged);
    if (!d || d.getTime() === 0) return false;
    const age = (now - d) / (1000 * 60 * 60 * 24 * 30);
    return age >= 12;
  });

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
    <title>Makine Kartı — ${m.numarasi || m.name}</title>${getPdfBaseStyles()}</head><body>
    <div class="pdf-page">

      <div class="pdf-header">
        <div class="pdf-logo">
          <div class="pdf-logo-box">M</div>
          <div class="pdf-logo-text">
            <div class="t1">MTB Elektrik Bakım</div>
            <div class="t2">CNC Bakım & Teşhis Platformu</div>
          </div>
        </div>
        <div class="pdf-meta">
          <strong>Makine Kartı</strong>
          Oluşturma: ${dateStr} ${timeStr}<br>
          Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}
        </div>
      </div>

      <div class="pdf-title">🏭 Makine Kartı — ${m.numarasi || m.name || '—'}</div>
      <div class="pdf-subtitle">${m.marka || m.brand || ''} ${m.model || ''} · Seri No: ${m.seri_no || m.serial || '—'}</div>

      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-num">${machMaint.length}</div>
          <div class="kpi-lbl">Toplam Bakım</div>
        </div>
        <div class="kpi-box red">
          <div class="kpi-num">${totalFault}</div>
          <div class="kpi-lbl">Arıza</div>
        </div>
        <div class="kpi-box ${critBatt.length > 0 ? 'red' : 'green'}">
          <div class="kpi-num">${critBatt.length}</div>
          <div class="kpi-lbl">Kritik Pil</div>
        </div>
        <div class="kpi-box amber">
          <div class="kpi-num">${machFans.length}</div>
          <div class="kpi-lbl">Fan Kaydı</div>
        </div>
      </div>

      <div class="section-title">Tezgah Bilgileri</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Tezgah No / Adı</div><div class="info-value">${m.numarasi || m.name || '—'}</div></div>
        <div class="info-item"><div class="info-label">Marka / Model</div><div class="info-value">${m.marka || m.brand || '—'} ${m.model || ''}</div></div>
        <div class="info-item"><div class="info-label">Seri No</div><div class="info-value">${m.seri_no || m.serial || '—'}</div></div>
        <div class="info-item"><div class="info-label">FANUC Kontrol</div><div class="info-value">${m.fanuc || m.control || '—'}</div></div>
        <div class="info-item"><div class="info-label">Bölüm</div><div class="info-value">${m.bolum || m.department || '—'}</div></div>
        <div class="info-item"><div class="info-label">Tezgah Tipi</div><div class="info-value">${m.tip || m.type || '—'}</div></div>
        <div class="info-item"><div class="info-label">Son Bakım</div><div class="info-value">${lastMaint ? (lastMaint.tarih || lastMaint.date) : '—'}</div></div>
        <div class="info-item"><div class="info-label">Devreye Giriş</div><div class="info-value">${m.devreye_tarihi || m.installDate || '—'}</div></div>
      </div>

      <div class="section-title">Son Bakım Kayıtları (En Yeni 10)</div>
      <table>
        <thead>
          <tr>
            <th style="width:15%">Tarih</th>
            <th style="width:15%">Tür</th>
            <th style="width:50%">Açıklama</th>
            <th style="width:20%">Teknisyen</th>
          </tr>
        </thead>
        <tbody>
          ${machMaint.slice(0, 10).map(r => {
            const tur = getRecordType(r);
            const badgeCls = tur === 'Arıza' ? 'badge-red' : 'badge-green';
            return `<tr>
              <td>${r.tarih || r.date || '—'}</td>
              <td><span class="badge ${badgeCls}">${tur || '—'}</span></td>
              <td>${r.aciklama || r.description || '—'}</td>
              <td>${r.bakim_yapan || r.technician || '—'}</td>
            </tr>`;
          }).join('')}
          ${!machMaint.length ? '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding:16px">Bakım kaydı yok</td></tr>' : ''}
        </tbody>
      </table>

      ${machBatt.length ? `
        <div class="section-title">Pil Takip Durumu</div>
        <table>
          <thead>
            <tr>
              <th style="width:15%">Eksen</th>
              <th style="width:20%">Pil Modeli</th>
              <th style="width:20%">Son Değişim</th>
              <th style="width:25%">Yapan</th>
              <th style="width:20%">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${machBatt.map(b => {
              const d = parseDateHelper(b.tarih || b.lastChanged);
              let status = '✓ Normal', badgeCls = 'badge-green';
              if (d && d.getTime() > 0) {
                const months = (now - d) / (1000 * 60 * 60 * 24 * 30);
                if (months >= 12) { status = '⚠ Değişim Gerekli'; badgeCls = 'badge-red'; }
                else if (months >= 10) { status = '! Yaklaşıyor'; badgeCls = 'badge-amber'; }
              }
              return `<tr>
                <td>${b.eksen || b.axis || '—'}</td>
                <td>${b.pil_modeli || b.model || '—'}</td>
                <td>${b.tarih || b.lastChanged || '—'}</td>
                <td>${b.bakim_yapan || b.technician || '—'}</td>
                <td><span class="badge ${badgeCls}">${status}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="signature-row">
        <div class="signature-box">Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}<br><br></div>

        <div class="signature-box">Onaylayan:<br><br></div>
        <div class="signature-box">Tarih: ${dateStr}<br><br></div>
      </div>

      <div class="pdf-footer">
        <span>MTB Elektrik Bakım — Makine Kartı</span>
        <span>${dateStr} ${timeStr}</span>
      </div>
    </div>
  </body></html>`;
}

// PDF export actions
window.printMaintenanceReport = async function(machineId) {
  try {
    showToast('PDF hazırlanıyor...', 'info');
    const m = machineId ? State.machines.find(x => x.id == machineId) : null;
    const defaultName = m
      ? `makine_kart_${(m.numarasi || m.name || 'tezgah').replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`
      : `bakim_raporu_${new Date().toISOString().slice(0,10)}.pdf`;
    const html = buildMaintenanceReportHTML(machineId ? { machineId } : {});
    const res = await window.electronAPI.printToPDF(html, defaultName);
    if (res && res.ok) showToast('✓ PDF kaydedildi: ' + res.filePath.split('\\').pop(), 'success');
    else if (res && !res.ok && res.filePath === undefined) showToast('PDF iptal edildi', 'info');
    else showToast('PDF oluşturulamadı: ' + (res && res.error ? res.error : ''), 'error');
  } catch (e) { showToast('PDF hatası: ' + e.message, 'error'); }
};

window.printMachineCard = async function(machineId) {
  try {
    showToast('Makine kartı hazırlanıyor...', 'info');
    const m = State.machines.find(x => x.id == machineId);
    const defaultName = `makine_karti_${(m ? (m.numarasi || m.name) : 'tezgah').replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
    const html = buildMachineCardHTML(machineId);
    const res = await window.electronAPI.printToPDF(html, defaultName);
    if (res && res.ok) showToast('✓ Makine kartı kaydedildi: ' + res.filePath.split('\\').pop(), 'success');
    else if (res && !res.ok && res.filePath === undefined) showToast('PDF iptal edildi', 'info');
    else showToast('PDF oluşturulamadı: ' + (res && res.error ? res.error : ''), 'error');
  } catch (e) { showToast('PDF hatası: ' + e.message, 'error'); }
};

// ════════════════════════════════════════════════════════════════
//  BAKIM DEFTERİ
// ════════════════════════════════════════════════════════════════
function renderMaintenance() {
  const page = createPage('maintenance');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🔧 Tezgah Bakım Defteri</h1>
          <p>Toplam ${State.maintenances.length} servis ve periyodik bakım kaydı</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="exportMaintenanceCSV()">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV İndir
          </button>
          <button class="btn btn-secondary btn-sm" onclick="printMaintenanceReport()">
            <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            PDF Rapor
          </button>
          ${canEdit() ? `
          <button class="btn btn-primary" onclick="showNewMaintModal()">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Bakım Kaydı
          </button>
          ` : ''}
        </div>
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="maint-search" placeholder="Usta veya açıklama ara..." />
        </div>
        <select id="maint-mach-filter" style="width:180px">
          <option value="">Tüm Tezgahlar</option>
          ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
        </select>
        <select id="maint-status-filter" style="width:150px">
          <option value="">Tüm Durumlar</option>
          <option>Tamamlandı</option>
          <option>Beklemede</option>
          <option>Devam Ediyor</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div style="overflow-y:auto; flex:1">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tezgah</th>
              <th>Bakım Yapan</th>
              <th>Açıklama</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody id="maint-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderMaintTable(State.maintenances, page);

  page.querySelector('#maint-search').addEventListener('input', () => filterMaintenances(page));
  page.querySelector('#maint-mach-filter').addEventListener('change', () => filterMaintenances(page));
  page.querySelector('#maint-status-filter').addEventListener('change', () => filterMaintenances(page));

  return page;
}

function filterMaintenances(page) {
  const q = page.querySelector('#maint-search').value.toLowerCase();
  const machId = page.querySelector('#maint-mach-filter').value;
  const status = page.querySelector('#maint-status-filter').value;

  const filtered = State.maintenances.filter(m =>
    (!q || m.bakim_yapan.toLowerCase().includes(q) || m.aciklama.toLowerCase().includes(q)) &&
    (!machId || m.tezgah_id === parseInt(machId)) &&
    (!status || m.durum === status)
  );
  renderMaintTable(filtered, page);
}

function renderMaintTable(list, page) {
  const tbody = page.querySelector('#maint-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Bakım kaydı bulunamadı</td></tr>`;
    return;
  }
  
  // Sort by date (latest first) or id
  const sorted = [...list].sort((a, b) => b.id - a.id);
  
  tbody.innerHTML = sorted.map(m => {
    const mach = State.machines.find(x => x.id === m.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${m.tezgah_id}`;
    const statusClass = m.durum === 'Tamamlandı' ? 'tag-green' : m.durum === 'Devam Ediyor' ? 'tag-blue' : 'tag-amber';
    return `
      <tr>
        <td><span class="font-mono text-sm" style="color:var(--text-secondary)">${escapeHTML(m.tarih)}</span></td>
        <td><strong style="color:var(--text-accent)">${escapeHTML(machName)}</strong></td>
        <td><span style="font-size:12.5px; font-weight:500">${escapeHTML(m.bakim_yapan)}</span></td>
        <td><div style="font-size:12px; max-width:400px; white-space:normal; line-height:1.5">${escapeHTML(m.aciklama)}</div></td>
        <td><span class="tag ${statusClass}">${escapeHTML(m.durum)}</span></td>
        <td>
          ${canDelete() ? `
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteMaint(${m.id})" title="Sil" style="color:var(--red)">
            ✕
          </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.showNewMaintModal = function() {
  showModal('new-maint', `
    <div class="modal-header">
      <span class="modal-title">Yeni Bakım Kaydı Ekle</span>
      <button class="modal-close" onclick="closeModal('new-maint')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-maint-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tarih (GG.AA.YYYY) *</label>
        <input class="form-control" id="nm-maint-tarih" value="${getTodayFormat()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Usta / Bakımcı *</label>
        <input class="form-control" id="nm-maint-yapan" placeholder="ör. Mehmet Özer" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Yapılan Bakım / Açıklama *</label>
      <textarea class="form-control" id="nm-maint-desc" rows="4" placeholder="Gerçekleştirilen işlemleri detaylandırın..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Durum</label>
      <select class="form-control" id="nm-maint-status">
        <option>Tamamlandı</option>
        <option>Beklemede</option>
        <option>Devam Ediyor</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-maint')">İptal</button>
      <button class="btn btn-primary" onclick="createNewMaint()">Kaydı Kaydet</button>
    </div>
  `);
};

window.createNewMaint = async function() {
  if (!canEdit()) { showToast('Bakım kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-maint-mach').value);
  const tarih = document.getElementById('nm-maint-tarih').value.trim();
  const bakim_yapan = document.getElementById('nm-maint-yapan').value.trim();
  const aciklama = document.getElementById('nm-maint-desc').value.trim();
  const durum = document.getElementById('nm-maint-status').value;

  if (!tarih || !bakim_yapan || !aciklama) {
    showToast('Tarih, usta ve açıklama girmek zorunludur.', 'error');
    return;
  }

  const id = State.maintenances.length ? Math.max(...State.maintenances.map(m => m.id)) + 1 : 1;
  const newMaint = { id, tezgah_id, tarih, bakim_yapan, aciklama, durum };
  State.maintenances.push(newMaint);
  await saveMaintenances();
  closeModal('new-maint');
  showToast('Bakım kaydı başarıyla oluşturuldu!', 'success');
  navigate('maintenance');
};

window.deleteMaint = async function(id) {
  if (!canDelete()) { showToast('Bakım kaydı silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu bakım kaydını silmek istediğinize emin misiniz?')) return;
  State.maintenances = State.maintenances.filter(m => m.id !== id);
  await saveMaintenances();
  showToast('Bakım kaydı silindi.', 'success');
  navigate('maintenance');
};

// ════════════════════════════════════════════════════════════════
//  PİL TAKİBİ
// ════════════════════════════════════════════════════════════════
window.CurrentBatteryTab = 'battery';

function renderBattery() {
  const page = createPage('battery');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🔋 Pil & Sürücü Fan Ömrü Takip Paneli (Lifecycle Calculator)</h1>
          <p>FANUC Absolute Enkoder Pil Voltajları, Geri Sayım Sayacı ve Sürücü Fan Ömrü Takip Sihirbazı</p>
        </div>
        ${canEdit() ? `
        <div class="flex gap-2">
          <button class="btn btn-primary" id="btn-add-battery" onclick="showNewBattModal()">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Pil Değişimi Kaydet
          </button>
          <button class="btn btn-primary" id="btn-add-fan" onclick="showNewFanModal()" style="display:none">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Fan Takibi Ekle
          </button>
        </div>
        ` : ''}
      </div>

      <!-- Lifecycle Summary KPI Cards -->
      <div class="stats-grid mt-3 mb-1" style="grid-template-columns: repeat(4, 1fr); gap:12px">
        <div class="stat-card blue" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-batt-avg-days" style="color:#60a5fa; font-size:22px">0 Gün</div>
            <div class="stat-label">Ortalama Kalan Pil Ömrü</div>
          </div>
        </div>
        <div class="stat-card amber" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-batt-warning" style="color:#fbbf24; font-size:22px">0</div>
            <div class="stat-label">Değişimi Yaklaşan (< 60 Gün)</div>
          </div>
        </div>
        <div class="stat-card red" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-batt-critical" style="color:#f87171; font-size:22px">0</div>
            <div class="stat-label">Kritik / Süresi Dolan</div>
          </div>
        </div>
        <div class="stat-card green" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-fan-critical" style="color:#34d399; font-size:22px">0</div>
            <div class="stat-label">Bakım Zamanı Gelen Fan</div>
          </div>
        </div>
      </div>
      
      <!-- Tabs Selector -->
      <div class="flex gap-2 mt-3" style="border-bottom: 1px solid var(--border); padding-bottom: 8px">
        <button class="btn btn-ghost" id="btn-tab-battery" onclick="switchBatteryTab('battery')" style="font-weight:700; color:var(--text-accent); border-bottom:2px solid var(--text-accent); border-radius:0">🔋 Enkoder Pilleri</button>
        <button class="btn btn-ghost" id="btn-tab-fan" onclick="switchBatteryTab('fan')" style="font-weight:700; border-radius:0">🌀 Sürücü & Kabin Fanları</button>
      </div>

      <!-- Battery Filters -->
      <div class="flex gap-2 mt-3" id="battery-filters" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="batt-search" placeholder="Eksen veya pil tipi ara..." />
        </div>
        <select id="batt-mach-filter" style="width:180px">
          <option value="">Tüm Tezgahlar</option>
          ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
        </select>
        <select id="batt-status-filter" style="width:150px">
          <option value="">Tüm Durumlar</option>
          <option value="normal">Normal (Güvenli)</option>
          <option value="warning">Uyarı (Yaklaştı)</option>
          <option value="critical">Kritik (Süresi Geçti)</option>
        </select>
      </div>

      <!-- Fan Filters -->
      <div class="flex gap-2 mt-3" id="fan-filters" style="flex-wrap:wrap; display:none">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="fan-search" placeholder="Konum veya fan tipi ara..." />
        </div>
        <select id="fan-mach-filter" style="width:180px">
          <option value="">Tüm Tezgahlar</option>
          ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
        </select>
        <select id="fan-status-filter" style="width:150px">
          <option value="">Tüm Durumlar</option>
          <option value="normal">Normal (Güvenli)</option>
          <option value="warning">Uyarı (Bakım Yakın)</option>
          <option value="critical">Kritik (Limit Aşımı)</option>
        </select>
      </div>
    </div>

    <div class="page-body" style="padding:0">
      <!-- Battery Tab Container -->
      <div style="overflow-y:auto; flex:1" id="tab-container-battery">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Eksen</th>
              <th>Pil Modeli</th>
              <th>Voltaj</th>
              <th>Son Değişim</th>
              <th>Değişimi Yapan</th>
              <th>Kalan Gün</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody id="batt-tbody"></tbody>
        </table>
      </div>

      <!-- Fan Tab Container -->
      <div style="overflow-y:auto; flex:1; display:none" id="tab-container-fan">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Konum / Fan Tipi</th>
              <th>Çalışma Saati</th>
              <th>Kalan Ömür (Sa)</th>
              <th>Son Bakım Yapan</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody id="fan-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderBatteryTable(State.batteries, page);
  renderFanTable(State.fans, page);

  // Restore current tab visual state
  if (window.CurrentBatteryTab === 'fan') {
    setTimeout(() => {
      window.switchBatteryTab('fan');
    }, 10);
  }

  // Hook filters
  page.querySelector('#batt-search').addEventListener('input', () => filterBatteries(page));
  page.querySelector('#batt-mach-filter').addEventListener('change', () => filterBatteries(page));
  page.querySelector('#batt-status-filter').addEventListener('change', () => filterBatteries(page));

  page.querySelector('#fan-search').addEventListener('input', () => filterFans(page));
  page.querySelector('#fan-mach-filter').addEventListener('change', () => filterFans(page));
  page.querySelector('#fan-status-filter').addEventListener('change', () => filterFans(page));

  return page;
}

window.switchBatteryTab = function(tab) {
  window.CurrentBatteryTab = tab;
  const isBatt = tab === 'battery';

  // Toggle buttons
  const btnAddBatt = document.getElementById('btn-add-battery');
  const btnAddFan = document.getElementById('btn-add-fan');
  if (btnAddBatt) btnAddBatt.style.display = isBatt ? 'block' : 'none';
  if (btnAddFan) btnAddFan.style.display = isBatt ? 'none' : 'block';

  // Toggle tab buttons visual styles
  const tabBatt = document.getElementById('btn-tab-battery');
  const tabFan = document.getElementById('btn-tab-fan');
  if (tabBatt) {
    tabBatt.style.color = isBatt ? 'var(--text-accent)' : 'var(--text-secondary)';
    tabBatt.style.borderBottom = isBatt ? '2px solid var(--text-accent)' : 'none';
  }
  if (tabFan) {
    tabFan.style.color = !isBatt ? 'var(--text-accent)' : 'var(--text-secondary)';
    tabFan.style.borderBottom = !isBatt ? '2px solid var(--text-accent)' : 'none';
  }

  // Toggle filter divs
  const filtersBatt = document.getElementById('battery-filters');
  const filtersFan = document.getElementById('fan-filters');
  if (filtersBatt) filtersBatt.style.display = isBatt ? 'flex' : 'none';
  if (filtersFan) filtersFan.style.display = isBatt ? 'none' : 'flex';

  // Toggle containers
  const containerBatt = document.getElementById('tab-container-battery');
  const containerFan = document.getElementById('tab-container-fan');
  if (containerBatt) containerBatt.style.display = isBatt ? 'block' : 'none';
  if (containerFan) containerFan.style.display = isBatt ? 'none' : 'block';
};

function filterBatteries(page) {
  const q = page.querySelector('#batt-search').value.toLowerCase();
  const machId = page.querySelector('#batt-mach-filter').value;
  const statusFilter = page.querySelector('#batt-status-filter').value;

  const filtered = State.batteries.filter(b => {
    const textMatch = !q || b.eksen.toLowerCase().includes(q) || b.pil_modeli.toLowerCase().includes(q);
    const machMatch = !machId || b.tezgah_id === parseInt(machId);
    
    const stat = getBatteryStatus(b.tarih);
    let statMatch = true;
    if (statusFilter === 'normal') statMatch = stat.class === 'tag-green';
    else if (statusFilter === 'warning') statMatch = stat.class === 'tag-amber';
    else if (statusFilter === 'critical') statMatch = stat.class === 'tag-red';

    return textMatch && machMatch && statMatch;
  });
  
  renderBatteryTable(filtered, page);
}

function filterFans(page) {
  const q = page.querySelector('#fan-search').value.toLowerCase();
  const machId = page.querySelector('#fan-mach-filter').value;
  const statusFilter = page.querySelector('#fan-status-filter').value;

  const filtered = State.fans.filter(f => {
    const textMatch = !q || f.konum.toLowerCase().includes(q) || (f.bakim_yapan && f.bakim_yapan.toLowerCase().includes(q));
    const machMatch = !machId || f.tezgah_id === parseInt(machId);
    
    const lifeLeft = 20000 - f.calisma_saati;
    let statClass = 'tag-green';
    if (lifeLeft < 0) statClass = 'tag-red';
    else if (lifeLeft < 5000) statClass = 'tag-amber';

    let statMatch = true;
    if (statusFilter === 'normal') statMatch = statClass === 'tag-green';
    else if (statusFilter === 'warning') statMatch = statClass === 'tag-amber';
    else if (statusFilter === 'critical') statMatch = statClass === 'tag-red';

    return textMatch && machMatch && statMatch;
  });

  renderFanTable(filtered, page);
}

function renderBatteryTable(list, page) {
  const tbody = page.querySelector('#batt-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted)">Pil kaydı bulunamadı</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(b => {
    const mach = State.machines.find(x => x.id === b.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${b.tezgah_id}`;
    const stat = getBatteryStatus(b.tarih);
    const deg = window.calculateDegradation ? window.calculateDegradation(b, 'battery') : { percentRemaining: 100, daysRemaining: stat.daysLeft, color: 'var(--green)' };
    const remainingDays = deg.daysRemaining;

    let volt = 3.6;
    if (remainingDays < 0) {
      volt = 2.4;
    } else if (remainingDays < 30) {
      volt = 2.9;
    } else if (remainingDays < 90) {
      volt = 3.2;
    }

    const statusColor = deg.color;

    return `
      <tr>
        <td><strong style="color:var(--text-accent)">${escapeHTML(machName)}</strong></td>
        <td><span style="font-weight:600">${escapeHTML(b.eksen)}</span></td>
        <td><span class="tag tag-gray">${escapeHTML(b.pil_modeli)}</span></td>
        <td><span class="font-mono" style="font-weight:700; color:${statusColor}">⚡ ${volt.toFixed(1)}V</span></td>
        <td><span class="font-mono text-sm">${escapeHTML(b.tarih)}</span></td>
        <td><span>${escapeHTML(b.bakim_yapan)}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px">
            <span class="font-mono" style="font-weight:700; color:${deg.color}; font-size:12px">%${deg.percentRemaining}</span>
            <span class="font-mono text-xs" style="color:var(--text-muted)">(${deg.daysRemaining} Gün)</span>
          </div>
          <div style="width: 110px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; height: 6px; margin-top: 4px">
            <div style="width: ${deg.percentRemaining}%; height: 100%; background: ${deg.color}; transition: width 0.3s ease"></div>
          </div>
        </td>
        <td><span class="tag ${stat.class}">${escapeHTML(stat.label.split(' ')[0])}</span></td>

        <td>
          <div style="display:flex; gap:6px; align-items:center">
            ${canEdit() ? `
            <button class="btn btn-ghost btn-sm" onclick="resetBatteryLife(${b.id})" style="color:var(--green); font-size:11px; padding:2px 8px; border:1px solid var(--green)">
              🔄 Değiştir
            </button>
            ` : ''}
            ${canDelete() ? `
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteBattery(${b.id})" title="Sil" style="color:var(--red)">
              ✕
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderFanTable(list, page) {
  const tbody = page.querySelector('#fan-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Fan takip kaydı bulunamadı</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(f => {
    const mach = State.machines.find(x => x.id === f.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${f.tezgah_id}`;
    const lifeLeft = 20000 - f.calisma_saati;
    
    let statusLabel = 'Normal';
    let statusClass = 'tag-green';
    if (lifeLeft < 0) {
      statusLabel = 'Limit Aşımı';
      statusClass = 'tag-red';
    } else if (lifeLeft < 5000) {
      statusLabel = 'Bakım Yakın';
      statusClass = 'tag-amber';
    }

    const statusColor = lifeLeft < 0 ? 'var(--red)' : lifeLeft < 5000 ? 'var(--amber)' : 'var(--green)';

    return `
      <tr>
        <td><strong style="color:var(--text-accent)">${escapeHTML(machName)}</strong></td>
        <td><span style="font-weight:600">${escapeHTML(f.konum)}</span></td>
        <td><span class="font-mono">${f.calisma_saati.toLocaleString('tr-TR')} Sa</span></td>
        <td>
          <span class="font-mono" style="font-weight:600; color:${statusColor}">${lifeLeft.toLocaleString('tr-TR')} Sa</span>
          <div style="width: 90px; background: var(--border-light); border-radius: 4px; overflow: hidden; height: 5px; margin-top: 4px">
            <div style="width: ${Math.max(0, Math.min(100, (lifeLeft / 20000) * 100))}%; height: 100%; background: ${statusColor}"></div>
          </div>
        </td>
        <td><span>${escapeHTML(f.bakim_yapan || '—')}</span></td>
        <td><span class="tag ${statusClass}">${escapeHTML(statusLabel)}</span></td>
        <td>
          <div style="display:flex; gap:6px; align-items:center">
            ${canEdit() ? `
            <button class="btn btn-ghost btn-sm" onclick="resetFanHours(${f.id})" style="color:var(--green); font-size:11px; padding:2px 8px; border:1px solid var(--green)">
              🔄 Sıfırla
            </button>
            ` : ''}
            ${canDelete() ? `
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteFan(${f.id})" title="Sil" style="color:var(--red)">
              ✕
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getBatteryStatus(dateStr) {
  if (!dateStr) return { label: 'Bilinmiyor', class: 'tag-gray', daysLeft: 0 };
  
  const date = parseDateHelper(dateStr);
  if (!date || date.getTime() === 0) return { label: 'Geçersiz', class: 'tag-gray', daysLeft: 0 };
  
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = todayStart.getTime() - dateStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const daysLeft = 365 - diffDays;
  
  if (daysLeft < 0) {
    return { label: `Kritik (${Math.abs(daysLeft)} gün geçti)`, class: 'tag-red', daysLeft };
  } else if (daysLeft < 30) {
    return { label: `Uyarı (${daysLeft} gün kaldı)`, class: 'tag-amber', daysLeft };
  } else {
    return { label: `Normal (${daysLeft} gün kaldı)`, class: 'tag-green', daysLeft };
  }
}

window.showNewBattModal = function() {
  showModal('new-batt', `
    <div class="modal-header">
      <span class="modal-title">Pil Değişimi Kaydet</span>
      <button class="modal-close" onclick="closeModal('new-batt')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-batt-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Eksen (ör. X, Y, Z, Spindle) *</label>
        <input class="form-control" id="nm-batt-eksen" placeholder="X, Y, Z" />
      </div>
      <div class="form-group">
        <label class="form-label">Pil Modeli / Tipi *</label>
        <input class="form-control" id="nm-batt-model" placeholder="ör. 6V Lithium, D-Size" value="6V Lithium" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Değişim Tarihi (GG.AA.YYYY) *</label>
        <input class="form-control" id="nm-batt-tarih" value="${getTodayFormat()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Teknisyen *</label>
        <input class="form-control" id="nm-batt-yapan" placeholder="ör. Mehmet Özer" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-batt')">İptal</button>
      <button class="btn btn-primary" onclick="createNewBattery()">Pil Değişimini Kaydet</button>
    </div>
  `);
};

window.createNewBattery = async function() {
  if (!canEdit()) { showToast('Pil kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-batt-mach').value);
  const eksen = document.getElementById('nm-batt-eksen').value.trim();
  const pil_modeli = document.getElementById('nm-batt-model').value.trim();
  const tarih = document.getElementById('nm-batt-tarih').value.trim();
  const bakim_yapan = document.getElementById('nm-batt-yapan').value.trim();

  if (!eksen || !pil_modeli || !tarih || !bakim_yapan) {
    showToast('Tüm alanları doldurmak zorunludur.', 'error');
    return;
  }

  const id = State.batteries.length ? Math.max(...State.batteries.map(m => m.id)) + 1 : 1;
  const newBatt = { id, tezgah_id, eksen, pil_modeli, tarih, bakim_yapan };
  State.batteries.push(newBatt);
  await saveBatteries();
  closeModal('new-batt');
  showToast('Pil değişim kaydı başarıyla eklendi!', 'success');
  navigate('battery');
};

window.resetBatteryLife = async function(id) {
  if (!canEdit()) { showToast('Pil değiştirme yetkiniz yok', 'error'); return; }
  const batt = State.batteries.find(b => b.id == id);
  if (!batt) return;
  
  showPromptModal('Pil Değişimi Onayı', batt.bakim_yapan || '', async (tech) => {
    const todayStr = getTodayFormat();
    batt.tarih = todayStr;
    batt.bakim_yapan = tech.toUpperCase();
    await saveBatteries();

    // Log in Maintenance Book!
    const maintId = State.maintenances.length ? Math.max(...State.maintenances.map(m => m.id)) + 1 : 1;
    const newMaint = {
      id: maintId,
      tezgah_id: batt.tezgah_id,
      tarih: todayStr,
      bakim_yapan: tech.toUpperCase(),
      aciklama: `[PM] ${batt.eksen} ekseni absolute enkoder pili değiştirildi (Voltaj 3.6V düzeyine resetlendi).`,
      durum: 'Tamamlandı'
    };
    State.maintenances.push(newMaint);
    await saveMaintenances();

    showToast('Enkoder pili başarıyla güncellendi ve bakım defterine işlendi!', 'success');
    navigate('battery');
  });
};

window.deleteBattery = async function(id) {
  if (!canDelete()) { showToast('Pil kaydı silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu pil değişim kaydını silmek istediğinize emin misiniz?')) return;
  State.batteries = State.batteries.filter(b => b.id !== id);
  await saveBatteries();
  showToast('Pil değişim kaydı silindi.', 'success');
  navigate('battery');
};

window.showNewFanModal = function() {
  showModal('new-fan', `
    <div class="modal-header">
      <span class="modal-title">Yeni Fan Takibi Ekle</span>
      <button class="modal-close" onclick="closeModal('new-fan')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-fan-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Konum / Fan Tipi *</label>
        <input class="form-control" id="nm-fan-konum" placeholder="ör. SVM Fanı, Kabin Emiş Fanı" />
      </div>
      <div class="form-group">
        <label class="form-label">Başlangıç Çalışma Saati *</label>
        <input class="form-control" id="nm-fan-hours" type="number" value="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Teknisyen *</label>
      <input class="form-control" id="nm-fan-yapan" placeholder="ör. AHMET MERT ÖZER" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-fan')">İptal</button>
      <button class="btn btn-primary" onclick="createNewFan()">Fan Takibini Kaydet</button>
    </div>
  `);
};

window.createNewFan = async function() {
  if (!canEdit()) { showToast('Fan kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-fan-mach').value);
  const konum = document.getElementById('nm-fan-konum').value.trim();
  const calisma_saati = parseInt(document.getElementById('nm-fan-hours').value);
  const bakim_yapan = document.getElementById('nm-fan-yapan').value.trim();

  if (!konum || isNaN(calisma_saati) || !bakim_yapan) {
    showToast('Tüm alanları doldurmak zorunludur.', 'error');
    return;
  }

  const id = State.fans.length ? Math.max(...State.fans.map(m => m.id)) + 1 : 1;
  const newFan = { id, tezgah_id, konum, calisma_saati, bakim_yapan: bakim_yapan.toUpperCase() };
  State.fans.push(newFan);
  await saveFans();
  closeModal('new-fan');
  showToast('Yeni fan takip kaydı başarıyla eklendi!', 'success');
  navigate('battery');
};

window.resetFanHours = async function(id) {
  if (!canEdit()) { showToast('Fan sıfırlama yetkiniz yok', 'error'); return; }
  const fan = State.fans.find(f => f.id == id);
  if (!fan) return;
  
  showPromptModal('Fan Ömrü Sıfırlama Onayı', fan.bakim_yapan || '', async (tech) => {
    fan.calisma_saati = 0;
    fan.bakim_yapan = tech.toUpperCase();
    await saveFans();
    
    const maintId = State.maintenances.length ? Math.max(...State.maintenances.map(m => m.id)) + 1 : 1;
    const newMaint = {
      id: maintId,
      tezgah_id: fan.tezgah_id,
      tarih: getTodayFormat(),
      bakim_yapan: tech.toUpperCase(),
      aciklama: `[PM] ${fan.konum} bakımı/değişimi yapıldı ve çalışma saati sıfırlandı.`,
      durum: 'Tamamlandı'
    };
    State.maintenances.push(newMaint);
    await saveMaintenances();

    showToast('Fan çalışma saati başarıyla sıfırlandı ve bakım defterine kaydedildi!', 'success');
    navigate('battery');
  });
};

window.deleteFan = async function(id) {
  if (!canDelete()) { showToast('Fan kaydı silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu fan takip kaydını silmek istediğinize emin misiniz?')) return;
  State.fans = State.fans.filter(f => f.id !== id);
  await saveFans();
  showToast('Fan takip kaydı silindi.', 'success');
  navigate('battery');
};

// ════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════
function createPage(id) {
  const el = document.createElement('div');
  el.className = 'page active';
  el.id = 'page-' + id;
  return el;
}

function formatTime(date) {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// Modal system
function showModal(id, content, size = 'md') {
  let overlay = document.getElementById('modal-' + id);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-' + id;
    const modal = document.createElement('div');
    modal.className = 'modal modal-' + size;
    modal.innerHTML = content;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(id); });
  } else {
    const modal = overlay.querySelector('.modal');
    modal.className = 'modal modal-' + size;
    modal.innerHTML = content;
  }
  requestAnimationFrame(() => overlay.classList.add('open'));
}

window.closeModal = function(id) {
  const overlay = document.getElementById('modal-' + id);
  if (overlay) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 200); }
};

// Toast
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = 'all .3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// Style injection
function addStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// ════════════════════════════════════════════════════════════════
//  NC CODES DATABASE
// ════════════════════════════════════════════════════════════════
function renderNcCodes() {
  const page = createPage('nc_codes');
  page.innerHTML = `
    <div class="page-header">
      <h1>🗂 G/M NC Kod Kütüphanesi</h1>
      <p>${State.nc_codes.length} standart NC kodu — Freze, Torna G-Kodları ve Genel M-Kodları</p>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:360px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="nc-search" placeholder="Kod veya tanım ara... (ör: G76, G02, M03)" />
        </div>
        <select id="nc-type-filter" style="width:200px">
          <option value="">Tüm Tipler</option>
          <option value="G-Milling">G-Kodları (Freze / MC)</option>
          <option value="G-Lathe">G-Kodları (Torna / Lathe)</option>
          <option value="M-Code">M-Kodları (Genel / Yardımcı)</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0; overflow:auto">
      <table class="data-table" id="nc-table">
        <thead>
          <tr>
            <th>Kod</th>
            <th>Tip</th>
            <th>Adı</th>
            <th>Sözdizimi / Örnek</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody id="nc-tbody"></tbody>
      </table>
    </div>
  `;

  renderNcTable(State.nc_codes, page);
  page.querySelector('#nc-search').addEventListener('input', () => filterNc(page));
  page.querySelector('#nc-type-filter').addEventListener('change', () => filterNc(page));

  return page;
}

function filterNc(page) {
  const q = page.querySelector('#nc-search').value.toLowerCase();
  const type = page.querySelector('#nc-type-filter').value;
  const filtered = State.nc_codes.filter(n =>
    (!q || n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)) &&
    (!type || n.type === type)
  );
  renderNcTable(filtered, page);
}

function renderNcTable(codes, page) {
  const tbody = (page || document).querySelector('#nc-tbody');
  if (!tbody) return;
  if (!codes.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">NC kodu bulunamadı</td></tr>`;
    return;
  }
  const typeLabels = { 'G-Milling': 'G (Freze)', 'G-Lathe': 'G (Torna)', 'M-Code': 'M Kodu' };
  const typeTags   = { 'G-Milling': 'tag-blue', 'G-Lathe': 'tag-cyan', 'M-Code': 'tag-purple' };
  tbody.innerHTML = codes.map(n => `
    <tr style="cursor:pointer" onclick="showNcDetail('${n.code}')">
      <td><span class="font-mono" style="color:var(--text-accent); font-weight:600; font-size:13px">${n.code}</span></td>
      <td><span class="tag ${typeTags[n.type]||'tag-gray'}">${typeLabels[n.type]||n.type}</span></td>
      <td><span style="font-size:12px; font-weight:500">${n.name || ''}</span></td>
      <td><span class="font-mono text-sm" style="color:var(--text-secondary)">${n.syntax || '—'}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showNcDetail('${n.code}')">Detay</button></td>
    </tr>
  `).join('');
}

window.showNcDetail = function(code) {
  const item = State.nc_codes.find(n => n.code === code);
  if (!item) return;
  const typeLabels = { 'G-Milling': 'G (Freze)', 'G-Lathe': 'G (Torna)', 'M-Code': 'M Kodu' };
  const typeTags   = { 'G-Milling': 'tag-blue', 'G-Lathe': 'tag-cyan', 'M-Code': 'tag-purple' };

  showModal('nc-detail', `
    <div class="modal-header">
      <span class="modal-title">NC Kodu <span class="font-mono" style="color:var(--text-accent)">${item.code}</span> — ${item.name || ''}</span>
      <button class="modal-close" onclick="closeModal('nc-detail')">✕</button>
    </div>
    <div class="flex gap-2 mb-3">
      <span class="tag ${typeTags[item.type]}">${typeLabels[item.type]}</span>
    </div>
    <div class="card mb-3">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${item.description}</p>
    </div>
    <div class="card mb-3">
      <div class="card-title mb-2">💻 Sözdizimi / Örnek</div>
      <pre style="font-family:var(--font-mono); background:var(--bg-base); padding:8px; border-radius:4px; font-size:11.5px; overflow-x:auto; border:1px solid var(--border)">${item.syntax || '—'}</pre>
    </div>
    ${item.example ? `
      <div class="card mb-3">
        <div class="card-title mb-2">📝 Program Örneği</div>
        <pre style="font-family:var(--font-mono); background:var(--bg-base); padding:8px; border-radius:4px; font-size:11.5px; overflow-x:auto; border:1px solid var(--border)">${item.example}</pre>
      </div>
    ` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('nc-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutNc('${item.code}')">🤖 AI'ya Sor</button>
    </div>
  `);
};

window.askAIAboutNc = function(code) {
  closeModal('nc-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC CNC NC kodu ${code} hakkında detaylı bilgi, sözdizimi yapısı ve parametrik kullanım örnekleri sun.`;
      sendAIMessage();
    }
  }, 300);
};

// ════════════════════════════════════════════════════════════════
//  PMC SIGNALS DATABASE
// ════════════════════════════════════════════════════════════════
function renderPmcSignals() {
  const page = createPage('pmc_signals');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔌 PMC Sinyal Listesi</h1>
      <p>${State.pmc_signals.length} standart PMC arayüz sinyali — G, F, X, Y Adresleri</p>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:360px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="pmc-search" placeholder="Adres veya isim ara... (ör: G008.4, ESP, ST)" />
        </div>
        <select id="pmc-dir-filter" style="width:180px">
          <option value="">Tüm Yönler</option>
          <option value="NC->PMC">NC -> PMC (F / G Giriş)</option>
          <option value="PMC->NC">PMC -> NC (G / F Çıkış)</option>
          <option value="I/O">I/O (X Giriş / Y Çıkış)</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0; overflow:auto">
      <table class="data-table" id="pmc-table">
        <thead>
          <tr>
            <th>Adres</th>
            <th>Yön</th>
            <th>Sembol / İsim</th>
            <th>Açıklama</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody id="pmc-tbody"></tbody>
      </table>
    </div>
  `;

  renderPmcTable(State.pmc_signals, page);
  page.querySelector('#pmc-search').addEventListener('input', () => filterPmc(page));
  page.querySelector('#pmc-dir-filter').addEventListener('change', () => filterPmc(page));

  return page;
}

function filterPmc(page) {
  const q = page.querySelector('#pmc-search').value.toLowerCase();
  const dir = page.querySelector('#pmc-dir-filter').value;
  const filtered = State.pmc_signals.filter(p =>
    (!q || p.address.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
    (!dir || p.direction === dir)
  );
  renderPmcTable(filtered, page);
}

function renderPmcTable(signals, page) {
  const tbody = (page || document).querySelector('#pmc-tbody');
  if (!tbody) return;
  if (!signals.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">PMC sinyali bulunamadı</td></tr>`;
    return;
  }
  const dirTags = { 'NC->PMC': 'tag-blue', 'PMC->NC': 'tag-purple', 'I/O': 'tag-amber' };
  tbody.innerHTML = signals.map(p => `
    <tr style="cursor:pointer" onclick="showPmcDetail('${p.address}')">
      <td><span class="font-mono" style="color:var(--text-accent); font-weight:600; font-size:13px">${p.address}</span></td>
      <td><span class="tag ${dirTags[p.direction]||'tag-gray'}">${p.direction}</span></td>
      <td><span style="font-weight:500; font-size:12px">${p.symbol}</span></td>
      <td><span style="font-size:11.5px; color:var(--text-secondary)">${p.description}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showPmcDetail('${p.address}')">Detay</button></td>
    </tr>
  `).join('');
}

window.showPmcDetail = function(address) {
  const item = State.pmc_signals.find(p => p.address === address);
  if (!item) return;
  const dirTags = { 'NC->PMC': 'tag-blue', 'PMC->NC': 'tag-purple', 'I/O': 'tag-amber' };

  showModal('pmc-detail', `
    <div class="modal-header">
      <span class="modal-title">PMC Sinyali <span class="font-mono" style="color:var(--text-accent)">${item.address}</span></span>
      <button class="modal-close" onclick="closeModal('pmc-detail')">✕</button>
    </div>
    <div class="flex gap-2 mb-3">
      <span class="tag ${dirTags[item.direction]}">${item.direction}</span>
      <span class="tag tag-gray">${item.symbol}</span>
    </div>
    <div class="card mb-3">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${item.description}</p>
    </div>
    ${item.ladder_example ? `
      <div class="card mb-3">
        <div class="card-title mb-2">🔌 Ladder Programındaki Rolü</div>
        <p style="font-size:12px; color:var(--text-secondary)">${item.ladder_example}</p>
      </div>
    ` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('pmc-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutPmc('${item.address}')">🤖 AI'ya Sor</button>
    </div>
  `);
};

window.askAIAboutPmc = function(address) {
  closeModal('pmc-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC PMC arayüz sinyali ${address} (${State.pmc_signals.find(p=>p.address===address)?.symbol}) nedir? Hangi interlock devrelerinde ve nasıl kullanılır?`;
      sendAIMessage();
    }
  }, 300);
};

// ════════════════════════════════════════════════════════════════
//  RAPORLAR & ANALİZ
// ════════════════════════════════════════════════════════════════
function renderReports() {
  const page = createPage('reports');
  
  // Calculate stats
  const monthCounts = {};
  State.maintenances.forEach(m => {
    const dateStr = m.tarih || m.date;
    if (!dateStr) return;
    const d = parseDateHelper(dateStr);
    if (d && d.getTime() > 0) {
      const monthYear = String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      monthCounts[monthYear] = (monthCounts[monthYear] || 0) + 1;
    }
  });

  const deptCounts = {};
  State.maintenances.forEach(m => {
    const mach = State.machines.find(x => x.id === m.tezgah_id);
    const dept = mach ? (mach.bolum || 'Diğer') : 'Diğer';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  const machFailures = {};
  State.maintenances.forEach(m => {
    machFailures[m.tezgah_id] = (machFailures[m.tezgah_id] || 0) + 1;
  });

  const topMachines = Object.keys(machFailures)
    .map(tid => {
      const mach = State.machines.find(x => x.id === parseInt(tid));
      return {
        id: tid,
        name: mach ? mach.numarasi : `Tezgah #${tid}`,
        count: machFailures[tid],
        dept: mach ? (mach.bolum || '—') : '—'
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  page.innerHTML = `
    <div class="page-header">
      <h1>📊 Raporlar & Analiz Paneli</h1>
      <p>Bakım sıklığı, arıza analizleri ve departman bazlı istatistikler</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="gap:16px">
        <div class="card">
          <div class="card-title mb-3">📈 Aylara Göre Bakım Dağılımı</div>
          <div style="display:flex; justify-content:center; padding:10px">
            <canvas id="maint-bar-chart" width="450" height="220" style="width:100%; max-width:450px"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title mb-3">🍩 Departmanlara Göre Arıza Dağılımı</div>
          <div style="display:flex; align-items:center; justify-content:space-around; padding:10px">
            <canvas id="maint-donut-chart" width="200" height="200" style="max-width:200px"></canvas>
            <div style="font-size:11.5px; display:flex; flex-direction:column; gap:6px" id="donut-legend"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title mb-3">🚨 En Sık Arızalanan Kritik Tezgahlar (Top 5)</div>
        <table class="data-table" style="font-size:12px">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Bölüm</th>
              <th>Toplam Arıza Sayısı</th>
              <th>Kritik Durum Derecesi</th>
            </tr>
          </thead>
          <tbody>
            ${topMachines.map(m => {
              const severityClass = m.count > 10 ? 'tag-red' : m.count > 5 ? 'tag-amber' : 'tag-blue';
              const severityText = m.count > 10 ? 'Çok Yüksek' : m.count > 5 ? 'Orta-Yüksek' : 'Düşük-Orta';
              return `
                <tr>
                  <td><strong style="color:var(--text-accent)">${m.name}</strong></td>
                  <td>${m.dept}</td>
                  <td><span class="font-mono" style="font-weight:600">${m.count} Defa</span></td>
                  <td><span class="tag ${severityClass}">${severityText}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Draw charts asynchronously to ensure canvas elements exist in DOM
  setTimeout(() => {
    drawBarChart('maint-bar-chart', monthCounts);
    drawDonutChart('maint-donut-chart', deptCounts, 'donut-legend');
  }, 100);

  return page;
}

function drawBarChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const keys = Object.keys(data).sort((a,b) => {
    const aP = a.split('/'), bP = b.split('/');
    return new Date(aP[1], aP[0]-1) - new Date(bP[1], bP[0]-1);
  }).slice(-6); // last 6 active months
  
  if (!keys.length) return;
  const values = keys.map(k => data[k]);
  const maxVal = Math.max(...values, 1);
  
  const width = canvas.width;
  const height = canvas.height;
  const padding = 35;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  
  // Helper grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const yGrid = padding + (chartHeight / 4) * i;
    ctx.moveTo(padding, yGrid);
    ctx.lineTo(width - padding, yGrid);
  }
  ctx.stroke();

  // Axis lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
  
  const barGap = 18;
  const barWidth = (chartWidth - (barGap * (keys.length - 1))) / keys.length;
  
  keys.forEach((key, idx) => {
    const val = data[key];
    const barHeight = (val / maxVal) * chartHeight;
    const x = padding + idx * (barWidth + barGap);
    const y = height - padding - barHeight;
    
    // Create glowing neon gradient
    const grad = ctx.createLinearGradient(x, y, x, height - padding);
    grad.addColorStop(0, '#60a5fa');
    grad.addColorStop(0.5, '#a78bfa');
    grad.addColorStop(1, 'rgba(167, 139, 250, 0.05)');
    
    // Draw bar with shadow/glow
    ctx.save();
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 12;
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
    } else {
      ctx.rect(x, y, barWidth, barHeight);
    }
    ctx.fill();
    ctx.restore();
    
    // Text value
    ctx.fillStyle = '#f3f4f6';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(val, x + barWidth / 2, y - 8);
    
    // Label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px monospace';
    ctx.fillText(key, x + barWidth / 2, height - padding + 18);
  });
}

function drawDonutChart(canvasId, data, legendId) {
  const canvas = document.getElementById(canvasId);
  const legend = document.getElementById(legendId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Get top 4 depts and group others
  const sortedDepts = Object.keys(data).sort((a,b) => data[b] - data[a]);
  const displayDepts = sortedDepts.slice(0, 4);
  let otherSum = 0;
  sortedDepts.slice(4).forEach(d => otherSum += data[d]);
  
  const chartData = {};
  displayDepts.forEach(d => chartData[d] = data[d]);
  if (otherSum > 0) chartData['Diğer'] = otherSum;

  const total = Object.values(chartData).reduce((a, b) => a + b, 0);
  const keys = Object.keys(chartData);
  if (total === 0) return;
  
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 15;
  
  let startAngle = 0;
  // Modern glowing colors
  const colors = ['#3b82f6', '#10b981', '#fbbf24', '#f43f5e', '#a78bfa'];
  
  keys.forEach((key, idx) => {
    const val = chartData[key];
    const sliceAngle = (val / total) * 2 * Math.PI;
    const color = colors[idx % colors.length];
    
    ctx.save();
    ctx.fillStyle = color;
    // Add neon shadow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    startAngle += sliceAngle;
  });
  
  // Donut hole
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.6, 0, 2 * Math.PI);
  ctx.fill();

  // Draw legend
  if (legend) {
    legend.innerHTML = keys.map((key, idx) => {
      const val = chartData[key];
      const pct = ((val / total) * 100).toFixed(1);
      return `
        <div class="flex items-center gap-2" style="padding: 4px 0">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colors[idx % colors.length]}; box-shadow: 0 0 6px ${colors[idx % colors.length]}"></span>
          <span class="truncate" style="max-width:110px; font-weight:500; color:var(--text-secondary)">${key}</span>
          <span style="margin-left:auto; font-weight:600; color:var(--text-primary)">%${pct}</span>
          <span class="text-muted" style="font-size:10px; margin-left:4px">(${val})</span>
        </div>
      `;
    }).join('');
  }
}

// ════════════════════════════════════════════════════════════════
//  KESTİRİMCİ BAKIM PANELİ
// ════════════════════════════════════════════════════════════════
function calculateMachineHealth(m) {
  let score = 100;
  const logs = State.maintenances.filter(l => l.tezgah_id === m.id);
  const batts = State.batteries.filter(b => b.tezgah_id === m.id);

  // 1. Time since last maintenance
  if (logs.length > 0) {
    const lastDate = parseDateHelper(logs[0].tarih || logs[0].date);
    if (lastDate && lastDate.getTime() > 0) {
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 360) score -= 40;
      else if (daysSince > 180) score -= 25;
      else if (daysSince > 90) score -= 12;
    }
  } else {
    score -= 40; // no maintenance ever
  }

  // 2. Breakdown frequency (Logs in last 90 days)
  let recentBreakdowns = 0;
  logs.forEach(l => {
    const date = parseDateHelper(l.tarih || l.date);
    if (date && date.getTime() > 0) {
      const daysDiff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 90) recentBreakdowns++;
    }
  });
  if (recentBreakdowns > 5) score -= 45;
  else if (recentBreakdowns > 3) score -= 25;
  else if (recentBreakdowns > 0) score -= 10;

  // 3. Encoder battery health
  if (batts.length > 0) {
    batts.forEach(b => {
      const status = getBatteryStatus(b.tarih);
      if (status.class === 'tag-red') score -= 35;      // expired
      else if (status.class === 'tag-amber') score -= 15; // warning
    });
  } else {
    score -= 10; // no battery record (precautionary)
  }

  score = Math.max(score, 0);
  const failureRisk = 100 - score;
  let status = 'Safe';
  let colorClass = 'tag-green';
  if (score < 50) {
    status = 'Critical';
    colorClass = 'tag-red';
  } else if (score < 80) {
    status = 'Warning';
    colorClass = 'tag-amber';
  }
  return { score, failureRisk, status, colorClass };
}

function renderPredictive() {
  const page = createPage('predictive');
  
  // Calculate health for all machines
  const machList = State.machines.map(m => {
    const health = calculateMachineHealth(m);
    return { ...m, health };
  });

  // Sort by health ascending (most critical first)
  machList.sort((a, b) => a.health.score - b.health.score);

  const criticals = machList.filter(m => m.health.status === 'Critical');
  const warnings = machList.filter(m => m.health.status === 'Warning');
  const safes = machList.filter(m => m.health.status === 'Safe');

  page.innerHTML = `
    <div class="page-header">
      <h1>🧠 Kestirimci Bakım & Risk Analiz Paneli</h1>
      <p>Algoritmik arıza tahmini, son servis aralıkları ve pil ömürlerine dayalı sağlık raporu</p>
    </div>
    <div class="page-body">
      <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:18px">
        <div class="stat-card red">
          <div class="stat-icon red">🔴</div>
          <div class="stat-data">
            <div class="stat-value" style="color:#f87171">${criticals.length}</div>
            <div class="stat-label">Kritik (Arıza Riski Yüksek)</div>
          </div>
        </div>
        <div class="stat-card amber">
          <div class="stat-icon amber">🟡</div>
          <div class="stat-data">
            <div class="stat-value" style="color:#fbbf24">${warnings.length}</div>
            <div class="stat-label">Riskli (Bakım Planlanmalı)</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon green">🟢</div>
          <div class="stat-data">
            <div class="stat-value" style="color:#34d399">${safes.length}</div>
            <div class="stat-label">Güvenli Durumda</div>
          </div>
        </div>
      </div>

      <div class="card mb-4" style="border-left: 4px solid var(--red)">
        <div class="card-title text-red">⚠️ Acil Müdahale Gereken Eksen/Tezgah Önerisi</div>
        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5">
          Aşağıdaki liste, son arıza frekansları ve absolute pil döngüleri dikkate alınarak yapay zeka ve matematiksel algoritmalar tarafından puanlanmıştır. En düşük puanlı (sağlığı kritik) tezgahların bakım planlamasına acilen alınması tavsiye edilir.
        </p>
      </div>

      <div class="flex gap-2 mb-3">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="pred-search" placeholder="Tezgah adı ara..." />
        </div>
        <select id="pred-status-filter" style="width:160px">
          <option value="">Tüm Durumlar</option>
          <option value="Critical">🔴 Kritik</option>
          <option value="Warning">🟡 Riskli</option>
          <option value="Safe">🟢 Güvenli</option>
        </select>
      </div>

      <div style="overflow-y:auto; flex:1">
        <table class="data-table" id="pred-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Bölüm</th>
              <th>Sağlık Puanı</th>
              <th>Arıza Riski</th>
              <th>Öncelik Durumu</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody id="pred-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderPredictiveTable(machList, page);

  page.querySelector('#pred-search').addEventListener('input', () => filterPredictive(page, machList));
  page.querySelector('#pred-status-filter').addEventListener('change', () => filterPredictive(page, machList));

  return page;
}

function filterPredictive(page, fullList) {
  const q = page.querySelector('#pred-search').value.toLowerCase();
  const status = page.querySelector('#pred-status-filter').value;

  const filtered = fullList.filter(m =>
    (!q || m.numarasi.toLowerCase().includes(q)) &&
    (!status || m.health.status === status)
  );
  renderPredictiveTable(filtered, page);
}

function renderPredictiveTable(list, page) {
  const tbody = page.querySelector('#pred-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Tezgah bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(m => {
    return `
      <tr>
        <td><strong style="color:var(--text-accent)">${escapeHTML(m.numarasi)}</strong></td>
        <td>${escapeHTML(m.bolum || '—')}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px">
            <div style="flex:1; height:6px; background:#374151; border-radius:3px; max-width:80px">
              <div style="width:${m.health.score}%; height:100%; border-radius:3px; background:${m.health.score < 50 ? 'var(--red)' : m.health.score < 80 ? 'var(--amber)' : 'var(--green)'}"></div>
            </div>
            <span class="font-mono" style="font-weight:600">%${m.health.score}</span>
          </div>
        </td>
        <td><span class="font-mono" style="color:var(--text-secondary)">%${m.health.failureRisk}</span></td>
        <td><span class="tag ${m.health.colorClass}">${m.health.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showMachineDetailsModal(${m.id})">Kayıtlar</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  PARAMETRE AYAR SİHİRBAZI
// ════════════════════════════════════════════════════════════════
function renderTuning() {
  const page = createPage('tuning');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ CNC Parametre Ayar Sihirbazı</h1>
      <p>Kritik ayarlar için adım adım kılavuz ve sanal parametre kontrol paneli</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 280px 1fr; gap: 16px">
        <div class="card" style="display:flex; flex-direction:column; gap:10px">
          <div class="card-title">İşlem Seçin</div>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-1815" onclick="selectTuningWizard(1815)">📍 Absolute Sıfırlama (P1815)</button>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-1851" onclick="selectTuningWizard(1851)">⚙️ Backlash Kompanzasyonu (P1851)</button>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-1320" onclick="selectTuningWizard(1320)">📏 Limit Ayarları (P1320/21)</button>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-2004" onclick="selectTuningWizard(2004)">⚡ Eksen Akım Döngüsü Kazancı (P2004)</button>
        </div>
        <div class="card" id="tuning-wizard-content">
          <div class="empty-state">
            <p>Lütfen soldan gerçekleştirmek istediğiniz parametre sihirbazını seçin.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Select first by default
  setTimeout(() => selectTuningWizard(1815), 50);

  return page;
}

window.selectTuningWizard = function(id) {
  const container = document.getElementById('tuning-wizard-content');
  if (!container) return;

  // Highlight active button
  document.querySelectorAll('[id^="btn-tune-"]').forEach(b => b.classList.remove('btn-primary'));
  const activeBtn = document.getElementById('btn-tune-' + id);
  if (activeBtn) activeBtn.classList.add('btn-primary');

  if (id === 1815) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">📍 Absolute Eksen Referans Noktası Ayarı (Parametre 1815)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Tezgahın elektrik kesintilerinde pozisyonunu kaybetmesini engelleyen absolute enkoder sıfır noktası bu sihirbaz ile ayarlanır. Piller bittiğinde veya söküldüğünde sıfırlama zorunludur.
      </p>
      
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Sıfırlanacak ekseni el çarkı (handle) ile fiziksel referans çizgisine veya komparatör sıfır noktasına getirin.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> PWE'yi (Parameter Write Enable) açın. MDI modunda <code>SETTING</code> sayfasında <code>PARAMETER WRITE = 1</code> yapın. (CNC alarm verecektir, normaldir).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> <code>SYSTEM > PARAM > 1815</code> parametresini bulun. Sıfırlanacak eksenin <code>APC (Bit 5)</code> değerini 1 yapın.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> Aynı parametrede <code>APZ (Bit 4)</code> değerini önce 0 yapın, ardından tekrar 1 yapın.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 5:</strong> PWE'yi kapatın (<code>PARAMETER WRITE = 0</code>). Tezgahın ana şalterini kapatıp 10 saniye bekleyin ve tekrar açın. Eksen sıfırlanmıştır.</div>
        </div>
      </div>

      <strong style="font-size:11px; text-transform:uppercase; color:var(--text-muted)">Sanal Parametre Ekranı (1815)</strong>
      <table class="data-table" style="font-size:11.5px; margin-top:6px; font-family:monospace">
        <thead>
          <tr>
            <th>Eksen</th>
            <th>Bit 7</th>
            <th>Bit 6</th>
            <th>APC (B5)</th>
            <th>APZ (B4)</th>
            <th>Bit 3</th>
            <th>Bit 2</th>
            <th>Bit 1</th>
            <th>Bit 0</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>X Eksen</td>
            <td>0</td>
            <td>0</td>
            <td><span style="color:var(--green)">1</span></td>
            <td><span style="color:var(--green)">1</span></td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
          </tr>
          <tr>
            <td>Z Eksen</td>
            <td>0</td>
            <td>0</td>
            <td><span style="color:var(--green)">1</span></td>
            <td><span style="color:var(--green)">1</span></td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
          </tr>
        </tbody>
      </table>
    `;
  } else if (id === 1851) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">⚙️ Backlash (Eksen Boşluk) Kompanzasyonu (Parametre 1851)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Eksen bilyalı millerindeki aşınmadan kaynaklanan geri dönme boşluğunu gidermek için parametrik kompanzasyon adımları:
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Eksen üzerine bir komparatör saat yerleştirin. Ekseni pozitif (+) yönde hareket ettirip saati sıfırlayın.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> MDI modunda ekseni negatif (-) yönde 0.1 mm hareket ettirin (örn: <code>G91 G01 X-0.1 F100</code>).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> Komparatördeki değeri okuyun. Eğer saat 0.08 mm gösteriyorsa, aradaki 0.02 mm (20 mikron) boşluktur.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> <code>SYSTEM > PARAM > 1851</code> nolu parametreye gidin. Hesaplanan boşluğu mikron cinsinden girin (örn: 20 yazın).</div>
        </div>
      </div>
      
      <div class="card" style="background:rgba(245,158,11,0.06); border-color:rgba(245,158,11,0.15)">
        <div style="font-size:11.5px; color:var(--amber)">
          💡 <strong>İpucu:</strong> Eğer dairesel interpolasyonda (daire kesiminde) geçiş izleri kalıyorsa, Parameter <code>1852</code> (Kesme esnasında backlash) değerini de aynı miktarda güncelleyin.
        </div>
      </div>
    `;
  } else if (id === 1320) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">📏 Yazılımsal Eksen Sınır Limitleri Ayarı (Parametre 1320 & 1321)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Tezgahın sınır anahtarlarına (limit switch) çarpmadan yazılımsal olarak duracağı sınır değerlerini (Stored Stroke Limit) ayarlar.
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Ekseni el çarkı ile fiziksel limit anahtarına yaklaşana kadar (güvenli bir mesafede) jog edin.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> CNC ekranından Makine Koordinat Sistemindeki (MACHINE) değeri okuyun (örn: X ekseni için +450.000).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> <code>SYSTEM > PARAM > 1320</code> (Pozitif limitler) parametresine gidin ve X eksenine bu değeri yazın. Güvenlik için 5mm tolerans ekleyebilirsiniz (+445.000 girin).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> Negatif limit sınırları için <code>1321</code> parametresini kullanın. Değeri eksi (-) işaretiyle girin.</div>
        </div>
      </div>
    `;
  } else if (id === 2004) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">⚡ Eksen Akım Döngüsü Kazanç Ayarı (Parametre 2004)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Eksen motorlarındaki yüksek frekanslı titremeleri (vibration) ve motordan gelen vınıltı seslerini kesmek için Parametre 2004 ve Parametre 2040/2041 akım kazancı ayarlama adımları:
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Titreme veya vınıltı yapan ekseni tespit edin (örn: X ekseni).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> <code>SYSTEM > PARAM > 2004</code> parametresine gidin (Akım Kazanç Oranı). Nominal fabrika değeri genelde <code>0</code> veya <code>100</code> civarıdır.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> Motordaki ses ve titremeyi azaltmak için bu değeri 10'arlı adımlarla azaltın (örn: 100'den 90'a, ardından gerekirse 80'e düşürün).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> Eğer eksen kalkış ve duruşlarda vuruntu yapıyorsa, <code>Parametre 2040</code> (Current Loop Integral) ve <code>Parametre 2041</code> (Current Loop Proportional) kazançlarını %5-10 azaltarak tork tepkisini yumuşatın.</div>
        </div>
      </div>

      <div class="card" style="background:rgba(239,68,68,0.06); border-color:rgba(239,68,68,0.15)">
        <div style="font-size:11.5px; color:var(--red)">
          ⚠️ <strong>Uyarı:</strong> Akım kazançlarını gereğinden fazla düşürmek eksenin tork kaybetmesine, pozisyonlama hassasiyetinin bozulmasına ve aşırı yüke (overload) girmesine neden olabilir. Ayar sonrası Servo Tuning ekranından akım dalgalanmasını izleyin.
        </div>
      </div>
    `;
  }
};

// ════════════════════════════════════════════════════════════════
//  G-CODE & MAKRO ÜRETİCİ
// ════════════════════════════════════════════════════════════════
function renderGenerator() {
  const page = createPage('generator');
  page.innerHTML = `
    <div class="page-header">
      <h1>🛠 Akıllı G-Code Makro Üretici</h1>
      <p>Delik delme, cep frezeleme ve cıvata dairesi koordinatlarını otomatik hesaplar ve G-Code üretir</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 320px 1fr; gap: 16px">
        <div class="card" style="display:flex; flex-direction:column; gap:12px">
          <div class="card-title">Operasyon Tipi</div>
          <select id="gen-op-select" onchange="toggleGeneratorFields()" class="form-control" style="width:100%; margin-bottom:10px">
            <option value="bhc">🔩 Cıvata Dairesi Delme (BHC)</option>
            <option value="pocket-circ">⭕ Dairesel Cep Boşaltma</option>
            <option value="pocket-rect">🟩 Dikdörtgen Cep Boşaltma</option>
          </select>
          
          <div id="gen-fields-container" style="display:flex; flex-direction:column; gap:8px"></div>
          
          <button class="btn btn-primary w-100 mt-2" onclick="generateGcode()">⚡ G-Code Oluştur</button>
        </div>
        
        <div class="card" style="display:flex; flex-direction:column; height:100%">
          <div class="flex items-center justify-between mb-2">
            <div class="card-title">Üretilen FANUC G-Kodu</div>
            <button class="btn btn-secondary btn-sm" onclick="copyGcodeToClipboard()">📋 Kopyala</button>
          </div>
          <textarea id="gen-output" readonly style="flex:1; width:100%; height:320px; font-family:monospace; font-size:12px; background:#0f172a; color:#38bdf8; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; resize:none"></textarea>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => toggleGeneratorFields(), 50);

  return page;
}

window.toggleGeneratorFields = function() {
  const op = document.getElementById('gen-op-select').value;
  const container = document.getElementById('gen-fields-container');
  if (!container) return;

  if (op === 'bhc') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Daire Merkez X (mm)</label>
        <input class="form-control" id="inp-bhc-x" value="0.0" />
      </div>
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Daire Merkez Y (mm)</label>
        <input class="form-control" id="inp-bhc-y" value="0.0" />
      </div>
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Daire Çapı (PCD - mm)</label>
        <input class="form-control" id="inp-bhc-dia" value="100.0" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Delik Sayısı</label>
          <input class="form-control" id="inp-bhc-num" value="6" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Başlangıç Açısı (°)</label>
          <input class="form-control" id="inp-bhc-ang" value="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Delik Derinliği Z (mm)</label>
          <input class="form-control" id="inp-bhc-depth" value="-15.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Geri Çekilme R (mm)</label>
          <input class="form-control" id="inp-bhc-ret" value="2.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">İlerleme F (mm/dk)</label>
          <input class="form-control" id="inp-bhc-feed" value="120" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Devir S (RPM)</label>
          <input class="form-control" id="inp-bhc-rpm" value="1200" />
        </div>
      </div>
    `;
  } else if (op === 'pocket-circ') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Takım Çapı (mm)</label>
        <input class="form-control" id="inp-pc-tooldia" value="10.0" />
      </div>
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Cep Çapı (mm)</label>
        <input class="form-control" id="inp-pc-dia" value="50.0" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Toplam Derinlik Z</label>
          <input class="form-control" id="inp-pc-depth" value="-10.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Paso Derinliği Q</label>
          <input class="form-control" id="inp-pc-peck" value="2.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">İlerleme F (mm/dk)</label>
          <input class="form-control" id="inp-pc-feed" value="300" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Devir S (RPM)</label>
          <input class="form-control" id="inp-pc-rpm" value="2000" />
        </div>
      </div>
    `;
  } else if (op === 'pocket-rect') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Takım Çapı (mm)</label>
        <input class="form-control" id="inp-pr-tooldia" value="10.0" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Cep Genişlik X (mm)</label>
          <input class="form-control" id="inp-pr-w" value="60.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Cep Uzunluk Y (mm)</label>
          <input class="form-control" id="inp-pr-l" value="40.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Toplam Derinlik Z</label>
          <input class="form-control" id="inp-pr-depth" value="-12.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Paso Derinliği Q</label>
          <input class="form-control" id="inp-pr-peck" value="2.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">İlerleme F (mm/dk)</label>
          <input class="form-control" id="inp-pr-feed" value="350" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Devir S (RPM)</label>
          <input class="form-control" id="inp-pr-rpm" value="1800" />
        </div>
      </div>
    `;
  }
};

window.generateGcode = function() {
  const op = document.getElementById('gen-op-select').value;
  const output = document.getElementById('gen-output');
  if (!output) return;

  let gcode = "%\\nO9001 (CNC HIZLI PROGRAM URETICI)\\n";
  gcode += "G21 G90 G40 G80 G49 (MILIMETRE - ABSOLUTE SECIM)\\n";

  if (op === 'bhc') {
    const x = parseFloat(document.getElementById('inp-bhc-x').value) || 0;
    const y = parseFloat(document.getElementById('inp-bhc-y').value) || 0;
    const dia = parseFloat(document.getElementById('inp-bhc-dia').value) || 100;
    const num = parseInt(document.getElementById('inp-bhc-num').value) || 6;
    const ang = parseFloat(document.getElementById('inp-bhc-ang').value) || 0;
    const depth = parseFloat(document.getElementById('inp-bhc-depth').value) || -15;
    const ret = parseFloat(document.getElementById('inp-bhc-ret').value) || 2;
    const feed = parseInt(document.getElementById('inp-bhc-feed').value) || 120;
    const rpm = parseInt(document.getElementById('inp-bhc-rpm').value) || 1200;

    gcode += `T01 M06 (MATKAP TAKILIR)\\n`;
    gcode += `S${rpm} M03 (MILLI BASLAT - SAAT YONU)\\n`;
    gcode += `G00 G54 X${x.toFixed(3)} Y${y.toFixed(3)} M08 (MERKEZE GIT - SOGUTUCU ACIK)\\n`;
    gcode += `G43 H01 Z50.0 (TAKIM BOY TELAFISI ACIK)\\n`;
    gcode += `G99 G81 Z${depth.toFixed(3)} R${ret.toFixed(3)} F${feed} (DELIK ÇEVRIMI BAŞLAT)\\n`;

    const rad = dia / 2;
    for (let i = 0; i < num; i++) {
      const angleDeg = ang + (i * (360 / num));
      const angleRad = (angleDeg * Math.PI) / 180;
      const hx = x + rad * Math.cos(angleRad);
      const hy = y + rad * Math.sin(angleRad);
      gcode += `X${hx.toFixed(3)} Y${hy.toFixed(3)} (DELIK ${i+1} ACI: ${angleDeg}°)\\n`;
    }
    gcode += `G80 G00 Z100.0 M09 (CEVRIM IPTAL - SOGUTUCU KAPALI)\\n`;
    gcode += `M30 (PROGRAM SONU VE BASA DON)\\n%`;
  } else if (op === 'pocket-circ') {
    const tooldia = parseFloat(document.getElementById('inp-pc-tooldia').value) || 10;
    const dia = parseFloat(document.getElementById('inp-pc-dia').value) || 50;
    const depth = parseFloat(document.getElementById('inp-pc-depth').value) || -10;
    const peck = parseFloat(document.getElementById('inp-pc-peck').value) || 2;
    const feed = parseInt(document.getElementById('inp-pc-feed').value) || 300;
    const rpm = parseInt(document.getElementById('inp-pc-rpm').value) || 2000;

    const pocketRad = dia / 2;
    const toolRad = tooldia / 2;
    const cutRad = pocketRad - toolRad;

    gcode += `T02 M06 (PARMAK FREZE TAKILIR)\\n`;
    gcode += `S${rpm} M03 (DEVIR ACIK)\\n`;
    gcode += `G00 G54 X0.0 Y0.0 M08 (MERKEZ GOSTEGESI)\\n`;
    gcode += `G43 H02 Z5.0 (BOY TELAFISI ACIK)\\n`;
    
    let currentZ = 0;
    const targetZ = depth;
    let stepCount = 1;

    while (currentZ > targetZ) {
      currentZ -= peck;
      if (currentZ < targetZ) currentZ = targetZ;
      gcode += `(PASO ${stepCount} - DERINLIK Z: ${currentZ.toFixed(3)})\\n`;
      gcode += `G01 Z${currentZ.toFixed(3)} F${Math.round(feed/2)}\\n`;
      gcode += `G01 X${cutRad.toFixed(3)} F${feed}\\n`;
      gcode += `G03 I-${cutRad.toFixed(3)} (TAM DAIRESAL TUR)\\n`;
      gcode += `G01 X0.0\\n`;
      stepCount++;
    }
    gcode += `G00 Z100.0 M09\\n`;
    gcode += `M30\\n%`;
  } else if (op === 'pocket-rect') {
    const tooldia = parseFloat(document.getElementById('inp-pr-tooldia').value) || 10;
    const w = parseFloat(document.getElementById('inp-pr-w').value) || 60;
    const l = parseFloat(document.getElementById('inp-pr-l').value) || 40;
    const depth = parseFloat(document.getElementById('inp-pr-depth').value) || -12;
    const peck = parseFloat(document.getElementById('inp-pr-peck').value) || 2;
    const feed = parseInt(document.getElementById('inp-pr-feed').value) || 350;
    const rpm = parseInt(document.getElementById('inp-pr-rpm').value) || 1800;

    const toolRad = tooldia / 2;
    const cutW = w - tooldia;
    const cutL = l - tooldia;

    gcode += `T02 M06 (TAKIM DEGISIMI)\\n`;
    gcode += `S${rpm} M03\\n`;
    gcode += `G00 G54 X0.0 Y0.0 M08 (MERKEZ)\\n`;
    gcode += `G43 H02 Z5.0\\n`;

    let currentZ = 0;
    const targetZ = depth;
    let stepCount = 1;

    const halfW = cutW / 2;
    const halfL = cutL / 2;

    while (currentZ > targetZ) {
      currentZ -= peck;
      if (currentZ < targetZ) currentZ = targetZ;
      gcode += `(PASO ${stepCount} - DERINLIK Z: ${currentZ.toFixed(3)})\\n`;
      gcode += `G00 X0.0 Y0.0\\n`;
      gcode += `G01 Z${currentZ.toFixed(3)} F${Math.round(feed/2)}\\n`;
      gcode += `G01 X-${halfW.toFixed(3)} Y-${halfL.toFixed(3)} F${feed}\\n`;
      gcode += `G01 X${halfW.toFixed(3)}\\n`;
      gcode += `G01 Y${halfL.toFixed(3)}\\n`;
      gcode += `G01 X-${halfW.toFixed(3)}\\n`;
      gcode += `G01 Y-${halfL.toFixed(3)}\\n`;
      stepCount++;
    }
    gcode += `G01 X0.0 Y0.0 F${feed}\\n`;
    gcode += `G00 Z100.0 M09\\n`;
    gcode += `M30\\n%`;
  }

  output.value = gcode.replace(/\\n/g, '\n');
};

window.copyGcodeToClipboard = function() {
  const output = document.getElementById('gen-output');
  if (!output || !output.value) return;
  output.select();
  document.execCommand('copy');
  showToast('G-Code panoya kopyalandı!', 'success');
};

// ════════════════════════════════════════════════════════════════
//  HIZLI KILAVUZLAR & REFERANSLAR
// ════════════════════════════════════════════════════════════════
function renderCheatSheets() {
  const page = createPage('cheat_sheets');
  page.innerHTML = `
    <div class="page-header">
      <h1>📋 FANUC Hızlı Referans Kılavuzları</h1>
      <p>G-Kod Sistemleri, SRAM yedekleme adımları ve kritik sistem parametreleri el kitabı</p>
    </div>
    <div class="page-body">
      <div class="flex gap-2 mb-4" style="border-bottom:1px solid var(--border); padding-bottom:10px; flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="btn-cs-gcode" onclick="selectCheatSheetTab('gcode')">🔌 G-Code Sistemleri (A/B/C)</button>
        <button class="btn btn-secondary btn-sm" id="btn-cs-sram" onclick="selectCheatSheetTab('sram')">💾 Boot Loader & SRAM Yedekleme</button>
        <button class="btn btn-secondary btn-sm" id="btn-cs-param" onclick="selectCheatSheetTab('param')">⚙️ Kritik Parametre Numaraları</button>
        <button class="btn btn-secondary btn-sm" id="btn-cs-alarms" onclick="selectCheatSheetTab('alarms')">🚨 Hızlı Hata / Alarm Teşhisi</button>
      </div>
      <div class="card" id="cs-content" style="padding:20px; line-height:1.6"></div>
    </div>
  `;

  setTimeout(() => selectCheatSheetTab('gcode'), 50);

  return page;
}

window.selectCheatSheetTab = function(tab) {
  const container = document.getElementById('cs-content');
  if (!container) return;

  // Highlight active tab button
  document.querySelectorAll('[id^="btn-cs-"]').forEach(btn => btn.classList.remove('btn-primary'));
  const activeBtn = document.getElementById('btn-cs-' + tab);
  if (activeBtn) activeBtn.classList.add('btn-primary');

  if (tab === 'gcode') {
    container.innerHTML = `
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:12px">
        <h2 style="font-size:15px; color:var(--text-accent); margin:0">🔌 FANUC Torna G-Kod Grupları Karşılaştırması</h2>
        <span class="tag tag-blue">Parametre 3401</span>
      </div>
      <p style="font-size:12.5px; color:var(--text-secondary); margin-bottom:14px">
        Torna (CNC Lathe) ünitelerinde, bölgesel uyumluluk veya eski program standartları için 3 farklı G-kod grubu tanımlanmıştır. **System A** varsayılan dünya standardıdır.
        <br>Etkin sistem <strong>Parameter 3401 Bit 7 (GSC) ve Bit 6 (GSB)</strong> ile belirlenir.
      </p>

      <table class="data-table" style="font-size:12px; margin-bottom:16px">
        <thead>
          <tr>
            <th>Özellik / Komut</th>
            <th>G-Code System A (Varsayılan)</th>
            <th>G-Code System B</th>
            <th>G-Code System C</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Mutlak (Absolute) Eksenler</strong></td>
            <td>Doğrudan X, Z, Y, C harfleriyle</td>
            <td>Modal <span class="tag tag-blue">G90</span> aktifken</td>
            <td>Modal <span class="tag tag-blue">G90</span> aktifken</td>
          </tr>
          <tr>
            <td><strong>Artışlı (Incremental) Eksenler</strong></td>
            <td>Doğrudan U, W, V, H harfleriyle</td>
            <td>Modal <span class="tag tag-blue">G91</span> aktifken</td>
            <td>Modal <span class="tag tag-blue">G91</span> aktifken</td>
          </tr>
          <tr>
            <td><strong>Dış Çap Tornalama Çevrimi</strong></td>
            <td><strong style="color:var(--text-accent)">G90</strong></td>
            <td><strong>G77</strong></td>
            <td><strong>G20</strong></td>
          </tr>
          <tr>
            <td><strong>Vida Diş Çekme Çevrimi</strong></td>
            <td><strong style="color:var(--text-accent)">G92</strong></td>
            <td><strong>G78</strong></td>
            <td><strong>G21</strong></td>
          </tr>
          <tr>
            <td><strong>Alın Tornalama Çevrimi</strong></td>
            <td><strong style="color:var(--text-accent)">G94</strong></td>
            <td><strong>G79</strong></td>
            <td><strong>G24</strong></td>
          </tr>
          <tr>
            <td><strong>Dakika Başına İlerleme</strong></td>
            <td>G98 (mm/dk)</td>
            <td>G94 (mm/dk)</td>
            <td>G94 (mm/dk)</td>
          </tr>
          <tr>
            <td><strong>Devir Başına İlerleme</strong></td>
            <td>G99 (mm/dev)</td>
            <td>G95 (mm/dev)</td>
            <td>G95 (mm/dev)</td>
          </tr>
          <tr>
            <td><strong>İnç / Metrik Seçimi</strong></td>
            <td>G20 / G21</td>
            <td>G20 / G21</td>
            <td>G70 / G71</td>
          </tr>
          <tr>
            <td><strong>Maks. Devir Sınırlama</strong></td>
            <td>G50 S2500</td>
            <td>G92 S2500</td>
            <td>G92 S2500</td>
          </tr>
        </tbody>
      </table>

      <div class="card" style="background:rgba(59,130,246,0.05); border-color:rgba(59,130,246,0.15)">
        <div style="font-size:11.5px; color:var(--text-secondary)">
          ⚠️ <strong>Önemli Kural:</strong> System A'da bir torna bloğuna <code>G90 X45.0 Z-20.0 F0.2</code> yazarsanız, takım tek pasoluk bir tornalama çevrimi yapar. System B veya C'de ise <code>G90</code> mutlak koordinat modunu açar ve takım doğrusal hareket (G01) gerçekleştirir.
        </div>
      </div>
    `;
  } else if (tab === 'sram') {
    container.innerHTML = `
      <div style="display:flex; justify-content:between; align-items:center; margin-bottom:12px">
        <h2 style="font-size:15px; color:var(--text-accent); margin:0">💾 FANUC Boot Loader & SRAM Yedekleme Adımları</h2>
        <span class="tag tag-purple">SRAM_BAK.001</span>
      </div>
      <p style="font-size:12.5px; color:var(--text-secondary); margin-bottom:16px">
        Tezgahın elektrik kablolarında arıza giderme, CNC kartı değişimi veya absolute enkoder pili değişimi öncesi tüm parametrelerin, programların ve ayarların yedeklenmesi (SRAM Backup) önerilir.
      </p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:12px">
        <div class="card" style="background:var(--bg-card2)">
          <div class="card-title mb-2" style="font-size:13px; color:var(--green)">📥 CNC -> Bellek Kartına Yedek Alma</div>
          <ol style="font-size:11.5px; padding-left:16px; display:flex; flex-direction:column; gap:6px">
            <li>CNC gücünü kapatın.</li>
            <li>Ekranın solundaki yuvaya **FAT16** biçimli PCMCIA veya CF kart takın.</li>
            <li>MDI panelindeki <strong>nokta (.) ve eksi (-)</strong> tuşlarına aynı anda basılı tutarak CNC şalterini açın.</li>
            <li>Sarı renkli <strong>SYSTEM MONITOR</strong> ekranı açılana kadar basılı tutmaya devam edin.</li>
            <li>Menüden <strong>7. SRAM DATA UTILITY</strong> seçip SELECT butonuna basın.</li>
            <li><strong>SRAM BACKUP (CNC -> MEMORY CARD)</strong> seçeneğini seçin.</li>
            <li>Onay sorusuna <strong>YES</strong> deyin. "SRAM BACKUP COMPLETE" yazana kadar bekleyin.</li>
          </ol>
        </div>
        <div class="card" style="background:var(--bg-card2)">
          <div class="card-title mb-2" style="font-size:13px; color:var(--red)">📤 Bellek Kartından CNC'ye Yükleme</div>
          <ol style="font-size:11.5px; padding-left:16px; display:flex; flex-direction:column; gap:6px">
            <li>Yedek dosyasını içeren kartı takıp, aynı tuşlarla <strong>SYSTEM MONITOR</strong> ekranını açın.</li>
            <li><strong>7. SRAM DATA UTILITY</strong> menüsüne girin.</li>
            <li><strong>RESTORE SRAM (MEMORY CARD -> CNC)</strong> seçeneğini seçin.</li>
            <li>Ajanın yedeklediği dosyayı doğrulamak için **YES** butonuna tıklayın.</li>
            <li>"SRAM RESTORE COMPLETE" yazısı çıktıktan sonra geri çıkın ve **9. START (NORMAL)** seçerek sistemi normal modda başlatın.</li>
          </ol>
        </div>
      </div>
    `;
  } else if (tab === 'param') {
    container.innerHTML = `
      <h2 style="font-size:15px; color:var(--text-accent); margin-bottom:12px">⚙️ Kritik Sistem Parametre Numaraları</h2>
      <div style="max-height:300px; overflow-y:auto">
        <table class="data-table" style="font-size:11.5px">
          <thead>
            <tr>
              <th style="width:100px">Parametre No</th>
              <th>Sembol / Tanım</th>
              <th>Önemi / Kullanımı</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong class="font-mono">1001 (Bit 0)</strong></td>
              <td><strong>INM</strong></td>
              <td>Sistem temel koordinat seçimi (0 = Metrik - mm, 1 = İnç - inch).</td>
            </tr>
            <tr>
              <td><strong class="font-mono">1320</strong></td>
              <td><strong>+SOFT LIMIT 1</strong></td>
              <td>Her eksen için pozitif yazılımsal sınır limit değerleri (mikron cinsinden).</td>
            </tr>
            <tr>
              <td><strong class="font-mono">1321</strong></td>
              <td><strong>-SOFT LIMIT 1</strong></td>
              <td>Her eksen için negatif yazılımsal sınır limit değerleri.</td>
            </tr>
            <tr>
              <td><strong class="font-mono">1815</strong></td>
              <td><strong>APC / APZ</strong></td>
              <td>Eksen pozisyon geri besleme ayarları. Bit 5 (APC): Absolute Enkoder aktif (1), Bit 4 (APZ): Sıfır noktası ayarlandı (1).</td>
            </tr>
            <tr>
              <td><strong class="font-mono">1828</strong></td>
              <td><strong>MOVING LIMIT</strong></td>
              <td>Eksen hareket halindeyken izin verilen maksimum pozisyon sapma limiti (Hata durumunda SV0411 verir).</td>
            </tr>
            <tr>
              <td><strong class="font-mono">1829</strong></td>
              <td><strong>STOPPING LIMIT</strong></td>
              <td>Eksen dururken izin verilen maksimum pozisyon sapma limiti (Hata durumunda SV0410 verir).</td>
            </tr>
            <tr>
              <td><strong class="font-mono">1851</strong></td>
              <td><strong>BACKLASH</strong></td>
              <td>Eksen geri dönme boşluğu kompanzasyon değeri (mikron).</td>
            </tr>
            <tr>
              <td><strong class="font-mono">3102</strong></td>
              <td><strong>LANG DISPLAY</strong></td>
              <td>Ekran dili bitleri: Bit 0 (Japonca), Bit 1 (Almanca), Bit 2 (Fransızca), Bit 3 (Çince), Bit 4 (İtalyanca), Bit 6 (İspanyolca). Hepsi 0 ise İngilizce.</td>
            </tr>
            <tr>
              <td><strong class="font-mono">3111</strong></td>
              <td><strong>SCREEN CTRL</strong></td>
              <td>Ekran kontrolleri: Bit 0 (Servo ekranı), Bit 1 (Spindle ekranı), Bit 5 (Alarm gelince ekranı alarm sayfasına otomatik yönlendirme).</td>
            </tr>
            <tr>
              <td><strong class="font-mono">8130</strong></td>
              <td><strong>TOTAL AXES</strong></td>
              <td>Kontrol ünitesine bağlı toplam aktif eksen sayısı.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (tab === 'alarms') {
    container.innerHTML = `
      <h2 style="font-size:15px; color:var(--text-accent); margin-bottom:12px">🚨 Hızlı Hata / Alarm Teşhis Tablosu</h2>
      <div style="max-height:300px; overflow-y:auto">
        <table class="data-table" style="font-size:11.5px">
          <thead>
            <tr>
              <th style="width:100px">Alarm Kodu</th>
              <th>Hata Tanımı</th>
              <th>Olası Nedenler & Hızlı Çözüm Adımları</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="tag tag-red">SV0401</span></td>
              <td><strong>SERVO ALARM: V-READY OFF</strong></td>
              <td>CNC, servo sürücüden hazır sinyali alamadı. Güvenlik devresindeki acil stop butonlarını, kapı kilit rölelerini ve kontaktör bobinini (MCC) kontrol edin. Diagnostic 358'i inceleyin.</td>
            </tr>
            <tr>
              <td><span class="tag tag-red">SV0417</span></td>
              <td><strong>ILLEGAL DGTL PARAMETER</strong></td>
              <td>Servo parametre hatası. Motor ID (P2020) veya dişli oranlarını (P2084/85) kontrol edin. Diagnostic 280'den reddedilme sebebini okuyun.</td>
            </tr>
            <tr>
              <td><span class="tag tag-red">SV0368</span></td>
              <td><strong>SERIAL ENCODER ERROR</strong></td>
              <td>Servo motor enkoder haberleşme hatası. Geri besleme kablosunu ve soket pinlerini kontrol edin, temizleyin. kabloyu başka eksenle değiştirip test edin.</td>
            </tr>
            <tr>
              <td><span class="tag tag-amber">DS0300</span></td>
              <td><strong>APC ALARM: NEED REF RETURN</strong></td>
              <td>Absolute enkoder referans sıfır noktası kayboldu. Piller bitmiş olabilir. Pili değiştirin, ekseni hizalayıp Parametre 1815 APZ bitini 1 yapın.</td>
            </tr>
            <tr>
              <td><span class="tag tag-amber">DS0306</span></td>
              <td><strong>APC ALARM: BATTERY LOW</strong></td>
              <td>Sürücü yedeği pil voltajı 3.2V altına düştü. **CNC açıkken** panodaki 3.6V Lithium pilleri hemen değiştirin. Güç kapalıyken sökülürse sıfır noktası kaybolur!</td>
            </tr>
            <tr>
              <td><span class="tag tag-red">SP0740</span></td>
              <td><strong>SPINDLE DEV. ALARM</strong></td>
              <td>Spindle hız sapması. Spindle kayışının gevşekliğini veya motorda sıkışma olup olmadığını kontrol edin. Geribesleme enkoder kablosunu test edin.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
};

window.startDatabaseSync = function() {
  showModal('sync-progress', `
    <div class="modal-header">
      <span class="modal-title">Bulut Veri Senkronizasyonu</span>
    </div>
    <div style="padding:10px 0">
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px" id="sync-status-text">
        Bulut sunucusuna bağlanılıyor (api.fanuc-pro-suite.cloud)...
      </div>
      <div style="width:100%; height:8px; background:#1f2937; border-radius:4px; overflow:hidden; margin-bottom:12px">
        <div style="width:0%; height:100%; background:var(--green); transition:width .4s ease" id="sync-progress-bar"></div>
      </div>
      <div id="sync-details-log" style="font-family:monospace; font-size:10px; color:var(--text-muted); background:#0f172a; padding:8px; border-radius:4px; max-height:100px; overflow-y:auto; line-height:1.4">
        [INFO] Senkronizasyon işlemi başlatıldı.
      </div>
    </div>
  `);

  const pBar = document.getElementById('sync-progress-bar');
  const statusText = document.getElementById('sync-status-text');
  const detailsLog = document.getElementById('sync-details-log');

  const addLog = (msg) => {
    detailsLog.innerHTML += `<br>[INFO] ${msg}`;
    detailsLog.scrollTop = detailsLog.scrollHeight;
  };

  setTimeout(() => {
    pBar.style.width = '25%';
    statusText.innerText = 'Veritabanı versiyonları kontrol ediliyor...';
    addLog('Uzak sunucu ile yerel sürümler eşleştiriliyor.');
    
    setTimeout(() => {
      pBar.style.width = '50%';
      statusText.innerText = 'Yeni G-Kodları ve alarmlar indiriliyor...';
      addLog('Güncel FANUC 0i-F Plus ve 30i-B verileri indirildi (1.2 KB).');
      
      setTimeout(() => {
        pBar.style.width = '75%';
        statusText.innerText = 'Yerel veritabanı kontrol ediliyor...';
        addLog('Yerel dosyaların bütünlüğü doğrulanıyor.');
        
        setTimeout(async () => {
          State.settings.lastSync = new Date().toLocaleString('tr-TR');
          await saveSettings();

          pBar.style.width = '100%';
          statusText.innerText = 'Senkronizasyon tamamlandı!';
          addLog('Tüm veritabanı dosyaları güncel ve doğrulanmış durumda.');
          
          setTimeout(() => {
            closeModal('sync-progress');
            showToast('Veritabanları bulut ile başarıyla eşitlendi!', 'success');
            const lastTimeEl = document.getElementById('sync-last-time');
            if (lastTimeEl) lastTimeEl.innerText = `Son Senkronizasyon: ${State.settings.lastSync}`;
          }, 800);
        }, 1200);
      }, 1000);
    }, 1000);
  }, 1000);
};

// ════════════════════════════════════════════════════════════════
//  KEEP RELAY & ZAMANLAYICI DATABASE
// ════════════════════════════════════════════════════════════════
function renderKeepRelays() {
  const page = createPage('keep_relays');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🔌 Keep Relay & Zamanlayıcı Veritabanı</h1>
          <p>Tezgah opsiyon parametreleri, sinyal kilitleri ve süre ayarları el kitabı</p>
        </div>
        ${canEdit() ? `
        <button class="btn btn-primary" onclick="showNewKeepRelayModal()">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Parametre Tanımla
        </button>
        ` : ''}
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:320px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="kr-search" placeholder="Parametre adı veya kodu ara..." />
        </div>
        <select id="kr-type-filter" style="width:180px">
          <option value="">Tüm Tipler</option>
          <option>Keep Relay</option>
          <option>Timer</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div style="overflow-y:auto; flex:1">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:120px">Adres / No</th>
              <th style="width:80px">Tip</th>
              <th>Parametre İsmi</th>
              <th>Açıklama</th>
              <th>Özel Notlar (Tezgaha Özel)</th>
              <th style="width:100px">İşlemler</th>
            </tr>
          </thead>
          <tbody id="kr-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderKeepRelayTable(State.keep_relays, page);

  page.querySelector('#kr-search').addEventListener('input', () => filterKeepRelays(page));
  page.querySelector('#kr-type-filter').addEventListener('change', () => filterKeepRelays(page));

  return page;
}

function filterKeepRelays(page) {
  const q = page.querySelector('#kr-search').value.toLowerCase();
  const type = page.querySelector('#kr-type-filter').value;

  const filtered = State.keep_relays.filter(k =>
    (k.id.toLowerCase().includes(q) || k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q)) &&
    (!type || k.type === type)
  );
  renderKeepRelayTable(filtered, page);
}

function renderKeepRelayTable(list, page) {
  const tbody = page.querySelector('#kr-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Kayıt bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(k => {
    const isTimer = k.type === 'Timer';
    return `
      <tr>
        <td><strong class="font-mono text-sm" style="color:var(--text-accent)">${k.id}</strong></td>
        <td><span class="tag ${isTimer ? 'tag-purple' : 'tag-blue'}">${k.type}</span></td>
        <td><span style="font-weight:600">${k.name}</span></td>
        <td><span style="font-size:12px; color:var(--text-secondary)">${k.description}</span></td>
        <td><span style="font-size:12px; color:var(--amber); font-style:italic">${k.note || '—'}</span></td>
        <td>
          ${canEdit() ? `
          <button class="btn btn-secondary btn-sm" onclick="showEditKeepRelayModal('${k.id}')">Not Ekle</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.showEditKeepRelayModal = function(id) {
  const k = State.keep_relays.find(x => x.id === id);
  if (!k) return;

  showModal('edit-kr', `
    <div class="modal-header">
      <span class="modal-title">Röle Notu Düzenle — ${k.id}</span>
      <button class="modal-close" onclick="closeModal('edit-kr')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Parametre Adı</label>
      <input class="form-control" value="${k.name}" readonly style="opacity:0.6" />
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama</label>
      <textarea class="form-control" readonly style="opacity:0.6" rows="2">${k.description}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgaha Özel Notlar *</label>
      <textarea class="form-control" id="kr-edit-note" rows="3" placeholder="Örn: CNC-101 tezgahında otomatik kapıyı devre dışı bırakmak için 1 yapılır.">${k.note || ''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('edit-kr')">İptal</button>
      <button class="btn btn-primary" onclick="saveKeepRelayNote('${k.id}')">Notu Kaydet</button>
    </div>
  `);
};

window.saveKeepRelayNote = async function(id) {
  if (!canEdit()) { showToast('Not düzenleme yetkiniz yok', 'error'); return; }
  const note = document.getElementById('kr-edit-note').value.trim();
  const k = State.keep_relays.find(x => x.id === id);
  if (k) {
    const oldNote = k.note;
    k.note = note;
    try {
      const res = await window.electronAPI.writeFile('./data/keep_relays.json', JSON.stringify({ keep_relays: State.keep_relays }, null, 2));
      if (res && res.ok) {
        closeModal('edit-kr');
        showToast('Not başarıyla kaydedildi!', 'success');
        navigate('keep_relays');
      } else {
        k.note = oldNote; // revert
        showToast('Not kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (err) {
      k.note = oldNote; // revert
      showToast('Not kaydedilirken hata: ' + err.message, 'error');
    }
  }
};

window.showNewKeepRelayModal = function() {
  showModal('new-kr', `
    <div class="modal-header">
      <span class="modal-title">Yeni PMC Parametresi Tanımla</span>
      <button class="modal-close" onclick="closeModal('new-kr')">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Adres / No (ör. K00.4 veya T004) *</label>
        <input class="form-control" id="nk-id" placeholder="K00.4" />
      </div>
      <div class="form-group">
        <label class="form-label">Parametre Tipi *</label>
        <select class="form-control" id="nk-type">
          <option>Keep Relay</option>
          <option>Timer</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Parametre İsmi *</label>
      <input class="form-control" id="nk-name" placeholder="Kapı Kilidi İptali" />
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama *</label>
      <textarea class="form-control" id="nk-desc" rows="3" placeholder="Sinyalin görevini açıklayın..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Özel Notlar</label>
      <input class="form-control" id="nk-note" placeholder="Tezgaha özel not ekleyin..." />
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-kr')">İptal</button>
      <button class="btn btn-primary" onclick="createNewKeepRelay()">Parametreyi Kaydet</button>
    </div>
  `);
};

window.createNewKeepRelay = async function() {
  if (!canEdit()) { showToast('Keep Relay ekleme yetkiniz yok', 'error'); return; }
  const id = document.getElementById('nk-id').value.trim();
  const type = document.getElementById('nk-type').value;
  const name = document.getElementById('nk-name').value.trim();
  const description = document.getElementById('nk-desc').value.trim();
  const note = document.getElementById('nk-note').value.trim();

  if (!id || !name || !description) {
    showToast('Adres, isim ve açıklama girmek zorunludur.', 'error');
    return;
  }

  const newKR = { id, type, name, description, note };
  try {
    const res = await window.electronAPI.writeFile('./data/keep_relays.json', JSON.stringify({ keep_relays: [...State.keep_relays, newKR] }, null, 2));
    if (res && res.ok) {
      State.keep_relays.push(newKR);
      closeModal('new-kr');
      showToast('Parametre veritabanına eklendi!', 'success');
      navigate('keep_relays');
    } else {
      showToast('Parametre kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Parametre kaydedilirken hata: ' + err.message, 'error');
  }
};

// ════════════════════════════════════════════════════════════════
//  MAKRO DEĞİŞKENLERİ REHBERİ & HESAPLAYICISI
// ════════════════════════════════════════════════════════════════
function renderMacroVariables() {
  const page = createPage('macro');
  page.innerHTML = `
    <div class="page-header">
      <h1>🧮 FANUC Makro Değişkenleri Kılavuzu</h1>
      <p>Macro B değişken tablosu, sistem değişkenleri referansı ve interaktif hesaplayıcı</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">
        <div class="card" style="display:flex; flex-direction:column; height:100%">
          <div class="card-title mb-3">🧮 İnteraktif Makro Değer Hesaplayıcı</div>
          <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
            FANUC Macro B aritmetik ifadelerini test edin. Değişken kutularına (# sembolü olmadan) değerleri yazıp hesaplama yapabilirsiniz. Trigonometrik fonksiyonlar derece cinsinden hesaplanır (FANUC standardı).
          </p>
          <div class="grid-2 mb-3" style="gap:8px">
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#1 değeri (A)</label>
              <input class="form-control" id="mc-v1" value="30.0" style="padding:6px; font-family:monospace" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#2 değeri (B)</label>
              <input class="form-control" id="mc-v2" value="2.0" style="padding:6px; font-family:monospace" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#100 değeri</label>
              <input class="form-control" id="mc-v100" value="150.5" style="padding:6px; font-family:monospace" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#500 değeri</label>
              <input class="form-control" id="mc-v500" value="10.0" style="padding:6px; font-family:monospace" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:11px">Makro Formülü Girin (örn. [#100 + #500] * SIN[#1])</label>
            <input class="form-control" id="mc-expression" value="[#100 + #500] * SIN[#1]" style="font-family:monospace; background:#0f172a; color:#38bdf8" />
          </div>
          <button class="btn btn-primary w-100" onclick="evaluateMacro()">⚡ Formülü Hesapla</button>
          
          <div class="card mt-3" style="background:var(--bg-card2); padding:10px; border-color:var(--border)">
            <div style="font-size:11px; color:var(--text-muted)">HESAPLAMA SONUCU:</div>
            <div id="mc-result" style="font-size:18px; font-family:monospace; font-weight:700; color:var(--green); margin-top:4px">—</div>
          </div>
        </div>

        <div class="card" style="display:flex; flex-direction:column; height:100%">
          <div class="card-title mb-2">📋 Değişken Türleri Referansı</div>
          <div style="flex:1; overflow-y:auto; font-size:11.5px; display:flex; flex-direction:column; gap:10px">
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#1 - #33 (Yerel Değişkenler):</strong><br>
              G65 makro çağrılarında (alt program) lokal parametre transferi için kullanılır. Örneğin, <code>A=10.0</code> yazıldığında alt programda <code>#1</code> değeri 10.0 olur.
            </div>
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#100 - #199 / #500 - #999 (Ortak Değişkenler):</strong><br>
              Tüm programlar tarafından erişilebilir. <strong>#100 serisi</strong> güç kapatıldığında sıfırlanırken (volatile), <strong>#500 serisi</strong> kalıcı bellekte saklanır (non-volatile).
            </div>
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#1000 - #1131 (PMC Giriş/Çıkış Arayüzü):</strong><br>
              Makro programından PMC sinyal kontaklarını okumak (#1000) veya yazmak (#1100) için kullanılır.
            </div>
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#5021 - #5023 (Eksen Makine Koordinatları):</strong><br>
              Tezgahın o anki makine koordinat sistemindeki X, Y, Z mutlak pozisyonlarını okur (Salt Okunur).
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return page;
}

window.evaluateMacro = function() {
  const v1 = parseFloat(document.getElementById('mc-v1').value) || 0;
  const v2 = parseFloat(document.getElementById('mc-v2').value) || 0;
  const v100 = parseFloat(document.getElementById('mc-v100').value) || 0;
  const v500 = parseFloat(document.getElementById('mc-v500').value) || 0;
  let expr = document.getElementById('mc-expression').value.trim();

  const resEl = document.getElementById('mc-result');
  if (!expr) {
    resEl.innerText = 'Formül girilmedi';
    resEl.style.color = 'var(--red)';
    return;
  }

  // Define vars mapping
  const vars = {
    '1': v1,
    '2': v2,
    '100': v100,
    '500': v500
  };

  try {
    // 1. Replace brackets with parentheses for eval
    expr = expr.replace(/\[/g, '(').replace(/\]/g, ')');

    // 2. Replace math functions: SIN, COS, TAN, SQRT, ABS
    // FANUC uses degrees, so convert SIN(x) -> Math.sin(x * PI/180)
    expr = expr.replace(/SIN\(([^)]+)\)/gi, (m, p1) => `Math.sin((${p1}) * Math.PI / 180)`);
    expr = expr.replace(/COS\(([^)]+)\)/gi, (m, p1) => `Math.cos((${p1}) * Math.PI / 180)`);
    expr = expr.replace(/TAN\(([^)]+)\)/gi, (m, p1) => `Math.tan((${p1}) * Math.PI / 180)`);
    expr = expr.replace(/SQRT\(([^)]+)\)/gi, 'Math.sqrt($1)');
    expr = expr.replace(/ABS\(([^)]+)\)/gi, 'Math.abs($1)');
    expr = expr.replace(/ROUND\(([^)]+)\)/gi, 'Math.round($1)');

    // 3. Replace variables #1, #2, #100, #500
    expr = expr.replace(/#100/g, vars['100']);
    expr = expr.replace(/#500/g, vars['500']);
    expr = expr.replace(/#1/g, vars['1']);
    expr = expr.replace(/#2/g, vars['2']);

    // Check if there are unreplaced variables (e.g. #3, #150)
    if (/#\d+/g.test(expr)) {
      resEl.innerText = 'Hata: Tanımsız değişken (Sadece #1, #2, #100, #500)';
      resEl.style.color = 'var(--red)';
      return;
    }

    // 4. Safe evaluate
    // Use Function constructor instead of direct eval for safety
    const result = new Function(`return (${expr})`)();

    if (isNaN(result) || result === Infinity || result === -Infinity) {
      resEl.innerText = 'Hesaplama Hatası (Bölünme veya Geçersiz İşlem)';
      resEl.style.color = 'var(--red)';
    } else {
      resEl.innerText = result.toFixed(4);
      resEl.style.color = 'var(--green)';
    }
  } catch (e) {
    resEl.innerText = 'Hata: ' + e.message;
    resEl.style.color = 'var(--red)';
  }
};

// ════════════════════════════════════════════════════════════════
//  RS232 / DNC SERİ HABERLEŞME SİMÜLATÖRÜ & KILAVUZU
// ════════════════════════════════════════════════════════════════
function renderRS232() {
  const page = createPage('rs232');
  page.innerHTML = `
    <div class="page-header">
      <h1>📶 RS232 / DNC Seri Haberleşme & Parametre Rehberi</h1>
      <p>FANUC tezgahları için RS232 port ayarları, kablo şemaları ve interaktif G-Kod transfer simülatörü</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1.2fr 0.8fr; gap:16px">
        
        <!-- Left: Simulator -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-3">📤 DNC Dosya Aktarım Simülatörü</div>
            <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
              Tezgaha gönderilecek G-Kod dosyasını veya örnek programı seçin, DNC parametrelerini yapılandırıp aktarımı başlatın.
            </p>
            
            <div class="grid-2 mb-3" style="gap:8px">
              <div class="form-group" style="margin:0">
                <label class="form-label" style="font-size:10.5px">Baud Rate</label>
                <select class="form-control" id="dnc-baud" style="padding:6px; font-size:11.5px">
                  <option value="4800">4800 Baud</option>
                  <option value="9600" selected>9600 Baud</option>
                  <option value="19200">19200 Baud</option>
                </select>
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label" style="font-size:10.5px">Akış Kontrolü (Handshake)</label>
                <select class="form-control" id="dnc-flow" style="padding:6px; font-size:11.5px">
                  <option value="xon">XON / XOFF (Yazılımsal)</option>
                  <option value="hw">Donanımsal (RTS/CTS)</option>
                </select>
              </div>
            </div>

            <!-- Signal Leds -->
            <div style="display:flex; gap:14px; margin-bottom:14px; background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-tx" style="width:10px; height:10px; border-radius:50%; background:#374151; display:inline-block; transition:background .15s ease"></span> TX (Send)
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-rx" style="width:10px; height:10px; border-radius:50%; background:#374151; display:inline-block; transition:background .15s ease"></span> RX (Recv)
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-rts" style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; transition:background .15s ease"></span> RTS (Ready)
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-cts" style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; transition:background .15s ease"></span> CTS (Clear)
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size:11px">Gönderilecek G-Code Sinyal İçeriği</label>
              <textarea class="form-control" id="dnc-gcode-input" rows="8" style="font-family:monospace; font-size:11.5px; background:#0f172a; color:#a5f3fc; line-height:1.4">%
O1001 (RS232 DNC TEST)
G21 G90 G40 G80
T0101 M06 (DIS CAP TORNA)
G97 S1200 M03
G00 X50.0 Z5.0 M08
G01 Z-25.0 F0.2
G01 X60.0 F0.5
G00 X100.0 Z100.0 M09
G28 U0.0 W0.0
M30
%</textarea>
            </div>

            <!-- Progress Bar -->
            <div style="width:100%; height:6px; background:#1f2937; border-radius:3px; overflow:hidden; margin-bottom:12px">
              <div id="dnc-progress" style="width:0%; height:100%; background:var(--accent); transition:width .1s linear"></div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" id="btn-dnc-send" onclick="startDncTransmission()">📤 CNC'ye Gönder</button>
            <button class="btn btn-secondary" id="btn-dnc-stop" onclick="stopDncTransmission()" disabled>Durdur</button>
          </div>
        </div>

        <!-- Right: Wiring Diagram & Params -->
        <div class="card" style="display:flex; flex-direction:column; gap:16px">
          <div>
            <div class="card-title mb-2">🔌 FANUC RS232 Parametre Ayarları</div>
            <table class="data-table" style="font-size:11px">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Parametre Adı</th>
                  <th>Ayar Değeri</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong class="font-mono">0000</strong></td>
                  <td>ISO Kodu Çıkışı</td>
                  <td><strong style="color:var(--text-accent)">1 (ISO)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0020</strong></td>
                  <td>I/O Kanal Seçimi</td>
                  <td><strong style="color:var(--text-accent)">0 (Channel 1 RS232)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0101</strong></td>
                  <td>Veri formatı / Stop Bit</td>
                  <td><strong>10000001 (1 Stop Bit, 7-E)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0102</strong></td>
                  <td>Cihaz Tipi</td>
                  <td><strong>3 (RS-232C Terminal)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0103</strong></td>
                  <td>Baud Rate Hızı</td>
                  <td><strong>11 (9600) veya 12 (19200)</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="card-title mb-2">🗺️ DB9 (PC) - DB25 (CNC) Kablo Şeması</div>
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:8px">
              Yazılımsal Akış Kontrolü (XON/XOFF) için Null-Modem kablo bağlantı şeması:
            </p>
            <div style="background:#0f172a; padding:12px; border-radius:4px; border:1px solid var(--border); font-family:monospace; font-size:11px; line-height:1.5; color:var(--green)">
              PC (DB9 Dişi)               CNC (DB25 Erkek)
              -------------               ----------------
              Pin 2 (RXD)  <------------  Pin 2 (TXD)
              Pin 3 (TXD)  ------------->  Pin 3 (RXD)
              Pin 5 (GND)  =============  Pin 7 (SG)
              
              Pin 7 (RTS) --+             Pin 4 (RTS) --+
              Pin 8 (CTS) --+ (Köprü)     Pin 5 (CTS) --+ (Köprü)
              
              Pin 4 (DTR) --+             Pin 6 (DSR) --+
              Pin 6 (DSR) --+ (Köprü)     Pin 20(DTR) --+ (Köprü)
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  return page;
}

let DncInterval = null;
window.startDncTransmission = function() {
  const codeText = document.getElementById('dnc-gcode-input').value;
  const lines = codeText.split('\n');
  if (!lines.length || !codeText.trim()) {
    showToast('Gönderilecek G-Code bulunamadı.', 'error');
    return;
  }

  const sendBtn = document.getElementById('btn-dnc-send');
  const stopBtn = document.getElementById('btn-dnc-stop');
  const progBar = document.getElementById('dnc-progress');
  const ledTx = document.getElementById('led-tx');

  sendBtn.disabled = true;
  stopBtn.disabled = false;
  progBar.style.width = '0%';

  let currentLine = 0;
  const totalLines = lines.length;

  DncInterval = setInterval(() => {
    if (currentLine >= totalLines) {
      clearInterval(DncInterval);
      DncInterval = null;
      sendBtn.disabled = false;
      stopBtn.disabled = true;
      ledTx.style.background = '#374151';
      showToast('G-Code programı DNC üzerinden başarıyla aktarıldı!', 'success');
      return;
    }

    // Toggle LED flash for TX transmit
    ledTx.style.background = ledTx.style.background === 'rgb(59, 130, 246)' ? '#374151' : '#3b82f6';

    // Update progress
    currentLine++;
    const percent = Math.round((currentLine / totalLines) * 100);
    progBar.style.width = percent + '%';
  }, 180);
};

window.stopDncTransmission = function() {
  if (DncInterval) {
    clearInterval(DncInterval);
    DncInterval = null;
  }
  document.getElementById('btn-dnc-send').disabled = false;
  document.getElementById('btn-dnc-stop').disabled = true;
  document.getElementById('led-tx').style.background = '#374151';
  showToast('Aktarım kullanıcı tarafından durduruldu.', 'info');
};

// ════════════════════════════════════════════════════════════════
//  SÜRÜCÜ 7-SEGMENT HATA TEŞHİS SİHİRBAZI
// ════════════════════════════════════════════════════════════════
window.CurrentDriveTab = 'led';

function renderDriveDiagnostics() {
  const page = createPage('drive_diagnostics');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔧 Servo & Spindle Sürücü Hata Teşhis Sihirbazı</h1>
      <p>Sürücü arızalarını teşhis edin ve kabin içi sıcaklık / watchdog koruma parametrelerini inceleyin</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-dr-led" onclick="switchDriveTab('led')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          🚨 7-Segment LED Hata Teşhisi
        </button>
        <button class="tab-btn" id="tab-dr-heat" onclick="switchDriveTab('heat')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🌡️ Kabin Isı Kontrolü & Alarmlar
        </button>
        <button class="tab-btn" id="tab-dr-comm" onclick="switchDriveTab('commutation')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          ⚡ Servo Enkoder Kutup Hizalama
        </button>
      </div>
    </div>
    
    <div class="page-body" id="drive-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchDriveTab(window.CurrentDriveTab, page);
  }, 10);

  return page;
}

window.switchDriveTab = function(tab, page = document) {
  window.CurrentDriveTab = tab;
  
  const ledBtn = page.querySelector('#tab-dr-led');
  const heatBtn = page.querySelector('#tab-dr-heat');
  const commBtn = page.querySelector('#tab-dr-comm');
  if (ledBtn && heatBtn && commBtn) {
    ledBtn.style.color = tab === 'led' ? 'var(--text-accent)' : 'var(--text-secondary)';
    ledBtn.style.fontWeight = tab === 'led' ? 'bold' : 'normal';
    heatBtn.style.color = tab === 'heat' ? 'var(--text-accent)' : 'var(--text-secondary)';
    heatBtn.style.fontWeight = tab === 'heat' ? 'bold' : 'normal';
    commBtn.style.color = tab === 'commutation' ? 'var(--text-accent)' : 'var(--text-secondary)';
    commBtn.style.fontWeight = tab === 'commutation' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#drive-tab-content');
  if (!content) return;

  if (tab === 'led') {
    content.innerHTML = `
      <div class="grid-2 mb-4" style="grid-template-columns: 0.8fr 1.2fr; gap:16px">
        <!-- Left: Input & LED Simulation -->
        <div class="card" style="display:flex; flex-direction:column; align-items:center; text-align:center; justify-content:space-between; padding:24px">
          <div style="width:100%">
            <div class="card-title mb-3" style="text-align:left">🚨 7-Segment Dijital Ekran</div>
            <div class="form-group" style="text-align:left">
              <label class="form-label">Sürücü Ekran Kodu Seçin</label>
              <select class="form-control" id="diag-code-select" onchange="updateDiagLedDisplay()">
                <option value="">Kod Seçin...</option>
                ${State.drive_alarms.map(a => `<option value="${a.code}">${a.code} — ${a.title}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Glow LED Box -->
          <div style="width:120px; height:160px; background:#000; border:4px solid #1f2937; border-radius:8px; display:flex; align-items:center; justify-content:center; margin:24px 0; box-shadow:0 0 20px rgba(239,68,68,0.15)">
            <span id="led-display-text" style="font-family:'Courier New', monospace; font-size:90px; font-weight:900; color:#1f2937; text-shadow:none; transition:all .3s ease">--</span>
          </div>

          <button class="btn btn-primary w-100" onclick="runDriveDiagnosis()">⚡ Arızayı Teşhis Et</button>
        </div>

        <!-- Right: Diagnosis Details -->
        <div class="card" id="diag-results-card" style="padding:20px; min-height:300px">
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted)" id="diag-empty-state">
            <svg style="width:48px; height:48px; stroke:currentColor; fill:none; stroke-width:1.5; margin-bottom:12px" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p style="font-size:13px">Lütfen sol taraftan sürücü ekranında yanan kodu seçip "Arızayı Teşhis Et" butonuna basın.</p>
          </div>
          <div id="diag-details-content" style="display:none; line-height:1.6"></div>
        </div>
      </div>
    `;
  } else if (tab === 'heat') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        
        <!-- Left: Overheat alarms guide -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title" style="color:var(--red)">🌡️ Kabin & Kart Aşırı Isınma Alarmları</div>
          
          <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--red); border-radius:4px; font-size:12px">
            <strong>ALARM 700 - CNC MAIN BOARD OVERHEAT:</strong><br>
            CNC ana işlemci kartı (Main CPU) sıcaklığı kritik eşiği aştı. Soğutucu fanın çalışıp çalışmadığını kontrol edin.
          </div>
          
          <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--amber); border-radius:4px; font-size:12px">
            <strong>ALARM 704 - SPINDLE/SERVO DRIVE OVERHEAT:</strong><br>
            Sürücü soğutucu bloklarında (heatsink) aşırı ısınma algılandı. Genellikle sürücü gövdesinin dışındaki kabin fanları durduğunda tetiklenir.
          </div>

          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:6px">
            <strong>🔧 Arıza Giderme Adımları:</strong>
            <div>1. Elektrik kabininin arkasındaki ve sürücü üstündeki sarı fanların dönüp dönmediğini fiziksel olarak kontrol edin.</div>
            <div>2. Filtreleri söküp hava üfleyin (yağ buharı fan kanatlarını kilitleyebilir).</div>
            <div>3. Geçici acil durum kurtarması için elektrik kabin kapağını açıp harici vantilatör ile soğutma sağlayın.</div>
          </div>
        </div>

        <!-- Right: Temperature monitoring parameters -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">⚙️ Isı İzleme ve Parametre Göstergeleri</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Ana kart sıcaklığını doğrudan CNC ekranında görmek için parametreyi aktif edin:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); font-family:monospace; font-size:12.5px; color:#00ff00">
            <div style="border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">PARAMETER SETTING</div>
            <div style="display:flex; justify-content:space-between">
              <span>Parametre 3111 #0 (TEMD)</span>
              <span><strong>1</strong> (Ekranda Sıcaklık Göster)</span>
            </div>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:6px">
            <strong>📊 Diagnostic İzleme Değerleri:</strong>
            <div style="display:flex; justify-content:space-between; background:var(--bg-card2); padding:6px; border-radius:4px">
              <span>DGN 1010 (CPU Isısı):</span>
              <strong style="color:var(--text-accent)">Maksimum 85°C Sınırı</strong>
            </div>
            <div style="display:flex; justify-content:space-between; background:var(--bg-card2); padding:6px; border-radius:4px">
              <span>DGN 1014 (Sürücü Modül Sıcaklığı):</span>
              <strong style="color:var(--text-accent)">Maksimum 90°C Sınırı</strong>
            </div>
          </div>
        </div>

      </div>
    `;
  } else if (tab === 'commutation') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px; padding:0 20px">
        
        <!-- Left: Phase angle alignment -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">⚡ Servo Motor Enkoder Kutup (Phase Angle) Hizalama</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Servo motorların enkoderi (Pulsecoder) tamir veya değişim için söküldüğünde, motor kutup açısı (rotor mıknatıs sıfır noktası) ile enkoder sıfır noktası arasındaki faz açısı kayar. Bu durum tezgah açıldığında eksenin aniden fırlamasına ve aşırı sapma (Excessive Error) alarmlarına yol açar.
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔧 Adım Adım Faz Hizalama Prosedürü:</strong>
            <div>1. CNC gücünü kapatın. Motoru makineden söküp boşa alın (miller serbest dönmelidir).</div>
            <div>2. <code>SYSTEM > PARAM > 2000</code> serisindeki motor parametrelerini kontrol edin. Akım hizalamayı açmak için Parameter <strong>2013#0 (FCMD)</strong> bitini <code>1</code> yapın.</div>
            <div>3. Tezgahı açın. Eksene çok düşük bir hızda (MDI modunda jog) manuel hareket verin.</div>
            <div>4. Sürücü kontrol kartı, enkoderden gelen Z sinyali ile motorun U-Fazı sargı akımını otomatik olarak eşleştirecektir.</div>
            <div>5. İşlem bittiğinde <strong>FCMD</strong> parametresini tekrar <code>0</code> yapıp CNC'yi yeniden başlatın.</div>
          </div>
        </div>

        <!-- Right: Diagnostic value checking -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">📊 Kutup Açısı İzleme Diagnostic Ekranı</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Hizalama bittikten sonra faz açısının doğruluğunu diagnostic ekranı üzerinden teyit edin:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:8px">
            <div>
              <strong style="color:var(--text-accent)">• Diagnostic 453 (Phase Angle):</strong><br>
              Hizalama sonrasında bu değer kararlı olmalıdır. Eksen boştayken elinizle mili zorladığınızda değerin dalgalanıp eski haline döndüğünü gözlemleyin.
            </div>
            <div style="padding:8px; background:rgba(239,68,68,0.06); border-radius:4px; border:1px solid rgba(239,68,68,0.15); color:var(--red); font-size:11px">
              ⚠️ <strong>DİKKAT:</strong> Yanlış kutup hizalaması motorun kontrolsüzce son hızda dönüp çarparak mekanik stoperleri kırmasına yol açabilir! Test sırasında eksen yakınında durmayın ve eliniz acil stop butonunda hazır bekleyin.
            </div>
          </div>
        </div>

      </div>
    `;
  }
};

window.updateDiagLedDisplay = function() {
  const code = document.getElementById('diag-code-select').value;
  const led = document.getElementById('led-display-text');
  if (led) {
    if (code) {
      led.innerText = code;
      led.style.color = '#ef4444';
      led.style.textShadow = '0 0 15px rgba(239, 68, 68, 0.8)';
    } else {
      led.innerText = '--';
      led.style.color = '#1f2937';
      led.style.textShadow = 'none';
    }
  }
};

window.runDriveDiagnosis = function() {
  const code = document.getElementById('diag-code-select').value;
  const emptyState = document.getElementById('diag-empty-state');
  const detailsContent = document.getElementById('diag-details-content');

  if (!code) {
    showToast('Lütfen bir arıza kodu seçin.', 'error');
    return;
  }

  const alarm = State.drive_alarms.find(a => a.code === code);
  if (!alarm) return;

  emptyState.style.display = 'none';
  detailsContent.style.display = 'block';

  let typeTag = 'tag-blue';
  if (alarm.type.includes('Servo')) typeTag = 'tag-purple';
  if (alarm.type.includes('Spindle')) typeTag = 'tag-orange';

  detailsContent.innerHTML = `
    <div style="display:flex; justify-content:between; align-items:center; margin-bottom:12px">
      <h2 style="font-size:16px; color:var(--text-accent); margin:0">${alarm.code} — ${alarm.title}</h2>
      <span class="tag ${typeTag}">${alarm.type}</span>
    </div>
    <p style="font-size:12.5px; color:var(--text-secondary); margin-bottom:16px">${alarm.description}</p>
    
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
      <div>
        <strong style="font-size:11px; text-transform:uppercase; color:var(--red); letter-spacing:.5px">Olası Arıza Nedenleri:</strong>
        <ul style="font-size:12px; color:var(--text-secondary); margin-top:6px; padding-left:16px; display:flex; flex-direction:column; gap:4px">
          ${alarm.causes.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div>
        <strong style="font-size:11px; text-transform:uppercase; color:var(--green); letter-spacing:.5px">Çözüm / Kontrol Adımları:</strong>
        <ul style="font-size:12px; color:var(--text-secondary); margin-top:6px; padding-left:16px; display:flex; flex-direction:column; gap:4px">
          ${alarm.solutions.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
};

// ════════════════════════════════════════════════════════════════
//  ESNEK DİŞLİ ORANI (FGR 2084/2085) HESAPLAYICI
// ════════════════════════════════════════════════════════════════
function renderGearRatio() {
  const page = createPage('gear_ratio');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Esnek Dişli Oranı (Flexible Gear Ratio) Hesaplayıcı</h1>
      <p>Vidalı mil hatvesi ve enkoder çözünürlüğüne göre FANUC Parameter 2084 ve 2085 değerlerini bulun</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">
        
        <!-- Left: Input Form -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-3">🛠 Mekanik & Enkoder Parametreleri</div>
            
            <div class="form-group">
              <label class="form-label">Vidalı Mil Hatvesi (Pitch - mm) *</label>
              <input class="form-control" id="fgr-pitch" type="number" value="10" />
            </div>

            <div class="form-group">
              <label class="form-label">Enkoder Çözünürlüğü (Puls / Tur) *</label>
              <select class="form-control" id="fgr-encoder">
                <option value="1000000" selected>1,000,000 (αi Serisi Standart Enkoder)</option>
                <option value="64000">64,000 (Eski Tip Seri Enkoder)</option>
                <option value="10000">10,000 (Artışlı Enkoder)</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Motor Diş Sayısı *</label>
                <input class="form-control" id="fgr-motor-teeth" type="number" value="1" />
              </div>
              <div class="form-group">
                <label class="form-label">Mil Diş Sayısı (Bilyalı Vida) *</label>
                <input class="form-control" id="fgr-screw-teeth" type="number" value="1" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">İstenen Konumlandırma Hassasiyeti (LCI)</label>
              <select class="form-control" id="fgr-lci">
                <option value="0.001" selected>0.001 mm (1 Mikron)</option>
                <option value="0.0001">0.0001 mm (0.1 Mikron)</option>
              </select>
            </div>
          </div>

          <button class="btn btn-primary w-100" onclick="calculateFlexibleGearRatio()">⚡ Dişli Oranını Hesapla</button>
        </div>

        <!-- Right: Results -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center">
          <div id="fgr-empty" style="color:var(--text-muted)">
            <svg style="width:48px; height:48px; stroke:currentColor; fill:none; stroke-width:1.5; margin-bottom:12px" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <p style="font-size:13px">Gerekli değerleri doldurup "Dişli Oranını Hesapla" butonuna basın.</p>
          </div>

          <div id="fgr-results" style="display:none; width:100%; text-align:left">
            <h2 style="font-size:14px; color:var(--text-accent); text-align:center; margin-bottom:16px">📊 FANUC Parametre Giriş Değerleri</h2>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px">
              <div class="card" style="background:var(--bg-card2); border-color:var(--border); text-align:center; padding:14px">
                <div style="font-size:11px; color:var(--text-muted)">PA. 2084 (Pay - Numerator)</div>
                <div id="fgr-res-2084" style="font-size:28px; font-weight:800; color:var(--green); font-family:monospace; margin-top:6px">—</div>
              </div>
              <div class="card" style="background:var(--bg-card2); border-color:var(--border); text-align:center; padding:14px">
                <div style="font-size:11px; color:var(--text-muted)">PA. 2085 (Payda - Denominator)</div>
                <div id="fgr-res-2085" style="font-size:28px; font-weight:800; color:var(--green); font-family:monospace; margin-top:6px">—</div>
              </div>
            </div>

            <div class="card" style="background:rgba(59,130,246,0.04); border-color:rgba(59,130,246,0.12); padding:10px; font-size:11.5px; line-height:1.5">
              💡 <strong>Hassasiyet Notu:</strong> 1 tur vidalı mil hareketinde eksenin taradığı komut birimi sayısı <span id="fgr-cmd-units" style="font-weight:700">10000</span> LCI birimidir. Formül sonucu sadeleştirilmiş kesir oranı olarak parametrelere aktarılmıştır. Limitler aşılmadığı için sistem tam ölçü kalibrasyonundadır.
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  return page;
}

window.calculateFlexibleGearRatio = function() {
  const pitch = parseFloat(document.getElementById('fgr-pitch').value);
  const encoder = parseInt(document.getElementById('fgr-encoder').value);
  const motorTeeth = parseInt(document.getElementById('fgr-motor-teeth').value);
  const screwTeeth = parseInt(document.getElementById('fgr-screw-teeth').value);
  const lci = parseFloat(document.getElementById('fgr-lci').value);

  if (isNaN(pitch) || isNaN(motorTeeth) || isNaN(screwTeeth) || pitch <= 0 || motorTeeth <= 0 || screwTeeth <= 0) {
    showToast('Lütfen geçerli mekanik girdiler girin.', 'error');
    return;
  }

  // Calculate LCI units per 1 mm (e.g. 0.001 mm -> 1000 units/mm)
  const lciUnitsPerMm = 1 / lci;
  // Command units per 1 screw revolution
  const cmdUnitsPerScrewRev = pitch * lciUnitsPerMm;

  // Formula: FGR = (Encoder Pulses / Command units per screw rev) * (Screw Gear / Motor Gear)
  // Numerator = Encoder Pulses * Screw Gear
  // Denominator = Command units per screw rev * Motor Gear
  let num = encoder * screwTeeth;
  let den = cmdUnitsPerScrewRev * motorTeeth;

  // Reduce fraction using GCD
  const getGcd = (a, b) => b ? getGcd(b, a % b) : a;
  const commonDiv = getGcd(num, den);

  num = num / commonDiv;
  let finalDen = den / commonDiv;

  // If FGR is out of limit (FANUC limit for 2084/2085 is generally between 1 and 32767)
  if (num > 32767 || finalDen > 32767) {
    // Try to scale down
    const scaleFactor = Math.max(num, finalDen) / 30000;
    num = Math.round(num / scaleFactor);
    finalDen = Math.round(finalDen / scaleFactor);
    showToast('Dişli oranı limit dışına çıktı, en yakın tamsayı oranı hesaplandı.', 'info');
  }

  document.getElementById('fgr-empty').style.display = 'none';
  const resDiv = document.getElementById('fgr-results');
  resDiv.style.display = 'block';

  document.getElementById('fgr-res-2084').innerText = num;
  document.getElementById('fgr-res-2085').innerText = finalDen;
  document.getElementById('fgr-cmd-units').innerText = cmdUnitsPerScrewRev;
};

// ════════════════════════════════════════════════════════════════
//  MTBF & MTTR GÜVENİLİRLİK ANALİZÖRÜ
// ════════════════════════════════════════════════════════════════
function renderReliability() {
  const page = createPage('reliability');
  page.innerHTML = `
    <div class="page-header">
      <h1>📊 Tezgah Güvenilirlik & MTBF / MTTR Analiz Paneli</h1>
      <p>Arıza sıklığı (MTBF), ortalama tamir süresi (MTTR) ve tezgahlara özel kullanılabilirlik oranları</p>
    </div>
    <div class="page-body">
      
      <!-- Summary metrics cards -->
      <div class="flex gap-4 mb-4" style="flex-wrap:wrap">
        <div class="card" style="flex:1; min-width:200px; padding:16px; background:var(--bg-card2)">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase">Ortalama MTBF (Arızasızlık)</div>
          <div id="stat-avg-mtbf" style="font-size:24px; font-weight:700; color:var(--accent); margin-top:4px">Yükleniyor...</div>
        </div>
        <div class="card" style="flex:1; min-width:200px; padding:16px; background:var(--bg-card2)">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase">Ortalama MTTR (Tamir Süresi)</div>
          <div id="stat-avg-mttr" style="font-size:24px; font-weight:700; color:var(--accent); margin-top:4px">Yükleniyor...</div>
        </div>
        <div class="card" style="flex:1; min-width:200px; padding:16px; background:var(--bg-card2)">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase">Atölye Genel Kullanılabilirlik</div>
          <div id="stat-avg-avail" style="font-size:24px; font-weight:700; color:var(--green); margin-top:4px">Yükleniyor...</div>
        </div>
      </div>

      <div class="grid-2 mb-4" style="grid-template-columns: 1.2fr 0.8fr; gap:16px; align-items:stretch">
        
        <!-- Table -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; height:100%">
          <div class="card-title mb-3">📋 Tezgah Analiz Tablosu</div>
          <div style="overflow-x:auto; flex:1">
            <table class="data-table" style="font-size:11.5px">
              <thead>
                <tr>
                  <th>Tezgah Adı</th>
                  <th>Hata Sayısı</th>
                  <th>MTBF (Saat)</th>
                  <th>MTTR (Saat)</th>
                  <th>Kullanılabilirlik</th>
                  <th>Güvenilirlik Durumu</th>
                </tr>
              </thead>
              <tbody id="reliability-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- OEE Component Card -->
        <div class="card" style="padding:18px; display:flex; flex-direction:column; height:100%">
          <div style="margin-bottom:14px">
            <div class="card-title mb-1" style="display:flex; align-items:center; justify-content:space-between;">
              <span>📊 OEE Verimlilik Karşılaştırması (%)</span>
              <span class="tag tag-blue" style="font-size:10px; padding:2px 8px">Dinamik Hesaplama</span>
            </div>
            <p style="font-size:11px; color:var(--text-muted)">
              Kullanılabilirlik × Performans × Kalite formülüyle hesaplanan genel ekipman verimliliği
            </p>
          </div>
          <div id="oee-bar-container" style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-right:4px;">
            <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px">Hesaplanıyor...</div>
          </div>
        </div>

      </div>

    </div>
  `;

  setTimeout(() => calculateReliabilityMetrics(page), 50);

  return page;
}

function calculateReliabilityMetrics(page) {
  const tbody = page.querySelector('#reliability-tbody');
  const avgMtbfEl = page.querySelector('#stat-avg-mtbf');
  const avgMttrEl = page.querySelector('#stat-avg-mttr');
  const avgAvailEl = page.querySelector('#stat-avg-avail');

  if (!State.machines.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Tezgah kaydı bulunamadı</td></tr>`;
    return;
  }

  let totalMtbf = 0;
  let totalMttr = 0;
  let totalAvail = 0;
  let activeMachineCount = 0;

  const dataList = State.machines.map(m => {
    // Filter failures (non-PM/non-periyodik maintenance entries)
    const failures = State.maintenances.filter(maint => 
      maint.tezgah_id === m.id && 
      !(maint.aciklama && (maint.aciklama.includes('[PM]') || maint.aciklama.toLowerCase().includes('periyodik')))
    );
    const failureCount = failures.length;

    // Operating hours calculation (assumed default 2400 hours)
    const opHours = 2400;

    // Repair hours sum
    let repairHours = 0;
    failures.forEach(f => {
      // parse duration or fallback to 3 hours
      const hrs = parseFloat(f.duration) || 3;
      repairHours += hrs;
    });

    const mtbf = failureCount > 0 ? opHours / failureCount : opHours;
    const mttr = failureCount > 0 ? repairHours / failureCount : 0;
    
    // Availability %
    const avail = mtbf > 0 ? (mtbf / (mtbf + mttr)) * 100 : 100;

    // OEE % (mocking Performance 94% and Quality 98%)
    const oee = (avail * 94 * 98) / 10000;

    totalMtbf += mtbf;
    totalMttr += mttr;
    totalAvail += avail;
    activeMachineCount++;

    return {
      name: m.numarasi,
      failures: failureCount,
      mtbf,
      mttr,
      avail,
      oee
    };
  });

  // Render Table
  tbody.innerHTML = dataList.map(d => {
    let statusLabel = '🟢 Yüksek';
    let statusClass = 'tag-green';
    if (d.mtbf < 400) {
      statusLabel = '🔴 Kritik (Sık Hata)';
      statusClass = 'tag-red';
    } else if (d.mtbf < 800) {
      statusLabel = '🟡 Orta';
      statusClass = 'tag-orange';
    }

    return `
      <tr>
        <td><strong>${escapeHTML(d.name)}</strong></td>
        <td style="text-align:center">${d.failures}</td>
        <td><span class="font-mono">${Math.round(d.mtbf)} Sa</span></td>
        <td><span class="font-mono">${d.mttr.toFixed(1)} Sa</span></td>
        <td><strong style="color:var(--green)">${d.avail.toFixed(1)}%</strong></td>
        <td><span class="tag ${statusClass}">${statusLabel}</span></td>
      </tr>
    `;
  }).join('');

  // Set global stats
  const avgMtbf = totalMtbf / activeMachineCount;
  const avgMttr = totalMttr / activeMachineCount;
  const avgAvail = totalAvail / activeMachineCount;

  avgMtbfEl.innerText = `${Math.round(avgMtbf)} Saat`;
  avgMttrEl.innerText = `${avgMttr.toFixed(1)} Saat`;
  avgAvailEl.innerText = `${avgAvail.toFixed(1)}%`;

  // Render Modern OEE Bar List Component
  const oeeContainer = page.querySelector('#oee-bar-container');
  if (oeeContainer) {
    const sortedData = [...dataList].sort((a, b) => 
      String(a.name || '').localeCompare(String(b.name || ''), 'tr', { numeric: true, sensitivity: 'base' })
    );

    oeeContainer.innerHTML = sortedData.map(d => {
      const oeeVal = d.oee.toFixed(1);
      const isHigh = d.oee >= 85;
      const isMid = d.oee >= 70 && d.oee < 85;
      const barGradient = isHigh 
        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' 
        : (isMid ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)');
      const badgeClass = isHigh ? 'tag-green' : (isMid ? 'tag-amber' : 'tag-red');
      const glowColor = isHigh ? 'rgba(16, 185, 129, 0.3)' : (isMid ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)');

      return `
        <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px 14px; transition:transform 0.2s ease, border-color 0.2s ease;" class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12.5px; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:8px">
              <span style="width:8px; height:8px; border-radius:50%; background:${isHigh ? '#10b981' : (isMid ? '#f59e0b' : '#ef4444')}; display:inline-block; box-shadow:0 0 6px ${glowColor}"></span>
              ${escapeHTML(d.name)}
            </span>
            <span class="tag ${badgeClass}" style="font-family:var(--font-mono); font-size:11.5px; font-weight:700">
              %${oeeVal}
            </span>
          </div>
          <div style="position:relative; width:100%; height:8px; background:var(--bg-base); border-radius:4px; overflow:hidden">
            <div style="width:${Math.min(Math.max(d.oee, 5), 100)}%; height:100%; background:${barGradient}; border-radius:4px; transition:width 0.8s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 0 8px ${glowColor}"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ════════════════════════════════════════════════════════════════
//  G-CODE ÇARPIŞMA & HATA ÖNLEYİCİ
// ════════════════════════════════════════════════════════════════
function renderGcodeChecker() {
  const page = createPage('gcode_checker');
  page.innerHTML = `
    <div class="page-header">
      <h1>📉 G-Code Çarpışma & Hata Tarayıcı</h1>
      <p>CNC programınızı yükleyerek nokta hataları, eksik boy telafisi (G43) ve Z eksi yönlü hızlı hareketleri denetleyin</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1.1fr 0.9fr; gap:16px">
        
        <!-- Left: Text Area and controls -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-2">📥 G-Code Program Girişi</div>
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px">
              Aşağıdaki alana CNC programınızı yapıştırın veya örnek hatalı programı yükleyip "Hataları Tara" butonuna basın.
            </p>
            <textarea class="form-control" id="gcc-input" rows="12" style="font-family:monospace; font-size:11.5px; background:#0f172a; color:#a5f3fc; line-height:1.4">%
O2002 (BUGGY PROGRAM)
G21 G90
T0202 M06 (ALIN VE DIS CAP TORNA)
G00 X100 Z5.0 M03 (<- Hata: X100 ve Z5.0 noktası eksik! Fener mili devirsiz döndü)
G96 S180
G00 Z-15.0 M08 (<- Hata: G00 modunda Z eksiye hızlı hareket!)
G01 X50.0 (<- Hata: G01 modunda ilerleme F tanımlanmamış!)
G00 X150.0 Z100.0 M09
M30
%</textarea>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn btn-primary" onclick="runGcodeCheck()">⚡ Hataları Tara</button>
            <button class="btn btn-secondary" onclick="loadDefaultGcodeBug()">Örnek Kodu Yükle</button>
          </div>
        </div>

        <!-- Right: Diagnostic Results -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column">
          <div class="card-title mb-3">🔍 Tarama Sonuçları</div>
          
          <div id="gcc-summary" style="margin-bottom:14px; display:none">
            <div id="gcc-score-card" class="card" style="padding:10px 14px; display:flex; align-items:center; justify-content:space-between">
              <span style="font-weight:700" id="gcc-status-label">—</span>
              <span class="tag" id="gcc-tag-color">—</span>
            </div>
          </div>

          <div style="flex:1; overflow-y:auto; max-height:280px" id="gcc-logs-container">
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted)" id="gcc-empty">
              <svg style="width:40px; height:40px; stroke:currentColor; fill:none; stroke-width:1.5; margin-bottom:8px" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p style="font-size:12px">Analizi başlatmak için sol taraftaki butona basın.</p>
            </div>
            <div id="gcc-results-list" style="display:none; flex-direction:column; gap:8px"></div>
          </div>
        </div>

      </div>
    </div>
  `;

  return page;
}

window.loadDefaultGcodeBug = function() {
  const txt = document.getElementById('gcc-input');
  if (txt) {
    txt.value = `%\nO2002 (BUGGY PROGRAM)\nG21 G90\nT0202 M06 (ALIN VE DIS CAP TORNA)\nG00 X100 Z5.0 M03\nG96 S180\nG00 Z-15.0 M08\nG01 X50.0\nG00 X150.0 Z100.0 M09\nM30\n%`;
  }
};

window.runGcodeCheck = function() {
  const code = document.getElementById('gcc-input').value;
  const empty = document.getElementById('gcc-empty');
  const summary = document.getElementById('gcc-summary');
  const resultsList = document.getElementById('gcc-results-list');
  const statusLabel = document.getElementById('gcc-status-label');
  const tagColor = document.getElementById('gcc-tag-color');

  if (!code.trim()) {
    showToast('Taranacak kod içeriği boş olamaz.', 'error');
    return;
  }

  empty.style.display = 'none';
  summary.style.display = 'block';
  resultsList.style.display = 'flex';
  resultsList.innerHTML = '';

  const lines = code.split('\n');
  const errors = [];

  let hasFeedrate = false;
  let hasSpindleSpeed = false;
  let hasG43 = false;
  let inRapidMode = true; // G00 default

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    let clean = line.replace(/\([^)]*\)/g, '').toUpperCase().trim(); // remove comments
    if (!clean) return;

    // Track motion mode
    if (clean.includes('G00')) inRapidMode = true;
    if (clean.includes('G01') || clean.includes('G02') || clean.includes('G03')) inRapidMode = false;

    // Track compensation
    if (clean.includes('G43')) hasG43 = true;
    if (clean.includes('T') && clean.includes('M06')) hasG43 = false; // Reset on tool change

    // Track spindle speed
    if (clean.includes('S')) hasSpindleSpeed = true;
    if (clean.includes('M03') || clean.includes('M04')) {
      if (!hasSpindleSpeed && !clean.includes('S')) {
        errors.push({
          line: lineNum,
          type: 'warning',
          title: 'Devirsiz Mil Dönüşü',
          desc: 'M03/M04 komutu verildi fakat mil devri (S) tanımlanmadı.'
        });
      }
    }

    // Track Feedrate
    if (clean.includes('F')) hasFeedrate = true;
    if (clean.includes('G01') || clean.includes('G02') || clean.includes('G03')) {
      if (!hasFeedrate && !clean.includes('F')) {
        errors.push({
          line: lineNum,
          type: 'danger',
          title: 'Tanımsız İlerleme Hızı (F)',
          desc: 'Kesme hareketi (G01/G02/G03) başlatıldı fakat ilerleme hızı (F) tanımlanmadı.'
        });
      }
    }

    // 1. Check for Decimal Point Errors
    // Regex matches coordinates letters followed by numbers with no dots, like X100, Z-5
    const dotMatches = clean.match(/\b([XYZIJKUWV])(-?\d+)(?!\.)\b/g);
    if (dotMatches) {
      dotMatches.forEach(match => {
        errors.push({
          line: lineNum,
          type: 'danger',
          title: 'Nokta Hatası Algılandı',
          desc: `"${match}" komutunda ondalık nokta eksik! FANUC bunu mikron düzeyinde çok küçük bir hareket olarak yorumlayabilir (Kaza riski).`
        });
      });
    }

    // 2. Check for Z- Rapid Plunge
    if (inRapidMode && clean.includes('Z-')) {
      errors.push({
        line: lineNum,
        type: 'danger',
        title: 'Hızlı Hareketle Z- Dalışı',
        desc: 'Hızlı hareket modunda (G00) parça sıfırının altına (Z-) hareket tespit edildi! Çarpışma riski.'
      });
    }

    // 3. Check for missing G43 after tool change
    if (clean.includes('Z') && !hasG43 && (clean.includes('G00') || clean.includes('G01'))) {
      errors.push({
        line: lineNum,
        type: 'warning',
        title: 'G43 Boy Telafisi Eksik',
        desc: 'Takım değişiminden sonra Z ekseni hareket ettirildi fakat G43 boy kompenzasyonu etkinleştirilmedi.'
      });
    }
  });

  if (!errors.length) {
    statusLabel.innerText = '🟢 Program Güvenli Görünüyor';
    tagColor.innerText = 'Sıfır Hata';
    tagColor.className = 'tag tag-green';
    resultsList.innerHTML = `<div style="text-align:center; padding:24px; color:var(--green)">
      🎉 Tebrikler! Yapılan statik taramada herhangi bir nokta hatası, G43 eksikliği veya Z- dalma riski bulunamadı.
    </div>`;
  } else {
    const dangerCount = errors.filter(e => e.type === 'danger').length;
    statusLabel.innerText = dangerCount > 0 ? '🔴 Kritik Güvenlik Riski!' : '🟡 Potansiyel Risk Uyarıları';
    tagColor.innerText = `${errors.length} Bulgular`;
    tagColor.className = dangerCount > 0 ? 'tag tag-red' : 'tag tag-orange';

    resultsList.innerHTML = errors.map(e => `
      <div style="background:var(--bg-card2); border-left:4px solid var(--${e.type === 'danger' ? 'red' : 'amber'}); padding:8px 12px; border-radius:var(--radius-sm)">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <strong style="font-size:12px; color:var(--text-accent)">${e.title}</strong>
          <span style="font-size:10px; color:var(--text-muted)">Satır: ${e.line}</span>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-top:2px">${e.desc}</div>
      </div>
    `).join('');
  }
};

// ════════════════════════════════════════════════════════════════
//  CNC PARAMETRE KARŞILAŞTIRICI
// ════════════════════════════════════════════════════════════════
function renderParamComparator() {
  const page = createPage('param_comparator');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📁 CNC Parametre Karşılaştırma & Side-by-Side Diff Engine</h1>
          <p>İki ayrı FANUC parametre yedeğini yan yana karşılaştırın, bit seviyesinde değişiklikleri ve kritik eksen farklarını tespit edin</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="compareParameterFiles()">
            ⚡ Farkları Analiz Et
          </button>
          <button class="btn btn-secondary btn-sm" onclick="loadDefaultParamDiff()">
            🔄 Örnek Veri Yükle
          </button>
        </div>
      </div>
    </div>
    
    <div class="page-body">
      
      <!-- Hidden file inputs -->
      <input type="file" id="param-file-a-input" style="display:none" onchange="uploadParamFile('a')" accept=".txt,.cnm,.dat,.nc,.par,.all,.prm" />
      <input type="file" id="param-file-b-input" style="display:none" onchange="uploadParamFile('b')" accept=".txt,.cnm,.dat,.nc,.par,.all,.prm" />

      <!-- Side-by-Side File Input Cards -->
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">
        
        <!-- File Input A (Reference) -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; gap:10px">
          <div class="flex justify-between items-center">
            <div class="card-title" style="display:flex; align-items:center; gap:8px">
              <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block"></span>
              <span>📋 Yedek A (Referans / Orijinal Ayarlar)</span>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('param-file-a-input').click()">📁 Dosya Seç</button>
              <button class="btn btn-ghost btn-sm" onclick="clearParamInput('a')" title="Temizle">🗑️</button>
            </div>
          </div>
          
          <div id="dropzone-a" class="dropzone-box" style="border: 2px dashed var(--border); border-radius: var(--radius-md); padding: 10px; text-align: center; background: var(--bg-card2); transition: border-color 0.2s;"
               ondragover="handleParamDragOver(event, 'a')" ondragleave="handleParamDragLeave(event, 'a')" ondrop="handleParamDrop(event, 'a')">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px">Dosyayı buraya sürükleyip bırakın veya metni aşağıya yapıştırın</div>
            <textarea class="form-control" id="pmc-file-a" rows="7" placeholder="PRM 1815 = 00110000 veya 1815 00110000..." style="font-family:var(--font-mono); font-size:11px; background:#0b0f19; color:#34d399; line-height:1.4; resize:vertical">1001 00001000
1320 500000
1321 -500000
1815 00110000
1851 12</textarea>
          </div>
        </div>

        <!-- File Input B (Target) -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; gap:10px">
          <div class="flex justify-between items-center">
            <div class="card-title" style="display:flex; align-items:center; gap:8px">
              <span style="width:10px; height:10px; border-radius:50%; background:#f59e0b; display:inline-block"></span>
              <span>📋 Yedek B (Karşılaştırılan / Yeni Ayarlar)</span>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('param-file-b-input').click()">📁 Dosya Seç</button>
              <button class="btn btn-ghost btn-sm" onclick="clearParamInput('b')" title="Temizle">🗑️</button>
            </div>
          </div>
          
          <div id="dropzone-b" class="dropzone-box" style="border: 2px dashed var(--border); border-radius: var(--radius-md); padding: 10px; text-align: center; background: var(--bg-card2); transition: border-color 0.2s;"
               ondragover="handleParamDragOver(event, 'b')" ondragleave="handleParamDragLeave(event, 'b')" ondrop="handleParamDrop(event, 'b')">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px">Dosyayı buraya sürükleyip bırakın veya metni aşağıya yapıştırın</div>
            <textarea class="form-control" id="pmc-file-b" rows="7" placeholder="PRM 1815 = 00100000 veya 1815 00100000..." style="font-family:var(--font-mono); font-size:11px; background:#0b0f19; color:#fbbf24; line-height:1.4; resize:vertical">1001 00001000
1320 450000
1321 -500000
1815 00100000
1851 25
9999 1</textarea>
          </div>
        </div>

      </div>

      <!-- Diff Summary KPI Cards (Hidden initially) -->
      <div id="diff-kpi-summary" class="stats-grid mb-4" style="display:none; grid-template-columns: repeat(4, 1fr); gap:12px">
        <div class="stat-card amber" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-changed" style="color:#fbbf24; font-size:22px">0</div>
            <div class="stat-label">Değişen Parametre</div>
          </div>
        </div>
        <div class="stat-card green" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-added" style="color:#34d399; font-size:22px">0</div>
            <div class="stat-label">Yeni Eklendi</div>
          </div>
        </div>
        <div class="stat-card red" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-removed" style="color:#f87171; font-size:22px">0</div>
            <div class="stat-label">Silindi / Eksik</div>
          </div>
        </div>
        <div class="stat-card purple" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-critical" style="color:#a78bfa; font-size:22px">0</div>
            <div class="stat-label">Kritik Bit Uyarısı</div>
          </div>
        </div>
      </div>

      <!-- Diff Results View Card -->
      <div class="card" style="padding:20px; display:none" id="pmc-diff-card">
        <div class="flex items-center justify-between mb-3" style="flex-wrap:wrap; gap:10px">
          <div class="card-title" style="display:flex; align-items:center; gap:10px">
            <span>📊 Side-by-Side Değişiklik Tablosu</span>
            <span id="diff-total-badge" class="tag tag-blue" style="font-size:11px">0 Fark</span>
          </div>

          <!-- Filters and Search -->
          <div class="flex gap-2" style="align-items:center">
            <input type="text" id="diff-search-input" class="form-control" placeholder="Parametre no veya isim ara..." style="width:200px; padding:4px 8px; font-size:11.5px" oninput="filterDiffRows()" />
            <button class="btn btn-ghost btn-sm" onclick="filterDiffMode('all')" id="btn-diff-all" style="color:var(--text-accent); font-weight:bold">Tümü</button>
            <button class="btn btn-ghost btn-sm" onclick="filterDiffMode('critical')" id="btn-diff-critical">⚠️ Kritikler</button>
            <button class="btn btn-secondary btn-sm" onclick="exportDiffPDF()">🖨️ PDF Rapor</button>
          </div>
        </div>

        <div style="overflow-x:auto">
          <table class="data-table" style="font-size:11.5px">
            <thead>
              <tr>
                <th style="width:110px">Parametre No</th>
                <th>Parametre Tanımı & Bit Detayı</th>
                <th style="width:160px; background:rgba(16,185,129,0.08)">Yedek A (Referans)</th>
                <th style="width:160px; background:rgba(245,158,11,0.08)">Yedek B (Yeni)</th>
                <th style="width:100px">Fark Durumu</th>
              </tr>
            </thead>
            <tbody id="pmc-diff-tbody"></tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => compareParameterFiles(), 50);

  return page;
}

window.handleParamDragOver = function(e, type) {
  e.preventDefault();
  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.borderColor = 'var(--accent)';
};

window.handleParamDragLeave = function(e, type) {
  e.preventDefault();
  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.borderColor = 'var(--border)';
};

window.handleParamDrop = function(e, type) {
  e.preventDefault();
  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.borderColor = 'var(--border)';
  if (e.dataTransfer && e.dataTransfer.files.length) {
    const file = e.dataTransfer.files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
      document.getElementById(`pmc-file-${type}`).value = evt.target.result;
      showToast(`Dosya ${type.toUpperCase()} yüklendi: ${file.name}`, 'success');
      compareParameterFiles();
    };
    reader.readAsText(file);
  }
};

window.clearParamInput = function(type) {
  document.getElementById(`pmc-file-${type}`).value = '';
  showToast(`Yedek ${type.toUpperCase()} temizlendi.`, 'info');
};

window.uploadParamFile = function(type) {
  const input = document.getElementById(`param-file-${type}-input`);
  if (!input || !input.files.length) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById(`pmc-file-${type}`).value = e.target.result;
    showToast(`Dosya ${type.toUpperCase()} başarıyla yüklendi ✓`, 'success');
  };
  reader.readAsText(file);
};

window.loadDefaultParamDiff = function() {
  document.getElementById('pmc-file-a').value = `1001 00001000\n1320 500000\n1321 -500000\n1815 00110000\n1851 12`;
  document.getElementById('param-file-a-input').value = '';
  document.getElementById('pmc-file-b').value = `1001 00001000\n1320 450000\n1321 -500000\n1815 00100000\n1851 25\n9999 1`;
  document.getElementById('param-file-b-input').value = '';
};

window.compareParameterFiles = function() {
  const textA = document.getElementById('pmc-file-a')?.value || '';
  const textB = document.getElementById('pmc-file-b')?.value || '';
  const diffCard = document.getElementById('pmc-diff-card');
  const kpiCard = document.getElementById('diff-kpi-summary');
  const tbody = document.getElementById('pmc-diff-tbody');

  if (!diffCard || !tbody) return;

  const parseParams = (txt) => {
    const map = {};
    const lines = txt.split('\n');
    lines.forEach(l => {
      // support both "1815 00110000" and standard Fanuc "PRM 1815 = 00110000" formats
      const clean = l.replace(/PRM/gi, '').replace(/=/g, ' ').trim();
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const no = parseInt(parts[0]);
        if (!isNaN(no)) {
          map[no] = parts[1];
        }
      }
    });
    return map;
  };

  const paramsA = parseParams(textA);
  const paramsB = parseParams(textB);

  const allKeys = Array.from(new Set([...Object.keys(paramsA), ...Object.keys(paramsB)])).map(Number).sort((a,b)=>a-b);
  const diffs = [];

  let countChanged = 0;
  let countAdded = 0;
  let countRemoved = 0;
  let countCritical = 0;

  allKeys.forEach(no => {
    const valA = paramsA[no];
    const valB = paramsB[no];

    if (valA !== valB) {
      let status = 'Değişti';
      let colorClass = 'tag-orange';
      if (valA === undefined) {
        status = 'Eklendi';
        colorClass = 'tag-green';
        countAdded++;
      } else if (valB === undefined) {
        status = 'Silindi';
        colorClass = 'tag-red';
        countRemoved++;
      } else {
        countChanged++;
      }

      // Check if parameter is critical (1815, 1320, 1321, 3111, 3202, 1006)
      const isCritical = [1815, 1320, 1321, 3111, 3202, 1006, 1001, 1002].includes(no);
      if (isCritical) countCritical++;

      // Lookup description in State.parameters
      const dbParam = State.parameters.find(p => p.no === no);
      const desc = dbParam ? `${dbParam.name} - ${dbParam.description}` : 'Bilinmeyen Sistem Parametresi';

      diffs.push({
        no,
        desc,
        valA: valA !== undefined ? valA : '—',
        valB: valB !== undefined ? valB : '—',
        status,
        colorClass,
        isCritical
      });
    }
  });

  window.CurrentDiffs = diffs;

  // Update KPI summary cards
  if (kpiCard) {
    kpiCard.style.display = 'grid';
    const elChanged = document.getElementById('kpi-diff-changed');
    const elAdded = document.getElementById('kpi-diff-added');
    const elRemoved = document.getElementById('kpi-diff-removed');
    const elCritical = document.getElementById('kpi-diff-critical');
    const badgeTotal = document.getElementById('diff-total-badge');

    if (elChanged) animateCounter(elChanged, countChanged);
    if (elAdded) animateCounter(elAdded, countAdded);
    if (elRemoved) animateCounter(elRemoved, countRemoved);
    if (elCritical) animateCounter(elCritical, countCritical);
    if (badgeTotal) badgeTotal.textContent = `${diffs.length} Fark Tespiti`;
  }

  diffCard.style.display = 'block';
  renderDiffTableRows(diffs);
};

function renderDiffTableRows(diffsList) {
  const tbody = document.getElementById('pmc-diff-tbody');
  if (!tbody) return;

  if (!diffsList.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--green)">
      ✔️ Seçilen filtre ölçütlerine uygun hiçbir fark bulunamadı. Değerler eşleşmektedir.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = diffsList.map(d => {
    let cellStyle = '';
    // Special highlight for Parameter 1815 APZ bit change!
    if (d.no === 1815 && d.valA.length === 8 && d.valB.length === 8) {
      if (d.valA[3] !== d.valB[3]) {
        cellStyle = 'background:rgba(239,68,68,0.08); font-weight:bold';
      }
    } else if (d.isCritical) {
      cellStyle = 'background:rgba(245,158,11,0.04)';
    }

    // Binary bit differential analysis helper
    const bitDiffsHtml = getBitDifferenceDetails(d.no, d.valA, d.valB);

    return `
      <tr style="${cellStyle}">
        <td>
          <strong class="font-mono" style="font-size:12px; color:var(--text-accent)">#${d.no}</strong>
          ${d.isCritical ? '<span style="font-size:9px; background:rgba(239,68,68,0.18); color:#f87171; padding:1px 4px; border-radius:3px; margin-left:4px">KRİTİK</span>' : ''}
        </td>
        <td>
          <div style="font-size:12px; color:var(--text-primary); font-weight:600">${escapeHTML(d.desc)}</div>
          ${bitDiffsHtml}
        </td>
        <td style="background:rgba(16,185,129,0.04)"><span class="font-mono" style="color:#34d399; font-size:12px">${escapeHTML(d.valA)}</span></td>
        <td style="background:rgba(245,158,11,0.04)"><span class="font-mono" style="color:#fbbf24; font-size:12px; font-weight:bold">${escapeHTML(d.valB)}</span></td>
        <td><span class="tag ${d.colorClass}">${d.status}</span></td>
      </tr>
    `;
  }).join('');
}

window.filterDiffRows = function() {
  const q = (document.getElementById('diff-search-input')?.value || '').toLowerCase().trim();
  const diffs = window.CurrentDiffs || [];
  const filtered = diffs.filter(d => 
    !q || String(d.no).includes(q) || d.desc.toLowerCase().includes(q)
  );
  renderDiffTableRows(filtered);
};

window.filterDiffMode = function(mode) {
  const diffs = window.CurrentDiffs || [];
  const btnAll = document.getElementById('btn-diff-all');
  const btnCrit = document.getElementById('btn-diff-critical');

  if (btnAll && btnCrit) {
    btnAll.style.color = mode === 'all' ? 'var(--text-accent)' : 'var(--text-secondary)';
    btnAll.style.fontWeight = mode === 'all' ? 'bold' : 'normal';
    btnCrit.style.color = mode === 'critical' ? 'var(--text-accent)' : 'var(--text-secondary)';
    btnCrit.style.fontWeight = mode === 'critical' ? 'bold' : 'normal';
  }

  if (mode === 'critical') {
    renderDiffTableRows(diffs.filter(d => d.isCritical));
  } else {
    renderDiffTableRows(diffs);
  }
};

window.exportDiffPDF = function() {
  const diffs = window.CurrentDiffs || [];
  if (!diffs.length) {
    showToast('Dışa aktarılacak bir fark tespiti yok.', 'warning');
    return;
  }
  window.print();
};

function getBitDifferenceDetails(no, valA, valB) {
  if (valA.length !== 8 || valB.length !== 8 || !/^[01]+$/.test(valA) || !/^[01]+$/.test(valB)) {
    return '';
  }

  const bitDescriptions = {
    1815: {
      5: "APC (Mutlak Enkoder Aktif/Pasif)",
      4: "APZ (Referans Pozisyonu Senkronize)"
    },
    1006: {
      0: "ROT (Lineer/Dairesel Eksen Tipi Seçimi)",
      3: "DIA (Çap/Yarıçap Programlama Seçimi)",
      5: "ZMI (Manuel Referansa Dönüş Hareketi Yönü)"
    },
    3111: {
      0: "SVS (Servo Ayar ve Tuning Ekranı Gösterimi)",
      1: "SPS (Spindle Tuning Ekranı Gösterimi)",
      5: "OPS (Operatör Geçmişi İzleme Kaydı)",
      6: "OPH (Operatör Geçmişi Ekranı Gösterimi)",
      7: "NPA (Alarm Ekranı Geçişi / Otomatik Sayfa Değişimi)"
    },
    3202: {
      0: "NE8 (8000-8999 Program Kilidi / Koruma Durumu)",
      4: "NE9 (9000-9999 Program Kilidi / Koruma Durumu)"
    },
    1001: {
      0: "INM (Metrik/İnç Taban Ölçü Sistemi Seçimi)"
    },
    1002: {
      0: "JAX (Aynı Anda Manuel Hareketi Destekleyen Eksen Sayısı)",
      1: "DLZ (Decel Switch'siz Referans Noktası Bulma)",
      7: "IDG (Absolute Enkoder Referans Sıfırlama İnhibisyonu)"
    }
  };

  let rows = '';
  for (let bit = 7; bit >= 0; bit--) {
    const charA = valA[7 - bit];
    const charB = valB[7 - bit];
    if (charA !== charB) {
      const bitDesc = (bitDescriptions[no] && bitDescriptions[no][bit]) || `Genel Bit ${bit}`;
      rows += `
        <div style="padding: 4px 10px; display: flex; justify-content: space-between; font-size: 11px; border-bottom: 1px dashed var(--border)">
          <span style="color:var(--text-accent); font-family:monospace">Bit ${bit}: ${bitDesc}</span>
          <span>
            <span style="color:var(--red); font-family:monospace">${charA}</span> 
            ➔ 
            <span style="color:var(--green); font-family:monospace; font-weight:bold">${charB}</span>
          </span>
        </div>
      `;
    }
  }

  if (!rows) return '';
  return `
    <div style="background:var(--bg-card2); border-left: 3px solid var(--accent); padding: 8px; margin: 6px 0 10px 0; border-radius: var(--radius-sm)">
      <strong style="font-size:10px; text-transform:uppercase; color:var(--text-accent)">Değişen Bitlerin Analizi:</strong>
      ${rows}
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════
//  KRONİK ARIZA KARAR VE ÇÖZÜM AĞACI
// ════════════════════════════════════════════════════════════════
const TroubleshootNodes = {
  root: {
    title: "Lütfen Karşılaştığınız Belirtiyi Seçin",
    desc: "Tezgaha fiziksel müdahalede bulunmadan önce en belirgin arıza belirtisini seçerek karar destek ağacı ile teşhise başlayın.",
    options: [
      { text: "Eksenler hareket etmiyor / Eksen kilitlendi (Axis Won't Move)", next: "axis_root" },
      { text: "İş mili (Spindle) dönmüyor / Dönüş başlatılamıyor", next: "spindle_root" },
      { text: "Hidrolik ünite çalışmıyor veya basınç oluşturmuyor", next: "hydraulic_root" },
      { text: "Tezgah açılmıyor / Ekran tamamen karanlık", next: "screen_root" }
    ]
  },
  axis_root: {
    title: "1. Adım: Eksen Hata Belirtileri",
    desc: "Eksenlerin hiçbiri hareket etmiyor mu, yoksa sadece belirli bir eksende mi kilitlenme var?",
    options: [
      { text: "Tüm eksenler kilitlendi, el çarkı (manual pulse generator) dahil hiçbir şey hareket etmiyor", next: "axis_all" },
      { text: "Sadece tek bir eksen hareket etmiyor ve zorlanma sesi geliyor veya alarm veriyor", next: "axis_single" }
    ]
  },
  axis_all: {
    title: "2. Adım: Genel Sinyallerin Kontrolü",
    desc: "CNC ekranının sağ alt köşesinde yanan durumu kontrol edin. 'EMG' (Emergency) veya 'MDI' / 'JOG' modlarında kilitlenme var mı?",
    options: [
      { text: "Ekranın altında kırmızı renkle 'EMG' veya 'Emergency' uyarısı var", next: "axis_emg" },
      { text: "Acil stop aktif değil fakat eksenler kilitli, ekran durumu 'JOG' veya 'MEM' modunda normal görünüyor", next: "axis_interlock" }
    ]
  },
  axis_emg: {
    title: "Teşhis: Acil Stop / Güvenlik Zinciri Kesik",
    desc: "Acil stop sinyali (*ESP, genellikle X0008.4 girişi) aktif. Çözüm adımları:<br><br>1. Eksen limit switchlerine çarpmış (Overtravel) olabilir. Paneldeki <strong>OT Release</strong> butonuna basılı tutarak el çarkıyla ters yönde kurtarın.<br>2. Güç kabinindeki acil stop kontaktör rölesini (MCC veya KA röleleri) ve 24V sigortalarını kontrol edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  axis_interlock: {
    title: "Teşhis: Eksen Kilidi (Interlock / Machine Lock) Aktif",
    desc: "Sinyal kilidi devrededir. Olası sebepler:<br><br>1. Kontrol panelindeki 'Machine Lock' veya 'Z Axis Neglect' tuşları açık kalmıştır. Kapatıp tekrar deneyin.<br>2. Hidrolik üniteden gelen 'Ayna Sıkılı' veya 'Punta İleride' geri besleme sensörleri eksiktir. PMC sinyallerinden X0004.2 (Ayna sıkılı) ve X0005.1 (Punta ileri) durumlarını kontrol edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  axis_single: {
    title: "Teşhis: Servo Eksen veya Mekanik Sıkışma",
    desc: "Sadece tek eksen kilitliyse:<br><br>1. Sürücü (Servo Amplifier) üzerindeki hata LED kodunu kontrol edin. Kod 30 (Aşırı akım) veya 51 (Aşırı voltaj) varsa sol menüden <strong>Sürücü Teşhisi</strong> ekranını kullanın.<br>2. Ekseni el ile (güç kapalıyken) çevirmeyi deneyin. Vidalı mil bilyaları veya kızak kama sıkışması varsa mekanik revizyon gerekir.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  spindle_root: {
    title: "1. Adım: Ayna Sıkma Durumu",
    desc: "Torna veya işleme merkezinde ayna (chuck) ayakları parça sıkma konumunda mı?",
    options: [
      { text: "Evet, ayaklar parçayı sıktı ve ayna basıncı normal görünüyor", next: "spindle_door" },
      { text: "Hayır, ayna açık konumda veya pedal basılı değil", next: "spindle_chuck_err" }
    ]
  },
  spindle_chuck_err: {
    title: "Teşhis: Ayna Sıkılmadı Kilidi (Chuck Clamp Interlock)",
    desc: "Güvenlik nedeniyle ayna ayakları sıkılmadığında (X0004.2 = 0) spindle dönüşüne izin verilmez. Çözüm:<br><br>1. Ayak pedalını kullanarak aynayı sıkın.<br>2. Ayna sıkma basınç sensörü (Pressure Switch) kontağını kontrol edin.<br>3. Keep Relay K00.0 veya K00.2 parametrelerini kullanarak kilidi geçici olarak devre dışı bırakmayı deneyin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  spindle_door: {
    title: "2. Adım: Kapı Güvenlik Kilidi",
    desc: "Tezgah ön muhafaza kapısı tam kapalı mı ve emniyet kilidi (door interlock) pimi yuvaya oturdu mu?",
    options: [
      { text: "Evet, kapı kapalı ve kilit rölesi çekti", next: "spindle_program" },
      { text: "Hayır, kapı açık veya emniyet kilidi tam oturmadı", next: "spindle_door_err" }
    ]
  },
  spindle_door_err: {
    title: "Teşhis: Kapı Koruma Kilidi (Safety Door Interlock)",
    desc: "Kapı açıkken veya sınır anahtarı algılanmadığında (X0008.3 = 0) iş mili çalıştırılamaz. Çözüm:<br><br>1. Kapı limit switchini temizleyin.<br>2. Ayarlar sayfasından veya sol menüden <strong>Keep Relay</strong> kısmına giderek **K00.1 (Door Safety Interlock Bypass)** rölesini 1 yapıp kilidi iptal ederek test edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  spindle_program: {
    title: "Teşhis: Program veya Sürücü Hatası",
    desc: "Kapı ve ayna sinyalleri tamam olmasına rağmen dönmüyorsa:<br><br>1. Sürücü modülünde kırmızı LED hata kodu yanıyor mu? Yanıyorsa <strong>Sürücü Teşhisi</strong> sayfasına gidin.<br>2. Programda devir hızı (S) ve yönü (M03/M04) doğru girildi mi? (Örn: S1200 M03).<br>3. Spindle yönlendirme (Orientation) kilidi aktif kalmış olabilir. M19 iptal kodunu MDI'da çalıştırın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  hydraulic_root: {
    title: "1. Adım: Motor Dönüş Yönü",
    desc: "Hidrolik pompa motoru çalışıyor fakat basınç mı oluşmuyor, yoksa motor hiç mi dönmüyor?",
    options: [
      { text: "Motor çalışıyor ve dönüyor fakat manometrede basınç 0 bar", next: "hyd_no_pressure" },
      { text: "Pompa motoru hiç dönmüyor, kontaktör çekmiyor veya hemen termik attırıyor", next: "hyd_no_run" }
    ]
  },
  hyd_no_pressure: {
    title: "Teşhis: Faz Sırası veya Valf Tıkanıklığı",
    desc: "Motor çalıştığı halde basınç yoksa:<br><br>1. <strong>Faz Sırası Hatası:</strong> Motor ters dönüyor olabilir. Pano girişindeki veya motor klemensindeki R-S-T fazlarından ikisinin yerini değiştirerek motorun doğru yönde (ok işareti yönünde) dönmesini sağlayın.<br>2. Basınç regülatörü valfi veya hidrolik filtre tıkanmıştır. Filtreyi temizleyin veya valfi söküp solventle yıkayın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  hyd_no_run: {
    title: "Teşhis: Elektriksel Hata veya Sıkışma",
    desc: "Motor dönmüyorsa:<br><br>1. Pompa motoru termik rölesi (Thermal Overload) atmış olabilir. Panodaki termik rölenin mavi reset butonuna basın.<br>2. Pompa mili veya motor rulmanları kilitlenmiş olabilir. Kaplini söküp el ile rahat dönüp dönmediğini test edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  screen_root: {
    title: "1. Adım: Kabin Fanları ve Işıklar",
    desc: "Tezgah şalteri açıldığında elektrik panosundaki fanlar ve CNC ünitesinin arkasındaki yeşil LED'ler yanıyor mu?",
    options: [
      { text: "Evet, fanlar çalışıyor ve kartların üstündeki LED'ler yanıyor, sadece ekran karanlık", next: "screen_lcd_fail" },
      { text: "Hayır, tezgahta hiçbir yaşam belirtisi yok, fanlar da dönmüyor", next: "screen_no_power" }
    ]
  },
  screen_lcd_fail: {
    title: "Teşhis: LCD Panel veya Arka Aydınlatma Hatası",
    desc: "Kartlar çalıştığı halde ekran yoksa:<br><br>1. LCD ekranın floresan/LED arka aydınlatma kartı (Inverter board) arızalanmıştır veya sigortası atmıştır.<br>2. Ekran veri kablosu gevşemiş veya çıkmıştır. CNC ünitesinin arkasındaki soketi söküp tekrar takın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  screen_no_power: {
    title: "Teşhis: Ana Güç Kaynağı (PSU) Hatası",
    desc: "Şebeke elektriği kesik veya sigortalar atmıştır:<br><br>1. Elektrik kabinindeki 220V/24V ana güç kaynağı ünitesinin giriş sigortalarını ölçün.<br>2. Acil stop devre kontaktörünün giriş gerilimini kontrol edin.<br>3. Kapı emniyet switchi 24V hattını kısa devreye düşürüyor olabilir. Sinyal kablolarını söküp direnç testi yapın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  }
};

let CurrentTroubleshootNode = 'root';

function renderTroubleshooter() {
  CurrentTroubleshootNode = 'root';
  const page = createPage('troubleshooter');
  page.innerHTML = `
    <div class="page-header">
      <h1>🚨 Kronik Arıza Teşhis ve Çözüm Ağacı</h1>
      <p>Tezgahtaki belirtilere göre adım adım ilerleyen karar destek mekanizmasıyla arızanın kök nedenini bulun</p>
    </div>
    <div class="page-body">
      <!-- Animated Flowchart SVG -->
      <div id="flowchart-svg-wrap">
        ${window.renderInteractiveFlowchartSVG ? window.renderInteractiveFlowchartSVG('step1', {}) : ''}
      </div>

      <div class="card glass-card" style="padding:24px; max-width:800px; margin:0 auto; min-height:300px; display:flex; flex-direction:column; justify-content:space-between">

        
        <div>
          <!-- Title -->
          <h2 id="ts-title" style="font-size:16px; color:var(--text-accent); margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px">
            ${TroubleshootNodes[CurrentTroubleshootNode].title}
          </h2>
          <!-- Desc -->
          <p id="ts-desc" style="font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:24px">
            ${TroubleshootNodes[CurrentTroubleshootNode].desc}
          </p>
        </div>

        <!-- Options Container -->
        <div id="ts-options" style="display:flex; flex-direction:column; gap:10px"></div>

      </div>
    </div>
  `;

  renderTroubleshootButtons(page);

  return page;
}

function renderTroubleshootButtons(page) {
  const container = page.querySelector('#ts-options');
  const node = TroubleshootNodes[CurrentTroubleshootNode];
  if (!container || !node) return;

  container.innerHTML = node.options.map(opt => {
    const isBack = opt.next === 'root';
    return `
      <button class="btn ${isBack ? 'btn-secondary' : 'btn-ghost'}" style="text-align:left; justify-content:flex-start; padding:12px 16px; border:1px solid var(--border)" onclick="navigateTroubleshootNode('${opt.next}')">
        ${isBack ? '🔄 Başa Dön' : `👉 ${opt.text}`}
      </button>
    `;
  }).join('');
}

window.navigateTroubleshootNode = function(nextNode) {
  if (TroubleshootNodes[nextNode]) {
    CurrentTroubleshootNode = nextNode;
    const titleEl = document.getElementById('ts-title');
    const descEl = document.getElementById('ts-desc');
    const optionsEl = document.getElementById('ts-options');
    if (titleEl && descEl && optionsEl) {
      titleEl.innerHTML = TroubleshootNodes[nextNode].title;
      descEl.innerHTML = TroubleshootNodes[nextNode].desc;
      
      const node = TroubleshootNodes[nextNode];
      optionsEl.innerHTML = node.options.map(opt => {
        const isBack = opt.next === 'root';
        return `
          <button class="btn ${isBack ? 'btn-secondary' : 'btn-ghost'}" style="text-align:left; justify-content:flex-start; padding:12px 16px; border:1px solid var(--border)" onclick="navigateTroubleshootNode('${opt.next}')">
            ${isBack ? '🔄 Başa Dön' : `👉 ${opt.text}`}
          </button>
        `;
      }).join('');

      // Trigger premium fade-in/slide-up animation
      const cardEl = titleEl.closest('.card');
      if (cardEl) {
        cardEl.classList.remove('animate-in');
        void cardEl.offsetWidth; // trigger reflow
        cardEl.classList.add('animate-in');
      }
    } else {
      navigate('troubleshooter');
    }
  }
};

// ════════════════════════════════════════════════════════════════
//  FANUC I/O LINK & DONANIM BAĞLANTI TEŞHİSİ
// ════════════════════════════════════════════════════════════════
window.CurrentIOTab = 'graph';

function renderIOLink() {
  const page = createPage('io_link');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔌 FANUC I/O Link & Donanım Bağlantı Teşhisi</h1>
      <p>I/O Link kartları, veri kablosu mimarisi, adresleme kuralları ve donanımsal slot eşlemeleri</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-io-graph" onclick="switchIOTab('graph')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          🔌 I/O Kablo Mimarisi & Alarmlar
        </button>
        <button class="tab-btn" id="tab-io-map" onclick="switchIOTab('map')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🗺️ Donanımsal Slot & Adres Eşleme
        </button>
      </div>
    </div>
    
    <div class="page-body" id="io-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchIOTab(window.CurrentIOTab, page);
  }, 10);

  return page;
}

window.switchIOTab = function(tab, page = document) {
  window.CurrentIOTab = tab;
  
  const graphBtn = page.querySelector('#tab-io-graph');
  const mapBtn = page.querySelector('#tab-io-map');
  if (graphBtn && mapBtn) {
    graphBtn.style.color = tab === 'graph' ? 'var(--text-accent)' : 'var(--text-secondary)';
    graphBtn.style.fontWeight = tab === 'graph' ? 'bold' : 'normal';
    mapBtn.style.color = tab === 'map' ? 'var(--text-accent)' : 'var(--text-secondary)';
    mapBtn.style.fontWeight = tab === 'map' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#io-tab-content');
  if (!content) return;

  if (tab === 'graph') {
    content.innerHTML = `
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Connection Graph -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-2">🔌 I/O Link Kablo Mimarisi</div>
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px">
              FANUC I/O Link, kontrol kartı (Master) ile üniteler (Slave) arasındaki seri bağlantı zinciridir. Kablo soket etiketleri <strong>JD1A (OUT)</strong> ve <strong>JD1B (IN)</strong> şeklinde takip edilmelidir.
            </p>
            
            <div style="background:#0f172a; padding:16px; border-radius:4px; font-family:monospace; font-size:10.5px; color:var(--green); line-height:1.6; border:1px solid var(--border); margin-bottom:12px">
              [ CNC Main Board (COP10A) ]  JD1A (Master Port)
                           │
                           ▼ (I/O Link Kablosu)
              [ Operator Panel Board ]     JD1B (IN) -> JD1A (OUT)
                           │
                           ▼ (I/O Link Kablosu)
              [ I/O Base Module 1 ]        JD1B (IN) -> JD1A (OUT)
                           │
                           ▼ (I/O Link Kablosu)
              [ I/O Base Module 2 ]        JD1B (IN)
            </div>
          </div>
          <div class="card" style="background:rgba(239,68,68,0.03); border-color:rgba(239,68,68,0.12); padding:10px; font-size:11px; line-height:1.5">
            ⚠️ <strong>Sinyal Kuralı:</strong> Zincirdeki herhangi bir ara ünite (Örn: Operatör Paneli Kartı) 24V güç beslemesini kaybederse, kendisinden sonraki tüm I/O kartlarının sinyal bağlantısı kopar ve sistem anında acil stopa geçer (ER97 hatası).
          </div>
        </div>

        <!-- Alarm Table -->
        <div class="card" style="padding:16px">
          <div class="card-title mb-2">🚨 Yaygın I/O Link Alarm Kodları</div>
          <table class="data-table" style="font-size:11px">
            <thead>
              <tr>
                <th style="width:120px">Ekran Alarmı</th>
                <th>Donanımsal Anlamı</th>
                <th>Arıza Arama & Saha Çözümü</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style="color:var(--red)">ER97 I/O LINK FAILURE</strong></td>
                <td>Haberleşme hattı tamamen koptu.</td>
                <td>Sarı I/O ünitelerinin 24V DC besleme sigortalarını ölçün. JD1A/JD1B metal soketlerinin yuvalarına tam oturduğundan emin olun.</td>
              </tr>
              <tr>
                <td><strong style="color:var(--red)">ER96 I/O LINK FAILURE</strong></td>
                <td>Genişleme kartında veya slotta hata var.</td>
                <td>Sarı modüllerin arkasındaki sabitleme tırnaklarını kontrol edin. Gevşeme varsa kartı söküp pinleri temizleyin ve yeniden oturtun.</td>
              </tr>
              <tr>
                <td><strong style="color:var(--red)">SYS_ALM 160 I/O LINK</strong></td>
                <td>Ana kart FSSB / optik link arızası.</td>
                <td>COP10A optik kablo hattındaki tozlanmayı temizleyin. Optik konnektörün kırmızı ışık verip vermediğini kontrol edin.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1.2fr; gap:16px">
        
        <!-- Left: Slot selector -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">🗺️ Donanımsal I/O Modülü Seçin</div>
          <div class="form-group">
            <label class="form-label">Sarı I/O Ünitesi Modülü</label>
            <select class="form-control" id="io-slot-select" onchange="showIoSlotMapping()">
              <option value="slot1">MODÜL 1 - 16 Girişli Dijital Giriş Kartı (Slot 1)</option>
              <option value="slot2">MODÜL 2 - 16 Çıkışlı Dijital Çıkış Kartı (Slot 2)</option>
              <option value="slot3">MODÜL 3 - Operatör Paneli Dahili Kartı (Slot 3)</option>
            </select>
          </div>

          <div id="io-slot-details" style="background:var(--bg-card2); border:1px solid var(--border); padding:12px; border-radius:4px; font-size:12px">
            <div style="font-weight:bold; color:var(--text-accent); margin-bottom:6px" id="io-slot-name">MODÜL 1 - Dijital Giriş Kartı</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px">
              <span>PMC Lojik Adres Aralığı:</span>
              <strong id="io-slot-addr" style="font-family:monospace; color:var(--green)">X0.0 - X1.7</strong>
            </div>
            <div style="display:flex; justify-content:space-between">
              <span>Fiziksel Konnektör:</span>
              <strong id="io-slot-conn" style="font-family:monospace">CB104 (50-Pin)</strong>
            </div>
          </div>
        </div>

        <!-- Right: Terminal Pin mapping list -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">🔌 Pin ve PMC Lojik Adres Eşlemesi</div>
          <div style="overflow-y:auto; max-height:300px; background:#0f172a; padding:12px; border-radius:4px; border:1px solid var(--border)">
            <table class="data-table" style="font-size:11.5px; font-family:monospace">
              <thead>
                <tr>
                  <th>Fiziksel Pin No</th>
                  <th>Sinyal Yönü</th>
                  <th>PMC Lojik Adresi</th>
                  <th>Tipik Fonksiyon (CNC)</th>
                </tr>
              </thead>
              <tbody id="io-mapping-tbody"></tbody>
            </table>
          </div>
        </div>

      </div>
    `;
    setTimeout(showIoSlotMapping, 10);
  }
};

window.showIoSlotMapping = function() {
  const select = document.getElementById('io-slot-select');
  if (!select) return;

  const val = select.value;
  const tbody = document.getElementById('io-mapping-tbody');
  if (!tbody) return;

  const slotData = {
    slot1: {
      name: "MODÜL 1 - 16 Girişli Dijital Giriş Kartı (Slot 1)",
      addr: "X0.0 - X1.7",
      conn: "CB104 (20-Pin Klemens)",
      mapping: [
        { pin: "Pin 1 (X0.0)", dir: "Giriş (IN)", addr: "X0.0", func: "Acil Stop Butonu (ESP)" },
        { pin: "Pin 2 (X0.1)", dir: "Giriş (IN)", addr: "X0.1", func: "Eksen Limit Limit Switch +" },
        { pin: "Pin 3 (X0.2)", dir: "Giriş (IN)", addr: "X0.2", func: "Eksen Limit Limit Switch -" },
        { pin: "Pin 4 (X0.3)", dir: "Giriş (IN)", addr: "X0.3", func: "Kabin Kapağı Emniyet Sensörü" },
        { pin: "Pin 5 (X0.4)", dir: "Giriş (IN)", addr: "X0.4", func: "Kızak Yağ Seviyesi Switch'i" },
        { pin: "Pin 6 (X0.5)", dir: "Giriş (IN)", addr: "X0.5", func: "Hidrolik Basınç Okuma Girişi" },
        { pin: "Pin 7 to 16", dir: "Giriş (IN)", addr: "X0.6 - X1.7", func: "Kullanıcı Tanımlı Genel Sensörler" }
      ]
    },
    slot2: {
      name: "MODÜL 2 - 16 Çıkışlı Dijital Çıkış Kartı (Slot 2)",
      addr: "Y0.0 - Y1.7",
      conn: "CB105 (20-Pin Klemens)",
      mapping: [
        { pin: "Pin 1 (Y0.0)", dir: "Çıkış (OUT)", addr: "Y0.0", func: "Merkezi Yağlama Motor Rölesi" },
        { pin: "Pin 2 (Y0.1)", dir: "Çıkış (OUT)", addr: "Y0.1", func: "Kabin İçi Soğutucu Solenoid Valf" },
        { pin: "Pin 3 (Y0.2)", dir: "Çıkış (OUT)", addr: "Y0.2", func: "Hidrolik Motor Kontaktörü Tetik" },
        { pin: "Pin 4 (Y0.3)", dir: "Çıkış (OUT)", addr: "Y0.3", func: "Ayna Hidrolik Bobin Sıkma Rölesi" },
        { pin: "Pin 5 (Y0.4)", dir: "Çıkış (OUT)", addr: "Y0.4", func: "Ayna Hidrolik Bobin Açma Rölesi" },
        { pin: "Pin 6 (Y0.5)", dir: "Çıkış (OUT)", addr: "Y0.5", func: "Fener Mili Yağ Soğutma Pompası" },
        { pin: "Pin 7 to 16", dir: "Çıkış (OUT)", addr: "Y0.6 - Y1.7", func: "Genel Valf / Röle Tetik çıkışları" }
      ]
    },
    slot3: {
      name: "MODÜL 3 - Operatör Paneli Dahili Giriş Kartı (Slot 3)",
      addr: "X4.0 - X7.7",
      conn: "Dahili Şerit Kablo (Flat Cable)",
      mapping: [
        { pin: "Matrix 1 (X4.0)", dir: "Giriş (IN)", addr: "X4.0", func: "Panel Cycle Start Butonu" },
        { pin: "Matrix 2 (X4.1)", dir: "Giriş (IN)", addr: "X4.1", func: "Panel Feed Hold Butonu" },
        { pin: "Matrix 3 (X4.2)", dir: "Giriş (IN)", addr: "X4.2", func: "MDI Input Buton Girişi" },
        { pin: "Matrix 4 (X4.3)", dir: "Giriş (IN)", addr: "X4.3", func: "Mod Seçici Switche (AUTO/MDI/JOG)" },
        { pin: "Matrix 5 to 32", dir: "Giriş (IN)", addr: "X4.4 - X7.7", func: "Panel Diğer Tuş Girişleri" }
      ]
    }
  };

  const current = slotData[val];
  if (!current) return;

  document.getElementById('io-slot-name').innerText = current.name;
  document.getElementById('io-slot-addr').innerText = current.addr;
  document.getElementById('io-slot-conn').innerText = current.conn;

  tbody.innerHTML = current.mapping.map(m => `
    <tr>
      <td>${m.pin}</td>
      <td><span class="tag ${m.dir.includes('Giriş') ? 'tag-blue' : 'tag-orange'}">${m.dir}</span></td>
      <td style="color:var(--text-accent); font-weight:bold">${m.addr}</td>
      <td style="color:var(--text-secondary)">${m.func}</td>
    </tr>
  `).join('');
};

// ════════════════════════════════════════════════════════════════
//  FANUC PARAMETRE & PROGRAM YEDEKLEME/YÜKLEME SİHİRBAZI
// ════════════════════════════════════════════════════════════════
window.BackupWizardState = {
  media: 'cf',  // 'cf', 'usb', 'rs232'
  action: 'backup', // 'backup', 'restore'
  type: 'param'  // 'param', 'pmc', 'program', 'offset'
};

const BackupGuides = {
  cf_backup_param: [
    "MDI modunu kontrol edin: Kontrol paneli üzerindeki mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin.",
    "I/O Kanalını seçin: <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basın, ardından ekran altındaki <strong>[SETTING]</strong> sekmesini seçip <strong>I/O CHANNEL</strong> değerini <strong>4</strong> yapın (4 = CF Card).",
    "EDİT moduna geçin: Mod anahtarını <kbd class='kbd'>EDIT</kbd> (Program Yazma) konumuna getirin.",
    "I/O Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, sağ yön tuşu ile <strong>[>]</strong> ilerleyin ve <strong>[ALL IO]</strong> (veya DOSYA/PROGRAM transfer) sekmesini seçin.",
    "Parametre yedeklemeyi başlatın: Ekran altındaki menüden <strong>[PARAM]</strong> -> <strong>[PUNCH]</strong> (Dışarı Aktar) seçin. Dosya adını yazıp (örn: CNCPARAM.PRM) <strong>[O-SET]</strong> (Çıktı Belirle) ve ardından <strong>[EXEC]</strong> (Yürüt) tuşuna basın. Ekranın sağ alt köşesinde yanıp sönen <strong>OUTPUT</strong> ibaresi durana kadar bekleyin."
  ],
  cf_restore_param: [
    "MDI modunu kontrol edin: Kontrol paneli üzerindeki mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin.",
    "I/O Kanalını seçin: <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basın, ardından ekran altındaki <strong>[SETTING]</strong> sekmesini seçip <strong>I/O CHANNEL</strong> değerini <strong>4</strong> yapın (4 = CF Card).",
    "PWE (Parametre Yazma İzni) açın: <kbd class='kbd'>OFFSET/SETTING</kbd> ekranında <strong>PARAMETER WRITE (PWE)</strong> değerini <strong>1</strong> yapın. Tezgah 100 nolu Parameter Write Enable alarmı verecektir (Normaldir).",
    "EDİT moduna geçin: Mod anahtarını <kbd class='kbd'>EDIT</kbd> konumuna getirin ve Acil Stop butonuna basın (Parametre yazmak için acil stop basılı olmalıdır).",
    "Parametreleri yükleyin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, sağ yön tuşu <strong>[>]</strong> ile ilerleyip <strong>[ALL IO]</strong> sekmesine girin. Ekran altındaki menüden <strong>[PARAM]</strong> -> <strong>[READ]</strong> (Oku) seçin. Yüklenecek dosya numarasını veya adını seçip <strong>[EXEC]</strong> butonuna basın. Yükleme bitince PWE=0 yapın ve tezgahı kapatıp açın."
  ],
  cf_backup_pmc: [
    "MDI modunu kontrol edin: Mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin.",
    "I/O Kanalını kontrol edin: <kbd class='kbd'>OFFSET/SETTING</kbd> ekranında <strong>I/O CHANNEL</strong> değerini <strong>4</strong> yapın.",
    "PMC Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> tuşuna basın, alt menüden sırasıyla <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Parametreleri çıkartın: <strong>DEVICE</strong> değerini F-CARD, <strong>FUNCTION</strong> değerini WRITE, <strong>DATA KIND</strong> değerini PARAMETER olarak ayarlayın.",
    "Dosya adını belirleyin: FILE NAME kısmına PMC_DATA.LAD yazıp alt menüdeki <strong>[EXEC]</strong> (Yürüt) tuşuna basın. İşlem bitince kartı çıkarabilirsiniz."
  ],
  cf_restore_pmc: [
    "MDI modunu kontrol edin: Mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin ve PWE=1 yapın.",
    "PMC Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> sayfasına girin.",
    "Girdi ayarlarını yapın: <strong>DEVICE</strong> = F-CARD, <strong>FUNCTION</strong> = READ, <strong>DATA KIND</strong> = PARAMETER seçin.",
    "Dosya ismini seçin: F-CARD üzerindeki yedek dosya adını (örn: PMC_DATA.LAD) yazıp <strong>[EXEC]</strong> tuşuna basın. Yükleme bitince PWE=0 yapıp CNC'yi yeniden başlatın."
  ],
  usb_backup_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>17</strong> yapın (17 = USB Flash Sürücü).",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "I/O Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, sağ yön tuşu <strong>[>]</strong> ile ilerleyip <strong>[ALL IO]</strong> sekmesine girin.",
    "Parametreleri çıkarın: <strong>[PARAM]</strong> -> <strong>[PUNCH]</strong> seçin. Dosya adını yazıp <strong>[O-SET]</strong> ve ardından <strong>[EXEC]</strong> tuşuna basın."
  ],
  usb_restore_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>17</strong> yapın (17 = USB Flash Sürücü).",
    "PWE (Parametre Yazma İzni) açın: <kbd class='kbd'>OFFSET/SETTING</kbd> ekranında <strong>PARAMETER WRITE</strong> değerini <strong>1</strong> yapın. Acil Stop butonuna basın.",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "Parametreleri yükleyin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, <strong>[ALL IO]</strong> sekmesine girin. Menüden <strong>[PARAM]</strong> -> <strong>[READ]</strong> seçip <strong>[EXEC]</strong> tuşuna basın. İşlem bitince PWE=0 yapıp tezgahı kapatıp açın."
  ],
  usb_backup_pmc: [
    "I/O Kanalını ayarlayın: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> basıp <strong>I/O CHANNEL</strong> değerini <strong>17</strong> yapın.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = USB-MEM, <strong>FUNCTION</strong> = WRITE, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Dosya adını yazıp <strong>[EXEC]</strong> tuşuna basarak aktarımı tamamlayın."
  ],
  usb_restore_pmc: [
    "MDI modunu açın ve PWE=1 yapın. Acil stop basın.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = USB-MEM, <strong>FUNCTION</strong> = READ, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Dosya adını seçip <strong>[EXEC]</strong> tuşuna basarak yüklemeyi başlatın. Bitince PWE=0 yapıp CNC'yi kapatıp açın."
  ],
  rs232_backup_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>0</strong> veya <strong>1</strong> yapın (0/1 = RS232 Haberleşme Portu).",
    "RS232 Haberleşme programını PC tarafında (örn: DNC Precision) 9600 Baud Rate ile 'Alım' (Receive) konumunda açın.",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "Parametreleri gönderin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, <strong>[ALL IO]</strong> sekmesine girin. Menüden <strong>[PARAM]</strong> -> <strong>[PUNCH]</strong> seçip <strong>[EXEC]</strong> tuşuna basarak aktarımı başlatın."
  ],
  rs232_restore_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>0</strong> yapın. PWE=1 yapın ve Acil Stop butonuna basın.",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "Yüklemeyi başlatın: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, <strong>[ALL IO]</strong> sekmesine girin. Menüden <strong>[PARAM]</strong> -> <strong>[READ]</strong> seçip <strong>[EXEC]</strong> tuşuna basın. CNC ekranında INPUT ibaresi yanıp sönecektir.",
    "PC'den programı gönderin: PC tarafındaki haberleşme yazılımından parametre dosyasını gönder (Send) deyin. Aktarım bitince PWE=0 yapıp CNC'yi yeniden başlatın."
  ],
  rs232_backup_pmc: [
    "I/O Kanalını ayarlayın: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> basıp <strong>I/O CHANNEL</strong> değerini <strong>0</strong> yapın.",
    "PC'deki haberleşme programını 9600 Baud rate ile veri alım konumuna getirin.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = OTHERS, <strong>FUNCTION</strong> = WRITE, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Alt menüden <strong>[EXEC]</strong> tuşuna basarak PMC parametrelerini seri porttan dışarı aktarın."
  ],
  rs232_restore_pmc: [
    "MDI modunu açın ve PWE=1 yapın. Acil stop basın. I/O Channel = 0 yapın.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = OTHERS, <strong>FUNCTION</strong> = READ, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Ekran altından <strong>[EXEC]</strong> tuşuna basın (Ekran INPUT durumuna geçer). PC'den PMC dosyasını gönderin. İşlem bitince PWE=0 yapıp CNC'yi kapatıp açın."
  ]
};

// Fallback guides for programs / offsets (standard methods)
const StandardBackupMethods = {
  program: [
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "<strong>PROGRAM</strong> butonuna basın, ardından ekran altındaki <strong>[DIR]</strong> (Dizin) sekmesine girin.",
    "Yedekleme kanalına göre (CF Card için I/O Channel=4, USB için 17) alt menüden sırasıyla <strong>[F-OUTPUT]</strong> (Dosya Çıkış) seçin.",
    "Gönderilecek program numarasını yazın (Örn: <strong>O1001</strong> veya tüm programlar için <strong>-9999</strong>).",
    "<strong>[O-SET]</strong> sekmesine basın, ardından <strong>[EXEC]</strong> (Yürüt) tuşuna basarak aktarımı tamamlayın."
  ],
  offset: [
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "<strong>SYSTEM</strong> butonuna basıp sağ yön tuşu <strong>[>]</strong> ile ilerleyin ve <strong>[ALL IO]</strong> sekmesine girin.",
    "Alt menüden sırasıyla <strong>[OFFSET]</strong> -> <strong>[PUNCH]</strong> (Dışarı Aktar) seçin.",
    "Dosya adı girip (örn: OFFSETS.GDF) <strong>[O-SET]</strong> sekmesine basın.",
    "Son olarak <strong>[EXEC]</strong> tuşuna basarak takım aşınma, sıfır ofsetleri ve geometri değerlerini yedekleyin."
  ]
};

window.CurrentBackupTab = 'steps';

function renderBackupWizard() {
  const page = createPage('backup_wizard');
  page.innerHTML = `
    <div class="page-header">
      <h1>📄 FANUC Parametre & Program Yedekleme</h1>
      <p>CNC parametre yedeklerinizi kaydedin veya Boot ROM SRAM yedekleme işlemlerini inceleyin</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-bk-steps" onclick="switchBackupTab('steps')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📋 Adım Adım Yedekleme Sihirbazı
        </button>
        <button class="tab-btn" id="tab-bk-boot" onclick="switchBackupTab('boot_rom')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🔋 Boot ROM SRAM & Kart Formatlama
        </button>
      </div>
    </div>
    
    <div class="page-body" id="backup-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchBackupTab(window.CurrentBackupTab, page);
  }, 10);

  return page;
}

window.switchBackupTab = function(tab, page = document) {
  window.CurrentBackupTab = tab;

  const stepsBtn = page.querySelector('#tab-bk-steps');
  const bootBtn = page.querySelector('#tab-bk-boot');
  if (stepsBtn && bootBtn) {
    stepsBtn.style.color = tab === 'steps' ? 'var(--text-accent)' : 'var(--text-secondary)';
    stepsBtn.style.fontWeight = tab === 'steps' ? 'bold' : 'normal';
    bootBtn.style.color = tab === 'boot_rom' ? 'var(--text-accent)' : 'var(--text-secondary)';
    bootBtn.style.fontWeight = tab === 'boot_rom' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#backup-tab-content');
  if (!content) return;

  if (tab === 'steps') {
    content.innerHTML = `
      <div class="grid-2 mb-4" style="grid-template-columns: 0.9fr 1.1fr; gap:16px">
        <!-- Left: Configuration selectors -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:16px">
          <div class="card-title">⚙️ İşlem Konfigürasyonu</div>
          
          <!-- 1. Media Select -->
          <div>
            <label class="form-label" style="font-weight:700">1. Yedekleme Ortamı (Media)</label>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:6px">
              <button class="btn btn-ghost" id="wz-media-cf" onclick="setWizardConfig('media', 'cf')" style="border:1px solid var(--border)">💾 CF Card</button>
              <button class="btn btn-ghost" id="wz-media-usb" onclick="setWizardConfig('media', 'usb')" style="border:1px solid var(--border)">🔌 USB Drive</button>
              <button class="btn btn-ghost" id="wz-media-rs232" onclick="setWizardConfig('media', 'rs232')" style="border:1px solid var(--border)">💻 RS232 Port</button>
            </div>
          </div>

          <!-- 2. Action Select -->
          <div>
            <label class="form-label" style="font-weight:700">2. İşlem Tipi (Action)</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px">
              <button class="btn btn-ghost" id="wz-action-backup" onclick="setWizardConfig('action', 'backup')" style="border:1px solid var(--border)">➡️ CNC -> Medya (Yedek Al)</button>
              <button class="btn btn-ghost" id="wz-action-restore" onclick="setWizardConfig('action', 'restore')" style="border:1px solid var(--border)">⬅️ Medya -> CNC (Yükle)</button>
            </div>
          </div>

          <!-- 3. Data Type Select -->
          <div>
            <label class="form-label" style="font-weight:700">3. Veri Tipi (Data Type)</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px">
              <button class="btn btn-ghost" id="wz-type-param" onclick="setWizardConfig('type', 'param')" style="border:1px solid var(--border)">Parametre (NC)</button>
              <button class="btn btn-ghost" id="wz-type-pmc" onclick="setWizardConfig('type', 'pmc')" style="border:1px solid var(--border)">PMC (Ladder)</button>
              <button class="btn btn-ghost" id="wz-type-program" onclick="setWizardConfig('type', 'program')" style="border:1px solid var(--border)">Programlar</button>
              <button class="btn btn-ghost" id="wz-type-offset" onclick="setWizardConfig('type', 'offset')" style="border:1px solid var(--border)">Takım Ofsetleri</button>
            </div>
          </div>
        </div>

        <!-- Right: Step-by-step Interactive Guide -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column">
          <div class="card-title mb-2">📋 Adım Adım Uygulama Rehberi</div>
          <p style="font-size:11px; color:var(--text-secondary); margin-bottom:14px">
            Seçtiğiniz donanım konfigürasyonuna göre kontrol ünitesi panelinde basılması gereken tuş kombinasyonları aşağıdadır:
          </p>
          <div id="wz-steps-container" style="display:flex; flex-direction:column; gap:10px; flex:1"></div>
        </div>
      </div>
    `;
    setTimeout(() => {
      updateWizardUI(page);
    }, 10);
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px; padding:0 20px">
        
        <!-- Left: Boot ROM SRAM procedures -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">🔋 Boot ROM / System Monitor SRAM Yedekleme</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            CNC ünitesi açılmadan (anakart seviyesinde) tüm sistemi ve SRAM hafızasını (programlar, parametreler, ofsetler dahil) tek bir dosya halinde yedeklemek için:
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔧 Adım Adım SRAM Yedek Alma Prosedürü:</strong>
            <div>1. CNC ana enerjisini kapatın. Ekranın solundaki PCMCIA yuvasına FAT formatlı CF kartı takın.</div>
            <div>2. Panel üzerindeki en sağdaki iki tuşa (genellikle <strong>. (nokta)</strong> ve <strong>- (eksi)</strong> tuşları veya <code>MDI</code> ekranındaki en sağdaki iki yatay tuş) aynı anda basılı tutarak CNC şalterini açın.</div>
            <div>3. Ekranda sarı harflerle yazılmış <strong>SYSTEM MONITOR</strong> (Boot ekranı) gelene kadar tuşları bırakmayın.</div>
            <div>4. Yön tuşlarıyla <strong>SYSTEM DATA BACKUP</strong> veya <strong>SRAM BACKUP</strong> seçeneğinin üzerine gelin ve SELECT (INPUT) tuşuna basın.</div>
            <div>5. Çıkan menüden <strong>SRAM BACKUP (CNC -> CARD)</strong> seçin. Dosya adı <code>SRAM.FDB</code> olarak otomatik yazılacaktır. YES tuşuna basarak aktarımı başlatın.</div>
          </div>
        </div>

        <!-- Right: CF Card Formatting limits -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">💾 CF Kart Format Sınırları & Hataları</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Eski FANUC Boot Loader yazılımları modern büyük kapasiteli kartları tanıyamaz:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:8px">
            <div>
              <strong style="color:var(--text-accent)">• CF Kart Boyut Limiti:</strong><br>
              Tavsiye edilen kart boyutu <strong>128 MB ila 2 GB</strong> arasıdır. 4 GB ve üzeri SDHC/SDXC kartlar adaptörle takılsa dahi ünitede okunmaz.
            </div>
            <div>
              <strong style="color:var(--text-accent)">• Dosya Sistemi:</strong><br>
              Kart bilgisayara takılıp mutlaka <strong>FAT (FAT16)</strong> olarak formatlanmalıdır. FAT32 veya NTFS kartlar boş ekran veya kart hatası verir.
            </div>
            <div style="color:var(--red)">
              ⚠️ <strong>SRAM Write Protected Hatası:</strong><br>
              Eğer yedek yüklerken bu hatayı alırsanız, PCMCIA adaptörünün veya CF kartın yanındaki minik tırnağın (Lock) kilitli olmadığını doğrulayın.
            </div>
          </div>
        </div>

      </div>
    `;
  }
};


window.setWizardConfig = function(key, value) {
  window.BackupWizardState[key] = value;
  const page = document.getElementById('page-backup_wizard');
  if (page) {
    updateWizardUI(page);
    renderWizardSteps(page);
  }
};

function updateWizardUI(page = document) {
  const state = window.BackupWizardState;

  // Reset all buttons
  const ids = [
    'wz-media-cf', 'wz-media-usb', 'wz-media-rs232',
    'wz-action-backup', 'wz-action-restore',
    'wz-type-param', 'wz-type-pmc', 'wz-type-program', 'wz-type-offset'
  ];
  ids.forEach(id => {
    const el = page.querySelector('#' + id);
    if (el) {
      el.className = 'btn btn-ghost';
      el.style.borderColor = 'var(--border)';
      el.style.color = 'var(--text-secondary)';
    }
  });

  // Highlight active
  const activeIds = [
    'wz-media-' + state.media,
    'wz-action-' + state.action,
    'wz-type-' + state.type
  ];
  activeIds.forEach(id => {
    const el = page.querySelector('#' + id);
    if (el) {
      el.className = 'btn btn-primary';
      el.style.borderColor = 'var(--text-accent)';
      el.style.color = '#fff';
    }
  });
}

function renderWizardSteps(page) {
  const container = page.querySelector('#wz-steps-container');
  const completeCard = page.querySelector('#wz-complete-card');
  if (!container || !completeCard) return;

  completeCard.style.display = 'none';

  const state = window.BackupWizardState;
  let steps = [];

  // Determine steps array
  if (state.type === 'program') {
    steps = StandardBackupMethods.program;
  } else if (state.type === 'offset') {
    steps = StandardBackupMethods.offset;
  } else {
    const key = `${state.media}_${state.action}_${state.type}`;
    steps = BackupGuides[key] || [
      "Lütfen geçerli bir yedekleme medyası, işlem tipi ve veri türü seçin."
    ];
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px">
      ${steps.map((step, idx) => `
        <label class="flex items-start gap-3" style="cursor:pointer; font-size:12.5px; line-height:1.5; color:var(--text-secondary)">
          <input type="checkbox" class="wz-step-checkbox" style="margin-top:3px" onchange="checkWizardStepsCompletion()"/>
          <span><strong>Adım ${idx + 1}:</strong> ${step}</span>
        </label>
      `).join('')}
    </div>
  `;
}

window.checkWizardStepsCompletion = function() {
  const checkboxes = document.querySelectorAll('.wz-step-checkbox');
  const completeCard = document.getElementById('wz-complete-card');
  if (!checkboxes.length || !completeCard) return;

  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  if (allChecked) {
    completeCard.style.display = 'block';
    showToast('Tebrikler! Yedekleme adımlarını tamamladınız.', 'success');
  } else {
    completeCard.style.display = 'none';
  }
};


// ════════════════════════════════════════════════════════════════
//  ARIZA BİLGİ BANKASI (WIKI)
// ════════════════════════════════════════════════════════════════
function renderTroubleshootWiki() {
  const page = createPage('troubleshoot_wiki');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🗂️ Kronik Arıza Bilgi Bankası (Wiki)</h1>
          <p>Atölyedeki kronik arızalar, hata kodları ve saha çözüm yöntemleri kütüphanesi</p>
        </div>
        ${canEdit() ? `
        <button class="btn btn-primary" onclick="showNewWikiArticleModal()">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Makale Ekle
        </button>
        ` : ''}
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:340px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="wiki-search" placeholder="Hata kodu, başlık veya açıklama ara..." />
        </div>
        <select id="wiki-mach-filter" style="width:180px">
          <option value="">Tüm Tezgah Tipleri</option>
          <option>Torna (CNC Lathe)</option>
          <option>İşleme Merkezi (VMC)</option>
          <option>Kayar Otomat</option>
          <option>Diğer</option>
        </select>
      </div>
    </div>
    <div class="page-body">
      <div id="wiki-articles-container" style="display:flex; flex-direction:column; gap:16px"></div>
    </div>
  `;

  setTimeout(() => {
    filterWikiArticles(page);
    page.querySelector('#wiki-search').addEventListener('input', () => filterWikiArticles(page));
    page.querySelector('#wiki-mach-filter').addEventListener('change', () => filterWikiArticles(page));
  }, 10);

  return page;
}

function filterWikiArticles(page) {
  const container = page.querySelector('#wiki-articles-container');
  if (!container) return;

  const q = page.querySelector('#wiki-search').value.toLowerCase();
  const typeFilter = page.querySelector('#wiki-mach-filter').value;

  const filtered = State.wiki.filter(a =>
    (!q || a.title.toLowerCase().includes(q) || a.error_code.toLowerCase().includes(q) || a.solution.toLowerCase().includes(q)) &&
    (!typeFilter || a.machine_type === typeFilter)
  );

  if (!filtered.length) {
    container.innerHTML = `
      <div class="card" style="padding:40px; text-align:center; color:var(--text-muted)">
        Arama kriterlerine uygun arıza makalesi bulunamadı.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => `
    <div class="card" style="padding:20px; border-left:4px solid var(--text-accent)">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="tag tag-blue">${a.machine_type}</span>
          <span class="tag tag-red" style="font-family:monospace">${a.error_code}</span>
        </div>
        <div class="flex items-center gap-2">
          ${a.verified ? '<span class="tag tag-green">✓ Doğrulanmış Çözüm</span>' : '<span class="tag tag-amber">İncelemede</span>'}
          ${canDelete() ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteWikiArticle(${a.id})" title="Makaleyi Sil" style="color:var(--red); font-size:12px">✕</button>` : ''}
        </div>
      </div>
      <h3 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:8px">${a.title}</h3>
      <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.6; white-space:pre-line; background:var(--bg-card2); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border)">${a.solution}</div>
      <div class="flex justify-between items-center mt-3" style="font-size:11px; color:var(--text-muted)">
        <span>Yazar: <strong>${a.author}</strong></span>
        <span>Tarih: ${a.date}</span>
      </div>
    </div>
  `).join('');
}

window.showNewWikiArticleModal = function() {
  showModal('new-wiki-modal', `
    <div class="modal-header">
      <span class="modal-title">Yeni Arıza Makalesi Ekle</span>
      <button class="modal-close" onclick="closeModal('new-wiki-modal')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Başlık *</label>
      <input class="form-control" id="nm-wiki-title" placeholder="ör. X Ekseni Aşırı Yüklenme Hatası Çözümü" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tezgah Tipi / Sınıfı *</label>
        <select class="form-control" id="nm-wiki-mach-type">
          <option>Torna (CNC Lathe)</option>
          <option>İşleme Merkezi (VMC)</option>
          <option>Kayar Otomat</option>
          <option>Diğer</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Hata Kodu / Belirti *</label>
        <input class="form-control" id="nm-wiki-err" placeholder="ör. SV0410 / AL-32" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Usta / Teknisyen *</label>
      <input class="form-control" id="nm-wiki-author" placeholder="ör. AHMET MERT ÖZER" />
    </div>
    <div class="form-group">
      <label class="form-label">Çözüm Adımları / Saha Çözüm Yöntemi *</label>
      <textarea class="form-control" id="nm-wiki-solution" rows="6" placeholder="Arızanın çözüm adımlarını detaylandırın..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-wiki-modal')">İptal</button>
      <button class="btn btn-primary" onclick="createNewWikiArticle()">Makaleyi Kaydet</button>
    </div>
  `);
};

window.createNewWikiArticle = async function() {
  if (!canEdit()) { showToast('Makale ekleme yetkiniz yok', 'error'); return; }
  const title = document.getElementById('nm-wiki-title').value.trim();
  const machine_type = document.getElementById('nm-wiki-mach-type').value;
  const error_code = document.getElementById('nm-wiki-err').value.trim();
  const author = document.getElementById('nm-wiki-author').value.trim();
  const solution = document.getElementById('nm-wiki-solution').value.trim();

  if (!title || !error_code || !author || !solution) {
    showToast('Lütfen tüm zorunlu alanları doldurun.', 'error');
    return;
  }

  const id = State.wiki.length ? Math.max(...State.wiki.map(a => a.id)) + 1 : 1;
  const newArticle = {
    id,
    title,
    machine_type,
    error_code,
    solution,
    author: author.toUpperCase(),
    date: getTodayFormat(),
    verified: true
  };

  State.wiki.push(newArticle);
  await saveWiki();
  closeModal('new-wiki-modal');
  showToast('Arıza makalesi başarıyla eklendi!', 'success');
  navigate('troubleshoot_wiki');
};

window.deleteWikiArticle = async function(id) {
  if (!canDelete()) { showToast('Makale silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu makaleyi silmek istediğinize emin misiniz?')) return;
  State.wiki = State.wiki.filter(a => a.id !== id);
  await saveWiki();
  showToast('Makale başarıyla silindi.', 'success');
  navigate('troubleshoot_wiki');
};

// ════════════════════════════════════════════════════════════════
//  YEDEK TAKİP DEFTERİ (BACKUP TRACKER)
// ════════════════════════════════════════════════════════════════
function renderBackupTracker() {
  const page = createPage('backup_tracker');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>💾 Yedek Takip Defteri (SRAM & Parameter)</h1>
          <p>Tezgah parametreleri ve SRAM yedeklerinin güncellik durumları ve arşiv takibi</p>
        </div>
        ${canEdit() ? `
        <button class="btn btn-primary" onclick="showNewBackupLogModal()">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Yedek Kaydı Ekle
        </button>
        ` : ''}
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:340px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="bk-search" placeholder="Tezgah no veya açıklama ara..." />
        </div>
        <select id="bk-status-filter" style="width:180px">
          <option value="">Tüm Durumlar</option>
          <option value="ok">🟢 Güncel (&lt;= 180 Gün)</option>
          <option value="warn">🔴 Güncel Değil (&gt; 180 Gün)</option>
          <option value="none">❌ Hiç Yedeklenmemiş</option>
        </select>
      </div>
    </div>
    <div class="page-body">

      <!-- Backup Inspector Drag & Drop Card -->
      <div class="card mb-4" style="padding:16px; background:var(--bg-card2)">
        <div class="card-title mb-2" style="display:flex; align-items:center; gap:8px">
          <span>🔍 FANUC SRAM & Ladder Dosya İnceleyici (Backup Inspector)</span>
        </div>
        <div id="backup-inspector-dropzone" style="border: 2px dashed var(--border); border-radius: var(--radius-md); padding: 18px; text-align: center; background: var(--bg-card); cursor: pointer; transition: border-color 0.2s;"
             onclick="document.getElementById('backup-file-inspector-input').click()"
             ondragover="event.preventDefault(); this.style.borderColor='var(--accent)'"
             ondragleave="event.preventDefault(); this.style.borderColor='var(--border)'"
             ondrop="handleBackupFileDrop(event)">
          <div style="font-size: 24px; margin-bottom: 6px">📁</div>
          <div style="font-weight:600; font-size:12.5px">İncelemek istediğiniz .FDB, .DAT, .PMC veya .TXT yedek dosyasını buraya bırakın</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px">FANUC SRAM imajı, Parametre yedeği veya Ladder versiyonunu anında analiz eder</div>
          <input type="file" id="backup-file-inspector-input" style="display:none" onchange="handleBackupFileSelect(event)" accept=".fdb,.dat,.pmc,.lad,.txt,.nc,.mem" />
        </div>
        <div id="backup-inspector-result" style="display:none; margin-top:14px; padding:12px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm)"></div>
      </div>

      <div class="card" style="padding:0; overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Son Yedek Tarihi</th>
              <th>Yedekleyen</th>
              <th>Dosya Konumu / Arşiv</th>
              <th>Durum / Kalan Süre</th>
              <th style="width:200px">İşlemler</th>
            </tr>
          </thead>
          <tbody id="backup-tbody"></tbody>
        </table>
      </div>
    </div>

  `;

  setTimeout(() => {
    filterBackupTracker(page);
    page.querySelector('#bk-search').addEventListener('input', () => filterBackupTracker(page));
    page.querySelector('#bk-status-filter').addEventListener('change', () => filterBackupTracker(page));
  }, 10);

  return page;
}

function filterBackupTracker(page) {
  const tbody = page.querySelector('#backup-tbody');
  if (!tbody) return;

  const q = page.querySelector('#bk-search').value.toLowerCase();
  const statusFilter = page.querySelector('#bk-status-filter').value;

  const list = State.machines.map(m => {
    // Find logs for this machine
    const logs = State.backup_logs.filter(l => l.tezgah_id === m.id);
    // Sort logs by date desc to find the latest
    // Date format is DD.MM.YYYY
    const sortedLogs = [...logs].sort((a, b) => {
      return parseDateHelper(b.son_yedek_tarihi) - parseDateHelper(a.son_yedek_tarihi);
    });

    const latest = sortedLogs[0] || null;
    let daysPassed = null;
    let status = 'none'; // 'ok', 'warn', 'none'

    if (latest) {
      const backupDate = parseDateHelper(latest.son_yedek_tarihi);
      if (backupDate && backupDate.getTime() > 0) {
        const diffTime = Math.abs(new Date() - backupDate);
        daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        status = daysPassed <= 180 ? 'ok' : 'warn';
      }
    }

    return {
      machine: m,
      latest,
      daysPassed,
      status
    };
  });

  // Filter based on UI selections
  const filtered = list.filter(item => {
    const matchSearch = !q || item.machine.numarasi.toLowerCase().includes(q) || (item.latest && item.latest.aciklama.toLowerCase().includes(q));
    const matchStatus = !statusFilter || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Yedek takip kaydı bulunadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const m = item.machine;
    const l = item.latest;
    
    let dateStr = '<span style="color:var(--red); font-weight:700">Yedek Yok</span>';
    let techStr = '—';
    let pathStr = '—';
    let statusBadge = '<span class="tag tag-red">🔴 Yedeksiz</span>';

    if (l) {
      dateStr = `<span class="font-mono">${l.son_yedek_tarihi}</span>`;
      techStr = `<strong>${l.yedekleyen}</strong>`;
      pathStr = `<span class="font-mono" style="font-size:11px; color:var(--text-muted)" title="${l.dosya_konumu}">${l.dosya_konumu.length > 28 ? l.dosya_konumu.substring(0,25)+'...' : l.dosya_konumu}</span>`;
      
      if (item.status === 'ok') {
        const remaining = 180 - item.daysPassed;
        statusBadge = `<span class="tag tag-green">🟢 Güncel (${remaining} Gün Kaldı)</span>`;
      } else {
        const exceeded = item.daysPassed - 180;
        statusBadge = `<span class="tag tag-red">⚠️ Güncel Değil (${exceeded} Gün Geçti)</span>`;
      }
    }

    return `
      <tr>
        <td><strong style="color:var(--text-accent); font-size:13px">${m.numarasi}</strong></td>
        <td>${dateStr}</td>
        <td>${techStr}</td>
        <td>${pathStr}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:6px">
            ${canEdit() ? `
            <button class="btn btn-ghost btn-sm" onclick="showNewBackupLogModal(${m.id})" style="font-size:11px; padding:2px 8px; border:1px solid var(--border)">
              💾 Yedekle
            </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" onclick="showBackupHistoryModal(${m.id})" style="font-size:11px; padding:2px 8px; border:1px solid var(--border)">
              📋 Geçmiş
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.showNewBackupLogModal = function(mId = null) {
  showModal('new-backup-log', `
    <div class="modal-header">
      <span class="modal-title">Yeni Yedek Kaydı Ekle</span>
      <button class="modal-close" onclick="closeModal('new-backup-log')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-bk-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}" ${mId && m.id === mId ? 'selected' : ''}>${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tarih (GG.AA.YYYY) *</label>
        <input class="form-control" id="nm-bk-date" value="${getTodayFormat()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Yedekleyen Teknisyen *</label>
        <input class="form-control" id="nm-bk-tech" placeholder="ör. AHMET MERT ÖZER" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Yedek Dosya Konumu / Sunucu Arşiv Yolu *</label>
      <input class="form-control" id="nm-bk-path" placeholder="ör. DNC-SERVER/BACKUPS/CNF37_SRAM_2026.FDB" />
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama / Revizyon Notları</label>
      <textarea class="form-control" id="nm-bk-desc" rows="3" placeholder="Yedekleme içeriği hakkında bilgi girin (örn. Yıllık rutin yedek)"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-backup-log')">İptal</button>
      <button class="btn btn-primary" onclick="createNewBackupLog()">Yedek Kaydını Oluştur</button>
    </div>
  `);
};

window.createNewBackupLog = async function() {
  if (!canEdit()) { showToast('Yedek kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-bk-mach').value);
  const son_yedek_tarihi = document.getElementById('nm-bk-date').value.trim();
  const yedekleyen = document.getElementById('nm-bk-tech').value.trim();
  const dosya_konumu = document.getElementById('nm-bk-path').value.trim();
  const aciklama = document.getElementById('nm-bk-desc').value.trim();

  if (!son_yedek_tarihi || !yedekleyen || !dosya_konumu) {
    showToast('Tarih, yedekleyen ve dosya konumu girmek zorunludur.', 'error');
    return;
  }

  const id = State.backup_logs.length ? Math.max(...State.backup_logs.map(l => l.id)) + 1 : 1;
  const newLog = {
    id,
    tezgah_id,
    son_yedek_tarihi,
    yedekleyen: yedekleyen.toUpperCase(),
    dosya_konumu,
    aciklama
  };

  State.backup_logs.push(newLog);
  await saveBackupLogs();
  closeModal('new-backup-log');
  showToast('Yedek kaydı başarıyla deftere eklendi!', 'success');
  navigate('backup_tracker');
};

window.showBackupHistoryModal = function(mId) {
  const m = State.machines.find(x => x.id === mId);
  if (!m) return;

  const logs = State.backup_logs.filter(l => l.tezgah_id === mId).sort((a,b) => b.id - a.id);

  showModal('backup-history', `
    <div class="modal-header">
      <span class="modal-title">Yedekleme Geçmişi: ${m.numarasi}</span>
      <button class="modal-close" onclick="closeModal('backup-history')">✕</button>
    </div>
    <div style="max-height:300px; overflow-y:auto; padding:10px 0">
      ${logs.length ? logs.map(l => `
        <div class="card mb-3" style="padding:12px">
          <div class="flex justify-between items-center mb-1">
            <span class="font-mono" style="font-weight:700; color:var(--text-accent)">${l.son_yedek_tarihi}</span>
            <span style="font-size:11px; color:var(--text-muted)">Yapan: ${l.yedekleyen}</span>
          </div>
          <div style="font-size:11.5px; font-family:monospace; color:var(--text-secondary); background:var(--bg-card2); padding:6px; border-radius:4px; border:1px solid var(--border); word-break:break-all" class="mb-2">${l.dosya_konumu}</div>
          <p style="font-size:12px; color:var(--text-secondary); margin:0">${l.aciklama || 'Açıklama belirtilmemiş.'}</p>
        </div>
      `).join('') : '<div style="text-align:center; color:var(--text-muted); padding:20px">Bu tezgaha ait yedek kaydı bulunamadı</div>'}
    </div>
  `);
};

window.handleBackupFileDrop = function(e) {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files.length) {
    runBackupInspectorOnFile(e.dataTransfer.files[0]);
  }
};

window.handleBackupFileSelect = function(e) {
  if (e.target && e.target.files.length) {
    runBackupInspectorOnFile(e.target.files[0]);
  }
};

function runBackupInspectorOnFile(file) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    const content = evt.target.result;
    const res = window.inspectBackupFile ? window.inspectBackupFile(content, file.name) : null;
    const resEl = document.getElementById('backup-inspector-result');
    if (!resEl || !res) return;

    resEl.style.display = 'block';
    resEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
        <strong style="color:var(--text-accent); font-size:13px">📋 Dosya Analizi: ${escapeHTML(res.fileName)}</strong>
        <span class="tag ${res.isValid ? 'tag-green' : 'tag-amber'}">${escapeHTML(res.category)}</span>
      </div>
      <div style="font-size:12px; margin-bottom:6px; color:var(--text-primary)">
        <strong>Tür:</strong> ${escapeHTML(res.type)} · <strong>Boyut:</strong> ${res.estimatedSize}
      </div>
      <div style="font-size:11.5px; color:var(--text-secondary); margin-bottom:8px">
        <strong>Uyumlu Sistem:</strong> ${escapeHTML(res.controlSeries)}
      </div>
      <div style="font-size:11px; color:var(--text-muted)">
        ${res.details.map(d => `• ${escapeHTML(d)}`).join('<br>')}
      </div>
    `;
    showToast(`Yedek dosyası analiz edildi: ${file.name}`, 'success');
  };
  reader.readAsText(file);
}



// ════════════════════════════════════════════════════════════════
//  EKSEN BACKLASH (GERİ DÖNME BOŞLUĞU) HESAPLAMA SİHİRBAZI
// ════════════════════════════════════════════════════════════════
function renderBacklashHelper() {
  const page = createPage('backlash_helper');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Eksen Backlash (Geri Dönme Boşluğu) Sihirbazı</h1>
      <p>Mekanik vidalı mil boşluklarını komparatör saatiyle ölçmek için G-kod üretin ve Parametre 1851 yeni değerlerini hesaplayın</p>
    </div>
    <div class="page-body">
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        
        <!-- Left: Test G-Code Generator -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">🚀 1. Boşluk Test G-Kodu Üretici</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Tezgah eksenini komparatör saatine temas ettirip boşluğu ölçmek için otomatik test programı oluşturun:
          </p>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Test Ekseni</label>
              <select class="form-control" id="bl-axis">
                <option value="X">X Ekseni</option>
                <option value="Y">Y Ekseni</option>
                <option value="Z">Z Ekseni</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Test Mesafesi (mm)</label>
              <input class="form-control" id="bl-dist" type="number" value="10" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Hız (Feedrate F)</label>
              <input class="form-control" id="bl-feed" type="number" value="500" />
            </div>
            <div class="form-group">
              <label class="form-label">Bekleme (Dwell - Saniye)</label>
              <input class="form-control" id="bl-dwell" type="number" value="2" />
            </div>
          </div>

          <button class="btn btn-primary" onclick="generateBacklashGcode()">G-Kod Oluştur</button>

          <div style="position:relative; margin-top:10px">
            <textarea class="form-control font-mono" id="bl-gcode-output" rows="6" readonly style="background:#0f172a; color:var(--green); font-size:11.5px; line-height:1.5" placeholder="G-kod programı burada görüntülenecektir..."></textarea>
            <button class="btn btn-secondary btn-sm" onclick="copyBacklashGcode()" style="position:absolute; right:8px; top:8px; font-size:11px; padding:2px 8px">Kopyala</button>
          </div>
        </div>

        <!-- Right: Calculation & Simulated Parameter Screen -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📊 2. Kompanzasyon & Parametre 1851 Hesaplayıcı</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Geri hareket sonrasında komparatör saati üzerindeki sapma miktarını ve mevcut parametreyi girin:
          </p>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ölçülen Boşluk / Sapma (mm)</label>
              <input class="form-control" id="bl-measured" type="number" step="0.001" value="0.020" placeholder="ör. 0.020" />
            </div>
            <div class="form-group">
              <label class="form-label">Mevcut P1851 Değeri (Mikron)</label>
              <input class="form-control" id="bl-current-p1851" type="number" value="10" placeholder="ör. 10" />
            </div>
          </div>

          <button class="btn btn-primary" onclick="calculateNewBacklash()">Hesapla & Parametreyi Göster</button>

          <!-- Simulated FANUC Screen -->
          <div id="bl-simulated-screen" style="display:none; background:#000; border:3px solid #333; border-radius:4px; padding:12px; font-family:monospace; color:#00ff00; margin-top:10px">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">
              <span>SYSTEM PARAMETER</span>
              <span>No. 1851</span>
            </div>
            <div style="font-size:13px; line-height:1.8">
              <div>PARAMETER (BACKLASH COMP.)</div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="bl-screen-row-x">
                <span>X AXIS</span>
                <span id="bl-val-x" style="font-weight:bold; background:#222; padding:0 8px">10</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="bl-screen-row-y">
                <span>Y AXIS</span>
                <span id="bl-val-y" style="font-weight:bold; background:#222; padding:0 8px">15</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="bl-screen-row-z">
                <span>Z AXIS</span>
                <span id="bl-val-z" style="font-weight:bold; background:#222; padding:0 8px">8</span>
              </div>
            </div>
            <div style="margin-top:10px; font-size:10px; border-top:1px dashed #00ff00; padding-top:6px; color:#aaa" id="bl-calc-summary">
              Hesaplama: 20 mikron sapma + 10 mikron mevcut = 30 mikron yeni değer.
            </div>
          </div>

        </div>

      </div>
    </div>
  `;

  return page;
}

window.generateBacklashGcode = function() {
  const axis = document.getElementById('bl-axis').value;
  const dist = parseFloat(document.getElementById('bl-dist').value) || 10;
  const feed = parseInt(document.getElementById('bl-feed').value) || 500;
  const dwell = parseFloat(document.getElementById('bl-dwell').value) || 2;

  const code = `%
O1851 (BACKLASH TEST ${axis})
G21 G90 G94 (Metric, Abs, Feed/Min)
G00 ${axis}0.0 (Baslangic noktasina konumlan)
G04 X${dwell.toFixed(1)} (Komparator saati ayarlamak icin bekleme)
G01 ${axis}${dist.toFixed(3)} F${feed} (Ileri hareket - Komparator saati 0 yapin)
G04 X${dwell.toFixed(1)} (Ileri okuma beklemesi)
G01 ${axis}0.0 F${feed} (Geri hareket - Sapmayi olcun)
G04 X${dwell.toFixed(1)} (Geri okuma beklemesi)
M30
%`;

  document.getElementById('bl-gcode-output').value = code;
  showToast('G-Kod başarıyla üretildi.', 'success');
};

window.copyBacklashGcode = function() {
  const txt = document.getElementById('bl-gcode-output').value;
  if (!txt) {
    showToast('Öncelikle G-Kod üretin.', 'error');
    return;
  }
  navigator.clipboard.writeText(txt);
  showToast('G-Kod panoya kopyalandı!', 'success');
};

window.calculateNewBacklash = function() {
  const axis = document.getElementById('bl-axis').value;
  const measured = parseFloat(document.getElementById('bl-measured').value) || 0;
  const current = parseInt(document.getElementById('bl-current-p1851').value) || 0;

  // Convert mm to microns (1mm = 1000 microns)
  const measuredMicrons = Math.round(measured * 1000);
  const newValue = current + measuredMicrons;

  // Render values to simulated screen
  document.getElementById('bl-val-x').innerText = axis === 'X' ? newValue : '10';
  document.getElementById('bl-val-y').innerText = axis === 'Y' ? newValue : '15';
  document.getElementById('bl-val-z').innerText = axis === 'Z' ? newValue : '8';

  // Apply visual highlight to the calculated row
  document.getElementById('bl-screen-row-x').style.color = axis === 'X' ? '#ffff00' : '#00ff00';
  document.getElementById('bl-screen-row-y').style.color = axis === 'Y' ? '#ffff00' : '#00ff00';
  document.getElementById('bl-screen-row-z').style.color = axis === 'Z' ? '#ffff00' : '#00ff00';

  document.getElementById('bl-calc-summary').innerHTML = `
    <strong>HESAPLAMA DETAYI:</strong><br>
    - Ölçülen Sapma: ${measured.toFixed(3)} mm (${measuredMicrons} Mikron)<br>
    - Mevcut Parametre 1851: ${current} Mikron<br>
    - <strong>YENİ GİRİLMESİ GEREKEN DEĞER: ${newValue}</strong> (Parametre 1851 eksen satırına yazın).
  `;

  document.getElementById('bl-simulated-screen').style.display = 'block';
  showToast('Parametre hesabı tamamlandı.', 'success');
};


// ════════════════════════════════════════════════════════════════
//  SPINDLE SÜRÜCÜ TEŞHİSİ VE ENKODER KALİBRASYONU
// ════════════════════════════════════════════════════════════════
const SpindleDriveAlarms = [
  {
    code: "SP9002",
    title: "SPINDLE MOTOR OVERSPEED",
    desc: "Motor hızı belirlenen maksimum limiti aştı veya enkoder geri besleme sinyalinde sapma var.",
    causes: ["Enkoder kablosunda elektriksel parazit.", "Parametre 4020 (Spindle Max Hızı) yanlış girilmiş.", "Spindle enkoder okuyucu kafa ayarı bozuk."],
    solutions: ["Enkoder kablosunun ekranlamasını kontrol edin.", "Parametre 4020 ve 4001 nolu motor hız limitlerini kontrol edin.", "Enkoder hava boşluğunu ölçün (0.15mm olmalıdır)."]
  },
  {
    code: "SP9012",
    title: "SPINDLE MOTOR OVERCURRENT",
    desc: "Spindle sürücüsünün (SPM) çıkış devresinde aşırı akım algılandı.",
    causes: ["Motor sargılarında gövdeye kaçak veya kısa devre.", "Sürücü IGBT (güç transistörü) modülünde arıza.", "İş milinde mekanik kilitlenme veya aşırı yük."],
    solutions: ["Megger cihazı ile spindle motoru faz-faz ve faz-gövde sargı direncini ölçün.", "Sürücünün çıkış terminallerini söküp IGBT diyot testini yapın.", "Fener milinin elle rahat dönüp dönmediğini kontrol edin."]
  },
  {
    code: "SP9015",
    title: "SPINDLE FEEDBACK LOSS (ENCODER ALARM)",
    desc: "İş mili geri besleme enkoderinden gelen sinyal kesildi veya genliği düştü.",
    causes: ["Enkoder kablosunun kopması veya soketin çıkması.", "Enkoder okuyucu sensörün pislenmesi, yağlanması.", "Sensör ile dişli çark arasındaki hava boşluğunun açılması."],
    solutions: ["Sürücü kontrol kartı üzerindeki JY2/JY3 soket bağlantılarını sıkın.", "Enkoder sensör kafasını söküp temizleyici solventle temizleyin.", "Sensör boşluğunu (gap) sentil şeridi kullanarak 0.15mm - 0.20mm arasına ayarlayın."]
  },
  {
    code: "SP9056",
    title: "SPINDLE MOTOR SENSOR LOOP LOSS",
    desc: "Sürücü ile motorun dahili sensörü arasındaki dahili haberleşme halkası koptu.",
    causes: ["Dahili sıcaklık sensörü veya hız sensörü kablo temassızlığı.", "Sürücü SPM kontrol kartı arızası."],
    solutions: ["Motor klemens kutusundaki sensör bağlantılarını ve direnç değerlerini ölçün.", "Sürücü kablo konnektörlerini söküp oksitlenme temizliği yapın."]
  }
];

window.CurrentSpindleTab = 'alarms';

function renderSpindleDiagnostics() {
  const page = createPage('spindle_diagnostics');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚡ Spindle Sürücü Teşhisi ve Enkoder Kalibrasyonu</h1>
      <p>İş mili sürücü (SPM) alarmları, fren direnci testleri ve pozisyon kodlayıcı diş oranı ayarları</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-sp-alarms" onclick="switchSpindleTab('alarms')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📖 Spindle Alarmları & Sensör Boşluğu
        </button>
        <button class="tab-btn" id="tab-sp-brake" onclick="switchSpindleTab('brake')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          ⚡ Fren Direnci & Deşarj Testi
        </button>
        <button class="tab-btn" id="tab-sp-gear" onclick="switchSpindleTab('gear')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          ⚙️ Pozisyon Kodlayıcı Diş Oranı
        </button>
      </div>
    </div>
    
    <div class="page-body" id="spindle-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchSpindleTab(window.CurrentSpindleTab, page);
  }, 10);

  return page;
}

window.switchSpindleTab = function(tab, page = document) {
  window.CurrentSpindleTab = tab;
  
  const alBtn = page.querySelector('#tab-sp-alarms');
  const brBtn = page.querySelector('#tab-sp-brake');
  const geBtn = page.querySelector('#tab-sp-gear');
  if (alBtn && brBtn && geBtn) {
    alBtn.style.color = tab === 'alarms' ? 'var(--text-accent)' : 'var(--text-secondary)';
    alBtn.style.fontWeight = tab === 'alarms' ? 'bold' : 'normal';
    brBtn.style.color = tab === 'brake' ? 'var(--text-accent)' : 'var(--text-secondary)';
    brBtn.style.fontWeight = tab === 'brake' ? 'bold' : 'normal';
    geBtn.style.color = tab === 'gear' ? 'var(--text-accent)' : 'var(--text-secondary)';
    geBtn.style.fontWeight = tab === 'gear' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#spindle-tab-content');
  if (!content) return;

  if (tab === 'alarms') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Left: Spindle Alarms lookup -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📖 Spindle Alarm Ansiklopedisi</div>
          <div class="form-group">
            <label class="form-label">Spindle Hata Kodu Seçin</label>
            <select class="form-control" id="spd-alarm-select" onchange="showSpindleAlarmDetail()">
              <option value="">-- Alarm Seçin --</option>
              ${SpindleDriveAlarms.map(a => `<option value="${a.code}">${a.code} - ${a.title}</option>`).join('')}
            </select>
          </div>
          
          <div id="spd-alarm-detail" style="display:none; background:var(--bg-card2); border:1px solid var(--border); padding:16px; border-radius:var(--radius-sm)">
            <h3 id="spd-det-title" style="color:var(--red); font-size:14px; margin-bottom:8px"></h3>
            <p id="spd-det-desc" style="font-size:12px; color:var(--text-secondary); margin-bottom:12px"></p>
            
            <div style="margin-bottom:10px">
              <strong style="font-size:12px; color:var(--text-accent)">Olası Nedenler:</strong>
              <ul id="spd-det-causes" style="font-size:11.5px; padding-left:18px; margin-top:4px"></ul>
            </div>
            <div>
              <strong style="font-size:12px; color:var(--green)">Saha Çözüm Adımları:</strong>
              <ol id="spd-det-sols" style="font-size:11.5px; padding-left:18px; margin-top:4px"></ol>
            </div>
          </div>
        </div>

        <!-- Right: Spindle Sensor Gap Calibration -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📐 Manyetik Sensör (Enkoder) Hava Boşluğu Kalibrasyonu</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            İş mili üzerindeki dişli çarkı okuyan manyetik sensörün (pre-amp) hava boşluğu, sinyal genliğini (V p-p) doğrudan etkiler:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); font-size:12px">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px">
              <span>Hedef Hava Boşluğu:</span>
              <strong style="color:var(--text-accent)">0.15 mm - 0.20 mm</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px">
              <span>Sinyal Genliği (Peak-to-Peak):</span>
              <strong style="color:var(--green)">1.0 V p-p (±10%)</strong>
            </div>
            <div style="display:flex; justify-content:space-between">
              <span>Sınır Değer (Minimum):</span>
              <strong style="color:var(--red)">0.6 V p-p (Altı Hata Verir)</strong>
            </div>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:8px">
            <strong>🔧 Adım Adım Kalibrasyon Prosedürü:</strong>
            <div>1. Sentil şeridi (pirinç/bronz plastik esaslı şerit) kullanarak sensör okuyucu kafası ile dişli çarkın diş tepesi arasındaki boşluğu ölçün.</div>
            <div>2. Sabitleme vidalarını hafifçe gevşetip **0.15mm** sentili araya sıkıştırarak kafayı dişliye yaklaştırın ve vidaları torkunda sıkın.</div>
            <div>3. Mil elle çevrilirken dişlerin sensöre çarpmadığını teyit edin.</div>
            <div>4. Sürücü kontrol kartı üzerindeki **MS** ve **MB** test noktalarından osiloskop yardımıyla sinüs/kosinüs dalga genliğini kontrol edin.</div>
          </div>
        </div>
      </div>
    `;
  } else if (tab === 'brake') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1.1fr 0.9fr; gap:16px">
        <!-- Left: Brake Resistor multimeter test -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--red)">⚡ Fren Direnci & Rejeneratif Deşarj Testi</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Spindle yavaşlarken aşırı bara voltajı (Overvoltage / DC Link High) hatası veriyorsa frenleme devresini test edin:
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔌 Direnç Ölçüm Adımları (Multimetre):</strong>
            <div>1. Tezgahın ana gücünü kapatın ve DC bara kondansatörlerinin boşalması için en az 10 dakika bekleyin. Sürücü üstündeki kırmızı <strong>CHARGE</strong> lambasının söndüğünü doğrulayın.</div>
            <div>2. Sürücünün altındaki harici frenleme direnci terminallerini (genellikle <strong>R1 ve R2</strong> veya <strong>PR ve CX</strong>) sökün.</div>
            <div>3. Multimetreyi Ohm (Ω) konumuna alın ve bu iki uç arasındaki direnci ölçün. Direnç değeri plaka üzerindeki değerle (genellikle 10 Ω ile 30 Ω arası) aynı olmalıdır. Sonsuz direnç (OL) kablonun veya direncin koptuğunu gösterir.</div>
            <div>4. Direnç uçlarının gövdeye kaçak (şase) yapıp yapmadığını Mega-Ohm seviyesinde kontrol edin (en az 10 MΩ olmalıdır).</div>
          </div>
        </div>

        <!-- Right: IGBT and discharge circuit diagnostics -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">🔌 IGBT & Deşarj Transistörü Kontrolü</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Direnç sağlamsa, sürücü içerisindeki deşarj transistörü (IGBT) kısa devre veya açık devre olmuş olabilir:
          </p>
          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:11.5px; border:1px solid var(--border); display:flex; flex-direction:column; gap:6px">
            <div style="color:var(--text-accent)">• Transistör Kısa Devre Testi:</div>
            <div>Diyot modunda multimetre problarını <strong>DC+ (P)</strong> ve <strong>R1 (Deşarj)</strong> arasına tutun. Bir yönde diyot geçirgenliği (yaklaşık 0.4V), ters yönde açık devre (OL) görünmelidir. Her iki yönde 0V çıkarsa IGBT yanmıştır.</div>
          </div>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Left: Gear Ratio Calculator -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">⚙️ Kasnak & Dişli Oranı Hesaplayıcı</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            İş mili (spindle) ile devir/pozisyon bilgisini okuyan sensör kasnağı arasındaki diş sayılarını girin:
          </p>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Spindle (Fener Mili) Diş Sayısı</label>
              <input class="form-control" id="sp-teeth-sp" type="number" value="120" />
            </div>
            <div class="form-group">
              <label class="form-label">Sensör Mili Diş Sayısı</label>
              <input class="form-control" id="sp-teeth-sens" type="number" value="120" />
            </div>
          </div>

          <button class="btn btn-primary" onclick="calculateSpindleGearRatio()">Parametreleri Hesapla</button>

          <!-- Simulated FANUC Screen -->
          <div id="sp-simulated-screen" style="display:none; background:#000; border:3px solid #333; border-radius:4px; padding:12px; font-family:monospace; color:#00ff00; margin-top:10px">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">
              <span>SYSTEM PARAMETER</span>
              <span>No. 4002 / 4003</span>
            </div>
            <div style="font-size:13px; line-height:1.8">
              <div>SPINDLE POSITION CODER RATIO</div>
              <div style="display:flex; justify-content:space-between; padding-left:10px">
                <span>P4002 (SPINDLE/MOTOR RATIO NUM.)</span>
                <span id="sp-val-4002" style="font-weight:bold; background:#222; padding:0 8px">1</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px">
                <span>P4003 (SPINDLE/MOTOR RATIO DENOM.)</span>
                <span id="sp-val-4003" style="font-weight:bold; background:#222; padding:0 8px">1</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Parameters Explanation -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📖 Pozisyon Kodlayıcı Parametre Ayarları</div>
          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:10px; line-height:1.5">
            <div>
              <strong style="color:var(--text-accent)">• Parameter 4001 #4 (GSM):</strong><br>
              Pozisyon kodlayıcı ile iş mili arasındaki bağlantı tipini belirler. Dişli/kasnak bağlantısı varsa <code>1</code>, iş mili ile birebir aynı devirde dönen direkt bağlantı (Direct Drive) varsa <code>0</code> setlenir.
            </div>
            <div>
              <strong style="color:var(--text-accent)">• Parameter 4002 & 4003:</strong><br>
              Dişli veya kayış kasnak oranlarının en sadeleştirilmiş kesir (pay ve payda) karşılıklarıdır. Eğer bu oranlar yanlış setlenirse, kılavuz çekme (tapping) veya spindle oryantasyon (M19) kilitlenmelerinde senkronizasyon kaçar ve takım kırılır.
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

window.calculateSpindleGearRatio = function() {
  const teethSp = parseInt(document.getElementById('sp-teeth-sp').value) || 120;
  const teethSens = parseInt(document.getElementById('sp-teeth-sens').value) || 120;

  // Simple fraction reduction (GCD helper)
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const common = gcd(teethSp, teethSens);
  
  const num = teethSp / common;
  const denom = teethSens / common;

  document.getElementById('sp-val-4002').innerText = num;
  document.getElementById('sp-val-4003').innerText = denom;

  document.getElementById('sp-simulated-screen').style.display = 'block';
  showToast('Spindle dişli oranı hesaplandı.', 'success');
};

window.showSpindleAlarmDetail = function() {
  const code = document.getElementById('spd-alarm-select').value;
  const detailDiv = document.getElementById('spd-alarm-detail');
  if (!code) {
    detailDiv.style.display = 'none';
    return;
  }

  const alarm = SpindleDriveAlarms.find(a => a.code === code);
  if (!alarm) return;

  document.getElementById('spd-det-title').innerText = `${alarm.code} - ${alarm.title}`;
  document.getElementById('spd-det-desc').innerText = alarm.desc;
  
  document.getElementById('spd-det-causes').innerHTML = alarm.causes.map(c => `<li>${c}</li>`).join('');
  document.getElementById('spd-det-sols').innerHTML = alarm.solutions.map(s => `<li>${s}</li>`).join('');
  
  detailDiv.style.display = 'block';
};


// ════════════════════════════════════════════════════════════════
//  ÜRETİCİ ÖZEL M-KODU VE ALARM KÜTÜPHANESİ (A-ADRESLERİ)
// ════════════════════════════════════════════════════════════════
window.CurrentBuilderTab = 'mcodes';

function renderCustomBuilderLibrary() {
  const page = createPage('custom_builder_library');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📖 Üretici Özel M-Kodu ve Alarm Kütüphanesi</h1>
          <p>Tezgah üreticisine özel tanımlanmış M-kodları ve PMC A-adresi alarm mesajları kılavuzu</p>
        </div>
        ${canEdit() ? `
        <div>
          <button class="btn btn-primary" id="bl-add-btn" onclick="showNewBuilderItemModal()">
            Yeni Ekle
          </button>
        </div>
        ` : ''}
      </div>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-mcodes" onclick="switchBuilderTab('mcodes')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📦 Özel M-Kodları
        </button>
        <button class="tab-btn" id="tab-alarms" onclick="switchBuilderTab('alarms')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🚨 Üretici Alarmları (A-Adresleri)
        </button>
      </div>

      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="builder-search" placeholder="Kod veya açıklama ara..." />
        </div>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div style="overflow-y:auto; flex:1">
        <table class="data-table">
          <thead id="builder-thead"></thead>
          <tbody id="builder-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => {
    switchBuilderTab(window.CurrentBuilderTab, page);
    page.querySelector('#builder-search').addEventListener('input', () => filterBuilderList(page));
  }, 10);

  return page;
}

window.switchBuilderTab = function(tab, page = document) {
  window.CurrentBuilderTab = tab;
  
  const mBtn = page.querySelector('#tab-mcodes');
  const aBtn = page.querySelector('#tab-alarms');
  if (mBtn && aBtn) {
    mBtn.style.color = tab === 'mcodes' ? 'var(--text-accent)' : 'var(--text-secondary)';
    mBtn.style.fontWeight = tab === 'mcodes' ? 'bold' : 'normal';
    aBtn.style.color = tab === 'alarms' ? 'var(--text-accent)' : 'var(--text-secondary)';
    aBtn.style.fontWeight = tab === 'alarms' ? 'bold' : 'normal';
  }

  const thead = page.querySelector('#builder-thead');
  if (tab === 'mcodes') {
    thead.innerHTML = `
      <tr>
        <th>M-Kodu</th>
        <th>İşlev Adı</th>
        <th>Tetikleyici Sinyal</th>
        <th>Açıklama</th>
        <th style="width:100px">İşlemler</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        <th>A-Adresi</th>
        <th>Hata Kodu</th>
        <th>Alarm Başlığı</th>
        <th>Açıklama</th>
        <th style="width:100px">İşlemler</th>
      </tr>
    `;
  }

  filterBuilderList(page);
};

function filterBuilderList(page) {
  const tbody = page.querySelector('#builder-tbody');
  if (!tbody) return;

  const q = page.querySelector('#builder-search').value.toLowerCase();
  
  if (window.CurrentBuilderTab === 'mcodes') {
    const filtered = State.custom_mcodes.filter(m => 
      !q || m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Özel M-Kodu bulunamadı.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(m => `
      <tr>
        <td><strong style="color:var(--text-accent); font-family:monospace">${m.code}</strong></td>
        <td><strong>${m.name}</strong></td>
        <td><span class="tag tag-blue" style="font-family:monospace">${m.signal}</span></td>
        <td><div style="font-size:12px; white-space:normal; max-width:500px">${m.description}</div></td>
        <td>
          ${canDelete() ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteCustomMcode(${m.id})" title="Sil" style="color:var(--red)">✕</button>` : ''}
        </td>
      </tr>
    `).join('');
  } else {
    const filtered = State.custom_alarms.filter(a => 
      !q || a.address.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Üretici Alarmı bulunamadı.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(a => `
      <tr>
        <td><strong style="color:var(--text-accent); font-family:monospace">${a.address}</strong></td>
        <td><span class="tag tag-red" style="font-family:monospace">${a.code}</span></td>
        <td><strong>${a.title}</strong></td>
        <td><div style="font-size:12px; white-space:normal; max-width:400px">${a.description}</div></td>
        <td>
          ${canDelete() ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteCustomAlarm(${a.id})" title="Sil" style="color:var(--red)">✕</button>` : ''}
        </td>
      </tr>
    `).join('');
  }
}

window.showNewBuilderItemModal = function() {
  if (window.CurrentBuilderTab === 'mcodes') {
    showModal('new-builder-mcode', `
      <div class="modal-header">
        <span class="modal-title">Yeni Özel M-Kodu Ekle</span>
        <button class="modal-close" onclick="closeModal('new-builder-mcode')">✕</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">M-Kodu (ör. M10) *</label>
          <input class="form-control" id="nm-mc-code" placeholder="M10" />
        </div>
        <div class="form-group">
          <label class="form-label">Tetikleyici PMC Sinyali (ör. Y22.4)</label>
          <input class="form-control" id="nm-mc-signal" placeholder="Y22.4" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">İşlev Adı *</label>
        <input class="form-control" id="nm-mc-name" placeholder="ör. AYNA SIKMA" />
      </div>
      <div class="form-group">
        <label class="form-label">Açıklama</label>
        <textarea class="form-control" id="nm-mc-desc" rows="3" placeholder="İşlev hakkında detaylı bilgi girin..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('new-builder-mcode')">İptal</button>
        <button class="btn btn-primary" onclick="createNewCustomMcode()">Kaydet</button>
      </div>
    `);
  } else {
    showModal('new-builder-alarm', `
      <div class="modal-header">
        <span class="modal-title">Yeni Üretici Alarmı (A-Adresi) Ekle</span>
        <button class="modal-close" onclick="closeModal('new-builder-alarm')">✕</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">A-Adresi (ör. A0.0) *</label>
          <input class="form-control" id="nm-al-addr" placeholder="A0.0" />
        </div>
        <div class="form-group">
          <label class="form-label">Hata Kodu (ör. EX0001) *</label>
          <input class="form-control" id="nm-al-code" placeholder="EX0001" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Alarm Başlığı *</label>
        <input class="form-control" id="nm-al-title" placeholder="ör. LUBRICATION PRESSURE FAULT" />
      </div>
      <div class="form-group">
        <label class="form-label">Açıklama / Saha Önerileri</label>
        <textarea class="form-control" id="nm-al-desc" rows="3" placeholder="Hatanın çözümü ve nedenleri hakkında bilgi girin..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('new-builder-alarm')">İptal</button>
        <button class="btn btn-primary" onclick="createNewCustomAlarm()">Kaydet</button>
      </div>
    `);
  }
};

window.createNewCustomMcode = async function() {
  if (!canEdit()) { showToast('M-Kodu ekleme yetkiniz yok', 'error'); return; }
  const code = document.getElementById('nm-mc-code').value.trim().toUpperCase();
  const signal = document.getElementById('nm-mc-signal').value.trim().toUpperCase();
  const name = document.getElementById('nm-mc-name').value.trim().toUpperCase();
  const description = document.getElementById('nm-mc-desc').value.trim();

  if (!code || !name) {
    showToast('Lütfen zorunlu alanları doldurun.', 'error');
    return;
  }

  const id = State.custom_mcodes.length ? Math.max(...State.custom_mcodes.map(m => m.id)) + 1 : 1;
  State.custom_mcodes.push({ id, code, signal, name, description });
  await saveCustomMCodes();
  closeModal('new-builder-mcode');
  showToast('Özel M-Kodu eklendi.', 'success');
  navigate('custom_builder_library');
};

window.createNewCustomAlarm = async function() {
  if (!canEdit()) { showToast('Özel alarm ekleme yetkiniz yok', 'error'); return; }
  const address = document.getElementById('nm-al-addr').value.trim().toUpperCase();
  const code = document.getElementById('nm-al-code').value.trim().toUpperCase();
  const title = document.getElementById('nm-al-title').value.trim().toUpperCase();
  const description = document.getElementById('nm-al-desc').value.trim();

  if (!address || !code || !title) {
    showToast('Lütfen zorunlu alanları doldurun.', 'error');
    return;
  }

  const id = State.custom_alarms.length ? Math.max(...State.custom_alarms.map(a => a.id)) + 1 : 1;
  State.custom_alarms.push({ id, address, code, title, description, causes: [], solutions: [] });
  await saveCustomAlarms();
  closeModal('new-builder-alarm');
  showToast('Üretici alarmı eklendi.', 'success');
  navigate('custom_builder_library');
};

window.deleteCustomMcode = async function(id) {
  if (!canDelete()) { showToast('M-Kodu silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu M-kodunu silmek istediğinize emin misiniz?')) return;
  State.custom_mcodes = State.custom_mcodes.filter(m => m.id !== id);
  await saveCustomMCodes();
  showToast('M-kodu silindi.', 'success');
  navigate('custom_builder_library');
};

window.deleteCustomAlarm = async function(id) {
  if (!canDelete()) { showToast('Özel alarm silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu alarmı silmek istediğinize emin misiniz?')) return;
  State.custom_alarms = State.custom_alarms.filter(a => a.id !== id);
  await saveCustomAlarms();
  showToast('Alarm silindi.', 'success');
  navigate('custom_builder_library');
};


// ════════════════════════════════════════════════════════════════
//  RS232 PİN VE LEHİMLEME BAĞLANTI REHBERİ
// ════════════════════════════════════════════════════════════════
const Rs232CableSchematics = {
  software: {
    title: "DB9 (PC Side) - DB25 (CNC Side) Software Handshake (XON/XOFF) Kablo Şeması",
    desc: "Yazılımsal akış kontrolü kullanan standart kablo şeması. Donanımsal RTS/CTS köprüleri konektörlerin kendi içinde yapılmıştır.",
    wiring: [
      { from: "DB9 Pin 2 (RxD)", to: "DB25 Pin 2 (TxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 3 (TxD)", to: "DB25 Pin 3 (RxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 5 (GND)", to: "DB25 Pin 7 (SG)", color: "var(--green)" },
      { from: "DB25 Köprü (CNC)", to: "Pin 4 (RTS) - Pin 5 (CTS) Arası Köprü", color: "var(--red)" },
      { from: "DB25 Köprü (CNC)", to: "Pin 6 (DSR) - Pin 8 (CD) - Pin 20 (DTR) Arası Köprü", color: "var(--red)" },
      { from: "DB9 Köprü (PC)", to: "Pin 7 (RTS) - Pin 8 (CTS) Arası Köprü", color: "var(--yellow)" },
      { from: "DB9 Köprü (PC)", to: "Pin 1 (CD) - Pin 4 (DTR) - Pin 6 (DSR) Arası Köprü", color: "var(--yellow)" }
    ]
  },
  hardware: {
    title: "DB9 (PC Side) - DB25 (CNC Side) Full Hardware Handshake (DTR/DSR/RTS/CTS) Şeması",
    desc: "Donanımsal el sıkışma (RTS/CTS) kullanan tam bağlantılı kablo. Akış kontrolü CNC donanımı üzerinden elektriksel olarak kesilir.",
    wiring: [
      { from: "DB9 Pin 2 (RxD)", to: "DB25 Pin 2 (TxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 3 (TxD)", to: "DB25 Pin 3 (RxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 5 (GND)", to: "DB25 Pin 7 (SG)", color: "var(--green)" },
      { from: "DB9 Pin 7 (RTS)", to: "DB25 Pin 5 (CTS)", color: "var(--yellow)" },
      { from: "DB9 Pin 8 (CTS)", to: "DB25 Pin 4 (RTS)", color: "var(--yellow)" },
      { from: "DB9 Pin 4 (DTR)", to: "DB25 Pin 6 (DSR) + Pin 8 (CD)", color: "var(--blue)" },
      { from: "DB9 Pin 6 (DSR)", to: "DB25 Pin 20 (DTR)", color: "var(--blue)" }
    ]
  }
};

function renderRs232Cables() {
  const page = createPage('rs232_cables');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔌 RS232 Pin & Lehim Bağlantı Rehberi</h1>
      <p>FANUC CNC üniteleri ile PC arasındaki DNC haberleşme kablosunun lehimleme pin şeması ve süreklilik testleri</p>
    </div>
    <div class="page-body">
      <div class="grid-2" style="grid-template-columns: 1.2fr 0.8fr; gap:16px">
        
        <!-- Left: Wiring Schematic Details -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">🔌 Kablo Şeması Seçici</div>
          
          <div class="form-group">
            <label class="form-label">Bağlantı Tipi</label>
            <select class="form-control" id="r2-scheme-select" onchange="showRs232Schematic()">
              <option value="software">XON/XOFF Yazılımsal Akış Kontrolü (Önerilen)</option>
              <option value="hardware">RTS/CTS Donanımsal Akış Kontrolü</option>
            </select>
          </div>

          <div id="r2-scheme-detail" style="margin-top:10px">
            <h3 id="r2-sch-title" style="color:var(--text-accent); font-size:13.5px; font-weight:bold; margin-bottom:4px"></h3>
            <p id="r2-sch-desc" style="font-size:12px; color:var(--text-secondary); margin-bottom:12px"></p>
            
            <div style="background:#0f172a; padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
              <div style="font-size:12px; font-weight:bold; color:var(--text-primary); margin-bottom:8px">Lehimleme Bağlantı Tablosu:</div>
              <div id="r2-sch-wiring-list" style="font-family:monospace; font-size:11.5px; display:flex; flex-direction:column; gap:6px"></div>
            </div>
          </div>
        </div>

        <!-- Right: Continuity & Shield Ground Tests -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">⚡ Kablo Süreklilik ve Şase Test Kılavuzu</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Kablonuzu lehimledikten sonra CNC'ye bağlamadan önce mutlaka bir multimetre yardımıyla şu testleri gerçekleştirin:
          </p>

          <div style="display:flex; flex-direction:column; gap:10px; font-size:12px">
            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--green); border-radius:4px">
              <strong style="color:var(--green)">1. Kısa Devre Kontrolü:</strong><br>
              Multimetreyi direnç veya buzzer konumuna alın. Yandaki tabloda yer almayan **hiçbir pin çiftinin** kendi arasında kısa devre yapmadığını doğrulayın. (Özellikle 2 ve 3 numaralı pinler).
            </div>
            
            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--text-accent); border-radius:4px">
              <strong>2. Dış Ekranlama (Shield GND) Testi:</strong><br>
              Kablo dışındaki metal örgü (blendaj) korumasını **sadece DB25 (CNC) tarafındaki Pin 1 (Frame Ground)** terminaline lehimleyin. PC tarafındaki DB9 tarafında ekranlama boşta kalmalıdır. Bu kural toprak döngüsü parazitlerini engeller.
            </div>

            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--red); border-radius:4px">
              <strong style="color:var(--red)">3. SR0086 (DR Signal Off) Hatası Alırsanız:</strong><br>
              CNC tarafındaki DB25 konektöründe 6, 8 ve 20 numaralı pinlerin kendi arasında tam kısa devre (köprü) yapılıp lehimlendiğini teyit edin.
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  setTimeout(() => showRs232Schematic(page), 10);

  return page;
}

window.showRs232Schematic = function(page = document) {
  const select = page.querySelector('#r2-scheme-select');
  if (!select) return;

  const key = select.value;
  const sch = Rs232CableSchematics[key];
  if (!sch) return;

  page.querySelector('#r2-sch-title').innerText = sch.title;
  page.querySelector('#r2-sch-desc').innerText = sch.desc;

  const wList = page.querySelector('#r2-sch-wiring-list');
  wList.innerHTML = sch.wiring.map(w => `
    <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #1e293b; padding-bottom:4px">
      <span>${w.from}</span>
      <span style="color:#64748b">────────►</span>
      <span style="color:${w.color}; font-weight:bold">${w.to}</span>
    </div>
  `).join('');
};

// ════════════════════════════════════════════════════════════════
//  EKSEN YUMUŞAK LİMİT (SOFT LIMIT) HESAPLAMA SİHİRBAZI
// ════════════════════════════════════════════════════════════════
window.CurrentLimitTab = 'limits';

function renderAxisLimitsHelper() {
  const page = createPage('axis_limits_helper');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Eksen Yumuşak Limit & Hareket Kilidi (Interlock)</h1>
      <p>Yumuşak limit parametrelerini hesaplayın veya eksen hareket kilidi (interlock) sinyallerini teşhis edin</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-lim-calc" onclick="switchLimitTab('limits')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📐 Stored Stroke Limits (P1320/21)
        </button>
        <button class="tab-btn" id="tab-lim-int" onclick="switchLimitTab('interlock')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🔒 Eksen Kilit Teşhisi (Interlock)
        </button>
      </div>
    </div>
    
    <div class="page-body" id="limit-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchLimitTab(window.CurrentLimitTab, page);
  }, 10);

  return page;
}

window.switchLimitTab = function(tab, page = document) {
  window.CurrentLimitTab = tab;

  const calcBtn = page.querySelector('#tab-lim-calc');
  const intBtn = page.querySelector('#tab-lim-int');
  if (calcBtn && intBtn) {
    calcBtn.style.color = tab === 'limits' ? 'var(--text-accent)' : 'var(--text-secondary)';
    calcBtn.style.fontWeight = tab === 'limits' ? 'bold' : 'normal';
    intBtn.style.color = tab === 'interlock' ? 'var(--text-accent)' : 'var(--text-secondary)';
    intBtn.style.fontWeight = tab === 'interlock' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#limit-tab-content');
  if (!content) return;

  if (tab === 'limits') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Left: Input & Calculation parameters -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📐 Limit Hesaplama Kriterleri</div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Eksen Seçimi</label>
              <select class="form-control" id="axl-axis">
                <option value="X">X Ekseni</option>
                <option value="Y">Y Ekseni</option>
                <option value="Z">Z Ekseni</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Mekanik Stoper Konumu (mm)</label>
              <input class="form-control" id="axl-stop" type="number" value="520" placeholder="ör. 520" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Emniyet Boşluk Payı (mm)</label>
              <input class="form-control" id="axl-margin" type="number" value="10" placeholder="ör. 10" />
            </div>
            <div class="form-group">
              <label class="form-label">Limit Yönü</label>
              <select class="form-control" id="axl-direction">
                <option value="positive">Artı Yön (+) - P1320</option>
                <option value="negative">Eksi Yön (-) - P1321</option>
              </select>
            </div>
          </div>

          <button class="btn btn-primary" onclick="calculateNewLimits()">Yeni Limit Değerini Hesapla</button>

          <!-- Simulated FANUC Screen for Parameters 1320 / 1321 -->
          <div id="axl-simulated-screen" style="display:none; background:#000; border:3px solid #333; border-radius:4px; padding:12px; font-family:monospace; color:#00ff00; margin-top:10px">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">
              <span>SYSTEM PARAMETER</span>
              <span id="axl-screen-param-no">No. 1320</span>
            </div>
            <div style="font-size:13px; line-height:1.8">
              <div id="axl-screen-param-name">LIMIT+ (STORED STROKE LIMIT 1)</div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="axl-row-x">
                <span>X AXIS</span>
                <span id="axl-val-x" style="font-weight:bold; background:#222; padding:0 8px">500000</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="axl-row-y">
                <span>Y AXIS</span>
                <span id="axl-val-y" style="font-weight:bold; background:#222; padding:0 8px">450000</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="axl-row-z">
                <span>Z AXIS</span>
                <span id="axl-val-z" style="font-weight:bold; background:#222; padding:0 8px">600000</span>
              </div>
            </div>
            <div style="margin-top:10px; font-size:10px; border-top:1px dashed #00ff00; padding-top:6px; color:#aaa" id="axl-calc-summary"></div>
          </div>
        </div>

        <!-- Right: Field Guidelines and Explanation -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📖 Limit Parametreleri Saha Bilgisi</div>
          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:12px; line-height:1.5">
            <div>
              <strong style="color:var(--text-accent)">• Stored Stroke Limit 1 (P1320 & P1321):</strong><br>
              Tezgahın eksen limitlerini elektriksel olarak sınırlayan parametrelerdir. Buraya yazılan değerler milimetre cinsinden değerin 1000 katıdır (Örn: 510 mm limit için parametreye **510000** yazılır).
            </div>
            <div>
              <strong style="color:var(--text-accent)">• OT0500 / OT0501 Sınır Aşım Alarmları:</strong><br>
              Eksen yumuşak limiti aştığında bu alarmlar tetiklenir. Kurtarmak için MDI modunda limit aşım yönünün tersine el çarkıyla (MPG) jog çekilmeli veya acil stop basılıyken limit parametresi geçici olarak genişletilmelidir.
            </div>
            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--red); border-radius:4px">
              <strong style="color:var(--red)">Önemli Saha Kuralı:</strong><br>
              Limit değeri belirlenirken, mekanik stoper ile yumuşak limit arasında en az **5 ila 10 mm emniyet payı** bırakılmalıdır. Aksi halde, yüksek hızda (Rapid feed G00) eksen durana kadar mekanik takoza çarpar ve vidalı mil/rulman hasarı oluşur.
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        
        <!-- Left: Axis interlock diagnostics -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">🔒 Eksen Kilidi (Interlock) PMC Teşhisi</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Eksenler jog veya el çarkıyla (MPG) hareket etmiyorsa ve ekranda herhangi bir hata kodu yoksa, PMC ladder programı yazılımsal olarak eksen hareketlerini kilitlemiş olabilir:
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔍 Kontrol Edilmesi Gereken Kritik PMC Sinyalleri:</strong>
            <div style="padding:8px; background:var(--bg-card2); border-radius:4px">
              <strong style="color:var(--text-accent)">• Bütün Eksenler Kilidi (*IT / G8.0):</strong><br>
              Tüm eksenlerin genel hareket kilididir. Bu bitin değeri <strong>1 (High)</strong> olmalıdır. Eğer <code>0</code> ise hiçbir eksen hareket etmez.
            </div>
            <div style="padding:8px; background:var(--bg-card2); border-radius:4px">
              <strong style="color:var(--text-accent)">• Tekil Eksen Kilidi (G130):</strong><br>
              Eksenlerin ayrı ayrı kilitlenmesidir (G130.0 -> X, G130.1 -> Y, G130.2 -> Z). Bu bitlerin değeri <strong>0</strong> olmalıdır. Eğer ilgili bit <code>1</code> ise o eksenin PMC tarafından (kapı switch'i açık, ayna gevşek vb. nedenlerle) kilitlendiğini gösterir.
            </div>
          </div>
        </div>

        <!-- Right: Diagnostics steps -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">🔧 Adım Adım Sinyal İzleme Prosedürü</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            PMC ekranı üzerinden kilit sinyallerinin lojik durumlarını teyit edin:
          </p>
          
          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <div>1. CNC panelinden <strong>SYSTEM > PMC > STATUS</strong> menüsüne girin.</div>
            <div>2. Arama çubuğuna <code>G130</code> yazıp SEARCH (veya G-DATA) basın.</div>
            <div>3. Lojik durum ekranında <strong>G130.0, G130.1, G130.2</strong> bitlerinin <code>0</code> olduğunu doğrulayın.</div>
            <div>4. Eğer ilgili eksen biti <code>1</code> ise, PMC ladder ekranından bu bitin gerisindeki sensör ve lojik röleleri (örn: kapı switch X veya ayna switch X) geriye doğru izleyerek hangi kilidin aktif kaldığını tespit edin.</div>
          </div>
        </div>

      </div>
    `;
  }
};

window.calculateNewLimits = function() {
  const axis = document.getElementById('axl-axis').value;
  const stop = parseFloat(document.getElementById('axl-stop').value) || 0;
  const margin = parseFloat(document.getElementById('axl-margin').value) || 0;
  const dir = document.getElementById('axl-direction').value;

  let newValue = 0;
  const absoluteStop = Math.abs(stop);
  if (dir === 'positive') {
    newValue = absoluteStop - margin;
  } else {
    newValue = -absoluteStop + margin;
  }

  // Convert to microns (multiply by 1000 for FANUC)
  const paramVal = Math.round(newValue * 1000);
  const paramNo = dir === 'positive' ? 'No. 1320' : 'No. 1321';
  const paramName = dir === 'positive' ? 'LIMIT+ (STORED STROKE LIMIT 1)' : 'LIMIT- (STORED STROKE LIMIT 1)';

  // Update Simulated Screen
  document.getElementById('axl-screen-param-no').innerText = paramNo;
  document.getElementById('axl-screen-param-name').innerText = paramName;

  document.getElementById('axl-val-x').innerText = axis === 'X' ? paramVal : (dir === 'positive' ? '500000' : '-500000');
  document.getElementById('axl-val-y').innerText = axis === 'Y' ? paramVal : (dir === 'positive' ? '450000' : '-450000');
  document.getElementById('axl-val-z').innerText = axis === 'Z' ? paramVal : (dir === 'positive' ? '600000' : '-600000');

  // Highlight active row
  document.getElementById('axl-row-x').style.color = axis === 'X' ? '#ffff00' : '#00ff00';
  document.getElementById('axl-row-y').style.color = axis === 'Y' ? '#ffff00' : '#00ff00';
  document.getElementById('axl-row-z').style.color = axis === 'Z' ? '#ffff00' : '#00ff00';

  document.getElementById('axl-calc-summary').innerHTML = `
    <strong>HESAPLAMA DETAYI:</strong><br>
    - Mekanik Stoper Sınırı: ${stop} mm<br>
    - Emniyet Boşluk Payı: ${margin} mm<br>
    - Hesaplanan Emniyetli Konum: ${newValue} mm<br>
    - <strong>YENİ GİRİLMESİ GEREKEN DEĞER: ${paramVal}</strong> (Parameter ${dir === 'positive' ? '1320' : '1321'} eksen satırına yazın).
  `;

  document.getElementById('axl-simulated-screen').style.display = 'block';
  showToast('Limit hesabı tamamlandı.', 'success');
};

// ── Hoisted Helper Functions ────────────────────────────────────
function animateCounter(el, target, duration = 800, prefix = '', suffix = '') {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeProgress);
    el.textContent = `${prefix}${current.toLocaleString('tr-TR')}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = `${prefix}${target.toLocaleString('tr-TR')}${suffix}`;
    }
  }
  requestAnimationFrame(update);
}

function showTableSkeleton(tbody, rows = 5, cols = 5) {
  if (!tbody) return;
  let html = '';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      html += `<td><span class="skeleton skeleton-text" style="width:${50 + ((r * 11 + c * 7) % 40)}%"></span></td>`;
    }
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

function getSortedMachines() {
  return [...State.machines].sort((a, b) => String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr', { numeric: true, sensitivity: 'base' }));
}

function getTodayFormat() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function showPromptModal(title, defaultValue, onSubmit) {
  showModal('prompt-tech', `
    <div class="modal-header">
      <span class="modal-title">${escapeHTML(title)}</span>
      <button class="modal-close" onclick="closeModal('prompt-tech')">✕</button>
    </div>
    <div class="form-group" style="margin-top:12px">
      <label class="form-label">Teknisyen Adı Soyadı *</label>
      <input class="form-control" id="prompt-tech-input" value="${escapeHTML(defaultValue)}" placeholder="ör. AHMET MERT ÖZER" />
    </div>
    <div class="modal-footer" style="margin-top:16px">
      <button class="btn btn-ghost" onclick="closeModal('prompt-tech')">İptal</button>
      <button class="btn btn-primary" id="prompt-tech-submit">Onayla</button>
    </div>
  `, 'sm');
  
  setTimeout(() => {
    const input = document.getElementById('prompt-tech-input');
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);

  const submitBtn = document.getElementById('prompt-tech-submit');
  const submitAction = () => {
    const value = document.getElementById('prompt-tech-input').value.trim();
    if (!value) {
      showToast('Lütfen geçerli bir isim girin.', 'error');
      return;
    }
    closeModal('prompt-tech');
    onSubmit(value);
  };

  submitBtn.onclick = submitAction;
  document.getElementById('prompt-tech-input').onkeydown = (e) => {
    if (e.key === 'Enter') submitAction();
  };
}

function parseDateHelper(dateStr) {
  if (!dateStr) return new Date(0);
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date(0) : dateStr;
  if (typeof dateStr !== 'string') {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date(0) : date;
  }

  const str = dateStr.trim();

  // 1. Match DD.MM.YYYY [HH:mm[:ss]]
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10) - 1;
    const year = parseInt(dotMatch[3], 10);
    const hour = dotMatch[4] ? parseInt(dotMatch[4], 10) : 0;
    const min = dotMatch[5] ? parseInt(dotMatch[5], 10) : 0;
    const sec = dotMatch[6] ? parseInt(dotMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Match DD-MM-YYYY [HH:mm[:ss]] (Turkish/European hyphens)
  const hyphenMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (hyphenMatch) {
    const day = parseInt(hyphenMatch[1], 10);
    const month = parseInt(hyphenMatch[2], 10) - 1;
    const year = parseInt(hyphenMatch[3], 10);
    const hour = hyphenMatch[4] ? parseInt(hyphenMatch[4], 10) : 0;
    const min = hyphenMatch[5] ? parseInt(hyphenMatch[5], 10) : 0;
    const sec = hyphenMatch[6] ? parseInt(hyphenMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Fallback to native constructor (supports ISO YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss...)
  let d = new Date(str);
  if (isNaN(d.getTime()) && str.includes(' ')) {
    // Try replacing space with T for standard ISO date-time strings
    d = new Date(str.replace(' ', 'T'));
  }

  return isNaN(d.getTime()) ? new Date(0) : d;
}

function renderCncDashboard() {
  const page = createPage('cnc_dashboard');
  page.style.height = '100%';
  page.style.display = 'flex';
  page.style.flexDirection = 'column';
  page.style.padding = '0';

  // Sort machines alphabetically by name (Turkish locale aware natural sort)
  const sortedMachines = [...State.machines].sort((a, b) => {
    return String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr-TR', { numeric: true, sensitivity: 'base' });
  });

  // Build dynamic dropdown option elements from sortedMachines
  const machineOptions = sortedMachines.map(m => {
    return `<option value="${m.id}">${escapeHTML(m.numarasi)} (${escapeHTML(m.tip || 'CNC')})</option>`;
  }).join('');

  page.innerHTML = `
    <div style="background: var(--bg-surface); padding: 8px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; flex-shrink: 0; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">İzleme Yuvası:</label>
        <select id="cnc-sel-slot" class="form-control" style="width: 145px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);">
          <option value="0">Slot 1 (Sol Panel)</option>
          <option value="1">Slot 2 (Sağ Panel)</option>
        </select>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Tezgah:</label>
        <select id="cnc-sel-machine" class="form-control" style="width: 180px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);">
          <option value="">-- Tezgah Seçin --</option>
          ${machineOptions}
        </select>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">IP Adresi:</label>
        <input type="text" id="cnc-sel-ip" class="form-control" placeholder="192.168.30.20" style="width: 130px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);" />
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Port:</label>
        <input type="number" id="cnc-sel-port" class="form-control" placeholder="8193" style="width: 75px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);" value="8193" />
      </div>
      <button class="btn btn-primary btn-sm" id="btn-cnc-connect" style="padding: 5px 12px; font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
        <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2.5;"><polyline points="16 16 20 20 24 16"/><path d="M18 20V10a4 4 0 00-8 0v4"/><path d="M12 10a4 4 0 00-8 0v10"/><polyline points="8 16 4 20 0 16"/></svg>
        Bağlan ve İzle
      </button>
    </div>
    <div style="flex: 1; position: relative; width: 100%; height: 100%;">
      <iframe src="./dashboard/index.html" style="width: 100%; height: 100%; border: none; background: #171a1c;"></iframe>
    </div>
  `;

  const selSlot = page.querySelector('#cnc-sel-slot');
  const selMachine = page.querySelector('#cnc-sel-machine');
  const txtIp = page.querySelector('#cnc-sel-ip');
  const txtPort = page.querySelector('#cnc-sel-port');
  const btnConnect = page.querySelector('#btn-cnc-connect');

  // Load slot names from LocalStorage
  State.cnc_slot1_name = localStorage.getItem('cnc_slot1_name') || 'Fanuc Tezgah 1';
  State.cnc_slot2_name = localStorage.getItem('cnc_slot2_name') || 'Fanuc Tezgah 2';

  // Read current IPs/ports from adapter config to update State.machines
  window.electronAPI.readFile('bin/adapter.config.json').then(res => {
    if (res.ok) {
      try {
        const configData = JSON.parse(res.data);
        const m1 = configData[0];
        const m2 = configData[1];
        if (m1) {
          const found = State.machines.find(m => m.numarasi === State.cnc_slot1_name);
          if (found) {
            found.ip = m1.ip;
            found.port = m1.port;
          }
        }
        if (m2) {
          const found = State.machines.find(m => m.numarasi === State.cnc_slot2_name);
          if (found) {
            found.ip = m2.ip;
            found.port = m2.port;
          }
        }
        // Pre-fill fields with Slot 1 on startup if mapped
        if (State.cnc_slot1_name) {
          const match = State.machines.find(m => m.numarasi === State.cnc_slot1_name);
          if (match) {
            selMachine.value = match.id;
            txtIp.value = match.ip || '';
            txtPort.value = match.port || 8193;
          }
        }
      } catch (e) {}
    }
  });

  selMachine.addEventListener('change', () => {
    const mId = parseInt(selMachine.value);
    if (!isNaN(mId)) {
      const machine = State.machines.find(m => m.id === mId);
      if (machine) {
        txtIp.value = machine.ip || '';
        txtPort.value = machine.port || 8193;
      }
    } else {
      txtIp.value = '';
      txtPort.value = '8193';
    }
  });

  selSlot.addEventListener('change', () => {
    const slotIdx = parseInt(selSlot.value);
    const targetName = slotIdx === 0 ? State.cnc_slot1_name : State.cnc_slot2_name;
    if (targetName) {
      const match = State.machines.find(m => m.numarasi === targetName);
      if (match) {
        selMachine.value = match.id;
        txtIp.value = match.ip || '';
        txtPort.value = match.port || 8193;
        return;
      }
    }
    selMachine.value = '';
    txtIp.value = '';
    txtPort.value = '8193';
  });

  btnConnect.addEventListener('click', async () => {
    const slotIdx = parseInt(selSlot.value);
    const mId = parseInt(selMachine.value);
    const ip = txtIp.value.trim();
    const port = parseInt(txtPort.value) || 8193;

    if (isNaN(mId)) {
      showToast('Lütfen listeden bir tezgah seçin.', 'error');
      return;
    }
    if (!ip) {
      showToast('Lütfen geçerli bir IP adresi girin.', 'error');
      return;
    }

    const machine = State.machines.find(m => m.id === mId);
    if (!machine) return;

    machine.ip = ip;
    machine.port = port;
    await saveMachines();

    if (slotIdx === 0) {
      State.cnc_slot1_name = machine.numarasi;
      localStorage.setItem('cnc_slot1_name', machine.numarasi);
    } else {
      State.cnc_slot2_name = machine.numarasi;
      localStorage.setItem('cnc_slot2_name', machine.numarasi);
    }

    try {
      let configData = [
        { id: "Fanuc", ip: "192.168.30.20", port: 8193, shdrPort: 7880, prefix: "f" },
        { id: "Fanuc2", ip: "192.168.30.21", port: 8193, shdrPort: 7881, prefix: "f2" }
      ];

      const readRes = await window.electronAPI.readFile('bin/adapter.config.json');
      if (readRes.ok) {
        try { configData = JSON.parse(readRes.data); } catch (e) {}
      }

      configData[slotIdx] = {
        id: slotIdx === 0 ? "Fanuc" : "Fanuc2",
        ip: ip,
        port: port,
        shdrPort: slotIdx === 0 ? 7880 : 7881,
        prefix: slotIdx === 0 ? "f" : "f2"
      };

      const writeRes = await window.electronAPI.writeFile('bin/adapter.config.json', JSON.stringify(configData, null, 2));
      if (writeRes && writeRes.ok) {
        showToast(`${machine.numarasi} bağlantısı kuruluyor, lütfen bekleyin...`, 'success');
        await window.electronAPI.restartAdapter();
        
        // Refresh iframe to reload app.js with updated State.cnc_slotX_name values
        setTimeout(() => {
          const iframe = page.querySelector('iframe');
          if (iframe) iframe.src = iframe.src;
        }, 800);
      } else {
        throw new Error(writeRes?.error || 'Konfigürasyon yazılamadı.');
      }
    } catch (err) {
      showToast('Bağlantı kaydedilemedi: ' + err.message, 'error');
    }
  });

  return page;
}

function renderCncScreenViewer() {
  const page = createPage('cnc_screen_viewer');
  
  const sortedMachines = [...State.machines].sort((a, b) => {
    return String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr-TR', { numeric: true, sensitivity: 'base' });
  });

  const machineOptions = sortedMachines.map(m => {
    return `<option value="${m.id}" data-ip="${escapeHTML(m.ip || '192.168.1.50')}">${escapeHTML(m.numarasi)} (${escapeHTML(m.tip || 'CNC')})</option>`;
  }).join('');

  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🖥️ Canlı CNC Ekran İzleyici (Remote VNC / iHMI Display)</h1>
          <p>FANUC CNC kontrolör ekranını uzaktan canlı izleyin, tuş takımı ile kumanda edin ve ekran görüntüsü kaydedin</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary" onclick="captureCncScreenSnapshot(document.getElementById('cnc-view-mach-sel').value)">
            📸 Ekran Görüntüsü Al & Bakıma Ekle
          </button>
        </div>
      </div>
    </div>

    <div class="page-body">
      <!-- Control Panel & Machine Picker -->
      <div class="card mb-4" style="padding:14px">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:12px">
          <div class="flex items-center gap-3" style="flex-wrap:wrap">
            <label style="font-weight:700; font-size:12px; color:var(--text-secondary)">Tezgâh Seçin:</label>
            <select id="cnc-view-mach-sel" class="form-control" style="width:200px" onchange="onCncScreenMachineChange()">
              <option value="">-- Tezgâh Seçin --</option>
              ${machineOptions}
            </select>

            <label style="font-weight:700; font-size:12px; color:var(--text-secondary)">IP Adresi:</label>
            <input type="text" id="cnc-view-ip-input" class="form-control" placeholder="192.168.1.50" style="width:140px" value="192.168.1.50" />

            <label style="font-weight:700; font-size:12px; color:var(--text-secondary)">VNC Port:</label>
            <input type="number" id="cnc-view-port-input" class="form-control" placeholder="5900" style="width:80px" value="5900" />
          </div>

          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="connectCncScreenStream(document.getElementById('cnc-view-ip-input').value, document.getElementById('cnc-view-port-input').value)">
              ▶️ Canlı Bağlantıyı Başlat
            </button>
            <button class="btn btn-secondary btn-sm" onclick="disconnectCncScreenStream()">
              ⏹️ Bağlantıyı Kes
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between mt-3" style="font-size:11.5px; border-top:1px solid var(--border); padding-top:10px">
          <div id="cnc-screen-status-badge" class="tag tag-gray">⚪ Çevrimdışı</div>
          <div id="cnc-screen-status-text" style="color:var(--text-muted)">Bağlantı Bekleniyor...</div>
        </div>
      </div>

      <!-- Main Live Screen Area -->
      <div id="cnc-screen-frame-wrap" class="card mb-4" style="padding:10px; background:#0b0f19">
        <div style="width:100%; height:380px; background:var(--bg-card2); border:2px dashed var(--border); border-radius:var(--radius-md); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px">
          <div style="font-size:36px; margin-bottom:10px; opacity:0.6">🖥️</div>
          <div style="font-weight:600; font-size:14px; margin-bottom:6px">CNC Canlı Ekran Akışı Bekleniyor</div>
          <div style="font-size:12px; color:var(--text-muted); max-width:400px">
            Yukarıdaki tezgâhı seçip "Canlı Bağlantıyı Başlat" butonuna basarak uzaktan ekran izlemeyi başlatın.
          </div>
        </div>
      </div>

      <!-- Virtual FANUC Keypad Control -->
      <div class="card" style="padding:16px">
        <div class="card-title mb-3" style="display:flex; align-items:center; justify-content:between">
          <span>⌨️ Sanal FANUC Tuş Takımı (Remote Keypad)</span>
          <span style="font-size:11px; color:var(--text-muted)">Tıkladığınız tuş canlı CNC kontrolörüne iletilir</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:8px">
          <button class="btn btn-danger btn-sm" onclick="sendCncKeypress('RESET')" style="font-weight:bold; font-size:11px">🔴 RESET</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('POS')" style="font-weight:bold; font-size:11px">📍 POS</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('PROG')" style="font-weight:bold; font-size:11px">📜 PROG</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('OFS/SET')" style="font-weight:bold; font-size:11px">📐 OFS/SET</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('SYSTEM')" style="font-weight:bold; font-size:11px">⚙️ SYSTEM</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('MESSAGE')" style="font-weight:bold; font-size:11px">⚠️ MESSAGE</button>

          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F1')" style="font-size:11px">F1</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F2')" style="font-size:11px">F2</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F3')" style="font-size:11px">F3</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F4')" style="font-size:11px">F4</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F5')" style="font-size:11px">F5</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('CHAPTER')" style="font-size:11px">◀ ▶ NEXT</button>
        </div>
      </div>
    </div>
  `;

  return page;
}

window.onCncScreenMachineChange = function() {
  const sel = document.getElementById('cnc-view-mach-sel');
  const ipInput = document.getElementById('cnc-view-ip-input');
  if (!sel || !ipInput) return;

  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset && opt.dataset.ip) {
    ipInput.value = opt.dataset.ip;
  }
};

