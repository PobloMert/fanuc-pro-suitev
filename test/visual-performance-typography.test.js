'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Visual, Typography, and Performance CSS/JS enhancements are verified', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/main.css'), 'utf8');

  // Verify tabular figures
  assert.ok(css.includes('font-variant-numeric: tabular-nums lining-nums;'));
  assert.ok(css.includes('"tnum" 1'));

  // Verify modal spring animation
  assert.ok(css.includes('@keyframes modalSpringIn'));
  assert.ok(css.includes('modalSpringIn'));

  // Verify button depth feedback
  assert.ok(css.includes('.btn:active'));
  assert.ok(css.includes('scale(0.97)'));
});
