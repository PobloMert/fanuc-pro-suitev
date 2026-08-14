'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('PowerDiagnostics evaluates DC Bus voltage thresholds, regen load and troubleshooting advice', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/js/modules/power_diagnostics.js'), 'utf8');
  assert.ok(code.includes('class PowerDiagnostics'));

  const sandbox = {};
  vm.runInNewContext(code, { window: sandbox, globalThis: sandbox });

  assert.ok(sandbox.MTBPowerDiagnostics);
  const power = new sandbox.MTBPowerDiagnostics();

  // Test Optimal 300V DC
  const evalOptimal = power.evaluateDcBus(298.5);
  assert.equal(evalOptimal.status, 'OPTIMAL');
  assert.equal(evalOptimal.color, 'green');
  assert.equal(evalOptimal.isAlarm, false);

  // Test Overvoltage (>375V trip threshold)
  const evalOver = power.evaluateDcBus(395.0);
  assert.equal(evalOver.status, 'OVERVOLTAGE');
  assert.equal(evalOver.color, 'red');
  assert.equal(evalOver.isAlarm, true);
  assert.equal(evalOver.alarmCode, 'PSM 01');

  // Test Undervoltage (<255V trip threshold)
  const evalUnder = power.evaluateDcBus(240.0);
  assert.equal(evalUnder.status, 'UNDERVOLTAGE');
  assert.equal(evalUnder.color, 'red');
  assert.equal(evalUnder.isAlarm, true);
  assert.equal(evalUnder.alarmCode, 'PSM 02');

  // Test Regen Load
  const regenNormal = power.evaluateRegen(25.0);
  assert.equal(regenNormal.status, 'NORMAL');
  assert.equal(regenNormal.color, 'green');

  const regenHot = power.evaluateRegen(88.0);
  assert.equal(regenHot.status, 'OVERHEAT_RISK');
  assert.equal(regenHot.color, 'red');
  assert.equal(regenHot.alarmCode, 'PSM 03');

  // Test PSM Temp
  const tempNormal = power.evaluatePsmTemp(45.0);
  assert.equal(tempNormal.status, 'NORMAL');

  const tempHot = power.evaluatePsmTemp(85.0);
  assert.equal(tempHot.status, 'HOT');
  assert.equal(tempHot.color, 'red');

  // Test Advice
  const advice = power.getTroubleshootingAdvice(evalOver, regenHot, tempHot);
  assert.ok(advice.length >= 3);
  assert.ok(advice.some(t => t.includes('yavaşlama') || t.includes('Deceleration')));
});
