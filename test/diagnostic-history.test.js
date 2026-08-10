'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('diagnostic history is a canonical independently loaded page', () => {
  assert.match(read('src/js/page_manifest.js'), /diagnostic_history.*MTBDiagnosticHistory\.render/);
  const html = read('src/index.html');
  assert.match(html, /data-page="diagnostic_history"/);
  assert.match(html, /js\/features\/diagnostic_history\.js/);
});

test('diagnostic history covers cautious manual summaries and safe symptom flows', () => {
  const source = read('src/js/features/diagnostic_history.js');
  for (const text of ['System Configuration', 'Alarm history', 'System alarm history', 'Operation history', 'FSSB current', 'Fan Monitor', 'Leakage Detection Monitor', 'CNC açılmıyor', 'Manuel hareket yok', 'Referansa dönemiyor', 'Servo ready oluşmuyor', 'Spindle dönmüyor', 'I/O Link sorunu', 'B-64605EN/01']) assert.ok(source.includes(text), text);
  assert.match(source, /Canlı veri yok/);
  assert.match(source, /bypass etmeyin/);
  assert.doesNotMatch(source, /setParameter|writeParameter|sendCommand/);
});

test('history is filtered, paginated, exportable and Drive synchronized', () => {
  const source = read('src/js/features/diagnostic_history.js');
  assert.match(source, /State\?\.diagnostic_history/);
  assert.match(source, /saveDiagnosticHistory/);
  assert.match(source, /MTBRecordRepository\.create/);
  assert.match(source, /archiveById/);
  assert.match(source, /MTBHistoryGrowth/);
  assert.match(source, /data-dh-from/);
  assert.match(source, /data-dh-page/);
  assert.match(source, /exportYear/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-selected/);
  assert.match(source, /role="status"/);
});

test('diagnostic history is loaded, backed up and allowed by both sync peers', () => {
  assert.match(read('src/js/data_loader.js'), /diagnostic_history\.json/);
  assert.match(read('src/js/services/data_persistence.js'), /saveDiagnosticHistory/);
  assert.match(read('src/js/services/google_drive_sync.js'), /diagnostic_history:\s*\['diagnostic_history\.json'/);
  assert.match(read('google-apps-script/Code.gs'), /'diagnostic_history'/);
  assert.match(read('main.js'), /'diagnostic_history\.json'/);
});
