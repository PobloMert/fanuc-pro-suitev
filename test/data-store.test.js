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
  assert.equal(store.purgeTelemetry(30),1);
  store.close(); fs.rmSync(root,{recursive:true,force:true});
});
