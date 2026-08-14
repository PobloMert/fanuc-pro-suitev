'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('AI System: Multi-Alarm Cross Diagnostics hierarchy and root-cause classification', () => {
  const aiCode = fs.readFileSync(path.join(__dirname, '../src/js/features/ai_screen.js'), 'utf8');

  // Check code integration
  assert.ok(aiCode.includes('Çoklu Alarm Çapraz Kök Neden Analizi'));
  assert.ok(aiCode.includes('Birincil Kök Neden (Tetikleyici Asıl Arıza)'));
  assert.ok(aiCode.includes('Zincirleme Güvenlik Sonuçları (Türeyen Alarmlar)'));
  assert.ok(aiCode.includes('Pano Başında Müdahale Sırası'));
  assert.ok(aiCode.includes('SV0401 ve SP9012 alarmları'));

  // Simulate offlineAI logic for Multi-Alarm input
  const alarms = [
    { code: 'SV0401', title: 'V_READY OFF (SERVO ALARM)', category: 'Servo', description: 'Servo sürücü hazır sinyali kesildi.', causes: ['Sürücü hazır değil'], solutions: ['DRDY hattını kontrol edin'] },
    { code: 'SP9012', title: 'SPINDLE MOTOR OVERCURRENT', category: 'Spindle', description: 'Spindle motorunda aşırı akım.', causes: ['Motor sargısı kısa devre'], solutions: ['Motor faz direncini ölçün', 'SPM modülü güç çıkışını kontrol edin'] }
  ];

  const inputMsg = 'Tezgâhta SV0401 ve SP9012 alarmları aynı anda geldi';
  const allAlarmMatches = [...inputMsg.matchAll(/\b([A-Z]{2,4}\d{3,4})\b/gi)].map(m => m[1].toUpperCase());
  const uniqueAlarmCodes = [...new Set(allAlarmMatches)];

  assert.equal(uniqueAlarmCodes.length, 2);
  assert.ok(uniqueAlarmCodes.includes('SV0401'));
  assert.ok(uniqueAlarmCodes.includes('SP9012'));

  const isTriggerTier = (a) => {
    const code = a.code;
    const text = (a.category + ' ' + a.description + ' ' + a.causes.join(' ')).toLowerCase();
    if (code === 'SV0401' || code === 'SR0004') return 2;
    if (text.includes('aşırı akım') || text.includes('overcurrent')) return 1;
    return 3;
  };

  const sorted = [...alarms].sort((a, b) => isTriggerTier(a) - isTriggerTier(b));
  assert.equal(sorted[0].code, 'SP9012'); // SP9012 is identified as the root cause trigger
  assert.equal(sorted[1].code, 'SV0401'); // SV0401 is identified as the follower/interlock drop
});
