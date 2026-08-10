'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const knowledge = fs.readFileSync(path.join(root, 'src', 'js', 'features', 'knowledge_screens.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src', 'js', 'features', 'lifecycle.js'), 'utf8');

test('amplifier replacement guidance enforces the FANUC manual safety prerequisites', () => {
  assert.match(knowledge, /en az <b>20 dakika<\/b> bekleyin/);
  assert.doesNotMatch(knowledge, /DC Link[^\n]*5-10 dk/);
  for (const rule of ['harici güç', 'geriliminin güvenli seviyeye', 'ESD bilekliği', 'yetkili teknisyen']) {
    assert.match(knowledge, new RegExp(rule, 'i'));
  }
});

test('battery alarm lifecycle uses a seven-day deadline and backup prerequisite', () => {
  assert.match(lifecycle, /low_battery_alarm_date/);
  assert.match(lifecycle, /deadline\.setDate\(deadline\.getDate\(\) \+ 7\)/);
  assert.match(lifecycle, /Önce yedek doğrulanmalı/);
  assert.match(lifecycle, /low_battery_alarm_date && !backup_verified/);
  assert.match(lifecycle, /Alarm kaydı yok/);
});

test('cabinet maintenance warns about coolant-related corrosion risks', () => {
  for (const risk of ['kükürt', 'klor', 'sentetik soğutucular', 'alkali', 'korozyon']) {
    assert.match(knowledge, new RegExp(risk, 'i'));
  }
});
