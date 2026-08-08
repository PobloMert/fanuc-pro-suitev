'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'performance_data.js'), 'utf8');
function load() { const context = { window: {}, String, Number, Map, Set, Date, Object, Array, performance: { now: (() => { let value = 0; return () => ++value; })() }, setTimeout, clearTimeout }; vm.runInNewContext(source, context); return context.window.MTBPerformance; }
test('record index resolves id and legacy machine name and is reused', () => { const perf = load(); const state = { maintenances: [{ id: 1, tezgah_id: 7 }, { id: 2, machine_name: 'M-07' }], batteries: [{ id: 3, machine_id: 7 }], fans: [], backup_logs: [] }; const first = perf.buildRecordIndex(state); assert.equal(first, perf.buildRecordIndex(state)); assert.deepEqual(Array.from(first.forMachine({ id: 7, numarasi: 'M-07' }).maintenance, item => item.id), [1, 2]); assert.equal(first.forMachine({ id: 7 }).batteries.length, 1); });
test('record index refreshes after an in-place append', () => { const perf = load(); const state = { maintenances: [], batteries: [], fans: [], backup_logs: [] }; const first = perf.buildRecordIndex(state); state.maintenances.push({ id: 4, tezgah_id: 2 }); const second = perf.buildRecordIndex(state); assert.notEqual(first, second); assert.equal(second.forMachine({ id: 2 }).maintenance.length, 1); });
test('pagination clamps unsafe values and reports totals', () => { const result = load().paginate(Array.from({ length: 123 }, (_, index) => index), 99, 50); assert.equal(result.page, 3); assert.equal(result.totalPages, 3); assert.equal(result.items.length, 23); });
test('performance metrics stay local and bounded', () => { const perf = load(); for (let index = 0; index < 105; index += 1) perf.measure('render', () => index); assert.equal(perf.getMetrics().length, 100); });
