'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Fleet live remote contains dual-mode view switcher, andon filters and interactive actions', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/js/features/cnc_live_remote.js'), 'utf8');

  // Verify functions exist
  assert.ok(code.includes('window.switchCncLiveMode'));
  assert.ok(code.includes('window.filterFleetGrid'));
  assert.ok(code.includes('window.selectFleetMachineCard'));
  assert.ok(code.includes('window.toggleFleetAndonFullscreen'));

  // Verify andon matrix and dual mode UI rendering
  assert.ok(code.includes('Fabrika Kuşbakışı (Andon)'));
  assert.ok(code.includes('Tekil Tezgâh Detayı'));
  assert.ok(code.includes('fleet-machine-card'));
  assert.ok(code.includes('Andon TV Modu'));

  // Verify status states and ground reality checks
  assert.ok(code.includes('IP TANIMLANMAMIŞ'));
  assert.ok(code.includes('ÇEVRİMDIŞI'));
});
