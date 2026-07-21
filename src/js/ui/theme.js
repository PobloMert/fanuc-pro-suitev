/**
 * MTB Elektrik Bakım — Theme Switcher
 */

import { State } from '../state.js';

export function applyTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-retro');
  if (theme === 'light') document.body.classList.add('theme-light');
  else if (theme === 'retro') document.body.classList.add('theme-retro');
  State.settings.theme = theme;
}

if (typeof window !== 'undefined') {
  window.applyTheme = applyTheme;
}
