'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src', 'js', 'features', 'lifecycle.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

test('maintenance, battery and fan implementation lives in lifecycle feature module', () => {
  assert.match(index, /js\/features\/lifecycle\.js[\s\S]*renderer\.js/);
  assert.match(renderer, /MTBLifecycleFeature\.initialize/);
  assert.doesNotMatch(renderer, /window\.createNewBattery\s*=/);
  assert.doesNotMatch(renderer, /window\.createNewFan\s*=/);
  assert.doesNotMatch(renderer, /window\.createNewMaint\s*=/);
  assert.match(lifecycle, /window\.createNewBattery\s*=/);
  assert.match(lifecycle, /window\.createNewFan\s*=/);
  assert.match(lifecycle, /window\.createNewMaint\s*=/);
});

test('battery and fan views accept and clear machine context together', () => {
  assert.match(lifecycle, /extraData\?\.machineId/);
  assert.match(lifecycle, /extraData\?\.tab === 'fan'/);
  assert.match(lifecycle, /#batt-mach-filter/);
  assert.match(lifecycle, /#fan-mach-filter/);
  assert.match(lifecycle, /lifecycle-clear-machine-context/);
  assert.match(lifecycle, /filterBatteries\(page\);[\s\S]*filterFans\(page\);/);
});

test('inline lifecycle actions remain available on window', () => {
  for (const action of ['showNewMaintModal', 'createNewMaint', 'deleteMaint', 'switchBatteryTab',
    'showNewBattModal', 'createNewBattery', 'resetBatteryLife', 'deleteBattery',
    'showNewFanModal', 'createNewFan', 'resetFanHours', 'deleteFan']) {
    assert.match(lifecycle, new RegExp(`window\\.${action}\\s*=`));
  }
});
