'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('DataStore SQLite WAL and high-performance pragmas are configured', () => {
  const code = fs.readFileSync(path.join(__dirname, '../lib/data-store.js'), 'utf8');

  // Verify WAL and performance pragmas
  assert.ok(code.includes('PRAGMA journal_mode=WAL;'));
  assert.ok(code.includes('PRAGMA synchronous=NORMAL;'));
  assert.ok(code.includes('PRAGMA cache_size=-64000;'));
  assert.ok(code.includes('PRAGMA temp_store=MEMORY;'));
  assert.ok(code.includes('PRAGMA mmap_size=268435456;'));
});
