'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('data persistence and report exports are loaded as dedicated modules', () => {
  const html = read('src/index.html');
  assert.match(html, /js\/services\/data_persistence\.js/);
  assert.match(html, /js\/features\/report_exports\.js/);
  assert.ok(html.indexOf('data_persistence.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('report_exports.js') > html.indexOf('renderer.js'));
});

test('renderer delegates storage and export actions', () => {
  const renderer = read('src/renderer.js');
  const persistence = read('src/js/services/data_persistence.js');
  const reports = read('src/js/features/report_exports.js');
  assert.match(renderer, /window\.DataPersistence\.saveMachines/);
  assert.match(persistence, /async function saveJSONDatabase/);
  assert.match(reports, /window\.exportMaintenanceCSV/);
  assert.match(reports, /window\.exportAlarmsCSV/);
  assert.match(reports, /window\.printMaintenanceReport/);
  assert.match(reports, /window\.printMachineCard/);
  assert.doesNotMatch(renderer, /window\.printMaintenanceReport\s*=\s*async/);
});
