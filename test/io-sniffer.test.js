'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('IOSniffer compiles, parses PMC addresses, detects bit differences and evaluates states', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/js/modules/io_sniffer.js'), 'utf8');
  assert.ok(code.includes('class IOSniffer'));

  const sandbox = {};
  vm.runInNewContext(code, { window: sandbox, globalThis: sandbox });

  assert.ok(sandbox.MTBIOSniffer);
  const sniffer = new sandbox.MTBIOSniffer();

  // Test Address Parsing
  const parsed = sniffer.parseAddress('X0008.3');
  assert.equal(parsed.type, 'X');
  assert.equal(parsed.byte, 8);
  assert.equal(parsed.bit, 3);
  assert.equal(parsed.formatted, 'X0008.3');

  const parsedG = sniffer.parseAddress('g8.4');
  assert.equal(parsedG.type, 'G');
  assert.equal(parsedG.byte, 8);
  assert.equal(parsedG.bit, 4);
  assert.equal(parsedG.formatted, 'G0008.4');

  // Test Listening and Bit Detection
  sniffer.startListening({ X4: 0b00000000 });
  const changes = sniffer.checkBytes({ X4: 0b00000100 }); // bit 2 flipped from 0 to 1

  assert.equal(changes.length, 1);
  assert.equal(changes[0].address, 'X0004.2');
  assert.equal(changes[0].from, 0);
  assert.equal(changes[0].to, 1);
  assert.equal(changes[0].direction, 'RISING');

  // Test Templates
  const presets = sniffer.getPresetTemplates();
  assert.ok(presets.standard_mill.length > 3);
  assert.ok(presets.standard_lathe.length > 3);
  assert.ok(presets.doosan_dnm.length > 3);

  // Test Signal Evaluation
  const doorSignal = {
    name: 'Ön Kapı Switchi',
    address: 'X0008.3',
    activeState: 1,
    okLabel: 'KAPALI',
    warnLabel: 'AÇIK',
    isSafety: true
  };

  const evalOk = sniffer.evaluateSignal(doorSignal, { X8: 0b00001000 });
  assert.equal(evalOk.isOk, true);
  assert.equal(evalOk.label, 'KAPALI');
  assert.equal(evalOk.color, 'green');

  const evalWarn = sniffer.evaluateSignal(doorSignal, { X8: 0b00000000 });
  assert.equal(evalWarn.isOk, false);
  assert.equal(evalWarn.label, 'AÇIK');
  assert.equal(evalWarn.color, 'red');
});
