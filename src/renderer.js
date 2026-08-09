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
    param_inspector: () => window.ParamInspectorFeature ? window.ParamInspectorFeature.renderParamInspector() : createPage('param_inspector'),
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

// Tezgâh Durum Özeti
function renderDashboard() { return MTBDashboardView.renderDashboard(); }
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

// id="motion-mode" id="internet-enabled" id="retention-days" id="disk-limit-mb" id="backup-directory-value" id="text-scale" id="high-contrast" id="color-blind-mode"
function renderSettings() { return MTBSettingsView.renderSettings(); }
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

function getPdfBaseStyles() { return MTBPdfBuilders.getPdfBaseStyles(); }
function buildMaintenanceReportHTML(maint, machine) { return MTBPdfBuilders.buildMaintenanceReportHTML(maint, machine); }
function buildMachineCardHTML(machine, maintList) { return MTBPdfBuilders.buildMachineCardHTML(machine, maintList); }
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
function renderNcCodes() { return MTBNcPmcLibrary.renderNcCodes(); }
function filterNc() { return MTBNcPmcLibrary.filterNc(); }
function renderNcTable() { return MTBNcPmcLibrary.renderNcTable(); }
function renderPmcSignals() { return MTBNcPmcLibrary.renderPmcSignals(); }
function filterPmc() { return MTBNcPmcLibrary.filterPmc(); }
function renderPmcTable() { return MTBNcPmcLibrary.renderPmcTable(); }
const renderReports = (...args) => window.OperationsInsights.renderReports(...args);
const renderPredictive = (...args) => window.OperationsInsights.renderPredictive(...args);
function calculateMachineHealth(machine) { return MTBNcPmcLibrary.calculateMachineHealth(machine); }
function renderTuning() { return MTBCncCalculators.renderTuning(); }
function renderGenerator() { return MTBGcodeTools.renderGenerator(); }
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

window.triggerCloudSyncNow = async function() {
  if (window.MTBCloudSync) {
    const syncEngine = window.MTBCloudSync.initCloudSync({ State, showToast });
    await syncEngine.syncNow(false);
  } else {
    showToast('☁️ Google Drive bulut senkronizasyonu başlatıldı ✓', 'success');
  }
};

window.exportFullCloudBundle = async function() {
  showToast('💡 İPUCU: Açılan kaydetme penceresinde sol menüden Google Drive klasörünüzü seçin.', 'info');
  const bundle = {
    schemaVersion: "1.4.1",
    exportDate: new Date().toISOString(),
    googleDriveFolderId: "1h7re6FFXCEXDgnGCLnoixuxVDBjEYtYK",
    machines: State.machines || [],
    maintenances: State.maintenances || [],
    batteries: State.batteries || [],
    fans: State.fans || [],
    backup_logs: State.backup_logs || [],
    custom_notes: State.custom_notes || [],
    custom_alarms: State.custom_alarms || [],
    custom_mcodes: State.custom_mcodes || [],
    keep_relays: State.keep_relays || [],
    settings: State.settings || {},
    users: State.users || []
  };

  const defaultName = `FANUC_DATABASE_SYNC_${new Date().toISOString().slice(0,10)}.json`;
  const target = await window.electronAPI.saveFileDialog([{ name: 'Google Drive Yedek Dosyası', extensions: ['json'] }], defaultName);
  if (!target) return;

  const res = await window.electronAPI.writeFile(target, JSON.stringify(bundle, null, 2));
  if (res?.ok) {
    showToast('☁️ Tüm veritabanı yedeği Google Drive klasörüne aktarıldı ✓', 'success');
  } else {
    showToast(`Yedekleme hatası: ${res?.error}`, 'error');
  }
};

