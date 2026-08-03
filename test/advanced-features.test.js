const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const main = read('main.js');
const renderer = read('src/renderer.js');
const rag = read('src/js/modules/rag.js');

test('AI cloud requests are gated, masked and source constrained', () => {
  assert.match(main, /if \(appSettings\.internetEnabled === false\)/);
  assert.match(main, /Kaynak yoksa kesin teşhis veya değer verme/);
  assert.match(renderer, /maskSensitiveForCloud/);
  assert.match(renderer, /\[IP MASKELENDİ\]/);
  assert.match(rag, /buildRAGResult/);
  assert.match(renderer, /KALICI SALT OKUNUR — CNC'YE KOMUT GÖNDEREMEZ/);
});

test('knowledge preferences are stored separately from privileged settings', () => {
  assert.match(main, /knowledge-preferences\.json/);
  assert.match(main, /knowledge-preferences-set/);
  assert.match(renderer, /knowledgeFavorites/);
  assert.match(renderer, /knowledgeRecent/);
  assert.match(renderer, /knowledgeNotes/);
});

test('settings include offline, retention, backup and accessibility controls', () => {
  for (const id of ['internet-enabled', 'retention-days', 'disk-limit-mb', 'backup-directory-value', 'text-scale', 'high-contrast', 'color-blind-mode']) {
    assert.match(renderer, new RegExp(id));
  }
  assert.match(main, /storage-policy-apply/);
  assert.match(main, /getConfiguredBackupDir/);
});
