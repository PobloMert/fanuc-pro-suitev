'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('archive page is registered, loaded and protected by delete permission', () => {
  const html = read('src/index.html');
  const manifest = read('src/js/page_manifest.js');
  const archive = read('src/js/features/archive.js');
  assert.match(html, /features\/archive\.js/);
  assert.match(html, /data-page="archive"/);
  assert.match(manifest, /\['archive', 'Silinen Kayıtlar', 'management', 'renderArchive'\]/);
  assert.match(archive, /canDelete/);
});

test('user CRUD deletion paths use tombstones instead of array removal', () => {
  const lifecycle = read('src/js/features/lifecycle.js');
  const renderer = read('src/renderer.js');
  const wiki = read('src/js/features/troubleshooter.js');
  const custom = read('src/js/features/nc_pmc_library.js');
  assert.match(lifecycle, /archiveById\(State\.maintenances/);
  assert.match(lifecycle, /archiveById\(State\.batteries/);
  assert.match(lifecycle, /archiveById\(State\.fans/);
  assert.match(renderer, /archiveById\(State\.machines/);
  assert.match(read('src/js/features/backup_tracker.js'), /archiveById\(State\.backup_logs/);
  assert.match(wiki, /archiveById\(State\.wiki/);
  assert.match(custom, /archiveById\(State\.custom_mcodes/);
  assert.match(custom, /archiveById\(State\.custom_alarms/);
  assert.match(read('src/js/features/operations_insights.js'), /MTBRecordRepository\.archive\(State\.projects/);
});

test('reference alarm and parameter datasets are not included in archive collections', () => {
  const archive = read('src/js/features/archive.js');
  const definitions = archive.slice(archive.indexOf('const definitions'), archive.indexOf('const esc'));
  assert.doesNotMatch(definitions, /^\s*alarms:/m);
  assert.doesNotMatch(definitions, /^\s*parameters:/m);
  assert.doesNotMatch(definitions, /^\s*nc_codes:/m);
});
