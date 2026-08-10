const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('page manifest is the canonical navigation and renderer registry', () => {
  const manifest = read('src/js/page_manifest.js');
  const navigation = read('src/js/ui/navigation.js');
  const renderer = read('src/renderer.js');
  const html = read('src/index.html');
  assert.match(html, /js\/page_manifest\.js/);
  assert.match(navigation, /MTBPageManifest/);
  assert.doesNotMatch(navigation, /pages:\s*\['cnc_dashboard'/);
  assert.match(renderer, /MTBPageManifest\?\.byId/);
  assert.match(manifest, /Günlük Operasyon/);
  assert.match(manifest, /Parametre ve Program Araçları/);
});

test('navigation failures offer accessible recovery actions', () => {
  const renderer = read('src/renderer.js');
  const css = read('src/styles/main.css');
  assert.match(renderer, /role="alert"/);
  assert.match(renderer, /data-page-recovery="retry"/);
  assert.match(renderer, /data-page-recovery="dashboard"/);
  assert.match(renderer, /data-page-recovery="diagnostics"/);
  assert.match(renderer, /Promise\.resolve\(result\)/);
  assert.match(css, /\.page-recovery:focus-visible/);
});

test('navigation activates page elements returned by independent feature modules', () => {
  const renderer = read('src/renderer.js');
  assert.match(renderer, /classList\.add\('page', 'active', 'animate-in'\)/);
});
