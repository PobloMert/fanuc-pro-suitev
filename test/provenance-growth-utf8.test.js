const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('technical provenance has cautious fallbacks and all visible source labels', () => {
  const source = read('src/js/services/source_provenance.js');
  for (const field of ['sourceType', 'manualNumber', 'manualRevision', 'applicableSeries', 'applicabilityNote']) assert.match(source, new RegExp(field));
  for (const label of ['FANUC kılavuzuyla karşılaştırıldı', 'OEM doğrulaması gerekli', 'Seriye göre değişebilir', 'Kullanıcı saha notu', 'Adaptör verisi']) assert.match(source, new RegExp(label));
  for (const series of ['0i-D', '0i-F', '0i-F Plus', '30i/31i/32i-B', '30i/31i/32i-B Plus']) assert.ok(source.includes(series));
  assert.match(read('src/js/data_loader.js'), /MTBSourceProvenance\?\.enrichState\(State\)/);
});

test('history helper bounds rendering, filters dates and prepares yearly CSV', () => {
  const context = { window: {}, Blob: class {}, document: {}, URL: {}, setTimeout };
  vm.runInNewContext(read('src/js/services/history_growth.js'), context);
  const api = context.window.MTBHistoryGrowth;
  const records = Array.from({ length: 300 }, (_, id) => ({ id, createdAt: id < 150 ? '2025-06-01T00:00:00Z' : '2026-06-01T00:00:00Z' }));
  const result = api.query(records, { from: '2026-01-01', to: '2026-12-31', pageSize: 100 });
  assert.equal(result.total, 150); assert.equal(result.rows.length, 100); assert.equal(result.pages, 2);
  assert.deepEqual(Array.from(api.years(records)), [2026, 2025]);
  assert.match(api.csv([{ createdAt: '2026-01-01', type: 'Alarm', note: 'Gözlem' }]), /Gözlem/);
});

test('new and rewritten user-visible sources are UTF-8 without mojibake signatures', () => {
  const files = ['src/js/services/source_provenance.js', 'src/js/services/history_growth.js', 'src/js/features/archive.js'];
  const signature = /Ã.|Ä.|Å.|Â.|â(?:€|™|†|‡|€“|€”|œ)|ğŸ|ï¸/u;
  for (const file of files) {
    const source = read(file);
    assert.equal(source.includes('\uFFFD'), false, `${file}: replacement character`);
    assert.equal(signature.test(source), false, `${file}: mojibake signature`);
  }
});
