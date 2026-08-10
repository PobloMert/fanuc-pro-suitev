'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('diagnostics carry machine and incident context through tombstone records', () => {
  const source = read('src/js/features/diagnostic_history.js');
  assert.match(source, /machineId:\s*selectedMachineId/);
  assert.match(source, /incidentId/);
  assert.match(source, /archiveById/);
  for (const stage of ['Alarm history','System alarm history','FSSB alarm history','Kontrol','Bakım','Sonuç']) assert.match(source, new RegExp(stage));
});

test('notifications preserve lifecycle and deduplicate stable keys', () => {
  const source = read('src/js/services/notification_lifecycle.js');
  for (const field of ['firstSeen','lastSeen','repeatCount','acknowledged','resolved','reopened']) assert.match(source, new RegExp(field));
  assert.match(read('src/js/ui/navigation.js'), /MTBNotificationLifecycle\?\.reconcile/);
});

test('maintenance and battery completion store evidence inside synced records', () => {
  const source = read('src/js/features/lifecycle.js');
  assert.match(source, /completionEvidence: evidence/);
  assert.match(source, /backupVerified/);
  assert.match(source, /referenceObserved/);
  assert.match(source, /outcomeObserved/);
});
