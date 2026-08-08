'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('modal service is loaded before renderer and keeps the public API', () => {
  const html = read('src/index.html');
  const modalIndex = html.indexOf('<script src="js/ui/modal.js"></script>');
  const rendererIndex = html.indexOf('<script src="renderer.js"></script>');
  assert.ok(modalIndex >= 0, 'modal service script must be included');
  assert.ok(modalIndex < rendererIndex, 'modal service must be available before renderer');

  const modal = read('src/js/ui/modal.js');
  assert.match(modal, /window\.showModal\s*=\s*show/);
  assert.match(modal, /window\.closeModal\s*=\s*close/);
  assert.match(modal, /window\.MTBModal\s*=\s*Object\.freeze/);
});

test('modal service preserves keyboard and dialog accessibility behavior', () => {
  const modal = read('src/js/ui/modal.js');
  assert.match(modal, /aria-modal/);
  assert.match(modal, /aria-labelledby/);
  assert.match(modal, /event\.key !== 'Escape'/);
  assert.match(modal, /event\.key !== 'Tab'/);
  assert.match(modal, /returnFocus\.get\(id\)/);
});

test('renderer consumes modal service instead of owning its implementation', () => {
  const renderer = read('src/renderer.js');
  const knowledge = read('src/js/features/knowledge_screens.js');
  assert.doesNotMatch(renderer, /function showModal\s*\(/);
  assert.doesNotMatch(renderer, /modalReturnFocus|modalFocusable/);
  assert.match(knowledge, /showModal\('book-detail'/);
});
