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
  if (window.MTBUX?.notify) return window.MTBUX.notify(message, type);
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

// Attach to window for legacy inline script compatibility
if (typeof window !== 'undefined') {
  window.escapeHTML = escapeHTML;
  window.safeParseJSON = safeParseJSON;
  window.showToast = showToast;
  window.canEdit = canEdit;
  window.canDelete = canDelete;
}
