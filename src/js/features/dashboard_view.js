/**
 * Dashboard View
 * Extracted from renderer.js for modular architecture.
 */
(function(global) {
  'use strict';

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


  const MTBDashboardView = {
    renderDashboard: typeof renderDashboard !== 'undefined' ? renderDashboard : undefined,
    alarmCategoryTag: typeof alarmCategoryTag !== 'undefined' ? alarmCategoryTag : undefined
  };

  global.MTBDashboardView = MTBDashboardView;
  if (typeof renderDashboard !== 'undefined') global.renderDashboard = renderDashboard;
  if (typeof alarmCategoryTag !== 'undefined') global.alarmCategoryTag = alarmCategoryTag;
})(window);
