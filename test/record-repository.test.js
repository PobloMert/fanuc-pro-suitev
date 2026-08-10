'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'services', 'record_repository.js'), 'utf8');
function load() {
  const context = { window: {}, Object, Number, String, Date };
  vm.runInNewContext(source, context);
  return context.window.MTBRecordRepository;
}

test('new records keep legacy fields and add canonical metadata', () => {
  const record = load().create([{ id: 8 }], { tezgah_id: 12, aciklama: 'Bakım' }, { name: 'Ada' }, '2026-08-10T10:00:00.000Z');
  assert.equal(record.id, 9);
  assert.equal(record.tezgah_id, 12);
  assert.equal(record.machineId, 12);
  assert.equal(record.createdBy, 'Ada');
  assert.equal(record.createdAt, '2026-08-10T10:00:00.000Z');
  assert.equal(record.updatedAt, record.createdAt);
  assert.equal(record.revision, 1);
});

test('legacy records remain readable without destructive migration', () => {
  const legacy = { id: 3, machine_id: 4, tarih: '01.01.2026' };
  const result = load().read(legacy);
  assert.equal(result.machineId, 4);
  assert.equal(result.tarih, legacy.tarih);
  assert.equal(legacy.machineId, undefined);
});

test('updates preserve creation metadata and increment revision', () => {
  const result = load().update({ id: 1, tezgah_id: 2, createdAt: 'old', createdBy: 'Ada', revision: 2 }, { durum: 'Tamamlandı' }, { name: 'Lin' }, 'new');
  assert.equal(result.createdAt, 'old');
  assert.equal(result.createdBy, 'Ada');
  assert.equal(result.updatedAt, 'new');
  assert.equal(result.revision, 3);
});

test('archive creates a syncable tombstone without destroying payload', () => {
  const repository = load();
  const archived = repository.archive({ id: 7, title: 'Fan değişimi', revision: 2 }, { name: 'Ada' }, '2026-08-10T12:00:00.000Z');
  assert.equal(archived.title, 'Fan değişimi');
  assert.equal(archived.deletedAt, '2026-08-10T12:00:00.000Z');
  assert.equal(archived.deletedBy, 'Ada');
  assert.equal(archived.updatedAt, archived.deletedAt);
  assert.equal(archived.revision, 3);
  assert.deepEqual(repository.active([archived, { id: 8 }]).map(item => item.id), [8]);
});

test('restore clears deletion metadata and advances revision', () => {
  const result = load().restore({ id: 7, deletedAt: 'old', deletedBy: 'Ada', revision: 3 }, { name: 'Lin' }, 'new');
  assert.equal(result.deletedAt, undefined);
  assert.equal(result.deletedBy, undefined);
  assert.equal(result.restoredAt, 'new');
  assert.equal(result.restoredBy, 'Lin');
  assert.equal(result.revision, 4);
});

test('expired archives compact payload but retain identity and sync version', () => {
  const repository = load();
  const result = repository.compactExpired([{ id: 4, title: 'secret', deletedAt: '2026-01-01T00:00:00.000Z', revision: 5 }], 90, '2026-08-10T00:00:00.000Z');
  assert.equal(result.compacted, 1);
  assert.equal(result.records[0].id, 4);
  assert.equal(result.records[0].revision, 5);
  assert.equal(result.records[0].deletedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(result.records[0].title, undefined);
  assert.equal(result.records[0].tombstone, true);
});
