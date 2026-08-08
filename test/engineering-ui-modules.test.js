'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const renderer = read('src/renderer.js');
const index = read('src/index.html');
const keepMacro = read('src/js/features/keep_macro.js');
const drive = read('src/js/features/drive_diagnostics.js');
const io = read('src/js/features/io_link.js');

test('engineering screens load before renderer and renderer only delegates them', () => {
  for (const file of ['keep_macro.js', 'drive_diagnostics.js', 'io_link.js']) {
    assert.ok(index.indexOf(`js/features/${file}`) < index.indexOf('renderer.js'));
  }
  assert.match(renderer, /MTBKeepMacroFeature\.initialize/);
  assert.match(renderer, /MTBDriveDiagnosticsFeature\.initialize/);
  assert.match(renderer, /MTBIOLinkFeature\.initialize/);
  assert.doesNotMatch(renderer, /window\.evaluateMacro\s*=/);
  assert.doesNotMatch(renderer, /window\.runDriveDiagnosis\s*=/);
  assert.doesNotMatch(renderer, /window\.showIoSlotMapping\s*=/);
});

test('Keep Relay and Macro module preserves its inline action contract', () => {
  for (const action of ['showEditKeepRelayModal', 'saveKeepRelayNote', 'showNewKeepRelayModal',
    'createNewKeepRelay', 'evaluateMacro']) {
    assert.match(keepMacro, new RegExp(`window\\.${action}\\s*=`));
  }
  assert.match(keepMacro, /evaluateSafeMathExpression/);
});

test('Drive and I/O modules preserve tab and interaction contracts', () => {
  assert.match(drive, /window\.CurrentDriveTab/);
  assert.match(drive, /window\.switchDriveTab\s*=/);
  assert.match(drive, /window\.runDriveDiagnosis\s*=/);
  assert.match(io, /window\.CurrentIOTab/);
  assert.match(io, /window\.switchIOTab\s*=/);
  assert.match(io, /window\.showIoSlotMapping\s*=/);
});
