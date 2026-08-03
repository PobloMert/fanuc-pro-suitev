'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('distributed users contain no plaintext PINs', () => {
  const users = JSON.parse(read('data/users.json')).users;
  assert.ok(users.every(user => !user.pin && user.pinHash && user.pinSalt));
});

test('dashboard contains no CNC mutation endpoint calls', () => {
  const source = read('src/dashboard/app.js');
  assert.doesNotMatch(source, /\/activateprogram|\/deleteprogram/i);
});

test('Electron sandbox is not disabled by start scripts', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.doesNotMatch(pkg.scripts.start, /--no-sandbox/);
});
