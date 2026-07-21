/**
 * MTB Elektrik Bakım — Navigation UI & Accordions
 */

import { State } from '../state.js';
import { parseDateHelper, escapeHTML } from '../utils.js';

export function initRippleEffect() {
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

export function organizeNavigation() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const footer = sidebar.querySelector('.sidebar-footer');
  const items = new Map(
    [...sidebar.querySelectorAll('.nav-item[data-page]')].map(item => [item.dataset.page, item])
  );
  const groups = [
    { id: 'operations', label: 'Operasyon', pages: ['cnc_dashboard', 'cnc_screen_viewer', 'machines', 'maintenance', 'battery', 'reports', 'predictive', 'reliability', 'projects'] },

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
  if (footer) {
    sidebar.insertBefore(home, footer);
    sidebar.insertBefore(host, footer);
    sidebar.insertBefore(shortcuts, footer);
  }
}

export function checkNotifications() {
  const notifications = [];
  const now = new Date();

  // Battery checks — Degradation Engine
  State.batteries.forEach(b => {
    const deg = window.calculateDegradation ? window.calculateDegradation(b, 'battery') : null;
    const dateStr = b.tarih || b.lastChanged;
    const mach = State.machines.find(x => x.id === b.tezgah_id);
    const machName = mach ? mach.numarasi : (b.machine || b.controller || `Tezgah #${b.tezgah_id}`);
    
    if (deg) {
      if (deg.status === 'expired' || deg.status === 'critical') {
        notifications.push({ level: 'red', title: '🔋 Pil Değişimi Gerekli', sub: `${machName} (Eksen ${b.eksen || '?'}) — ${deg.statusText}` });
      } else if (deg.status === 'warning') {
        notifications.push({ level: 'amber', title: '🔋 Pil Değişimi Yaklaşıyor', sub: `${machName} (Eksen ${b.eksen || '?'}) — ${deg.statusText}` });
      }
    }
  });

  // Fan checks — Degradation Engine
  State.fans.forEach(f => {
    const deg = window.calculateDegradation ? window.calculateDegradation(f, 'fan') : null;
    const mach = State.machines.find(x => x.id === f.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${f.tezgah_id}`;
    if (deg) {
      if (deg.status === 'expired' || deg.status === 'critical' || deg.status === 'warning') {
        notifications.push({ level: 'amber', title: '💨 Fan Bakım Uyarısı', sub: `${machName} (${f.konum || 'Kabin'}) — ${deg.statusText}` });
      }
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
  if (critical.length && window.electronAPI && window.electronAPI.showNativeNotification) {
    window.electronAPI.showNativeNotification('MTB Elektrik Bakım — Kritik Uyarı', `${critical.length} kritik bakım uyarısı var!`);
  }
}

export function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (State.notifications.length > 0) badge.classList.add('show');
  else badge.classList.remove('show');
}

export function renderNotifPanel() {
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

export function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.toggle('open');
}

export function closeNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.remove('open');
}

if (typeof window !== 'undefined') {
  window.checkNotifications = checkNotifications;
  window.toggleNotifPanel = toggleNotifPanel;
  window.closeNotifPanel = closeNotifPanel;
}
