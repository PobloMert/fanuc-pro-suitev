const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const updater = fs.readFileSync(path.join(root, 'src', 'js', 'modules', 'auto_updater.js'), 'utf8');

test('update checker uses a fixed GitHub endpoint and validates download origin', () => {
  assert.match(main, /api\.github\.com\/repos\/PobloMert\/fanuc-pro-suitev\/releases\/latest/);
  assert.match(main, /github\.com\/PobloMert\/fanuc-pro-suitev\/releases\/download\//);
  assert.doesNotMatch(preload, /checkForUpdates:\s*\(url/);
});

test('updater never executes a downloaded installer', () => {
  assert.match(updater, /openExternal\(info\.downloadUrl\)/);
  assert.doesNotMatch(updater, /exec\(|spawn\(|installOnAppQuit|quitAndInstall/);
});
