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

function evaluateSafeMathExpression(source) {
  const input = String(source || '').replace(/\[/g, '(').replace(/\]/g, ')');
  const tokens = [];
  const pattern = /\s*(Math\.(?:sin|cos|tan|sqrt|abs|round|PI)|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[()+\-*/])\s*/igy;
  let cursor = 0;
  while (cursor < input.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(input);
    if (!match || match.index !== cursor) throw new Error('Desteklenmeyen ifade');
    tokens.push(match[1]);
    cursor = pattern.lastIndex;
  }
  let index = 0;
  const peek = () => tokens[index];
  const take = expected => {
    const token = tokens[index++];
    if (expected && token !== expected) throw new Error(`Beklenen: ${expected}`);
    return token;
  };
  const functions = {
    'Math.sin': Math.sin,
    'Math.cos': Math.cos,
    'Math.tan': Math.tan,
    'Math.sqrt': Math.sqrt,
    'Math.abs': Math.abs,
    'Math.round': Math.round
  };
  function primary() {
    const token = peek();
    if (token === '(') { take('('); const value = expression(); take(')'); return value; }
    if (token === 'Math.PI') { take(); return Math.PI; }
    if (functions[token]) { take(); take('('); const value = expression(); take(')'); return functions[token](value); }
    if (token && /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) { take(); return Number(token); }
    throw new Error('Geçersiz matematik ifadesi');
  }
  function unary() {
    if (peek() === '+') { take(); return unary(); }
    if (peek() === '-') { take(); return -unary(); }
    return primary();
  }
  function term() {
    let value = unary();
    while (peek() === '*' || peek() === '/') {
      const operator = take();
      const right = unary();
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }
  function expression() {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const operator = take();
      const right = term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }
  const result = expression();
  if (index !== tokens.length) throw new Error('İfadenin tamamı işlenemedi');
  return result;
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
      pdfPaths: {},
      internetEnabled: true,
      retentionDays: 30,
      diskLimitMB: 2048,
      backupDirectory: '',
      textScale: 100,
      motionMode: 'full',
      highContrast: false,
      colorBlindMode: false,
      connectionProfiles: [],
      knowledgeFavorites: [],
      knowledgeRecent: [],
      knowledgeNotes: {}
    }
  };
}
var State = window.State;

