'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('renderer crash opens an in-app recovery screen', () => {
  assert.match(read('main.js'), /render-process-gone[\s\S]*query:\s*\{ recovery: 'renderer'/);
  assert.match(read('src/index.html'), /id="recovery-overlay"/);
  assert.match(read('src/js/recovery.js'), /Güvenli şekilde yeniden yükle|recovery-reload/);
});

test('local performance diagnostics are admin-only and never transmit metrics', () => {
  const feature = read('src/js/features/performance_diagnostics.js');
  assert.match(feature, /currentUser\?\.role !== 'admin'/);
  assert.match(feature, /MTBPerformance\?\.getMetrics/);
  assert.doesNotMatch(feature, /fetch\(|XMLHttpRequest|electronAPI/);
  assert.match(read('src/index.html'), /data-page="performance_diagnostics"/);
  assert.match(feature, /P95 süre/);
  assert.match(feature, /pmc_signals/);
});

test('large engineering tables use bounded pagination', () => {
  const screens = read('src/js/features/alarm_parameter_screens.js');
  const lifecycle = read('src/js/features/lifecycle.js');
  const library = read('src/js/features/nc_pmc_library.js');
  assert.match(screens, /pagerModel\?\.\(alarms[\s\S]*75/);
  assert.match(screens, /pagerModel\?\.\(params[\s\S]*75/);
  assert.match(lifecycle, /pagerModel\?\.\(sorted[\s\S]*50/);
  assert.match(library, /pagerModel\?\.\(signals[\s\S]*75/);
});
