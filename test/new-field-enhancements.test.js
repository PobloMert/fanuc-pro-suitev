'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Field Enhancements: Maintenance Templates, Interactive Checklist, and RS232 Continuity Tester are verified', () => {
  const lifecycleCode = fs.readFileSync(path.join(__dirname, '../src/js/features/lifecycle.js'), 'utf8');
  const alarmCode = fs.readFileSync(path.join(__dirname, '../src/js/features/alarm_parameter_screens.js'), 'utf8');
  const rs232Code = fs.readFileSync(path.join(__dirname, '../src/js/features/rs232_cables.js'), 'utf8');
  const inlineCode = fs.readFileSync(path.join(__dirname, '../src/js/inline_actions.js'), 'utf8');

  // 1. Maintenance Templates
  assert.ok(lifecycleCode.includes('applyMaintTemplate'));
  assert.ok(lifecycleCode.includes('[KIZAK YAĞLAMA]'));
  assert.ok(lifecycleCode.includes('[PİL DEĞİŞİMİ]'));
  assert.ok(lifecycleCode.includes('[PANO & FAN TEMİZLİĞİ]'));
  assert.ok(lifecycleCode.includes('Hızlı Bakım Şablonları'));

  // 2. Alarm Interactive Checklist
  assert.ok(alarmCode.includes('toggleAlarmChecklist'));
  assert.ok(alarmCode.includes('alarm-checklist-item'));
  assert.ok(alarmCode.includes('Pano Kontrol Listesi'));

  // 3. RS232 Multimeter Continuity Simulator
  assert.ok(rs232Code.includes('runRsContinuityTest'));
  assert.ok(rs232Code.includes('BUZZER ÖTMELİ'));
  assert.ok(rs232Code.includes('BUZZER ÖTMEMELİ'));

  // 4. Inline actions CSP allowlist
  assert.ok(inlineCode.includes('applyMaintTemplate'));
  assert.ok(inlineCode.includes('toggleAlarmChecklist'));
  assert.ok(inlineCode.includes('runRsContinuityTest'));
});
