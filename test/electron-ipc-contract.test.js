'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Electron IPC Contract: All preload methods map to unique main.js handlers', () => {
  const preloadContent = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
  const mainContent = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

  // Extract all ipcRenderer.invoke and ipcRenderer.send channel names from preload.js
  const channelRegex = /ipcRenderer\.(?:invoke|send)\(['"]([^'"]+)['"]/g;
  const preloadChannels = new Set();
  let match;
  while ((match = channelRegex.exec(preloadContent)) !== null) {
    preloadChannels.add(match[1]);
  }

  assert.ok(preloadChannels.size >= 25, `Expected at least 25 IPC channels in preload.js, found ${preloadChannels.size}`);

  // Extract all registered ipcMain.handle and ipcMain.on channels from main.js
  const mainHandlerRegex = /ipcMain\.(?:handle|on)\(['"]([^'"]+)['"]/g;
  const mainHandlers = new Map();
  while ((match = mainHandlerRegex.exec(mainContent)) !== null) {
    const channel = match[1];
    mainHandlers.set(channel, (mainHandlers.get(channel) || 0) + 1);
  }

  // Verify no duplicate registrations in main.js
  for (const [channel, count] of mainHandlers.entries()) {
    assert.equal(count, 1, `IPC channel '${channel}' is registered ${count} times in main.js (must be exactly 1)`);
  }

  // Verify that all preload channels have a corresponding handler in main.js
  for (const channel of preloadChannels) {
    assert.ok(mainHandlers.has(channel), `Preload invokes channel '${channel}' but no ipcMain handler was found in main.js`);
  }
});
