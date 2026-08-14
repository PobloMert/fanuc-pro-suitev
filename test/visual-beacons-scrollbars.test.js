'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Visual System: Breathing LED beacons, table neon edge, and cyber scrollbars are integrated', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/main.css'), 'utf8');

  // 1. Breathing LED beacon animations
  assert.ok(css.includes('@keyframes beaconPulseGreen'));
  assert.ok(css.includes('@keyframes beaconPulseRed'));
  assert.ok(css.includes('@keyframes beaconPulseAmber'));
  assert.ok(css.includes('@keyframes beaconPulseAccent'));
  assert.ok(css.includes('.machine-state i'));
  assert.ok(css.includes('.machine-state.danger i'));
  assert.ok(css.includes('.adapter-status-dot.running'));

  // 2. Custom slim cyber scrollbars
  assert.ok(css.includes('::-webkit-scrollbar'));
  assert.ok(css.includes('::-webkit-scrollbar-thumb:hover'));
  assert.ok(css.includes('scrollbar-width: thin;'));

  // 3. Table hover neon left edge selection
  assert.ok(css.includes('.data-table tbody tr:hover td:first-child'));
  assert.ok(css.includes('box-shadow: inset 4px 0 0 var(--accent);'));
});
