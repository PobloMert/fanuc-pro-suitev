'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src', 'js', 'ui', 'navigation.js'), 'utf8');

function groups(source) {
  return new Map([...source.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?pages:\s*\[([^\]]*)\]/g)].map(match => [
    match[1],
    [...match[2].matchAll(/'([^']+)'/g)].map(item => item[1])
  ]));
}

test('renderer no longer duplicates the canonical navigation manifest', () => {
  const legacy = groups(renderer);
  const canonical = groups(navigation);
  assert.equal(legacy.size, 0);
  assert.ok(canonical.size > 0);
  for (const [group, pages] of legacy) {
    assert.ok(canonical.has(group), `Eksik navigasyon grubu: ${group}`);
    for (const page of pages) assert.ok(canonical.get(group).includes(page), `${page}, ${group} grubunun iki kopyasında eşleşmiyor`);
  }
});

test('canonical grouped navigation contains unique pages backed by sidebar buttons', () => {
  const grouped = [...groups(navigation).values()].flat();
  assert.equal(new Set(grouped).size, grouped.length, 'Bir sayfa birden fazla navigasyon grubunda bulunuyor');
  const sidebarPages = new Set([...index.matchAll(/data-page="([^"]+)"/g)].map(match => match[1]));
  for (const page of grouped) assert.ok(sidebarPages.has(page), `${page} için index.html içinde sidebar düğmesi yok`);
});
