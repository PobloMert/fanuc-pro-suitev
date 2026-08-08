'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const rs232 = fs.readFileSync(path.join(root, 'src', 'js', 'features', 'rs232.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

test('RS232 screen implementation is owned by its feature module', () => {
  assert.match(index, /js\/features\/rs232\.js[\s\S]*renderer\.js/);
  assert.match(renderer, /MTBRS232Feature\.initialize/);
  assert.doesNotMatch(renderer, /window\.startDncTransmission\s*=/);
  assert.doesNotMatch(renderer, /window\.stopDncTransmission\s*=/);
  assert.match(rs232, /function renderRS232\(\)/);
});

test('RS232 inline actions remain globally available', () => {
  assert.match(rs232, /window\.startDncTransmission\s*=/);
  assert.match(rs232, /window\.stopDncTransmission\s*=/);
  assert.match(rs232, /DncInterval/);
});

test('DNC interaction is explicitly a read-only simulation', () => {
  assert.match(rs232, /salt okunur bir aktarım simülasyonu/);
  assert.match(rs232, /Simülasyonu Başlat/);
  assert.match(rs232, /CNC'ye veri gönderilmedi/);
  assert.doesNotMatch(rs232, /electronAPI\.(?:writeCnc|sendCnc|connectSerial)/);
});
