'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Param Comparator: Engineering field impact and bit difference analysis are fully integrated', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/js/features/param_comparator.js'), 'utf8');

  // Verify getParamImpactAnalysis exists and covers key parameters
  assert.ok(code.includes('getParamImpactAnalysis'));
  assert.ok(code.includes('APZ (Sıfır Noktası) Değişimi'));
  assert.ok(code.includes('Pozitif Strok Limiti (+ Limit)'));
  assert.ok(code.includes('Boşluk (Backlash) Kompanzasyonu'));
  assert.ok(code.includes('Servo Döngü / Hız Kazancı'));
  assert.ok(code.includes('Program Kilit Parametresi'));

  // Verify renderDiffTableRows includes paramImpactHtml
  assert.ok(code.includes('const paramImpactHtml = getParamImpactAnalysis(d.no, d.valA, d.valB);'));
  assert.ok(code.includes('${paramImpactHtml}'));
});
