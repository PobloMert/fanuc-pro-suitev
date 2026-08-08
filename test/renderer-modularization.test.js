'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src', 'js', 'ui', 'navigation.js'), 'utf8');
const spotlight = fs.readFileSync(path.join(root, 'src', 'js', 'ui', 'spotlight.js'), 'utf8');
const dataLoader = fs.readFileSync(path.join(root, 'src', 'js', 'data_loader.js'), 'utf8');

test('renderer delegates initialization and navigation to their modules', () => {
  assert.doesNotMatch(renderer, /async function init\s*\(/);
  assert.doesNotMatch(renderer, /function organizeNavigation\s*\(/);
  assert.doesNotMatch(renderer, /function initRippleEffect\s*\(/);
  assert.match(app, /organizeNavigation\(\)/);
  assert.match(navigation, /export function organizeNavigation\s*\(/);
  assert.match(navigation, /export function initRippleEffect\s*\(/);
});

test('renderer delegates data loading, spotlight and notifications to canonical modules', () => {
  assert.doesNotMatch(renderer, /async function loadData\s*\(/);
  assert.doesNotMatch(renderer, /async function loadUsers\s*\(/);
  assert.doesNotMatch(renderer, /async function loadSettings\s*\(/);
  assert.doesNotMatch(renderer, /function openSpotlight\s*\(/);
  assert.doesNotMatch(renderer, /function checkNotifications\s*\(/);
  assert.match(dataLoader, /export async function loadData\s*\(/);
  assert.match(dataLoader, /export async function loadUsers\s*\(/);
  assert.match(dataLoader, /export async function loadSettings\s*\(/);
  assert.match(spotlight, /export function openSpotlight\s*\(/);
  assert.match(navigation, /export function checkNotifications\s*\(/);
});
