'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src', 'js', 'ui', 'navigation.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'src', 'js', 'page_manifest.js'), 'utf8');

function groups(source) {
  return new Map([...source.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?pages:\s*\[([^\]]*)\]/g)].map(match => [
    match[1],
    [...match[2].matchAll(/'([^']+)'/g)].map(item => item[1])
  ]));
}

test('renderer no longer duplicates the canonical navigation manifest', () => {
  const legacy = groups(renderer);
  assert.equal(legacy.size, 0);
  assert.match(navigation, /window\.MTBPageManifest/);
  assert.match(renderer, /window\.MTBPageManifest\?\.byId/);
  assert.match(manifest, /window\.MTBPageManifest\s*=/);
});

test('canonical grouped navigation contains unique pages backed by sidebar buttons', () => {
  const grouped = [...manifest.matchAll(/^\s*\['([^']+)',\s*'[^']*',\s*'(daily|machines|diagnostics|engineering|knowledge|management)'/gm)].map(match => match[1]);
  assert.ok(grouped.length > 0);
  assert.equal(new Set(grouped).size, grouped.length, 'Bir sayfa birden fazla navigasyon grubunda bulunuyor');
  const sidebarPages = new Set([...index.matchAll(/data-page="([^"]+)"/g)].map(match => match[1]));
  for (const page of grouped) assert.ok(sidebarPages.has(page), `${page} için index.html içinde sidebar düğmesi yok`);
});