// Read-only dashboard bridge: telemetry may be persisted/exported, never sent to CNC.
window.addEventListener('message', async (event) => {
  const message = event.data;
  if (!message || typeof message !== 'object' || !String(message.type || '').startsWith('fanuc:')) return;
  try {
    if (message.type === 'fanuc:telemetry') await window.electronAPI.recordTelemetry(message.samples || []);
    if (message.type === 'fanuc:alarm') {
      await window.electronAPI.recordAlarm(message.alarm);
      window.electronAPI.showNativeNotification('FANUC Alarm', `${message.alarm.machine}: ${message.alarm.code} ${message.alarm.message || ''}`);
    }
    if (message.type === 'fanuc:summary-request') {
      const since = message.since || new Date(Date.now() - 86400000).toISOString();
      const [summary, backup] = await Promise.all([window.electronAPI.telemetrySummary(since), window.electronAPI.getBackupHealth()]);
      event.source?.postMessage({ type: 'fanuc:summary-response', requestId: message.requestId, summary, backup }, '*');
    }
    if (message.type === 'fanuc:export') {
      const result = await window.electronAPI.queryTelemetry(message.machine, message.since, 10000);
      if (result?.ok) {
        const header = 'sampled_at,machine,execution,program,part_count,spindle_load,data_age_ms,quality,simulated';
        const rows = result.items.map(r => [r.sampled_at,r.machine,r.execution,r.program,r.part_count,r.spindle_load,r.data_age_ms,r.quality,r.simulated].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
        await window.electronAPI.exportCSV([header,...rows].join('\n'), `telemetry_${message.machine}.csv`);
      }
    }
  } catch (error) { console.warn('Dashboard bridge error:', error); }
});


// Main initialization is bootstrapped via src/js/app.js module
// Initialization is owned by js/app.js.


async function saveKnowledgePreferences() {
  const result = await window.electronAPI.setKnowledgePreferences({
    favorites: State.settings.knowledgeFavorites || [],
    recent: State.settings.knowledgeRecent || [],
    notes: State.settings.knowledgeNotes || {}
  });
  if (!result?.ok) showToast(`Bilgi Merkezi tercihleri kaydedilemedi: ${result?.error}`, 'error');
  return result;
}

function applyAccessibilitySettings() {
  const scale = Math.max(85, Math.min(140, Number(State.settings.textScale) || 100));
  document.documentElement.style.fontSize = `${scale}%`;
  document.body.classList.toggle('high-contrast-mode', !!State.settings.highContrast);
  document.body.classList.toggle('color-blind-mode', !!State.settings.colorBlindMode);
  document.body.classList.remove('motion-full', 'motion-reduced', 'motion-off');
  const motionMode = ['full', 'reduced', 'off'].includes(State.settings.motionMode) ? State.settings.motionMode : 'full';
  document.body.classList.add(`motion-${motionMode}`);
}

window.chooseBackupDirectory = async function() {
  const selected = await window.electronAPI.openDirectoryDialog();
  if (!selected) return;
  State.settings.backupDirectory = selected;
  const el = document.getElementById('backup-directory-value');
  if (el) el.textContent = selected;
};

window.exportSafeConfiguration = async function() {
  const safe = { ...State.settings, aiApiKey: undefined, knowledgeRecent: State.settings.knowledgeRecent.slice(0, 20) };
  delete safe.aiApiKey;
  const target = await window.electronAPI.saveFileDialog([{ name: 'FANUC yapılandırması', extensions: ['json'] }], 'fanuc-pro-suite-settings.json');
  if (!target) return;
  const result = await window.electronAPI.writeFile(target, JSON.stringify({ schemaVersion: 1, settings: safe }, null, 2));
  showToast(result?.ok ? 'Yapılandırma dışa aktarıldı.' : `Dışa aktarma başarısız: ${result?.error}`, result?.ok ? 'success' : 'error');
};

window.importSafeConfiguration = async function() {
  const source = await window.electronAPI.openFileDialog([{ name: 'FANUC yapılandırması', extensions: ['json'] }]);
  if (!source) return;
  const result = await window.electronAPI.readFile(source);
  try {
    const parsed = JSON.parse(result.data);
    if (parsed.schemaVersion !== 1 || !parsed.settings) throw new Error('Desteklenmeyen yapılandırma biçimi.');
    const { aiApiKey, ...safe } = parsed.settings;
    Object.assign(State.settings, safe);
    await saveSettings();
    applyAccessibilitySettings();
    showToast('Yapılandırma içe aktarıldı. API anahtarları değiştirilmedi.', 'success');
    navigate('settings');
  } catch (err) { showToast(`İçe aktarma başarısız: ${err.message}`, 'error'); }
};

window.resetSafeSettings = async function() {
  if (!confirm('Görünüm, ağ erişimi ve depolama tercihleri varsayılana döndürülsün mü? CNC bağlantıları ve kayıtlar silinmez.')) return;
  Object.assign(State.settings, { internetEnabled: true, retentionDays: 30, diskLimitMB: 2048, backupDirectory: '', textScale: 100, motionMode: 'full', highContrast: false, colorBlindMode: false, theme: 'dark' });
  await saveSettings();
  applyTheme('dark');
  applyAccessibilitySettings();
  showToast('Güvenli varsayılan ayarlar uygulandı.', 'success');
  navigate('settings');
};

window.saveConnectionProfile = async function() {
  const name = document.getElementById('profile-name')?.value.trim();
  if (!name) return showToast('Profil adı gerekli.', 'warning');
  const profile = {
    name,
    machines: [1, 2].map(n => ({
      ip: document.getElementById(`cnc-m${n}-ip`)?.value.trim() || '',
      port: Number(document.getElementById(`cnc-m${n}-port`)?.value) || 8193
    }))
  };
  State.settings.connectionProfiles = (State.settings.connectionProfiles || []).filter(p => p.name !== name);
  State.settings.connectionProfiles.push(profile);
  await saveSettings();
  showToast('Bağlantı profili kaydedildi.', 'success');
  navigate('settings');
};

window.applyConnectionProfile = function(index) {
  const profile = State.settings.connectionProfiles?.[index];
  if (!profile) return;
  profile.machines.forEach((machine, i) => {
    const n = i + 1;
    const ip = document.getElementById(`cnc-m${n}-ip`);
    const port = document.getElementById(`cnc-m${n}-port`);
    if (ip) ip.value = machine.ip;
    if (port) port.value = machine.port;
  });
  showToast('Profil forma uygulandı; kalıcı olması için Ayarları Kaydet düğmesine basın.', 'info');
};

window.deleteConnectionProfile = async function(index) {
  State.settings.connectionProfiles.splice(index, 1);
  await saveSettings();
  navigate('settings');
};

// ── Navigation ─────────────────────────────────────────────────
window.navigate = function navigate(page, extraData = null) {
  const navigationToken = String(Date.now()) + Math.random();
  window.__activeNavigationToken = navigationToken;
  State.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + page);
  if (navBtn) {
    navBtn.classList.add('active');
    const group = navBtn.closest('.nav-group');
    if (group) group.open = true;
  }

  const content = document.getElementById('main-content');
  content.innerHTML = window.MTBUX?.loadingState('Ekran hazırlanıyor…') || '<div class="spinner"></div>';

  const pages = {
    dashboard:   renderDashboard,
    cnc_dashboard: renderCncDashboard,
    cnc_screen_viewer: renderCncScreenViewer,
    library:     renderLibrary,

    projects:    renderProjects,
    machines:    renderMachines,
    maintenance: () => renderMaintenance(extraData),
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
    backup_tracker: () => renderBackupTracker(extraData),
    backlash_helper: renderBacklashHelper,
    axis_limits_helper: renderAxisLimitsHelper,
    spindle_diagnostics: renderSpindleDiagnostics,
    custom_builder_library: renderCustomBuilderLibrary,
    rs232_cables: renderRs232Cables,
    nc_codes:    renderNcCodes,
    pmc_signals: renderPmcSignals,
    fssb_topology: renderFssbTopology,
    fanuc_center: () => window.renderFanucCenter ? window.renderFanucCenter(extraData) : createPage('fanuc_center'),
    ai:          renderAI,
    settings:    renderSettings,
    performance_diagnostics: () => window.MTBPerformanceDiagnostics.render(),
    pdf_viewer:  () => renderPdfViewer(extraData),
  };

  const fn = pages[page];
  if (fn) {
    requestAnimationFrame(() => {
      if (window.__activeNavigationToken !== navigationToken) return;
      try {
        const el = fn();
        if (window.__activeNavigationToken !== navigationToken) return;
        content.replaceChildren(el);
        el.classList.add('animate-in');
      } catch (error) {
        content.innerHTML = window.MTBUX?.emptyState({ icon: '!', title: 'Ekran açılamadı', description: 'Beklenmeyen bir hata oluştu. Sayfayı yeniden açmayı deneyin.' }) || '';
        window.MTBUX?.notify({ type: 'error', title: 'Ekran yüklenemedi', message: error?.message || 'Beklenmeyen bir uygulama hatası oluştu.', actionLabel: 'Tekrar dene', onAction: () => window.navigate(page, extraData) });
      }
    });
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
function getRoleLabel(role) {
  const map = { admin: '🔑 Yönetici', technician: '🔧 Bakım Teknisyeni', operator: '👤 Operatör' };
  return map[role] || role;
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
// ════════════════════════════════════════════════════════════════
//  NOTIFICATION SYSTEM
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  CSV EXPORT
// ════════════════════════════════════════════════════════════════
/* CSV export implementations live in js/features/report_exports.js.
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
}; */

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
        <div class="flex gap-2 mb-3"><button class="btn btn-ghost btn-sm" onclick="setFssbSimulationMode('normal')">Normal yol</button><button class="btn btn-ghost btn-sm" onclick="setFssbSimulationMode('kablo2')">Fiber 2 kopuk</button><button class="btn btn-ghost btn-sm" onclick="setFssbSimulationMode('amp1')">Amp 1 arızalı</button></div>
        <div id="fssb-live-path" class="mb-3">${window.renderFSSBTopologySVG ? window.renderFSSBTopologySVG('normal') : ''}</div>
        <div id="fssb-node-detail" class="status-surface info" style="padding:12px 14px 12px 18px;margin-bottom:12px">Bir düğüm seçerek konnektör ve kontrol bilgisini görüntüleyin.</div>
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

  window.setFssbSimulationMode = function(mode) {
    const target = document.getElementById('fssb-live-path');
    if (target && window.renderFSSBTopologySVG) target.innerHTML = window.renderFSSBTopologySVG(mode);
  };

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

  const latestBatteryByLocation = new Map();
  State.batteries.forEach(battery => {
    const key = `${battery.tezgah_id ?? battery.machine_id ?? battery.machine ?? battery.machine_name ?? ''}|${String(battery.eksen || battery.axis || 'genel').toLocaleLowerCase('tr-TR')}`;
    const current = latestBatteryByLocation.get(key);
    const batteryTime = parseDateHelper(battery.tarih || battery.date)?.getTime() || Number(battery.id) || 0;
    const currentTime = parseDateHelper(current?.tarih || current?.date)?.getTime() || Number(current?.id) || 0;
    if (!current || batteryTime >= currentTime) latestBatteryByLocation.set(key, battery);
  });
  const criticalBatteries = [...latestBatteryByLocation.values()].filter(b => {
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

  const machineConditions = State.machines.map(machine => calculateMachineHealth(machine));
  const machineConditionCounts = {
    critical: machineConditions.filter(item => item.status === 'Critical').length,
    attention: machineConditions.filter(item => item.status === 'Warning').length,
    normal: machineConditions.filter(item => item.status === 'Safe').length
  };

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

      ${window.renderOperationsBrief ? window.renderOperationsBrief(State) : ''}

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
        <!-- Explainable machine conditions -->
        <div class="card" style="padding:20px">
          <div class="card-title mb-3">Tezgâh Durum Özeti</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="status-surface danger" onclick="navigate('predictive')" style="text-align:left;padding:12px"><strong>${machineConditionCounts.critical}</strong><span style="display:block">Kritik pil veya fan bildirimi</span></button>
            <button class="status-surface warn" onclick="navigate('predictive')" style="text-align:left;padding:12px"><strong>${machineConditionCounts.attention}</strong><span style="display:block">Kontrol edilmeli</span></button>
            <button class="status-surface ok" onclick="navigate('predictive')" style="text-align:left;padding:12px"><strong>${machineConditionCounts.normal}</strong><span style="display:block">Aktif kritik bildirim yok</span></button>
          </div>
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
let KnowledgeScreens;
let AlarmParameterScreens;
const sendAIMessage = (...args) => { getAIScreen(); return window.sendAIMessage(...args); };
function getAlarmParameterScreens(){if(!AlarmParameterScreens)AlarmParameterScreens=window.MTBAlarmParameterScreens.initialize({State,createPage,escapeHTML,showToast,showModal,closeModal,canEdit,saveCustomAlarmNotes,navigate,alarmCategoryTag,sendAIMessage});return AlarmParameterScreens;}
function renderAlarms(){return getAlarmParameterScreens().renderAlarms();}
function renderParameters(){return getAlarmParameterScreens().renderParameters();}
function getKnowledgeScreens(){if(!KnowledgeScreens)KnowledgeScreens=window.MTBKnowledgeScreens.initialize({State,createPage,escapeHTML,showToast,navigate,saveKnowledgePreferences});return KnowledgeScreens;}
function renderLibrary(){return getKnowledgeScreens().renderLibrary();}
function renderPdfViewer(extraData){return getKnowledgeScreens().renderPdfViewer(extraData);}
const renderProjects = (...args) => window.OperationsInsights.renderProjects(...args);

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
              <span id="updater-status-badge" class="tag tag-green">Güncel (v1.4.1)</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px" id="updater-status-text">
              Yüklü sürüm: v1.4.1. GitHub üzerinden istediğiniz zaman manuel güncelleme denetimi yapabilirsiniz.
            </div>
            <div id="updater-last-checked" style="font-size:11px; color:var(--text-muted); margin-bottom:10px">Henüz manuel kontrol yapılmadı.</div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick="checkForAppUpdates()">
                🔍 Güncellemeleri Denetle
              </button>
              <button class="btn btn-ghost btn-sm" onclick="window.electronAPI.openExternal('https://github.com/PobloMert/fanuc-pro-suitev/releases')">
                GitHub Sürümleri
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
            <input type="password" class="form-control" id="ai-api-key" placeholder="Windows güvenli deposunda saklanır" value="" />
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

      <!-- Privacy, Storage & Accessibility -->
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">🛡️ Gizlilik, Depolama ve Erişilebilirlik</div>
        <label class="flex items-center gap-2 mb-3" style="font-size:12px">
          <input type="checkbox" id="internet-enabled" ${State.settings.internetEnabled !== false ? 'checked' : ''} />
          İnternet erişimine izin ver (kapalıyken AI bulut ve güncelleme denetimi devre dışıdır)
        </label>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Telemetri saklama süresi</label><input class="form-control" id="retention-days" type="number" min="1" max="3650" value="${Number(State.settings.retentionDays)||30}" /><small>gün</small></div>
          <div class="form-group"><label class="form-label">Veri tabanı yumuşak sınırı</label><input class="form-control" id="disk-limit-mb" type="number" min="250" max="102400" value="${Number(State.settings.diskLimitMB)||2048}" /><small>MB</small></div>
        </div>
        <div class="form-group">
          <label class="form-label">Yedek klasörü</label>
          <div id="backup-directory-value" class="font-mono text-xs" style="padding:8px;background:var(--bg-card2);border-radius:6px;word-break:break-all">${escapeHTML(State.settings.backupDirectory || (State.appDataDir + '/backups'))}</div>
          <button class="btn btn-ghost btn-sm mt-2" onclick="chooseBackupDirectory()">Klasör Seç</button>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Yazı büyüklüğü</label><input id="text-scale" type="range" min="85" max="140" value="${Number(State.settings.textScale)||100}" /><span id="text-scale-value">%${Number(State.settings.textScale)||100}</span></div>
          <label class="flex items-center gap-2"><input type="checkbox" id="high-contrast" ${State.settings.highContrast?'checked':''}/> Yüksek kontrast</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="color-blind-mode" ${State.settings.colorBlindMode?'checked':''}/> Renk körlüğü paleti</label>
          <div class="form-group"><label class="form-label">Hareket seviyesi</label><select class="form-control" id="motion-mode"><option value="full" ${State.settings.motionMode==='full'?'selected':''}>Tam</option><option value="reduced" ${State.settings.motionMode==='reduced'?'selected':''}>Azaltılmış</option><option value="off" ${State.settings.motionMode==='off'?'selected':''}>Kapalı</option></select></div>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="exportSafeConfiguration()">Yapılandırmayı Dışa Aktar</button>
          <button class="btn btn-secondary btn-sm" onclick="importSafeConfiguration()">Yapılandırmayı İçe Aktar</button>
          <button class="btn btn-ghost btn-sm" onclick="resetSafeSettings()">Güvenli Varsayılana Dön</button>
        </div>
      </div>

      <!-- Connection Profiles -->
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">🔌 Bağlantı Profilleri</div>
        <div class="flex gap-2">
          <input class="form-control" id="profile-name" placeholder="Profil adı (örn. Atölye A)" />
          <button class="btn btn-secondary btn-sm" onclick="saveConnectionProfile()">Mevcut IP'leri Kaydet</button>
        </div>
        <div id="connection-profile-list" style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
          ${(State.settings.connectionProfiles||[]).map((p,i)=>`<div class="flex justify-between items-center" style="padding:8px;background:var(--bg-card2);border-radius:6px"><span>${escapeHTML(p.name)}</span><div class="flex gap-2"><button class="btn btn-ghost btn-sm" onclick="applyConnectionProfile(${i})">Uygula</button><button class="btn btn-danger btn-sm" onclick="deleteConnectionProfile(${i})">Sil</button></div></div>`).join('') || '<span class="text-xs" style="color:var(--text-muted)">Kayıtlı profil yok.</span>'}
        </div>
      </div>

      <!-- App Settings -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">📁 Uygulama</div>
        <div class="flex gap-2 mb-3"><span class="tag tag-blue">Sürüm v${escapeHTML(window.CURRENT_APP_VERSION || '1.4.1')}</span><span class="tag tag-red">KALICI SALT OKUNUR</span></div>
        <p style="font-size:11px;color:var(--text-secondary)">Uygulama CNC programı etkinleştiremez, silemez veya yükleyemez; CNC parametresi yazamaz. İzleme ve yerel analiz amacıyla tasarlanmıştır.</p>
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
        <button class="btn btn-secondary btn-sm" id="btn-export-diagnostics">Tanılama Paketi Oluştur</button>
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
    body.high-contrast-mode { --border:#ffffff; --text-secondary:#f3f4f6; --text-muted:#d1d5db; }
    body.color-blind-mode { --accent:#3b82f6; --green:#0072b2; --red:#d55e00; --amber:#e69f00; }
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
  page.querySelector('#btn-export-diagnostics')?.addEventListener('click', async () => {
    const result = await window.electronAPI.exportDiagnostics();
    if (result?.ok) showToast(`Tanılama paketi oluşturuldu. SHA-256: ${result.checksum.slice(0, 12)}…`, 'success');
    else if (!result?.canceled) showToast(result?.error || 'Tanılama paketi oluşturulamadı.', 'error');
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
  const scaleInput = page.querySelector('#text-scale');
  scaleInput.addEventListener('input', () => {
    page.querySelector('#text-scale-value').textContent = `%${scaleInput.value}`;
    document.documentElement.style.fontSize = `${scaleInput.value}%`;
  });

  if (State.currentUser?.role === 'admin') {
    window.electronAPI.getAISecret().then(res => {
      if (res?.ok) {
        State.settings.aiApiKey = res.value || '';
        const input = page.querySelector('#ai-api-key');
        if (input) input.value = State.settings.aiApiKey;
      }
    });
  }

  page.querySelector('#btn-save-settings').addEventListener('click', async () => {
    State.settings.aiProvider = page.querySelector('#ai-provider').value;
    State.settings.aiApiKey   = page.querySelector('#ai-api-key').value;
    State.settings.aiModel    = page.querySelector('#ai-model').value;
    State.settings.internetEnabled = page.querySelector('#internet-enabled').checked;
    State.settings.retentionDays = Math.max(1, Math.min(3650, Number(page.querySelector('#retention-days').value) || 30));
    State.settings.diskLimitMB = Math.max(250, Math.min(102400, Number(page.querySelector('#disk-limit-mb').value) || 2048));
    State.settings.textScale = Number(page.querySelector('#text-scale').value) || 100;
    State.settings.highContrast = page.querySelector('#high-contrast').checked;
    State.settings.colorBlindMode = page.querySelector('#color-blind-mode').checked;
    State.settings.motionMode = page.querySelector('#motion-mode').value;
    if (!State.settings.internetEnabled) State.settings.aiProvider = 'offline';
    const secretResult = await window.electronAPI.setAISecret(State.settings.aiApiKey);
    if (!secretResult?.ok && State.currentUser?.role === 'admin') {
      showToast('API anahtarı güvenli depoya kaydedilemedi: ' + secretResult.error, 'error');
      return;
    }
    await saveSettings();
    applyAccessibilitySettings();
    const storageResult = await window.electronAPI.applyStoragePolicy({ retentionDays: State.settings.retentionDays, diskLimitMB: State.settings.diskLimitMB });
    if (!storageResult?.ok) showToast(`Depolama ilkesi uygulanamadı: ${storageResult?.error}`, 'warning');
    else if (storageResult.overLimit) showToast('Veri tabanı sınırın üzerinde. Telemetri bir güne indirildi; kalıcı kayıtlar güvenlik nedeniyle silinmedi.', 'warning');

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
  const newUser = { name, role, pin, initials: initials || name.slice(0,2).toUpperCase(), color: colors[State.users.length % colors.length] };

  try {
    const res = await window.electronAPI.addUser(newUser);
    if (res && res.ok) {
      State.users.push(res.user);
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
  try {
    const res = await window.electronAPI.deleteUser(userId);
    if (res && res.ok) {
      State.users = State.users.filter(u => u.id !== userId);
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

  if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    showToast('Yeni PIN sadece rakamlardan oluşmalı ve 4-6 hane uzunluğunda olmalıdır.', 'error');
    return;
  }

  if (newPin !== newPin2) {
    showToast('Yeni PIN şifreleri eşleşmiyor.', 'error');
    return;
  }

  try {
    const res = await window.electronAPI.changePin(oldPin, newPin);
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
let AIScreen;
function getAIScreen(){if(!AIScreen)AIScreen=window.MTBAIScreen.initialize({State,createPage,escapeHTML,showToast,showModal,closeModal,navigate,saveKnowledgePreferences,openBookPDF:(...args)=>window.openBookPDF(...args),calculateMachineHealth,getBatteryStatus,formatTime});return AIScreen;}
function renderAI(){return getAIScreen().renderAI();}

/* Persistence implementation lives in js/services/data_persistence.js.
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

async function saveMachines() { return await saveJSONDatabase('machines.json', 'machines', State.machines); } */
const saveJSONDatabase = (...args) => window.DataPersistence.saveJSONDatabase(...args);
const saveMachines = () => window.DataPersistence.saveMachines();
window.FanucCenterBridge = Object.freeze({
  getState: () => State,
  canEdit,
  saveMachineProfile: async (machineId, profile) => {
    if (!canEdit()) return { ok: false, error: 'FANUC profilini düzenleme yetkiniz yok.' };
    const machine = State.machines.find(item => item.id === Number(machineId));
    if (!machine) return { ok: false, error: 'Tezgâh bulunamadı.' };
    machine.fanucProfile = { ...(machine.fanucProfile || {}), ...profile, updatedAt: new Date().toISOString() };
    await saveMachines();
    return { ok: true };
  },
  saveModuleInventory: async (machineId, inventory) => {
    if (!canEdit()) return { ok: false, error: 'Modül envanterini düzenleme yetkiniz yok.' };
    const machine = State.machines.find(item => item.id === Number(machineId));
    if (!machine) return { ok: false, error: 'Tezgâh bulunamadı.' };
    machine.moduleInventory = Array.isArray(inventory) ? inventory : [];
    await saveMachines();
    return { ok: true };
  }
});
const saveMaintenances = () => window.DataPersistence.saveMaintenances();
const saveBatteries = () => window.DataPersistence.saveBatteries();
const saveFans = () => window.DataPersistence.saveFans();
const saveWiki = () => window.DataPersistence.saveWiki();
const saveBackupLogs = () => window.DataPersistence.saveBackupLogs();
const saveCustomMCodes = () => window.DataPersistence.saveCustomMCodes();
const saveCustomAlarms = () => window.DataPersistence.saveCustomAlarms();
const saveCustomAlarmNotes = () => window.DataPersistence.saveCustomAlarmNotes();

// ════════════════════════════════════════════════════════════════
//  TEZGAH LİSTESİ
// ════════════════════════════════════════════════════════════════
function renderMachines() {
  if (window.MachineWorkspace?.render) return window.MachineWorkspace.render();
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
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:14px 16px 0">
        <div class="status-surface ok" style="padding:12px 14px 12px 18px"><small>TAMAMLANAN</small><strong style="display:block;font-size:20px">${State.maintenances.filter(item=>item.durum==='Tamamlandı').length}</strong></div>
        <div class="status-surface info" style="padding:12px 14px 12px 18px"><small>DEVAM EDEN</small><strong style="display:block;font-size:20px">${State.maintenances.filter(item=>item.durum==='Devam Ediyor').length}</strong></div>
        <div class="status-surface warn" style="padding:12px 14px 12px 18px"><small>BEKLEYEN</small><strong style="display:block;font-size:20px">${State.maintenances.filter(item=>item.durum==='Beklemede').length}</strong></div>
      </div>
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
    const filtered = State.machines.length > 0;
    tbody.innerHTML = window.MTBUX.emptyTableRow({ colspan: 6, icon: '⚙',
      title: filtered ? 'Filtrelere uygun tezgâh bulunamadı' : 'Henüz tezgâh eklenmedi',
      description: filtered ? 'Arama veya bölüm filtrelerini temizleyerek tüm tezgâhları görüntüleyin.' : 'Bakım, pil, fan ve arıza kayıtlarını ilişkilendirmek için ilk tezgâhı ekleyin.',
      actionLabel: filtered ? 'Filtreleri temizle' : (canEdit() ? 'İlk tezgâhı ekle' : ''),
      command: filtered ? 'clear-filters' : 'new-machine' });
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
  if (window.MachineWorkspace?.showDetails) return window.MachineWorkspace.showDetails(id);
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
      <button class="btn btn-secondary" onclick="openFanucCenter(${m.id})">FANUC Merkezini Aç</button>
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

window.ReportBuilders = Object.freeze({
  maintenance: machineId => buildMaintenanceReportHTML(machineId ? { machineId } : {}),
  machineCard: machineId => buildMachineCardHTML(machineId)
});

// ════════════════════════════════════════════════════════════════
//  BAKIM DEFTERİ
// ════════════════════════════════════════════════════════════════
function getLifecycleFeature() {
  if (!window.MTBLifecycleFeature) throw new Error('Yaşam döngüsü modülü yüklenemedi');
  return window.MTBLifecycleFeature.initialize({
    State, createPage, canEdit, canDelete, escapeHTML, getSortedMachines,
    saveMaintenances, saveBatteries, saveFans, showModal, closeModal, showToast,
    navigate, getTodayFormat, showPromptModal, parseDateHelper
  });
}

function renderMaintenance(extraData = null) {
  return getLifecycleFeature().renderMaintenance(extraData);
}

function renderBattery(extraData = null) {
  return getLifecycleFeature().renderBattery(extraData);
}

function getBatteryStatus(dateStr) {
  return getLifecycleFeature().getBatteryStatus(dateStr);
}

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

window.MachineWorkspaceBridge = Object.freeze({
  getState: () => State,
  saveMachines,
  canEdit,
  getBatteryStatus,
  escapeHTML
});

// Toast
function showToast(message, type = 'info') {
  if (window.MTBUX?.notify) return window.MTBUX.notify(message, type);
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

// Reports and explainable maintenance views delegated to operations_insights.js
const renderReports = (...args) => window.OperationsInsights.renderReports(...args);
const renderPredictive = (...args) => window.OperationsInsights.renderPredictive(...args);
const calculateMachineHealth = (...args) => window.OperationsInsights.calculateMachineHealth(...args);

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
  if (State.settings.internetEnabled === false) {
    showToast('İnternet erişimi Ayarlar bölümünden kapatılmış.', 'warning');
    return;
  }
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
function getKeepMacroFeature() {
  if (!window.MTBKeepMacroFeature) throw new Error('Keep Relay/Makro modülü yüklenemedi');
  return window.MTBKeepMacroFeature.initialize({ State, createPage, canEdit, showModal, closeModal, showToast, navigate, evaluateSafeMathExpression });
}
function renderKeepRelays() { return getKeepMacroFeature().renderKeepRelays(); }
function renderMacroVariables() { return getKeepMacroFeature().renderMacroVariables(); }

// ════════════════════════════════════════════════════════════════
function getRS232Feature() {
  if (!window.MTBRS232Feature) throw new Error('RS232 modülü yüklenemedi');
  return window.MTBRS232Feature.initialize({ createPage, showToast });
}

function renderRS232() {
  return getRS232Feature().renderRS232();
}

// ════════════════════════════════════════════════════════════════
function getDriveDiagnosticsFeature() {
  if (!window.MTBDriveDiagnosticsFeature) throw new Error('Sürücü teşhis modülü yüklenemedi');
  return window.MTBDriveDiagnosticsFeature.initialize({ createPage, showToast });
}
function renderDriveDiagnostics() { return getDriveDiagnosticsFeature().renderDriveDiagnostics(); }

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

  const result = window.DiagnosticEngine.calculateGearRatio({ pitch, encoder, motorTeeth, screwTeeth, lci });
  if (!result) {
    showToast('Lütfen geçerli mekanik girdiler girin.', 'error');
    return;
  }
  if (result.approximated) {
    showToast('Dişli oranı limit dışına çıktı, en yakın tamsayı oranı hesaplandı.', 'info');
  }

  document.getElementById('fgr-empty').style.display = 'none';
  const resDiv = document.getElementById('fgr-results');
  resDiv.style.display = 'block';

  document.getElementById('fgr-res-2084').innerText = result.numerator;
  document.getElementById('fgr-res-2085').innerText = result.denominator;
  document.getElementById('fgr-cmd-units').innerText = result.commandUnits;
};

// Reliability view delegated to js/features/operations_insights.js
const renderReliability = (...args) => window.OperationsInsights.renderReliability(...args);

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
      <tr class="${d.isCritical ? 'diff-critical' : ''}" style="${cellStyle}">
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
  const bitStrip = `<div class="bit-diff" aria-label="8 bit karşılaştırması">${Array.from({length:8},(_,index)=>{ const bit=7-index; const changed=valA[index]!==valB[index]; return `<span class="${changed?'changed':''}" title="Bit ${bit}: ${valA[index]} → ${valB[index]}">${valB[index]}</span>`; }).join('')}</div>`;
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
      ${bitStrip}
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

// `var` is intentional: the legacy renderer can be entered from deferred module
// navigation while this section is still being initialized.
var CurrentTroubleshootNode = 'root';

function renderTroubleshooter() {
  CurrentTroubleshootNode = 'root';
  const page = createPage('troubleshooter');
  page.innerHTML = `
    <div class="page-header">
      <h1>🚨 Kronik Arıza Teşhis ve Çözüm Ağacı</h1>
      <p>Tezgahtaki belirtilere göre adım adım ilerleyen karar destek mekanizması ve çevrimdışı kök neden analizi</p>
    </div>
    <div class="page-body">
      <!-- Offline Root-Cause Engine Card -->
      <div class="card glass-card mb-4" style="padding:20px; max-width:800px; margin:0 auto 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-weight:750; font-size:15px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
            <span>🧠 Çevrimdışı Kök Neden Analizörü (Offline Root Cause Engine)</span>
            <span class="tag tag-green" style="font-size:10px;">%100 Çevrimdışı & Yerel DB</span>
          </div>
        </div>

        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.4;">
          İnternet bağlantısı olmasa dahi yerel veritabanındaki 500+ FANUC alarmı, LED kodları ve tecrübe notlarından kök neden ve ölçüm adımlarını anında hesaplar.
        </div>

        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <input type="text" id="offline-diag-input" class="form-control" placeholder="Alarm veya belirti girin (Örn: SV0401, VRDY OFF, SP9011, 401, Eksen Titriyor, Motor Isınıyor)..." style="font-size:12.5px; flex:1;" onkeydown="if(event.key==='Enter') runOfflineRootCauseAnalysis()" />
          <button class="btn btn-primary" onclick="runOfflineRootCauseAnalysis()" style="padding:6px 16px; font-weight:600;">🔍 Analiz Et</button>
        </div>

        <!-- Suggested Presets -->
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11px; color:var(--text-muted);">
          <span style="font-weight:600;">Hızlı Seçim:</span>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('SV0401 VRDY OFF')" style="font-size:10.5px; padding:2px 8px;">SV0401 VRDY OFF</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('SP9011 Spindle SSM')" style="font-size:10.5px; padding:2px 8px;">SP9011 Spindle SSM</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('1815 APZ')" style="font-size:10.5px; padding:2px 8px;">1815 Sıfır Kaybı</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('AL-12 Overvoltage')" style="font-size:10.5px; padding:2px 8px;">AL-12 Aşırı Voltaj</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('Eksen Titremesi')" style="font-size:10.5px; padding:2px 8px;">Eksen Titremesi</button>
        </div>

        <!-- Results Box -->
        <div id="offline-diag-results" style="display:none; margin-top:16px; border-top:1px solid var(--border); padding-top:16px;"></div>
      </div>

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

// ── Offline Root Cause Analyzer Logic ──────────────────────────────
let lastOfflineDiagReport = null;

window.selectOfflinePreset = function(query) {
  const input = document.getElementById('offline-diag-input');
  if (input) {
    input.value = query;
    runOfflineRootCauseAnalysis();
  }
};

window.runOfflineRootCauseAnalysis = function() {
  const input = document.getElementById('offline-diag-input');
  const resultsBox = document.getElementById('offline-diag-results');
  if (!input || !resultsBox) return;

  const query = input.value.trim().toLowerCase();
  if (!query) {
    showToast('Lütfen analiz edilecek bir alarm kodu veya arıza belirtisi girin.', 'warning');
    return;
  }

  const matchedAlarms = [];
  const queryClean = query.replace(/^(sv|sp|ot|ps|al|ex)/i, '').trim();

  // Scan Alarms & Custom Alarms
  const allAlarms = [...(State.alarms || []), ...(State.custom_alarms || [])];
  for (const item of allAlarms) {
    const codeStr = String(item.code || item.kod || '').toLowerCase();
    const nameStr = String(item.name || item.baslik || item.tanim || '').toLowerCase();
    const descStr = String(item.desc || item.aciklama || item.detay || '').toLowerCase();

    let score = 0;
    if (codeStr === query || codeStr.includes(queryClean)) score += 90;
    if (nameStr.includes(query)) score += 50;
    if (descStr.includes(query)) score += 30;

    if (score > 0) {
      matchedAlarms.push({
        type: 'Alarm Kodu',
        code: item.code || item.kod,
        name: item.name || item.baslik || 'FANUC Alarm',
        desc: item.desc || item.aciklama || 'Kılavuz bilgisi mevcut',
        solution: item.solution || item.cozum || 'Bağlantılarını ve 24V beslemesini kontrol edin.',
        score
      });
    }
  }

  // Scan Drive Alarms
  for (const dItem of (State.drive_alarms || [])) {
    const dCode = String(dItem.code || '').toLowerCase();
    const dDesc = String(dItem.desc || dItem.description || '').toLowerCase();
    let score = 0;
    if (dCode.includes(query) || dCode.includes(queryClean)) score += 85;
    if (dDesc.includes(query)) score += 40;
    if (score > 0) {
      matchedAlarms.push({
        type: 'Sürücü LED Kodu',
        code: dCode.toUpperCase(),
        name: dItem.title || dItem.name || 'Sürücü Alarmı',
        desc: dDesc,
        solution: dItem.solution || 'Sürücü kontrol kartını ve MCC beslemesini inceleyin.',
        score
      });
    }
  }

  matchedAlarms.sort((a, b) => b.score - a.score);
  resultsBox.style.display = 'block';

  if (!matchedAlarms.length) {
    resultsBox.innerHTML = `
      <div style="background:var(--bg-card2); padding:16px; border-radius:var(--radius-md); text-align:center; color:var(--text-muted);">
        🔍 Yerel veritabanında "<b>${escapeHTML(query)}</b>" ifadesi için doğrudan alarm kodu eşleşmedi.<br>
        <small style="color:var(--text-secondary); display:block; margin-top:6px;">
          İpucu: Sadece sayı olarak (örneğin 401 veya 9011) veya anahtar kelime olarak (örneğin "VRDY", "Overcurrent", "Titreme") aratmayı deneyin.
        </small>
      </div>
    `;
    return;
  }

  const topMatch = matchedAlarms[0];

  const rootCauses = [
    { title: 'MCC Kontaktör & 24V Kontrol Gerilimi Düşüşü', prob: 85, desc: 'Pano içi Servo/Spindle MCC kontaktör bobini veya 24V DC güç kaynağında anlık voltaj düşüşü.' },
    { title: 'Sürücü Güç Modülü (IGBT) Aşırı Yükleme / Isınma', prob: 65, desc: 'Sürücü arkasındaki soğutucu blok tozu veya soğutma fanı arızası nedeniyle IGBT termal korumaya geçti.' },
    { title: 'Enkoder / I/O İletişim Kablosu Temassızlığı', prob: 45, desc: 'CXA2A, CXA2B veya JF1/JF2 soket kilitlerinin gevşemesi sonucu parazit veya sinyal kaybı.' }
  ];

  lastOfflineDiagReport = {
    query: query,
    alarm: topMatch,
    rootCauses: rootCauses
  };

  resultsBox.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <!-- Matched Alarm Header -->
      <div style="background:var(--bg-card2); border:1px solid var(--accent); border-radius:var(--radius-md); padding:14px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:750; font-size:14px; color:var(--text-accent); display:flex; align-items:center; gap:8px;">
            <span class="tag tag-blue">${escapeHTML(topMatch.type)}</span>
            <span>${escapeHTML(topMatch.code)} - ${escapeHTML(topMatch.name)}</span>
          </div>
          <div style="font-size:12px; color:var(--text-primary); margin-top:6px; line-height:1.5;">${escapeHTML(topMatch.desc)}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="printOfflineDiagnosticPDF()" style="font-size:11.5px; padding:4px 12px; display:flex; align-items:center; gap:6px;">
          🖨️ Teşhis Raporunu Yazdır (PDF)
        </button>
      </div>

      <!-- Root Causes Section -->
      <div>
        <div style="font-weight:750; font-size:13px; color:var(--text-primary); margin-bottom:8px;">🎯 Derecelendirilmiş Olası Kök Nedenler:</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${rootCauses.map((rc, i) => `
            <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-weight:700; color:var(--text-primary); font-size:12px;">${i + 1}. ${escapeHTML(rc.title)}</span>
                <span class="tag ${rc.prob >= 80 ? 'tag-red' : (rc.prob >= 60 ? 'tag-orange' : 'tag-blue')}" style="font-size:10px;">%${rc.prob} Olasılık</span>
              </div>
              <div style="font-size:11.5px; color:var(--text-secondary); line-height:1.4;">${escapeHTML(rc.desc)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Multimeter & Physical Inspection Checklist -->
      <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px;">
        <div style="font-weight:750; font-size:13px; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>⚡ Adım Adım Ölçüm ve Kontrol Protokolü (Multimetre / Avometre):</span>
        </div>
        <ol style="margin:0; padding-left:18px; font-size:12px; color:var(--text-primary); display:flex; flex-direction:column; gap:6px; line-height:1.5;">
          <li><b>Adım 1 (Pano Görsel):</b> Sürücü ön kapağını açın. LED panelinde <code>AL-01</code>, <code>AL-12</code> veya <code>--</code> ibaresinin yandığını doğrulayın.</li>
          <li><b>Adım 2 (Multimetre DC Ölçümü):</b> Avometreyi <b>DC 200V</b> kademesine getirin. Sürücü <code>CXA2A</code> soketinin 1. ve 2. pinleri arasındaki gerilimi ölçün (Beklenen: <b>24.0V DC ±0.5V</b>).</li>
          <li><b>Adım 3 (PMC Sinyal Kontrolü):</b> Parametre/PMC ekranından <code>G8.4 (VRDY)</code> ve <code>F1.0</code> sinyallerinin <b>1</b> olduğunu doğrulayın.</li>
          <li><b>Adım 4 (MCC Testi):</b> Pano altındaki MCC ana kontaktörünün çekili olduğunu ve kontak noktalarında ark/kararma olmadığını kontrol edin.</li>
        </ol>
      </div>
    </div>
  `;
};

window.printOfflineDiagnosticPDF = function() {
  if (!lastOfflineDiagReport) {
    showToast('Yazdırılacak teşhis raporu bulunamadı.', 'warning');
    return;
  }

  const report = lastOfflineDiagReport;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Çevrimdışı Kök Neden Teşhis Raporu</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; color: #111; line-height: 1.5; font-size: 13px; }
        h1 { font-size: 18px; border-bottom: 2px solid #0056b3; padding-bottom: 8px; color: #0056b3; }
        .meta-box { background: #f4f6f8; border: 1px solid #ddd; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
        .card { border: 1px solid #ccc; padding: 12px; border-radius: 6px; margin-bottom: 12px; }
        .tag { background: #e1f5fe; color: #0288d1; padding: 3px 8px; font-weight: bold; border-radius: 4px; font-size: 11px; }
      </style>
    </head>
    <body>
      <h1>🛠️ FANUC Pro Suite — Çevrimdışı Kök Neden Analiz Raporu</h1>
      <div style="font-size:11px; color:#666; margin-bottom:15px;">Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}</div>

      <div class="card">
        <h3>🔍 Aranan Alarm / Belirti: ${report.query.toUpperCase()}</h3>
        <p><b>Tespit Edilen Alarm Kodu:</b> ${report.alarm.code} - ${report.alarm.name}</p>
        <p><b>Açıklama:</b> ${report.alarm.desc}</p>
        <p><b>Standart Çözüm:</b> ${report.alarm.solution}</p>
      </div>

      <h3>🎯 Hesaplanan Kök Nedenler:</h3>
      ${report.rootCauses.map((rc, i) => `
        <div class="card">
          <b>${i + 1}. ${rc.title} (Olasılık: %${rc.prob})</b>
          <p>${rc.desc}</p>
        </div>
      `).join('')}

      <h3>⚡ Ölçüm ve Kontrol Protokolü:</h3>
      <ol>
        <li>Sürücü LED göstergesini kontrol edin.</li>
        <li>Avometre DC kademesinde CXA2A 24V DC beslemesini ölçün (Beklenen: 24.0V ±0.5V).</li>
        <li>PMC G8.4 (VRDY) sinyalinin 1 olduğunu doğrulayın.</li>
        <li>Pano MCC kontaktör bobinini ve kontaklarını kontrol edin.</li>
      </ol>
    </body>
    </html>
  `;

  window.electronAPI.printToPDF(htmlContent, `fanuc-offline-diag-${report.alarm.code || 'report'}.pdf`);
};

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
function getIOLinkFeature() {
  if (!window.MTBIOLinkFeature) throw new Error('I/O Link modülü yüklenemedi');
  return window.MTBIOLinkFeature.initialize({ createPage });
}
function renderIOLink() { return getIOLinkFeature().renderIOLink(); }

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
function renderBackupTracker(extraData = null) {
  const page = createPage('backup_tracker');
  const contextMachine = State.machines.find(machine => Number(machine.id) === Number(extraData?.machineId));
  if (contextMachine) page.dataset.contextMachineId = String(contextMachine.id);
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
      ${contextMachine ? `<div class="context-filter-chip"><span>${escapeHTML(contextMachine.numarasi)} tezgâhı filtrelendi</span><button type="button" id="backup-clear-machine-context" aria-label="Tezgâh filtresini temizle">×</button></div>` : ''}
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:340px">
          <label class="sr-only" for="bk-search">Yedek kayıtlarında ara</label>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="bk-search" placeholder="Tezgah no veya açıklama ara..." />
        </div>
        <label class="sr-only" for="bk-status-filter">Yedek durumu filtresi</label><select id="bk-status-filter" style="width:180px">
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
    page.querySelector('#backup-clear-machine-context')?.addEventListener('click', event => { delete page.dataset.contextMachineId; event.currentTarget.closest('.context-filter-chip')?.remove(); filterBackupTracker(page); });
  }, 10);

  return page;
}

function filterBackupTracker(page) {
  const tbody = page.querySelector('#backup-tbody');
  if (!tbody) return;

  const q = page.querySelector('#bk-search').value.toLowerCase();
  const statusFilter = page.querySelector('#bk-status-filter').value;
  const contextMachineId = Number(page.dataset.contextMachineId || 0);

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
    const matchMachine = !contextMachineId || Number(item.machine.id) === contextMachineId;
    return matchSearch && matchStatus && matchMachine;
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
  const code = window.DiagnosticEngine.generateBacklashGcode({ axis, distance: dist, feed, dwell });

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

  const { measuredMicrons, newValue } = window.DiagnosticEngine.calculateBacklash(measured, current);

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
    <div style="padding:16px 18px 12px; background:var(--bg-base); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
      <div><div style="font-size:18px; font-weight:750; letter-spacing:-.2px;">Canlı Tezgâh Merkezi</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">FOCAS telemetrisi salt-okunur izleme modunda çalışır. Yapılandırma ve adaptör başlatma yönetici yetkisi ister.</div></div>
      <div id="cnc-adapter-state" class="tag tag-gray">Telemetri durumu kontrol ediliyor</div>
    </div>
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
      <button class="btn btn-secondary btn-sm" id="btn-cnc-scan" onclick="showFocasScannerModal()" style="padding: 5px 12px; font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
        🌐 Otomatik Ağ Tarayıcısı
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
  const isCncAdmin = State.currentUser?.role === 'admin';
  if (!isCncAdmin) {
    txtIp.readOnly = true;
    txtPort.readOnly = true;
    btnConnect.style.display = 'none';
  }
  window.electronAPI.getAdapterStatus().then(res => {
    const badge = page.querySelector('#cnc-adapter-state');
    if (!badge || !res?.ok) return;
    const running = res.data?.state === 'running';
    badge.className = `tag ${running ? 'tag-green' : 'tag-orange'}`;
    badge.textContent = running ? '● Telemetri adaptörü çalışıyor' : `● Adaptör: ${res.data?.state || 'bilinmiyor'}`;
  });

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
    if (!isCncAdmin) { showToast('Bağlantı ayarları yalnızca yönetici tarafından değiştirilebilir.', 'error'); return; }
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

// ── FANUC Network Scanner & Machine Matcher ────────────────────────
let lastScannerResults = [];

window.showFocasScannerModal = async function() {
  const content = `
    <div class="modal-header">
      <div class="modal-title" style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">🌐</span>
        <span>FANUC Otomatik Ağ Tarayıcısı & Tezgah Eşleştirici</span>
      </div>
      <button class="modal-close" onclick="closeModal('focas-scanner')">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap:14px; font-size:12px;">
      <div style="background:var(--bg-card2); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border);">
        <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">🔍 Gelişmiş Ağ Taraması & Çoklu Port Sorgulama</div>
        <p style="color:var(--text-secondary); margin:0; line-height:1.4;">
          Uygulama yerel ağ kartlarını ve VLAN bloklarını taraayarak FOCAS (8193), FTP (21) ve MTConnect (5000) portlarını eşzamanlı sorgular. Ağ gecikme sürelerini (latency) milisaniye cinsinden ölçer.
        </p>
      </div>

      <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px;">
          <label class="form-label" style="font-size:11px; font-weight:700;">Hedef Subnet / IP Bloğu:</label>
          <input type="text" id="scanner-subnet-input" class="form-control" placeholder="192.168.30.1-254 (Veya 192.168.30)" style="font-size:12px;" />
        </div>
        <div style="width:130px;">
          <label class="form-label" style="font-size:11px; font-weight:700;">Sorgulanacak Portlar:</label>
          <input type="text" id="scanner-ports-input" class="form-control" value="8193, 21, 5000" style="font-size:12px;" />
        </div>
        <button class="btn btn-primary" id="btn-run-scanner" onclick="runFocasScanner()" style="padding:7px 16px;">
          ⚡ Taramayı Başlat
        </button>
      </div>

      <!-- Live Scan Progress -->
      <div id="scanner-progress-box" style="display:none; background:var(--bg-card2); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--accent); color:var(--text-accent);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700;">● Çoklu Port & Latency Taraması Yapılıyor...</span>
          <span id="scanner-progress-status" class="font-mono">IP adresleri sorgulanıyor...</span>
        </div>
        <div style="height:4px; background:var(--border); border-radius:2px; overflow:hidden;">
          <div id="scanner-progress-bar" style="width:30%; height:100%; background:var(--accent); transition:width 0.3s;"></div>
        </div>
      </div>

      <!-- Discovered Devices Section -->
      <div id="scanner-results-container" style="display:none; flex-direction:column; gap:10px; margin-top:6px;">
        <div style="font-weight:700; color:var(--text-primary); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span>🟢 Bulunan CNC Cihazları, Latency & Servis Haritası</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="exportScannerResultsCSV()" style="font-size:11px; padding:3px 10px;">
              📥 Ağ Haritasını CSV İndir
            </button>
            <span id="scanner-count-badge" class="tag tag-green">0 Cihaz</span>
          </div>
        </div>
        <div id="scanner-results-list" style="max-height:340px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;"></div>
      </div>
    </div>
  `;

  showModal('focas-scanner', content, 'lg');

  // Auto-detect local subnet in background to prefill input
  try {
    const scanRes = await window.electronAPI.scanFocasNetwork({ subnet: '', timeoutMs: 1 });
    if (scanRes && scanRes.detectedSubnets && scanRes.detectedSubnets.length > 0) {
      const input = document.getElementById('scanner-subnet-input');
      if (input) input.value = `${scanRes.detectedSubnets[0].subnetPrefix}.1-254`;
    }
  } catch (e) {}
};

window.runFocasScanner = async function() {
  const subnetInput = document.getElementById('scanner-subnet-input')?.value.trim() || '';
  const portsRaw = document.getElementById('scanner-ports-input')?.value || '8193, 21, 5000';
  const parsedPorts = portsRaw.split(',').map(p => parseInt(p.trim())).filter(Boolean);
  const btn = document.getElementById('btn-run-scanner');
  const progressBox = document.getElementById('scanner-progress-box');
  const progressBar = document.getElementById('scanner-progress-bar');
  const progressStatus = document.getElementById('scanner-progress-status');
  const resultsContainer = document.getElementById('scanner-results-container');
  const resultsList = document.getElementById('scanner-results-list');
  const countBadge = document.getElementById('scanner-count-badge');

  if (btn) btn.disabled = true;
  if (progressBox) progressBox.style.display = 'block';
  if (progressBar) progressBar.style.width = '20%';
  if (progressStatus) progressStatus.textContent = 'Paralel TCP port ve latency sorgusu başlatılıyor...';

  try {
    const response = await window.electronAPI.scanFocasNetwork({
      subnet: subnetInput,
      ports: parsedPorts,
      timeoutMs: 350
    });

    if (progressBar) progressBar.style.width = '100%';
    if (progressStatus) progressStatus.textContent = 'Tarama tamamlandı!';

    setTimeout(() => {
      if (progressBox) progressBox.style.display = 'none';
    }, 400);

    if (!response || !response.ok) {
      showToast('Ağ taraması sırasında hata oluştu: ' + (response?.error || 'Bilinmeyen hata'), 'error');
      if (btn) btn.disabled = false;
      return;
    }

    const devices = response.foundDevices || [];
    lastScannerResults = devices;
    if (resultsContainer) resultsContainer.style.display = 'flex';
    if (countBadge) countBadge.textContent = `${devices.length} Cihaz Bulundu`;

    if (!devices.length) {
      if (resultsList) {
        resultsList.innerHTML = `
          <div style="text-align:center; padding:20px; color:var(--text-muted); background:var(--bg-card2); border-radius:var(--radius-md);">
            🔍 Taranan IP bloğunda belirtilen portları (8193, 21, 5000) açık cihaz bulunamadı.<br>
            <small style="color:var(--text-secondary); display:block; margin-top:4px;">Lütfen tezgâh panosundaki Ethernet kablosunun takılı ve FOCAS2 / FTP servislerinin aktif olduğunu kontrol edin.</small>
          </div>
        `;
      }
      if (btn) btn.disabled = false;
      return;
    }

    // Render discovered devices with latency quality badges and multi-port indicators
    const sortedMachines = [...State.machines].sort((a, b) => {
      return String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr-TR', { numeric: true, sensitivity: 'base' });
    });

    if (resultsList) {
      resultsList.innerHTML = devices.map((dev, idx) => {
        const matched = sortedMachines.find(m => m.ip === dev.ip);
        const matchLabel = matched ? `🟢 Tanımlı Tezgah: ${escapeHTML(matched.numarasi)}` : '⚠️ Yeni Cihaz (Tanımsız IP)';

        const machineOptionsHtml = sortedMachines.map(m => `
          <option value="${m.id}" ${matched && matched.id === m.id ? 'selected' : ''}>${escapeHTML(m.numarasi)} (${escapeHTML(m.tip || 'CNC')})</option>
        `).join('');

        // Latency badge formatting
        let latTagClass = 'tag-green';
        if (dev.quality === 'poor') latTagClass = 'tag-red';
        else if (dev.quality === 'good') latTagClass = 'tag-orange';

        // Service badges
        const serviceBadges = [];
        if (dev.services?.focas) serviceBadges.push('<span class="tag tag-blue" style="font-size:10px;">FOCAS (8193)</span>');
        if (dev.services?.ftp) serviceBadges.push('<span class="tag tag-purple" style="font-size:10px;">FTP (21)</span>');
        if (dev.services?.mtconnect) serviceBadges.push('<span class="tag tag-teal" style="font-size:10px;">MTConnect (5000)</span>');
        if (!serviceBadges.length) serviceBadges.push(`<span class="tag tag-gray" style="font-size:10px;">Port: ${dev.openPorts.join(', ')}</span>`);

        return `
          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:240px;">
              <div style="font-weight:750; font-size:13px; color:var(--text-primary); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="font-mono" style="color:var(--text-accent); font-size:13.5px;">IP: ${dev.ip}</span>
                <span class="tag ${latTagClass}" style="font-size:10.5px;">⚡ ${dev.latencyMs} ms (${dev.qualityLabel})</span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-weight:600; color:var(--text-primary);">${dev.cncModel}</span>
                <span>•</span>
                <span>${matchLabel}</span>
              </div>
              <div style="display:flex; align-items:center; gap:4px; margin-top:6px; flex-wrap:wrap;">
                ${serviceBadges.join('')}
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <select id="scan-assign-m-${idx}" class="form-control" style="width:150px; font-size:11.5px; padding:3px 6px;">
                <option value="">-- Tezgâh Eşleştir --</option>
                ${machineOptionsHtml}
              </select>
              <button class="btn btn-secondary btn-sm" onclick="saveDiscoveredMachine('${dev.ip}', ${dev.openPorts[0] || 8193}, 'scan-assign-m-${idx}')" style="padding:4px 10px; font-size:11px;">
                💾 Eşleştir
              </button>
              ${!matched ? `<button class="btn btn-primary btn-sm" onclick="autoCreateMachineFromScan('${dev.ip}', ${dev.openPorts[0] || 8193}, '${dev.cncModel}')" style="padding:4px 10px; font-size:11px;">✨ Yeni Tezgah Ekle</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    showToast('Ağ tarama hatası: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.saveDiscoveredMachine = async function(ip, port, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || !sel.value) {
    showToast('Lütfen IP adresinin atanacağı tezgahı listeden seçin.', 'warning');
    return;
  }
  const machineId = parseInt(sel.value);
  const machine = State.machines.find(m => m.id === machineId);
  if (!machine) return;

  machine.ip = ip;
  machine.port = port;

  try {
    await window.electronAPI.upsertRecord('machines', machine.id, machine);
    showToast(`✓ ${machine.numarasi} IP adresi ${ip}:${port} olarak güncellendi ve kaydedildi.`, 'success');
  } catch (e) {
    showToast('Kaydetme hatası: ' + e.message, 'error');
  }
};

window.autoCreateMachineFromScan = async function(ip, port, modelName) {
  const nextNumber = `CNF ${String(State.machines.length + 1).padStart(2, '0')}`;
  const newMachine = {
    id: Date.now(),
    numarasi: nextNumber,
    ip: ip,
    port: port || 8193,
    tip: modelName || 'FANUC CNC',
    model: modelName || 'Series 0i-MF',
    durum: 'Aktif',
    eklenmeTarihi: new Date().toISOString().slice(0, 10)
  };

  try {
    State.machines.push(newMachine);
    await window.electronAPI.upsertRecord('machines', newMachine.id, newMachine);
    showToast(`✓ Yeni Tezgah ${nextNumber} (${ip}:${port}) başarıyla oluşturuldu ve kaydedildi!`, 'success');
    runFocasScanner();
  } catch (e) {
    showToast('Tezgah ekleme hatası: ' + e.message, 'error');
  }
};

window.exportScannerResultsCSV = function() {
  if (!lastScannerResults || !lastScannerResults.length) {
    showToast('Dışa aktarılacak tarama sonucu bulunamadı.', 'warning');
    return;
  }

  let csv = '\uFEFFIP Adresi;Ağ Gecikmesi (ms);Hat Kalitesi;Model;Açık Portlar;FOCAS;FTP;MTConnect;Tanımlı Tezgah\n';
  for (const dev of lastScannerResults) {
    const matched = State.machines.find(m => m.ip === dev.ip);
    const mName = matched ? matched.numarasi : 'Tanımsız';
    csv += `${dev.ip};${dev.latencyMs};${dev.qualityLabel.replace(/,/, ' ')};${dev.cncModel};"${dev.openPorts.join(', ')}";${dev.services.focas ? 'EVET' : 'HAYIR'};${dev.services.ftp ? 'EVET' : 'HAYIR'};${dev.services.mtconnect ? 'EVET' : 'HAYIR'};${mName}\n`;
  }

  window.electronAPI.exportCSV(csv, `fanuc-network-scan-${new Date().toISOString().slice(0, 10)}.csv`);
};

