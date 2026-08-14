'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Alarm Database: Schema completeness, uniqueness and category distribution', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../data/alarms.json'), 'utf8');
  const data = JSON.parse(raw);

  assert.ok(Array.isArray(data.alarms), 'Alarms must be an array');
  assert.ok(data.alarms.length >= 35, `Expected at least 35 alarms, found ${data.alarms.length}`);

  const allowedCategories = new Set([
    'Servo',
    'Spindle',
    'Program',
    'Overtravel',
    'Overheat',
    'System',
    'PMC'
  ]);

  const seenCodes = new Set();
  const categoryCounts = {};

  for (const alarm of data.alarms) {
    // Unique code verification
    assert.ok(alarm.code, 'Alarm code is required');
    assert.ok(!seenCodes.has(alarm.code), `Duplicate alarm code detected: ${alarm.code}`);
    seenCodes.add(alarm.code);

    // Title and description
    assert.ok(alarm.title && alarm.title.length >= 5, `Alarm ${alarm.code} must have a descriptive title`);
    assert.ok(alarm.description && alarm.description.length >= 10, `Alarm ${alarm.code} must have a description`);

    // Category check
    assert.ok(allowedCategories.has(alarm.category), `Invalid category "${alarm.category}" for alarm ${alarm.code}`);
    categoryCounts[alarm.category] = (categoryCounts[alarm.category] || 0) + 1;

    // Series array check
    assert.ok(Array.isArray(alarm.series) && alarm.series.length > 0, `Alarm ${alarm.code} must specify applicable series`);

    // Causes and solutions check
    assert.ok(Array.isArray(alarm.causes) && alarm.causes.length > 0, `Alarm ${alarm.code} must list at least one root cause`);
    assert.ok(Array.isArray(alarm.solutions) && alarm.solutions.length > 0, `Alarm ${alarm.code} must list at least one solution step`);

    for (const cause of alarm.causes) {
      assert.ok(typeof cause === 'string' && cause.trim().length > 3, `Invalid cause in ${alarm.code}`);
    }
    for (const sol of alarm.solutions) {
      assert.ok(typeof sol === 'string' && sol.trim().length > 3, `Invalid solution in ${alarm.code}`);
    }
  }

  // Ensure major categories are represented
  assert.ok(categoryCounts['Servo'] >= 10, 'Must have at least 10 Servo alarms');
  assert.ok(categoryCounts['Spindle'] >= 5, 'Must have at least 5 Spindle alarms');
  assert.ok(categoryCounts['Program'] >= 10, 'Must have at least 10 Program alarms');
  assert.ok(categoryCounts['Overtravel'] >= 4, 'Must have at least 4 Overtravel alarms');
  assert.ok(categoryCounts['PMC'] >= 4, 'Must have at least 4 PMC alarms');
});
