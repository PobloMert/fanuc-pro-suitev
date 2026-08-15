'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Field readiness: FOCAS driver status check and offline fallback exist', () => {
  // Check main.js handler
  const mainJs = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  assert.ok(mainJs.includes('focas-driver-status'));

  // Check preload.js API
  const preloadJs = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
  assert.ok(preloadJs.includes('checkFocasDriverStatus'));

  // Check cnc_live_remote.js UI modal
  const liveRemoteJs = fs.readFileSync(path.join(__dirname, '../src/js/features/cnc_live_remote.js'), 'utf8');
  assert.ok(liveRemoteJs.includes('showFocasDriverHealthModal'));
  assert.match(liveRemoteJs, /showModal\('focas-driver-health'/);
  assert.match(liveRemoteJs, /closeModal\('focas-driver-health'\)/);
  assert.match(liveRemoteJs, /showModal\('power-diagnostics'/);
  assert.match(liveRemoteJs, /closeModal\('power-diagnostics'\)/);
  assert.match(liveRemoteJs, /showModal\('chronic-failure'/);
  assert.match(liveRemoteJs, /closeModal\('chronic-failure'\)/);
  assert.match(liveRemoteJs, /showModal\('pmc-sniffer'/);
  assert.match(liveRemoteJs, /closeModal\('pmc-sniffer'\)/);
  assert.doesNotMatch(liveRemoteJs, /document\.getElementById\([^)]+\)\.remove\(\)/);

  // Check mtconnect_client.js offline fallback
  const mtconnectJs = fs.readFileSync(path.join(__dirname, '../src/js/modules/mtconnect_client.js'), 'utf8');
  assert.ok(mtconnectJs.includes('getOfflineFallback'));

  // Check navigation.js sidebar favorites
  const navJs = fs.readFileSync(path.join(__dirname, '../src/js/ui/navigation.js'), 'utf8');
  assert.ok(navJs.includes('sidebar-favorites'));
  assert.ok(navJs.includes('Hızlı Erişim'));
});
