'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('ChronicFailureFinder clusters frequencies, identifies correlation chains and generates action plan', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/js/modules/chronic_failure_finder.js'), 'utf8');
  assert.ok(code.includes('class ChronicFailureFinder'));

  const sandbox = {};
  vm.runInNewContext(code, { window: sandbox, globalThis: sandbox });

  assert.ok(sandbox.MTBChronicFailureFinder);
  const finder = new sandbox.MTBChronicFailureFinder();

  // Test with sample structured historical alarms
  const sampleAlarms = [
    { alarm_code: '1004', message: 'KIZAK YAĞLAMA DÜŞÜK', occurred_at: '2026-08-01T10:00:00Z', downtimeMin: 10 },
    { alarm_code: '414', message: 'SERVO ALARM: X AŞIRI YÜK', occurred_at: '2026-08-01T10:08:00Z', downtimeMin: 25 },
    { alarm_code: '1004', message: 'KIZAK YAĞLAMA DÜŞÜK', occurred_at: '2026-08-05T14:00:00Z', downtimeMin: 12 },
    { alarm_code: '414', message: 'SERVO ALARM: X AŞIRI YÜK', occurred_at: '2026-08-05T14:10:00Z', downtimeMin: 30 },
    { alarm_code: '1004', message: 'KIZAK YAĞLAMA DÜŞÜK', occurred_at: '2026-08-08T09:00:00Z', downtimeMin: 15 }
  ];

  const analysis = finder.analyzeMachineAlarms(sampleAlarms, 30);

  assert.equal(analysis.analyzedDays, 30);
  assert.ok(analysis.topAlarms.length >= 2);
  assert.equal(analysis.topAlarms[0].code, '1004');
  assert.equal(analysis.topAlarms[0].count, 3);

  // Verify chain detection (1004 -> 414 within 15 min)
  assert.ok(analysis.chains.length >= 1);
  assert.equal(analysis.chains[0].from, '1004');
  assert.equal(analysis.chains[0].to, '414');
  assert.equal(analysis.chains[0].occurrences, 2);

  // Verify diagnosis and action plan
  assert.ok(analysis.primaryRisk.includes('Yağlama'));
  assert.ok(analysis.actionPlan.length >= 3);
  assert.ok(analysis.actionPlan.some(p => p.includes('Dozajör') || p.includes('manifoldu')));
  assert.ok(analysis.totalDowntimeMin > 0);
});
