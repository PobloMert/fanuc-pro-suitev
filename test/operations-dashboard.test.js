'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'operations_dashboard.js'), 'utf8');

function loadRenderer() {
  const context = {
    window: {},
    document: { addEventListener() {} },
    Date,
    Map,
    Set,
    String,
    Number
  };
  vm.runInNewContext(source, context, { filename: 'operations_dashboard.js' });
  return context.window.renderOperationsBrief;
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

test('operations dashboard uses only the latest battery and fan record per machine location', () => {
  const render = loadRenderer();
  const html = render({
    machines: [{ id: 1, numarasi: 'M-1', moduleInventory: [{}] }],
    maintenances: [],
    batteries: [
      { id: 1, tezgah_id: 1, eksen: 'X', tarih: isoDaysAgo(500) },
      { id: 2, tezgah_id: 1, eksen: 'X', tarih: isoDaysAgo(20) }
    ],
    fans: [
      { id: 1, tezgah_id: 1, konum: 'Kabin', calisma_saati: 19000 },
      { id: 2, tezgah_id: 1, konum: 'Kabin', calisma_saati: 1000 }
    ],
    backup_logs: [{ id: 1, tezgah_id: 1, son_yedek_tarihi: isoDaysAgo(20), dosya_konumu: 'D:/M-1.FDB' }]
  });
  assert.match(html, /Bakım durumu normal/);
  assert.match(html, /Kritik pil[\s\S]*?<b>0<\/b>/);
  assert.match(html, /Fan bakım uyarısı[\s\S]*?<b>0<\/b>/);
  assert.match(html, /Yedek riski[\s\S]*?<b>0<\/b>/);
});

test('operations attention total includes missing module inventories', () => {
  const render = loadRenderer();
  const html = render({ machines: [{ id: 1, numarasi: 'M-1' }], maintenances: [], batteries: [], fans: [], backup_logs: [{ tezgah_id: 1, son_yedek_tarihi: isoDaysAgo(1) }] });
  assert.match(html, /1 konu dikkat bekliyor/);
  assert.match(html, /Eksik modül envanteri[\s\S]*?<b>1<\/b>/);
});
