const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/js/diagnostics_engine');

test('G-code scanner reports unsafe motion and missing feed', () => {
  const findings = engine.scanGcode('G00 Z-5\nG01 X10');
  assert.ok(findings.some(item => item.title.includes('Z-')));
  assert.ok(findings.some(item => item.title.includes('İlerleme')));
});

test('gear ratio calculation returns reduced FANUC parameter values', () => {
  const result = engine.calculateGearRatio({ pitch: 10, encoder: 1000000, motorTeeth: 1, screwTeeth: 1, lci: 0.001 });
  assert.deepEqual(result, { numerator: 100, denominator: 1, commandUnits: 10000, approximated: false });
  assert.equal(engine.calculateGearRatio({ pitch: 0, encoder: 1000, motorTeeth: 1, screwTeeth: 1, lci: 0.001 }), null);
});

test('backlash helpers are deterministic and validate axis', () => {
  assert.equal(engine.calculateBacklash(0.02, 10).newValue, 30);
  assert.match(engine.generateBacklashGcode({ axis: 'Q', distance: 5, feed: 100, dwell: 1 }), /BACKLASH TEST X/);
});

test('AI cloud masking removes local identifiers', () => {
  const masked = engine.maskSensitive('10.0.0.7 C:\\secret\\x a@b.com sk-abcdefghijkl Tezgah-01 Ahmet', ['Tezgah-01'], 'Ahmet');
  assert.doesNotMatch(masked, /10\.0\.0\.7|secret|a@b\.com|sk-abcdefghijkl|Tezgah-01|Ahmet/);
});
