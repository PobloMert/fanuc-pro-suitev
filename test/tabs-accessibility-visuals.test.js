'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Tabs System: Visual styling, neon accents and overflow protection are present', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/main.css'), 'utf8');

  // Verify tabs container styling
  assert.ok(css.includes('.tabs {'));
  assert.ok(css.includes('overflow-x: auto;'));
  assert.ok(css.includes('scrollbar-width: none;'));

  // Verify tab buttons styling
  assert.ok(css.includes('.tab-btn {'));
  assert.ok(css.includes('user-select: none;'));
  assert.ok(css.includes('.tab-btn:hover {'));
  assert.ok(css.includes('transform: translateY(-1.5px);'));

  // Verify active tab neon glow and underline
  assert.ok(css.includes('.tab-btn.active {'));
  assert.ok(css.includes('.tab-btn.active::after {'));
  assert.ok(css.includes('box-shadow: 0 0 8px var(--accent);'));

  // Verify tab badge counter
  assert.ok(css.includes('.tab-badge {'));
  assert.ok(css.includes('.tab-btn.active .tab-badge {'));
});

test('Tabs System: Accessibility and keyboard navigation module is exported', () => {
  const navJs = fs.readFileSync(path.join(__dirname, '../src/js/ui/navigation.js'), 'utf8');
  assert.ok(navJs.includes('export function initAccessibleTabs'));
  assert.ok(navJs.includes('ArrowRight'));
  assert.ok(navJs.includes('ArrowLeft'));
  assert.ok(navJs.includes('Home'));
  assert.ok(navJs.includes('End'));

  const appJs = fs.readFileSync(path.join(__dirname, '../src/js/app.js'), 'utf8');
  assert.ok(appJs.includes('initAccessibleTabs'));
});
