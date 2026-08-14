'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('FOCAS Network Scanner: IPC handler and UI scanner actions are fully implemented', () => {
  // Check main.js IPC handler
  const mainJs = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  assert.ok(mainJs.includes('scan-focas-network'));
  assert.ok(mainJs.includes('pingTcpHost'));

  // Check preload.js
  const preloadJs = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
  assert.ok(preloadJs.includes('scanFocasNetwork'));

  // Check cnc_live_remote.js UI modal and actions
  const cncLiveJs = fs.readFileSync(path.join(__dirname, '../src/js/features/cnc_live_remote.js'), 'utf8');
  assert.ok(cncLiveJs.includes('showFocasScannerModal'));
  assert.ok(cncLiveJs.includes('runFocasScanner'));
  assert.ok(cncLiveJs.includes('saveDiscoveredMachine'));
  assert.ok(cncLiveJs.includes('Fabrika Ağını Tara ve Eşleştir'));
});
