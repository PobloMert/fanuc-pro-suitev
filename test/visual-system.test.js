'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const visual = fs.readFileSync(path.join(root, 'src', 'styles', 'visual-system.css'), 'utf8');
const ai = fs.readFileSync(path.join(root, 'src', 'styles', 'ai.css'), 'utf8');
const observability = fs.readFileSync(path.join(root, 'src', 'dashboard', 'observability.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const intro = fs.readFileSync(path.join(root, 'src', 'js', 'intro.js'), 'utf8');
const feedback = fs.readFileSync(path.join(root, 'src', 'js', 'ux_feedback.js'), 'utf8');
const mainStyle = fs.readFileSync(path.join(root, 'src', 'styles', 'main.css'), 'utf8');
const fanucCenter = fs.readFileSync(path.join(root, 'src', 'js', 'fanuc_center.js'), 'utf8');
const fanucCenterStyle = fs.readFileSync(path.join(root, 'src', 'styles', 'fanuc-center.css'), 'utf8');
const operationsDashboard = fs.readFileSync(path.join(root, 'src', 'js', 'operations_dashboard.js'), 'utf8');
const spotlight = fs.readFileSync(path.join(root, 'src', 'js', 'ui', 'spotlight.js'), 'utf8');

test('visual system provides motion accessibility modes', () => {
  assert.match(visual, /prefers-reduced-motion:reduce/);
  assert.match(visual, /\.motion-reduced/);
  assert.match(visual, /\.motion-off/);
  assert.match(renderer, /id="motion-mode"/);
});

test('selected lifecycle, diagnostic, diff and AI views use shared components', () => {
  assert.match(renderer, /lifecycle-timeline/);
  assert.match(renderer, /diff-critical/);
  assert.match(renderer, /ai-technical-card/);
  assert.match(visual, /\.flow-progress/);
  assert.match(visual, /\.fssb-signal/);
  assert.match(ai, /\.ai-shell/);
});

test('telemetry visual updates are frame scheduled and deduplicated', () => {
  assert.match(observability, /requestAnimationFrame/);
  assert.match(observability, /markup!==lastMarkup/);
});

test('AI output is sanitized before insertion', () => {
  assert.match(renderer, /DOMPurify\.sanitize/);
  assert.match(renderer, /escapeHTML\(text\)/);
});

test('startup intro is packaged, skippable and cannot block login', () => {
  const videoPath = path.join(root, 'assets', 'intro.mp4');
  assert.ok(fs.existsSync(videoPath));
  assert.ok(fs.statSync(videoPath).size > 0);
  assert.match(index, /id="intro-video"/);
  assert.match(index, /assets\/intro\.mp4/);
  assert.match(intro, /addEventListener\('ended', finishIntro/);
  assert.match(intro, /addEventListener\('error', finishIntro/);
  assert.match(intro, /setTimeout\(finishIntro, 60000\)/);
});

test('feedback system provides actionable notifications, guided empty states and loading skeletons', () => {
  assert.match(feedback, /aria-live/);
  assert.match(feedback, /actionLabel/);
  assert.match(feedback, /emptyTableRow/);
  assert.match(feedback, /clear-filters/);
  assert.match(feedback, /loadingState/);
  assert.match(renderer, /Ekran hazırlanıyor/);
  assert.match(mainStyle, /\.empty-state-guided/);
  assert.match(mainStyle, /\.page-loading-state/);
  assert.match(mainStyle, /\.toast-help/);
});

test('FANUC center integrates machine profiles, diagnostics, parameters, backups and LED guidance', () => {
  assert.match(index, /data-page="fanuc_center"/);
  assert.match(renderer, /FanucCenterBridge/);
  assert.match(fanucCenter, /FANUC Bakım & Teşhis Merkezi/);
  assert.match(fanucCenter, /Teşhis Senaryoları/);
  assert.match(fanucCenter, /param_comparator/);
  assert.match(fanucCenter, /backup_wizard/);
  assert.match(fanucCenter, /Sürücü LED ve alarm rehberi/);
  assert.match(fanucCenter, /Model kılavuzuyla doğrulayın/);
  assert.match(fanucCenter, /saveMachineProfile/);
  assert.match(fanucCenterStyle, /\.fanuc-scenario-layout/);
  assert.match(fanucCenterStyle, /\.fanuc-led-grid/);
});

test('module inventory, universal search and operations dashboard are integrated as separate modules', () => {
  assert.match(renderer, /saveModuleInventory/);
  assert.match(fanucCenter, /moduleInventory/);
  assert.match(fanucCenter, /ELEKTRİK PANO & MODÜL ENVANTERİ/);
  assert.match(fanucCenter, /data-module-edit/);
  assert.match(spotlight, /Pano Modülü/);
  assert.match(spotlight, /FanucCenterCatalog/);
  assert.match(spotlight, /backup_logs/);
  assert.match(operationsDashboard, /GÜNLÜK OPERASYON ÖZETİ/);
  assert.match(operationsDashboard, /backupRisk/);
  assert.match(operationsDashboard, /missingInventory/);
  assert.match(index, /js\/operations_dashboard\.js/);
  assert.match(fanucCenterStyle, /\.ops-priority-grid/);
  assert.match(fanucCenterStyle, /\.fanuc-inventory-table/);
});
