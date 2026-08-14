'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Keep Relays Database: Schema, address formats and bit numbering', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../data/keep_relays.json'), 'utf8');
  const data = JSON.parse(raw);

  assert.ok(Array.isArray(data.keep_relays), 'keep_relays must be an array');
  assert.ok(data.keep_relays.length >= 10, 'Must have at least 10 keep relay entries');

  const seenIds = new Set();
  const addressRegex = /^K\d{1,2}\.[0-7]$/;

  for (const kr of data.keep_relays) {
    assert.ok(kr.id, 'Keep relay id is required');
    assert.match(kr.id, addressRegex, `Keep relay id "${kr.id}" must match format Kxx.y (y between 0-7)`);
    assert.ok(!seenIds.has(kr.id), `Duplicate keep relay id: ${kr.id}`);
    seenIds.add(kr.id);

    assert.ok(kr.name && kr.name.length >= 3, `Keep relay ${kr.id} must have a valid name`);
    assert.ok(kr.description && kr.description.length >= 10, `Keep relay ${kr.id} must have a description`);
  }
});

test('PMC Signals Database: Addresses and signal types', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../data/pmc_signals.json'), 'utf8');
  const data = JSON.parse(raw);

  assert.ok(Array.isArray(data.pmc_signals), 'pmc_signals must be an array');
  assert.ok(data.pmc_signals.length >= 10, 'Must have at least 10 PMC signal entries');

  const allowedDirections = new Set([
    'Machine → PMC',
    'PMC → Machine',
    'CNC → PMC',
    'PMC → CNC',
    'İç Röle (PMC Internal)',
    'Veri Kaydı (Data Register)'
  ]);
  const addressRegex = /^[XYRFG]\d{1,4}\.[0-7]$|^D\d{1,5}$/;

  for (const sig of data.pmc_signals) {
    assert.ok(sig.address, 'Signal address is required');
    assert.match(sig.address, addressRegex, `Signal address "${sig.address}" must match valid PMC address`);
    assert.ok(sig.symbol && sig.symbol.length >= 2, `Signal ${sig.address} must have a symbol`);
    assert.ok(allowedDirections.has(sig.direction), `Invalid direction "${sig.direction}" in ${sig.address}`);
    assert.ok(sig.description && sig.description.length >= 5, `Signal ${sig.address} must have a description`);
  }
});
