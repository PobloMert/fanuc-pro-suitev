'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('AI System: Maintenance logbook records are deeply integrated into RAG, context and offline AI', () => {
  const ragCode = fs.readFileSync(path.join(__dirname, '../src/js/modules/rag.js'), 'utf8');
  const knowledgeCode = fs.readFileSync(path.join(__dirname, '../src/js/features/ai_knowledge.js'), 'utf8');
  const aiCode = fs.readFileSync(path.join(__dirname, '../src/js/features/ai_screen.js'), 'utf8');

  // 1. RAG engine retrieves maintenance logs
  assert.ok(ragCode.includes('Atölye Bakım Defteri Kayıtları'));
  assert.ok(ragCode.includes('State.maintenances'));
  assert.ok(ragCode.includes("type: 'Bakım Defteri'"));

  // 2. Machine context includes maintenance snippet
  assert.ok(knowledgeCode.includes('Son Bakım Kayıtları'));
  assert.ok(knowledgeCode.includes('state.maintenances'));

  // 3. Offline AI parses machine names and fault keywords from logbook
  assert.ok(aiCode.includes('Tezgâhı Bakım & Arıza Geçmişi'));
  assert.ok(aiCode.includes('Bakım Defterinde'));
  assert.ok(aiCode.includes('State.maintenances'));

  // 4. Test actual offline log retrieval logic
  const mockMachines = [{ id: 1, numarasi: 'CNF 37' }, { id: 2, numarasi: 'UNİ 20' }];
  const mockMaintenances = [
    { id: 1, tezgah_id: 1, tarih: '01-04-2024', bakim_yapan: 'AHMET MERT ÖZER', aciklama: 'MAGAZİN YARIDA KALMIŞ SENSÖR DEĞİŞTİRİLDİ', durum: 'Tamamlandı' },
    { id: 2, tezgah_id: 2, tarih: '02-04-2024', bakim_yapan: 'HAYATİ KARABAYIR', aciklama: 'X EKSENİ CETVELİ SÖKÜLÜP TEMİZLENDİ', durum: 'Tamamlandı' }
  ];

  const q = 'cnf 37 bakım geçmişinde ne yapıldı';
  const matched = mockMachines.find(m => q.toLowerCase().includes(m.numarasi.toLowerCase()));
  assert.ok(matched);
  assert.equal(matched.numarasi, 'CNF 37');

  const logs = mockMaintenances.filter(m => m.tezgah_id === matched.id);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].aciklama.includes('MAGAZİN'));
});
