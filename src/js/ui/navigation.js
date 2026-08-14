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
  const manifest = window.MTBPageManifest;
  if (!manifest) return;
  const groups = manifest.groups.map(group => ({
    ...group,
    pages: manifest.pages.filter(page => page.group === group.id).map(page => page.id)
  }));

  const home = document.createElement('div');
  home.className = 'sidebar-home';
  if (items.has('dashboard')) home.append(items.get('dashboard'));

  // Quick Access Favorites Bar
  const favContainer = document.createElement('div');
  favContainer.className = 'sidebar-favorites';
  favContainer.style.cssText = 'padding:8px 10px; margin:6px 0 10px 0; background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md);';
  favContainer.innerHTML = `
    <div style="font-size:10px; font-weight:800; color:var(--text-accent); letter-spacing:0.5px; text-transform:uppercase; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
      <span>⭐</span> Hızlı Erişim
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:4px;">
      <button class="btn btn-ghost btn-sm" onclick="navigate('cnc_dashboard')" style="font-size:10.5px; padding:3px 6px; font-weight:600;">📺 Canlı İzleme</button>
      <button class="btn btn-ghost btn-sm" onclick="navigate('machines')" style="font-size:10.5px; padding:3px 6px; font-weight:600;">📋 Tezgâhlar</button>
      <button class="btn btn-ghost btn-sm" onclick="navigate('alarms')" style="font-size:10.5px; padding:3px 6px; font-weight:600;">🚨 Alarmlar</button>
      <button class="btn btn-ghost btn-sm" onclick="navigate('maintenance')" style="font-size:10.5px; padding:3px 6px; font-weight:600;">🔧 Bakım</button>
      <button class="btn btn-ghost btn-sm" onclick="navigate('battery')" style="font-size:10.5px; padding:3px 6px; font-weight:600;">🔋 Piller</button>
    </div>
  `;
  home.append(favContainer);

  const host = document.createElement('div');
  host.className = 'nav-groups';
  groups.forEach(group => {
    const groupItems = group.pages.map(page => items.get(page)).filter(Boolean);
    if (!groupItems.length) return;
    const details = document.createElement('details');
    details.className = 'nav-group';
    details.dataset.group = group.id;
    details.open = group.id === 'daily';
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

  // New manifest entries must never silently disappear from navigation.
  const assigned = new Set(['dashboard', 'ai', 'settings', ...groups.flatMap(group => group.pages)]);
  const unassigned = [...items.entries()].filter(([page]) => !assigned.has(page));
  if (unassigned.length) {
    const details = document.createElement('details');
    details.className = 'nav-group';
    details.dataset.group = 'other';
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="nav-group-title">Diğer Modüller</span><span class="nav-group-count">${unassigned.length}</span>`;
    details.append(summary, ...unassigned.map(([, item]) => item));
    host.append(details);
  }

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
  const recordIndex = window.MTBPerformance?.buildRecordIndex?.(State);
  State.machines.forEach(m => {
    const machineMaint = recordIndex?.forMachine(m).maintenance || State.maintenances.filter(r => r.tezgah_id == m.id || r.machine_id == m.id);
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

  State.notifications = window.MTBNotificationLifecycle?.reconcile(notifications) || notifications;
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
        <div class="notif-sub">İlk: ${escapeHTML(new Date(n.firstSeen || Date.now()).toLocaleString('tr-TR'))} · Son: ${escapeHTML(new Date(n.lastSeen || Date.now()).toLocaleString('tr-TR'))} · Tekrar: ${Number(n.repeatCount || 1)}${n.reopened ? ` · Yeniden açıldı: ${Number(n.reopened)}` : ''}</div>
        <div class="flex gap-2 mt-1"><button class="btn btn-ghost btn-sm" data-notification-action="ack" data-notification-key="${escapeHTML(n.key || '')}">${n.acknowledged ? 'Görüldü' : 'Gördüm'}</button><button class="btn btn-ghost btn-sm" data-notification-action="resolve" data-notification-key="${escapeHTML(n.key || '')}">Çözüldü</button></div>
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

export function initAccessibleTabs() {
  if (typeof document === 'undefined') return;
  document.addEventListener('keydown', (e) => {
    const activeTab = document.activeElement;
    if (!activeTab || !activeTab.classList.contains('tab-btn')) return;
    const tabContainer = activeTab.closest('.tabs');
    if (!tabContainer) return;

    const tabs = Array.from(tabContainer.querySelectorAll('.tab-btn:not([disabled])'));
    const index = tabs.indexOf(activeTab);
    if (index === -1) return;

    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== -1) {
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
      tabs[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  });
}

if (typeof window !== 'undefined') {
  window.checkNotifications = checkNotifications;
  window.toggleNotifPanel = toggleNotifPanel;
  window.closeNotifPanel = closeNotifPanel;
  window.initAccessibleTabs = initAccessibleTabs;
}