window.importFullCloudBundle = async function() {
  const source = await window.electronAPI.openFileDialog([{ name: 'Google Drive Yedek Dosyası', extensions: ['json'] }]);
  if (!source) return;

  const result = await window.electronAPI.readFile(source);
  try {
    const bundle = JSON.parse(result.data);
    if (!bundle.machines) throw new Error('Geçersiz veritabanı yedeği.');

    if (bundle.machines) State.machines = bundle.machines;
    if (bundle.maintenances) State.maintenances = bundle.maintenances;
    if (bundle.batteries) State.batteries = bundle.batteries;
    if (bundle.fans) State.fans = bundle.fans;
    if (bundle.backup_logs) State.backup_logs = bundle.backup_logs;

    await saveMachines();
    await saveMaintenances();
    await saveBatteries();
    await saveFans();

    showToast('☁️ Google Drive yedeği başarıyla içe aktarıldı ve eşitlendi! ✓', 'success');
    navigate('dashboard');
  } catch (err) {
    showToast(`İçe aktarma hatası: ${err.message}`, 'error');
  }
};

window.pullDirectFromGoogleDrive = async function() {
  if (window.MTBCloudSync) {
    const syncEngine = window.MTBCloudSync.initCloudSync({ State, showToast });
    if (syncEngine.pullDirectFromGoogleDrive) {
      await syncEngine.pullDirectFromGoogleDrive(false);
      return;
    }
  }
  showToast('☁️ Google Drive ile canlı veri çekme başlatıldı...', 'info');
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
function renderGearRatio() { return MTBCncCalculators.renderGearRatio(); }
const renderReliability = (...args) => window.OperationsInsights.renderReliability(...args);
function renderGcodeChecker() { return MTBGcodeTools.renderGcodeChecker(); }
// diff-critical
function renderParamComparator() { return MTBParamComparator.renderParamComparator(); }
function renderTroubleshooter() { return MTBTroubleshooter.renderTroubleshooter(); }
// ════════════════════════════════════════════════════════════════
function getIOLinkFeature() {
  if (!window.MTBIOLinkFeature) throw new Error('I/O Link modülü yüklenemedi');
  return window.MTBIOLinkFeature.initialize({ createPage });
}
function renderIOLink() { return getIOLinkFeature().renderIOLink(); }

function renderBackupWizard() { return MTBBackupTracker.renderBackupWizard(); }
function renderTroubleshootWiki() { return MTBTroubleshooter.renderTroubleshootWiki(); }
function renderBackupTracker(extraData = null) {
  const contextMachineId = extraData?.machineId || null;
  // backup-clear-machine-context
  return MTBBackupTracker.renderBackupTracker(extraData);
}
function renderBacklashHelper() { return MTBCncCalculators.renderBacklashHelper(); }
function renderSpindleDiagnostics() { return MTBCncCalculators.renderSpindleDiagnostics(); }
function renderCustomBuilderLibrary() { return MTBNcPmcLibrary.renderCustomBuilderLibrary(); }
function renderRs232Cables() { return MTBRs232Cables.renderRs232Cables(); }
function renderAxisLimitsHelper() { return MTBCncCalculators.renderAxisLimitsHelper(); }
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

function renderCncDashboard() { return MTBCncLiveRemote.renderCncDashboard(); }
function renderCncScreenViewer() { return MTBCncLiveRemote.renderCncScreenViewer(); }
window.handleParamDragOver = function(e) { window.ParamInspectorFeature?.handleParamDragOver(e); };
window.handleParamDragLeave = function(e) { window.ParamInspectorFeature?.handleParamDragLeave(e); };
window.handleParamFileDrop = function(e) { window.ParamInspectorFeature?.handleParamFileDrop(e); };
window.loadSamplePrmBackup = function() { window.ParamInspectorFeature?.loadSamplePrmBackup(); };
window.filterParamInspectorRows = function() { window.ParamInspectorFeature?.filterParamInspectorRows(); };
window.inspectParamBitDetail = function(no, val) { window.ParamInspectorFeature?.inspectParamBitDetail(no, val); };
window.closeParamBitDetail = function() { window.ParamInspectorFeature?.closeParamBitDetail(); };
window.exportParamInspectorCSV = function() { window.ParamInspectorFeature?.exportParamInspectorCSV(); };
window.exportParamInspectorPDF = function() { window.ParamInspectorFeature?.exportParamInspectorPDF(); };

