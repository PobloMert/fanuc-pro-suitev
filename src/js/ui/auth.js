/**
 * MTB Elektrik Bakım — Authentication & User Overlay
 */

import { State } from '../state.js';
import { escapeHTML, getRoleLabel } from '../utils.js';

let _loginSelectedUser = null;

export function showLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  const list = document.getElementById('login-user-list');
  const pinWrap = document.getElementById('login-pin-wrap');
  if (pinWrap) pinWrap.style.display = 'none';
  if (list) list.style.display = 'flex';
  _loginSelectedUser = null;

  if (list) {
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
}

export function loginSelectUser(userId) {
  _loginSelectedUser = State.users.find(u => u.id === userId);
  if (!_loginSelectedUser) return;
  const pinWrap = document.getElementById('login-pin-wrap');
  const label = document.getElementById('login-pin-label');
  if (label) label.textContent = `${_loginSelectedUser.name} — PIN giriniz`;
  
  const pinInput = document.getElementById('login-pin-input');
  if (pinInput) pinInput.value = '';
  
  const pinErr = document.getElementById('login-pin-error');
  if (pinErr) pinErr.textContent = '';

  if (pinWrap) pinWrap.style.display = 'flex';
  const list = document.getElementById('login-user-list');
  if (list) list.style.display = 'none';

  setTimeout(() => pinInput && pinInput.focus(), 80);

  if (pinInput) {
    pinInput.onkeydown = (e) => {
      if (e.key === 'Enter') loginSubmitPin();
    };
  }
}

export function loginBack() {
  const pinWrap = document.getElementById('login-pin-wrap');
  if (pinWrap) pinWrap.style.display = 'none';
  const list = document.getElementById('login-user-list');
  if (list) list.style.display = 'flex';
  _loginSelectedUser = null;
}

export function loginSubmitPin() {
  const pinInput = document.getElementById('login-pin-input');
  const pin = pinInput ? pinInput.value : '';
  if (!_loginSelectedUser) return;

  if (pin === _loginSelectedUser.pin) {
    State.currentUser = _loginSelectedUser;
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.classList.add('hidden');
    updateUserAvatar();
    if (typeof window.checkNotifications === 'function') {
      window.checkNotifications();
    }
    if (typeof window.navigate === 'function') {
      window.navigate('dashboard');
    }
  } else {
    const errEl = document.getElementById('login-pin-error');
    if (errEl) errEl.textContent = '❌ Hatalı PIN. Tekrar deneyiniz.';
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  }
}

export function updateUserAvatar() {
  const u = State.currentUser;
  const circle = document.getElementById('user-avatar-circle');
  const name = document.getElementById('user-avatar-name');
  if (!u) {
    if (circle) {
      circle.style.background = 'var(--bg-card2)';
      circle.textContent = '??';
    }
    if (name) name.textContent = 'Misafir';
    return;
  }
  if (circle) {
    circle.style.background = u.color;
    circle.textContent = u.initials;
  }
  if (name) name.textContent = u.name;
}

// Global window mappings for inline onclick execution
if (typeof window !== 'undefined') {
  window.showLoginScreen = showLoginScreen;
  window.loginSelectUser = loginSelectUser;
  window.loginBack = loginBack;
  window.loginSubmitPin = loginSubmitPin;
  window.updateUserAvatar = updateUserAvatar;
}
