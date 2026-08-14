'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DataStore } = require('../lib/data-store');

test('JSON documents migrate to SQLite and remain mirrored', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fanuc-store-'));
  const jsonDir = path.join(root, 'data');
  fs.mkdirSync(jsonDir);
  fs.writeFileSync(path.join(jsonDir, 'machines.json'), '{"machines":[]}');
  const store = new DataStore(path.join(root, 'app.db'), jsonDir);
  store.migrateJsonDirectory();
  assert.equal(store.readDocument('machines.json'), '{"machines":[]}');
  store.writeDocument('machines.json', '{"machines":[{"id":1}]}');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(jsonDir, 'machines.json'))).machines, [{ id: 1 }]);
  assert.equal(store.status().documents, 1);
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('invalid JSON is rejected before persistence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fanuc-store-'));
  const jsonDir = path.join(root, 'data');
  fs.mkdirSync(jsonDir);
  const store = new DataStore(path.join(root, 'app.db'), jsonDir);
  assert.throws(() => store.writeDocument('bad.json', '{'));
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('telemetry history, summaries and retention work', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fanuc-telemetry-'));
  const jsonDir = path.join(root, 'data'); fs.mkdirSync(jsonDir);
  const store = new DataStore(path.join(root, 'app.db'), jsonDir);
  store.insertTelemetry({ machine:'Fanuc', sampledAt:new Date().toISOString(), execution:'ACTIVE', program:'O1001', partCount:4, spindleLoad:25, quality:'good' });
  store.insertTelemetry({ machine:'Fanuc', sampledAt:'2000-01-01T00:00:00.000Z', execution:'READY', quality:'stale' });
  assert.equal(store.queryTelemetry('Fanuc','1999-01-01T00:00:00.000Z').length,2);
  assert.equal(store.telemetrySummary('1999-01-01T00:00:00.000Z')[0].samples,2);
  const statsBefore = store.getDatabaseStats();
  assert.equal(statsBefore.totalSamples, 2);
  assert.equal(store.purgeTelemetry(30), 1);
  const statsAfter = store.getDatabaseStats();
  assert.equal(statsAfter.totalSamples, 1);
  assert.ok(statsAfter.sizeBytes > 0);
  store.close(); fs.rmSync(root,{recursive:true,force:true});
});

test('SQLite backups can exclude identity documents and records', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fanuc-backup-'));
  const jsonDir = path.join(root, 'data'); fs.mkdirSync(jsonDir);
  fs.writeFileSync(path.join(jsonDir, 'users.json'), '{"users":[{"id":1,"pinHash":"secret"}]}');
  fs.writeFileSync(path.join(jsonDir, 'machines.json'), '{"machines":[{"id":1}]}');
  const store = new DataStore(path.join(root, 'app.db'), jsonDir);
  store.migrateJsonDirectory();
  const backupPath = path.join(root, 'backup.db');
  store.backupTo(backupPath, { excludeIdentity: true });
  const backup = new DataStore(backupPath, path.join(root, 'backup-json'));
  assert.equal(backup.readDocument('users.json'), null);
  assert.deepEqual(backup.listRecords('users'), []);
  backup.close(); store.close(); fs.rmSync(root, { recursive: true, force: true });
});

test('sync queue enqueues, lists, dequeues and delta queries work', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fanuc-sync-'));
  const jsonDir = path.join(root, 'data'); fs.mkdirSync(jsonDir);
  const store = new DataStore(path.join(root, 'app.db'), jsonDir);

  store.upsertRecord('machines', 101, { id: 101, numarasi: 'CNC-01', ip: '192.168.1.100' });
  const pending = store.getPendingSyncQueue();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].collection, 'machines');
  assert.equal(pending[0].record_id, '101');
  assert.equal(pending[0].action, 'upsert');

  const delta = store.getDeltaRecords('2000-01-01T00:00:00.000Z');
  assert.equal(delta.length, 1);
  assert.equal(delta[0].id, '101');

  const cleared = store.dequeueSync([pending[0].id]);
  assert.equal(cleared, 1);
  assert.equal(store.getPendingSyncQueue().length, 0);

  store.close(); fs.rmSync(root, { recursive: true, force: true });
});

test('telemetry persists feedrate and spindle override metrics', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fanuc-override-'));
  const jsonDir = path.join(root, 'data'); fs.mkdirSync(jsonDir);
  const store = new DataStore(path.join(root, 'app.db'), jsonDir);

  store.insertTelemetry({
    machine: 'CNC-01',
    sampledAt: new Date().toISOString(),
    execution: 'ACTIVE',
    program: 'O1234',
    partCount: 12,
    spindleLoad: 35.5,
    feedrateOverride: 80,
    spindleOverride: 110,
    quality: 'good'
  });

  const samples = store.queryTelemetry('CNC-01', '2000-01-01T00:00:00.000Z');
  assert.equal(samples.length, 1);
  assert.equal(samples[0].feedrate_override, 80);
  assert.equal(samples[0].spindle_override, 110);

  store.close(); fs.rmSync(root, { recursive: true, force: true });
});

