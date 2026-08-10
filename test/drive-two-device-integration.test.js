const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/js/services/google_drive_sync.js'), 'utf8');
const names = ['machines','maintenances','batteries','fans','backup_logs','custom_alarms','custom_mcodes','keep_relays','wiki','diagnostic_history'];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function emptyCollections() { return Object.fromEntries(names.map(name => [name, []])); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function checksum(collections) {
  const bytes = new TextEncoder().encode(stable(collections));
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function newer(left, right) {
  const lr = Number(left?.revision) || 0, rr = Number(right?.revision) || 0;
  if (lr !== rr) return rr > lr ? right : left;
  const lt = Date.parse(left?.updatedAt || left?.createdAt || '') || 0;
  const rt = Date.parse(right?.updatedAt || right?.createdAt || '') || 0;
  return rt > lt ? right : left;
}

function createServer() {
  const state = { online: true, corruptNextGet: false, collections: emptyCollections(), devices: [], conflicts: [] };
  return {
    state,
    async request(action, options = {}) {
      if (!state.online) throw new Error('network unavailable');
      if (action === 'capabilities') return { ok: true, status: 200, data: JSON.stringify({ capabilities: { delta: true, retention: true, authenticated: true } }) };
      if (action === 'get') {
        if (state.corruptNextGet) {
          state.corruptNextGet = false;
          return { ok: true, status: 200, data: JSON.stringify({ schemaVersion: 3, collections: state.collections, checksum: '0'.repeat(64) }) };
        }
        return { ok: true, status: 200, data: JSON.stringify({ schemaVersion: 3, collections: clone(state.collections), devices: clone(state.devices), conflicts: clone(state.conflicts), checksum: await checksum(state.collections) }) };
      }
      const incoming = JSON.parse(options.body);
      for (const [name, records] of Object.entries(incoming.collections || {})) {
        const map = new Map((state.collections[name] || []).map(record => [String(record.id), record]));
        for (const record of records) {
          const key = String(record.id), current = map.get(key);
          if (!current) map.set(key, clone(record));
          else if (stable(current) !== stable(record)) {
            const sameRevision = (Number(current.revision) || 0) === (Number(record.revision) || 0);
            const sameTime = (Date.parse(current.updatedAt || '') || 0) === (Date.parse(record.updatedAt || '') || 0);
            if (sameRevision && sameTime) state.conflicts.push({ id: `${name}:${key}`, collection: name, recordId: key, local: clone(current), remote: clone(record) });
            map.set(key, clone(newer(current, record)));
          }
        }
        state.collections[name] = [...map.values()];
      }
      for (const device of incoming.devices || []) state.devices = [...state.devices.filter(item => item.id !== device.id), clone(device)];
      return { ok: true, status: 200, data: JSON.stringify({ ok: true }) };
    }
  };
}

function createDevice(server, id) {
  const storage = new Map([['mtb-drive-device-id', id]]);
  const State = Object.assign(emptyCollections(), { settings: {} });
  const persisted = [];
  const context = {
    crypto: webcrypto, TextEncoder, setInterval, clearInterval,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    electronAPI: { driveSyncRequest: (...args) => server.request(...args) },
    DataPersistence: { saveJSONDatabase: async (file, wrapper, records) => { persisted.push({ file, wrapper, records: clone(records) }); return true; } }
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { State, storage, persisted, sync: context.MTBCloudSync.initCloudSync({ State }) };
}

test('two devices synchronize diagnostic records, edits and tombstone deletion', async () => {
  const server = createServer(), a = createDevice(server, 'device-a'), b = createDevice(server, 'device-b');
  a.State.diagnostic_history.push({ id: 'diag-1', code: 'SV0401', note: 'first', revision: 1, updatedAt: '2026-08-10T10:00:00.000Z' });
  assert.equal((await a.sync.syncNow(true)).ok, true);
  assert.equal((await b.sync.syncNow(true)).ok, true);
  assert.equal(b.State.diagnostic_history[0].note, 'first');

  b.State.diagnostic_history[0] = { ...b.State.diagnostic_history[0], note: 'edited', revision: 2, updatedAt: '2026-08-10T10:10:00.000Z' };
  await b.sync.syncNow(true);
  await a.sync.syncNow(true);
  assert.equal(a.State.diagnostic_history[0].note, 'edited');

  a.State.diagnostic_history[0] = { ...a.State.diagnostic_history[0], deletedAt: '2026-08-10T10:20:00.000Z', revision: 3, updatedAt: '2026-08-10T10:20:00.000Z' };
  await a.sync.syncNow(true);
  await b.sync.syncNow(true);
  assert.equal(b.State.diagnostic_history[0].deletedAt, '2026-08-10T10:20:00.000Z');
});

test('same revision conflict is surfaced for review', async () => {
  const server = createServer(), a = createDevice(server, 'device-a'), b = createDevice(server, 'device-b');
  const base = { id: 'm-1', revision: 1, updatedAt: '2026-08-10T11:00:00.000Z' };
  a.State.maintenances = [{ ...base, description: 'local A' }];
  b.State.maintenances = [{ ...base, description: 'local B' }];
  await a.sync.syncNow(true);
  await b.sync.syncNow(true);
  await a.sync.syncNow(true);
  assert.ok(server.state.conflicts.some(item => item.collection === 'maintenances' && item.recordId === 'm-1'));
  assert.ok(a.sync.getSyncStatus().counts.conflicts >= 1);
});

test('offline payload remains queued and is transmitted after reconnect', async () => {
  const server = createServer(), a = createDevice(server, 'device-a');
  a.State.fans = [{ id: 'fan-1', revision: 1, updatedAt: '2026-08-10T12:00:00.000Z' }];
  server.state.online = false;
  const failed = await a.sync.syncNow(true);
  assert.equal(failed.ok, false);
  const queue = JSON.parse(a.storage.get('mtb-drive-sync-queue-v1'));
  assert.equal(queue.length, 1);
  queue[0].nextAttemptAt = '2000-01-01T00:00:00.000Z';
  a.storage.set('mtb-drive-sync-queue-v1', JSON.stringify(queue));
  server.state.online = true;
  assert.equal((await a.sync.syncNow(true)).ok, true);
  assert.equal(server.state.collections.fans[0].id, 'fan-1');
  assert.equal(JSON.parse(a.storage.get('mtb-drive-sync-queue-v1')).length, 0);
});

test('corrupt remote bundle is rejected without overwriting local data', async () => {
  const server = createServer(), a = createDevice(server, 'device-a');
  a.State.machines = [{ id: 'local-machine', revision: 1, updatedAt: '2026-08-10T13:00:00.000Z' }];
  server.state.collections.machines = [{ id: 'remote-machine', revision: 1, updatedAt: '2026-08-10T13:01:00.000Z' }];
  server.state.corruptNextGet = true;
  const result = await a.sync.syncNow(true);
  assert.equal(result.ok, false);
  assert.deepEqual(a.State.machines.map(item => item.id), ['local-machine']);
  assert.equal(a.persisted.length, 0);
});

test('HTTP-200 service error payload is treated as a failed synchronization', async () => {
  const server = createServer();
  server.request = async () => ({ ok: true, status: 200, data: JSON.stringify({ ok: false, error: 'server-validation-failed' }) });
  const device = createDevice(server, 'device-a');
  const result = await device.sync.syncNow(true);
  assert.equal(result.ok, false);
  assert.match(result.error, /server-validation-failed/);
});

test('client and Apps Script share the complete schema-v3 collection allowlist', () => {
  const serverSource = fs.readFileSync(path.join(root, 'google-apps-script/Code.gs'), 'utf8');
  for (const name of names) {
    assert.match(source, new RegExp(`${name}:`));
    assert.match(serverSource, new RegExp(`['\"]${name}['\"]`));
  }
  assert.match(serverSource, /schemaVersion:\s*3/);
  assert.match(serverSource, /Number\(bundle\.schemaVersion\)\s*>=\s*3/);
  assert.match(serverSource, /schemaVersion\s*>\s*3/);
});

test('Apps Script keeps schema-v1/v2 packages readable and defaults newly added collections', () => {
  const serverSource = fs.readFileSync(path.join(root, 'google-apps-script/Code.gs'), 'utf8');
  const context = {
    Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    Utilities: {
      Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'SHA-256' },
      computeDigest: (_algorithm, value) => [...require('node:crypto').createHash('sha256').update(value).digest()].map(byte => byte > 127 ? byte - 256 : byte)
    }
  };
  vm.runInNewContext(serverSource, context);
  const legacy = { schemaVersion: 2, collections: { machines: [{ id: 'legacy-machine' }] } };
  assert.doesNotThrow(() => context.validate_(legacy));
  const base = context.emptyBundle_();
  context.mergeCollections_(base.collections, legacy.collections, []);
  assert.equal(base.collections.machines[0].id, 'legacy-machine');
  assert.deepEqual(JSON.parse(JSON.stringify(base.collections.diagnostic_history)), []);
});
