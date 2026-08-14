'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('MTConnect client script compiles and exposes parser methods', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/js/modules/mtconnect_client.js'), 'utf8');
  assert.ok(code.includes('class MTConnectClient'));
  assert.ok(code.includes('PathFeedrateOverride'));
  assert.ok(code.includes('SpindleSpeedOverride'));
  assert.ok(code.includes('parseProbe'));
  assert.ok(code.includes('parseCurrent'));

  const vm = require('vm');
  const sandbox = {};
  vm.runInNewContext(code, { window: sandbox, globalThis: sandbox });

  assert.ok(sandbox.MTBMTConnectClient);
  const client = new sandbox.MTBMTConnectClient();
  assert.equal(typeof client.parseCurrent, 'function');
  assert.equal(typeof client.parseProbe, 'function');

  // Test JSON stream parser
  const mockJson = JSON.stringify({
    MTConnectStreams: {
      Streams: [
        {
          ComponentStream: {
            Events: {
              Execution: { value: 'ACTIVE' },
              Program: { value: 'O2024' },
              PartCount: { value: '42' },
              PathFeedrateOverride: { value: '120' },
              SpindleSpeedOverride: { value: '90' }
            },
            Samples: {
              SpindleLoad: { value: '45.2' },
              RotaryVelocity: { value: '3500' }
            }
          }
        }
      ]
    }
  });

  const parsed = client.parseCurrent(mockJson);
  assert.equal(parsed.execution, 'ACTIVE');
  assert.equal(parsed.program, 'O2024');
  assert.equal(parsed.partCount, 42);
  assert.equal(parsed.feedrateOverride, 120);
  assert.equal(parsed.spindleOverride, 90);
  assert.equal(parsed.spindleLoad, 45.2);
  assert.equal(parsed.spindleSpeed, 3500);

  const sample = client.toTelemetrySample(parsed, 'MAZAK-01');
  assert.equal(sample.machine, 'MAZAK-01');
  assert.equal(sample.feedrateOverride, 120);
  assert.equal(sample.spindleOverride, 90);
});
