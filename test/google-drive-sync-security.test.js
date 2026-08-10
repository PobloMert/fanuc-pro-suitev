const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/js/services/google_drive_sync.js'), 'utf8');

function loadService() {
  const storage = new Map();
  const context = {
    crypto: webcrypto,
    TextEncoder,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    setInterval,
    clearInterval
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.MTBCloudSync;
}

test('Drive bundle validation rejects unknown collections', async () => {
  const service = loadService();
  await assert.rejects(
    service.validateBundle({ schemaVersion: 2, collections: { machines: [], users: [{ pinHash: 'secret' }] } }),
    /izin verilmeyen koleksiyon/
  );
});

test('Drive schema v3 requires and verifies checksum before apply', async () => {
  const service = loadService();
  await assert.rejects(
    service.validateBundle({ schemaVersion: 3, checksum: '0'.repeat(64), collections: { machines: [] } }),
    /bütünlük doğrulamasından geçemedi/
  );
  await assert.rejects(
    service.validateBundle({ schemaVersion: 3, collections: { machines: [] } }),
    /checksum değeri eksik/
  );
});

test('delta contains only collections changed since successful snapshot', () => {
  const service = loadService();
  const previous = { machines: [{ id: 'm1' }], fans: [] };
  const current = { machines: [{ id: 'm1' }], fans: [{ id: 'f1' }] };
  const delta = service.makeDelta(current, previous);
  assert.equal(Object.prototype.hasOwnProperty.call(delta, 'machines'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(delta.fans)), [{ id: 'f1' }]);
});

test('two device merge propagates additions, tombstones and later restores', () => {
  const service = loadService();
  const deviceA = [
    { id: 'maint-a', description: 'A kaydı', revision: 1, updatedAt: '2026-08-10T10:00:00.000Z' }
  ];
  const deviceB = [
    { id: 'maint-b', description: 'B kaydı', revision: 1, updatedAt: '2026-08-10T10:01:00.000Z' }
  ];
  const union = service.mergeRecords(deviceA, deviceB, 'maintenances');
  assert.deepEqual(JSON.parse(JSON.stringify(union.map(item => item.id).sort())), ['maint-a', 'maint-b']);

  const deletedOnA = [{ ...deviceA[0], deletedAt: '2026-08-10T11:00:00.000Z', revision: 2, updatedAt: '2026-08-10T11:00:00.000Z' }];
  const deletionMerged = service.mergeRecords(union, deletedOnA, 'maintenances');
  assert.equal(deletionMerged.find(item => item.id === 'maint-a').deletedAt, '2026-08-10T11:00:00.000Z');
  assert.equal(deletionMerged.find(item => item.id === 'maint-a').revision, 2);

  const restoredOnB = [{ ...deviceA[0], deletedAt: null, restoredAt: '2026-08-10T12:00:00.000Z', revision: 3, updatedAt: '2026-08-10T12:00:00.000Z' }];
  const restoreMerged = service.mergeRecords(deletionMerged, restoredOnB, 'maintenances');
  assert.equal(restoreMerged.find(item => item.id === 'maint-a').deletedAt, null);
  assert.equal(restoreMerged.find(item => item.id === 'maint-a').revision, 3);
});

test('Drive access token remains main-process-only and encrypted', () => {
  const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.match(main, /writeEncryptedSecret\('driveAccessToken'/);
  assert.match(main, /decryptSecret\('driveAccessToken'/);
  assert.match(main, /Authorization = `Bearer \$\{token\}`/);
  assert.doesNotMatch(source, /driveAccessToken|Authorization|X-Device-Key/);
  assert.doesNotMatch(preload, /driveAccessToken/);
});

test('Drive protocol advertises explicit fallback and retention request', () => {
  assert.match(source, /legacy-full/);
  assert.match(source, /status\.capabilities\.delta/);
  assert.match(source, /retentionRequest: \{ dailyCopies: 7, weeklyCopies: 4 \}/);
  assert.match(source, /QUEUE_KEY/);
  assert.match(source, /2 \*\* Math\.min/);
});

test('Apps Script endpoint enforces a device key and server-side retention', () => {
  const server = fs.readFileSync(path.join(root, 'google-apps-script/Code.gs'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.match(server, /FANUC_DRIVE_TOKEN/);
  assert.match(server, /authorized_\(e\)/);
  assert.match(server, /sha256_\(stable_\(bundle\.collections\)\)/);
  assert.match(server, /retain_\(folder, 'FANUC_SYNC_DAILY_', 7\)/);
  assert.match(server, /retain_\(folder, 'FANUC_SYNC_WEEKLY_', 4\)/);
  assert.match(server, /deletedAt|revision/);
  assert.match(main, /endpoint\.searchParams\.set\('deviceKey', token\)/);
});
