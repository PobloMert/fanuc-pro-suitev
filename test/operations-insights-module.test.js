'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('projects and analysis screens are owned by operations insights module', () => {
  const renderer = read('src/renderer.js');
  const feature = read('src/js/features/operations_insights.js');
  const html = read('src/index.html');
  for (const name of ['renderProjects', 'renderReports', 'renderPredictive', 'renderReliability']) {
    assert.match(renderer, new RegExp(`const ${name} = .*OperationsInsights\\.${name}`));
    assert.match(feature, new RegExp(`function ${name}\\s*\\(`));
  }
  assert.doesNotMatch(renderer, /function renderProjectGrid\s*\(/);
  assert.doesNotMatch(renderer, /function renderPredictiveTable\s*\(/);
  assert.doesNotMatch(renderer, /function calculateReliabilityMetrics\s*\(/);
  assert.ok(html.indexOf('operations_insights.js') > html.indexOf('renderer.js'));
});

test('machine condition analysis stays explainable and score free', () => {
  const feature = read('src/js/features/operations_insights.js');
  assert.match(feature, /function calculateMachineHealth\s*\(/);
  assert.match(feature, /primaryReason/);
  assert.doesNotMatch(feature, /healthScore|failureRisk|riskScore/);
});
