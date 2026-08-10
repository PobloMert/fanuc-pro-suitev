'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('sync center is wired into canonical navigation and loaded', () => {
  assert.match(read('src/js/page_manifest.js'), /\['sync_center',[^\n]+MTBSyncCenter\.render/);
  assert.match(read('src/index.html'), /data-page="sync_center"/);
  assert.match(read('src/index.html'), /js\/features\/sync_center\.js/);
  assert.match(read('src/index.html'), /styles\/sync-center\.css/);
});

test('sync center normalizes current and future service status safely', () => {
  const context = { globalThis: {}, window: undefined };
  vm.runInNewContext(read('src/js/features/sync_center.js'), context);
  const value = context.globalThis.MTBSyncCenter.normalizeStatus({ lastSyncTime: '2026-08-10T10:00:00Z', stats: { sent: 4, received: 3, merged: 2, conflicts: 1 } });
  assert.equal(value.lastPush, '2026-08-10T10:00:00Z');
  assert.equal(value.lastPull, '2026-08-10T10:00:00Z');
  assert.equal(value.sent, 4);
  assert.equal(value.conflicts, 1);
  assert.deepEqual(Array.from(value.devices), []);
});

test('unsupported server capabilities are explicit and never fake success', () => {
  const feature = read('src/js/features/sync_center.js');
  assert.match(feature, /Sunucu\/protokol desteği bekleniyor/);
  assert.match(feature, /typeof engine\?\.resolveConflict === 'function'/);
  assert.match(feature, /resolveConflict\(\{ conflictId: button\.dataset\.conflictId, strategy: button\.dataset\.resolve \}\)/);
  assert.match(feature, /typeof engine\?\.setSyncScope === 'function'/);
  assert.doesNotMatch(feature, /return\s+\{\s*ok:\s*true/);
});

test('sync center requires an administrator', () => {
  assert.match(read('src/js/features/sync_center.js'), /currentUser\?\.role !== 'admin'/);
  assert.match(read('src/js/features/sync_center.js'), /Yönetici yetkisi gerekli/);
});

test('Drive secret management is write-only and uses the privileged bridge', () => {
  const feature = read('src/js/features/sync_center.js');
  assert.match(feature, /electronAPI\?\.getDriveSecretStatus/);
  assert.match(feature, /electronAPI\.setDriveSecret\(value\)/);
  assert.match(feature, /electronAPI\.setDriveSecret\(''\)/);
  assert.match(feature, /type="password"/);
  assert.match(feature, /autocomplete="new-password"/);
  assert.match(feature, /Yapılandırıldı ••••••••/);
  assert.match(feature, /secretInput\.value = ''/);
  assert.doesNotMatch(feature, /result\.(secret|token|value)/);
});
