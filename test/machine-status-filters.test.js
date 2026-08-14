'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Machine Workspace: 5-state summary filter counters and active highlighting are integrated', () => {
  const js = fs.readFileSync(path.join(__dirname, '../src/js/machine_workspace.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/machine-workspace.css'), 'utf8');

  // Verify renderSummary has all 5 filter buttons
  assert.ok(js.includes('data-machine-filter="all"'), 'Must have All machines filter');
  assert.ok(js.includes('data-machine-filter="ok"'), 'Must have Normal/Healthy filter');
  assert.ok(js.includes('data-machine-filter="danger"'), 'Must have Critical filter');
  assert.ok(js.includes('data-machine-filter="warn"'), 'Must have Warn/Attention filter');
  assert.ok(js.includes('data-machine-filter="backup"'), 'Must have Backup filter');

  // Verify CSS contains 5 columns and is-active styles for all statuses
  assert.ok(css.includes('grid-template-columns:repeat(5,1fr)'));
  assert.ok(css.includes('.machine-summary button.is-active'));
  assert.ok(css.includes('.machine-summary .ok.is-active'));
  assert.ok(css.includes('.machine-summary .danger.is-active'));
  assert.ok(css.includes('.machine-summary .warn.is-active'));

  // Verify applyFilters syncs the active class
  assert.ok(js.includes("btn.classList.toggle('is-active', btn.dataset.machineFilter === activeKey)"));
});
