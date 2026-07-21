/**
 * MTB Elektrik Bakım — Utility Helpers
 */

import { State } from './state.js';

export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function safeParseJSON(dataString, key, fallbackValue) {
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

export function addStyle(cssString) {
  const style = document.createElement('style');
  style.textContent = cssString;
  document.head.appendChild(style);
}

export function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    pointer-events: auto; padding: 12px 18px; border-radius: 8px; font-size: 13px; font-weight: 500;
    color: #fff; background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); opacity: 0; transform: translateY(10px); transition: all 0.3s ease;
  `;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function getRoleLabel(role) {
  const map = { admin: '🔑 Yönetici', technician: '🔧 Bakım Teknisyeni', operator: '👤 Operatör' };
  return map[role] || role;
}

export function canEdit() {
  return State.currentUser && (State.currentUser.role === 'admin' || State.currentUser.role === 'technician');
}

export function canDelete() {
  return State.currentUser && State.currentUser.role === 'admin';
}

export function parseDateHelper(dateStr) {
  if (!dateStr) return new Date(0);
  try {
    const parts = String(dateStr).split(/[-./]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]); // YYYY-MM-DD
      if (parts[2].length === 4) return new Date(parts[2], parts[1] - 1, parts[0]); // DD-MM-YYYY
    }
    return new Date(dateStr);
  } catch (e) {
    return new Date(0);
  }
}

export async function exportMaintenanceCSV() {
  const headers = ['Tarih', 'Tezgah', 'Tür', 'Açıklama', 'Teknisyen', 'Süre (dk)'];
  const rows = State.maintenances.map(r => {
    const mach = State.machines.find(x => x.id == (r.tezgah_id || r.machine_id));
    const machName = mach ? mach.numarasi : (r.tezgah_adi || r.machine_name || `Tezgah #${r.tezgah_id || r.machine_id}`);
    
    let type = r.tur || r.type;
    if (!type) {
      const desc = (r.aciklama || r.description || '').toLowerCase();
      if (desc.includes('[pm]') || desc.includes('periyodik') || desc.includes('planli') || desc.includes('planlı')) {
        type = 'Planlı Bakım';
      } else {
        type = 'Arıza';
      }
    }

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
}

export async function exportAlarmsCSV() {
  const headers = ['Kod', 'Kategori', 'Başlık', 'Açıklama', 'Olası Nedenler', 'Çözüm Önerileri'];
  const rows = State.alarms.map(a => {
    const causesStr = Array.isArray(a.causes) ? a.causes.join(' | ') : (a.causes || '');
    const solutionsStr = Array.isArray(a.solutions) ? a.solutions.join(' | ') : (a.solution || a.solutions || '');
    
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
}

// Attach to window for legacy inline script compatibility
if (typeof window !== 'undefined') {
  window.escapeHTML = escapeHTML;
  window.safeParseJSON = safeParseJSON;
  window.showToast = showToast;
  window.canEdit = canEdit;
  window.canDelete = canDelete;
  window.exportMaintenanceCSV = exportMaintenanceCSV;
  window.exportAlarmsCSV = exportAlarmsCSV;
}
