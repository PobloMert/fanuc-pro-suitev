const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('parameter views support provenance metadata with legacy fallbacks', () => {
  const comparator = read('src/js/features/param_comparator.js');
  const parameters = read('src/js/features/alarm_parameter_screens.js');
  for (const field of ['applicableSeries', 'manualNumber', 'manualRevision', 'applicabilityNote']) {
    assert.match(comparator, new RegExp(field));
    assert.match(parameters, new RegExp(field));
  }
  assert.match(comparator, /Seri doğrulanmadı/);
  assert.match(parameters, /Kılavuz belirtilmemiş/);
});

test('parameter comparison documents backup and controlled test safeguards', () => {
  const source = read('src/js/features/param_comparator.js');
  assert.match(source, /param-backup-confirmed/);
  assert.match(source, /param-change-reason/);
  assert.match(source, /param-change-source/);
  assert.match(source, /Machine Lock/);
  assert.match(source, /Single Block/);
  assert.match(source, /feed override/);
  assert.match(source, /CNC'ye veri yazmaz/);
});

test('prescriptive parameter writes and SRAM restore are replaced by escalation', () => {
  const ai = read('src/js/features/ai_screen.js');
  const calculator = read('src/js/features/cnc_calculators.js');
  const backup = read('src/js/features/backup_tracker.js');
  const renderer = read('src/renderer.js');
  assert.doesNotMatch(ai, /PWE=1 yapın/);
  assert.doesNotMatch(calculator, /PWE'yi \(Parameter Write Enable\) açın/);
  assert.match(backup, /Kalıcı salt-okunur politika/);
  assert.match(renderer, /SRAM geri yükleme işlemini bu uygulamadan yürütmeyin/);
  const alarms = read('data/alarms.json');
  const audited = [ai, calculator, backup, renderer, alarms].join('\n');
  assert.doesNotMatch(audited, /PWE\s*=\s*1|PARAMETER WRITE\s*=\s*1|RESTORE SRAM|APZ.*0.*1|bypass adımları/i);
  assert.doesNotMatch(ai, /APZ\/APC sıfırlama nasıl yapılır/);
});
