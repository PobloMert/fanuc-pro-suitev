'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Alarm database improvements: fast category filter pills and drive LED guidance exist', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/js/features/alarm_parameter_screens.js'), 'utf8');

  // Verify filter pills and handler
  assert.ok(code.includes('setAlarmCategoryFilter'));
  assert.ok(code.includes('window.setAlarmCategoryFilter'));
  assert.ok(code.includes('🔴 Servo (400+)'));
  assert.ok(code.includes('🌀 Spindle (700+)'));

  // Verify matchedDriveAlarm and 7-segment LED guidance
  assert.ok(code.includes('matchedDriveAlarm'));
  assert.ok(code.includes('Sürücü Üzerindeki 7-Segment LED / Teşhis Kodu'));

  // Check inline_actions.js allowlist
  const inlineJs = fs.readFileSync(path.join(__dirname, '../src/js/inline_actions.js'), 'utf8');
  assert.ok(inlineJs.includes('setAlarmCategoryFilter'));

  // Check dashboard app.js instant switch caching
  const appJs = fs.readFileSync(path.join(__dirname, '../src/dashboard/app.js'), 'utf8');
  assert.ok(appJs.includes('lastXmlDoc'));
  assert.ok(appJs.includes('updateDetailsPanel(lastXmlDoc)'));
});
