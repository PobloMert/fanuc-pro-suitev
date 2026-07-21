/**
 * MTB Elektrik Bakım — Battery & Fan Degradation Engine
 */

import { State } from '../state.js';

export function parseDateHelper(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  // Handle DD-MM-YYYY or DD.MM.YYYY
  if (s.includes('-') || s.includes('.')) {
    const parts = s.split(/[-.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        // DD-MM-YYYY
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function calculateDegradation(item, type = 'battery') {
  const defaultLifespanDays = type === 'fan' ? 730 : 365;
  const totalDays = item.lifespanDays || defaultLifespanDays;

  const dateStr = item.tarih || item.lastChanged || item.degisim_tarihi;
  const dateObj = parseDateHelper(dateStr);

  if (!dateObj) {
    return {
      daysElapsed: 0,
      totalDays,
      daysRemaining: totalDays,
      percentRemaining: 100,
      status: 'normal',
      color: '#10b981',
      badgeClass: 'tag-green',
      statusText: 'Kayıt Yok (Yeni)'
    };
  }

  const now = new Date();
  const diffTime = Math.max(0, now - dateObj);
  const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const daysRemaining = totalDays - daysElapsed;
  const percentRemaining = Math.max(0, Math.min(100, Math.round((daysRemaining / totalDays) * 100)));

  let status = 'normal';
  let color = '#10b981';
  let badgeClass = 'tag-green';
  let statusText = `${daysRemaining} gün kaldı (%${percentRemaining})`;

  if (daysRemaining <= 0) {
    status = 'expired';
    color = '#991b1b';
    badgeClass = 'tag-red';
    statusText = `Süresi Doldu! (${Math.abs(daysRemaining)} gün geçti)`;
  } else if (daysRemaining <= 30 || percentRemaining <= 15) {
    status = 'critical';
    color = '#ef4444';
    badgeClass = 'tag-red';
    statusText = `Kritik (${daysRemaining} gün kaldı)`;
  } else if (daysRemaining <= 60 || percentRemaining <= 30) {
    status = 'warning';
    color = '#f59e0b';
    badgeClass = 'tag-amber';
    statusText = `Yaklaşıyor (${daysRemaining} gün kaldı)`;
  }

  return {
    dateObj,
    daysElapsed,
    totalDays,
    daysRemaining,
    percentRemaining,
    status,
    color,
    badgeClass,
    statusText
  };
}

export function checkComponentDegradationAlerts() {
  if (!State.notifications) State.notifications = [];
  const existingAlertIds = new Set(State.notifications.map(n => n.id));

  // Check Batteries
  if (Array.isArray(State.batteries)) {
    State.batteries.forEach(b => {
      const deg = calculateDegradation(b, 'battery');
      if (deg.daysRemaining <= 30) {
        const notifId = `batt-alert-${b.id || (b.tezgah_id + '-' + b.eksen)}`;
        if (!existingAlertIds.has(notifId)) {
          const machName = b.tezgah_adi || b.machine_name || `Tezgah #${b.tezgah_id || ''}`;
          State.notifications.unshift({
            id: notifId,
            type: 'critical',
            title: `🔋 Pil Değişim Uyarısı: ${machName}`,
            message: `${b.eksen || 'Eksen'} pili ömrü bitmek üzere (${deg.statusText}).`,
            time: 'Şimdi',
            targetPage: 'batteries'
          });
        }
      }
    });
  }

  // Check Fans
  if (Array.isArray(State.fans)) {
    State.fans.forEach(f => {
      const deg = calculateDegradation(f, 'fan');
      if (deg.daysRemaining <= 30) {
        const notifId = `fan-alert-${f.id || (f.tezgah_id + '-' + f.konum)}`;
        if (!existingAlertIds.has(notifId)) {
          const machName = f.tezgah_adi || f.machine_name || `Tezgah #${f.tezgah_id || ''}`;
          State.notifications.unshift({
            id: notifId,
            type: 'warning',
            title: `🌀 Fan Bakım Uyarısı: ${machName}`,
            message: `${f.konum || 'Kabin'} fanı kullanım süresi doluyor (${deg.statusText}).`,
            time: 'Şimdi',
            targetPage: 'maintenance'
          });
        }
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.calculateDegradation = calculateDegradation;
  window.checkComponentDegradationAlerts = checkComponentDegradationAlerts;
}
