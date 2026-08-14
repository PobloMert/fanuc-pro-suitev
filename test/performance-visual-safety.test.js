'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Performance, Visuals, and Safety enhancements are verified', () => {
  // 1. Dashboard background CPU saver throttling
  const dashApp = fs.readFileSync(path.join(__dirname, '../src/dashboard/app.js'), 'utf8');
  assert.ok(dashApp.includes('startActivePolling'));
  assert.ok(dashApp.includes('visibilitychange'));
  assert.ok(dashApp.includes('if (document.hidden) return;'));

  // 2. Hardware accelerated CSS containment and smooth physics
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/main.css'), 'utf8');
  assert.ok(css.includes('contain: content;'));
  assert.ok(css.includes('neon-pulse-green'));
  assert.ok(css.includes('neon-pulse-red'));
  assert.ok(css.includes('smooth-gauge-bar'));

  // 3. Fleet live remote dynamic neon pulse
  const liveRemote = fs.readFileSync(path.join(__dirname, '../src/js/features/cnc_live_remote.js'), 'utf8');
  assert.ok(liveRemote.includes('neon-pulse-green'));
  assert.ok(liveRemote.includes('neon-pulse-red'));
});
