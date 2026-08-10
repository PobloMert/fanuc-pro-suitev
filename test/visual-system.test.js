'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const aiScreen = fs.readFileSync(path.join(root, 'src', 'js', 'features', 'ai_screen.js'), 'utf8');
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
const machineWorkspace = fs.readFileSync(path.join(root, 'src', 'js', 'machine_workspace.js'), 'utf8');
const machineWorkspaceStyle = fs.readFileSync(path.join(root, 'src', 'styles', 'machine-workspace.css'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src', 'js', 'ui', 'navigation.js'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'src', 'js', 'ui', 'modal.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src', 'js', 'features', 'lifecycle.js'), 'utf8');
const operationsInsights = fs.readFileSync(path.join(root, 'src', 'js', 'features', 'operations_insights.js'), 'utf8');

test('visual system provides motion accessibility modes', () => {
  assert.match(visual, /prefers-reduced-motion:reduce/);
  assert.match(visual, /\.motion-reduced/);
  assert.match(visual, /\.motion-off/);
  assert.match(renderer, /id="motion-mode"/);
});

test('operations and machine workspace support legacy backup fields and latest lifecycle records', () => {
  assert.match(machineWorkspace, /son_yedek_tarihi/);
  assert.match(machineWorkspace, /dosya_konumu/);
  assert.match(machineWorkspace, /latestPer/);
  assert.match(machineWorkspace, />= 365/);
  assert.match(operationsDashboard, /son_yedek_tarihi/);
  assert.match(operationsDashboard, /currentBatteries/);
  assert.match(operationsDashboard, />= 365/);
  assert.match(spotlight, /dosya_konumu/);
});

test('machine workspace keeps failed edits open and explains empty filter results', () => {
  assert.match(machineWorkspace, /if \(!saved\)/);
  assert.match(machineWorkspace, /Form açık bırakıldı/);
  assert.match(machineWorkspace, /machine-filter-empty/);
  assert.match(machineWorkspace, /Filtreleri temizle/);
  assert.match(machineWorkspace, /slice\(0,20\)/);
});
test('selected lifecycle, diagnostic, diff and AI views use shared components', () => {
  assert.match(lifecycle, /lifecycle-timeline/);
  assert.match(renderer, /diff-critical/);
  assert.match(aiScreen, /ai-technical-card/);
  assert.match(visual, /\.flow-progress/);
  assert.match(visual, /\.fssb-signal/);
  assert.match(ai, /\.ai-shell/);
});

test('telemetry visual updates are frame scheduled and deduplicated', () => {
  assert.match(observability, /requestAnimationFrame/);
  assert.match(observability, /markup!==lastMarkup/);
});

test('AI output is sanitized before insertion', () => {
  assert.match(aiScreen, /DOMPurify\.sanitize/);
  assert.match(aiScreen, /escapeHTML\(text\)/);
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

test('FANUC center page is visible when opened from dashboard actions', () => {
  assert.match(fanucCenter, /page\.className\s*=\s*['"]page active fanuc-center-page['"]/);
  assert.match(operationsDashboard, /data-ops-nav="fanuc_center"/);
  assert.match(operationsDashboard, /page:'fanuc_center'/);
});

test('FANUC center remains in navigation and enforces edit permissions at UI and bridge layers', () => {
  const pageManifest = fs.readFileSync(path.join(root, 'src', 'js', 'page_manifest.js'), 'utf8');
  assert.match(pageManifest, /\['fanuc_center',\s*'FANUC Merkezi',\s*'diagnostics'/);
  assert.match(renderer, /FanucCenterBridge[\s\S]*canEdit/);
  assert.match(renderer, /if \(!canEdit\(\)\) return \{ ok: false, error: 'FANUC profilini düzenleme yetkiniz yok\.'/);
  assert.match(fanucCenter, /const canEdit/);
  assert.match(fanucCenter, /Düzenleme yetkisi gerekli/);
});

test('FANUC profile uses missing-field guidance without a percentage score', () => {
  assert.match(fanucCenter, /missingProfileFields/);
  assert.match(fanucCenter, /profil alanı eksik/);
  assert.doesNotMatch(fanucCenter, /profil doluluğu|fanuc-health-ring|--score/);
});

test('machine workspace uses explainable states without machine scoring', () => {
  assert.match(index, /js\/machine_workspace\.js/);
  assert.match(renderer, /MachineWorkspaceBridge/);
  assert.match(machineWorkspace, /Kritik pil/);
  assert.match(machineWorkspace, /Yedek güncel değil/);
  assert.match(machineWorkspace, /Modül envanteri eksik/);
  assert.doesNotMatch(machineWorkspace, /healthScore|riskScore|sağlık puanı|risk puanı/i);
  assert.match(machineWorkspaceStyle, /\.machine-detail-tabs/);
});

test('dashboard and maintenance analysis do not score machines', () => {
  assert.doesNotMatch(renderer + operationsInsights, /Ortalama Tezgah Sağlığı|Sağlık Puanı|Sağlık Skoru|health\.score|failureRisk/);
  assert.match(renderer, /Tezgâh Durum Özeti/);
  assert.match(operationsInsights, /Tezgâhlara puan verilmez/);
});

test('machine detail combines maintenance, battery, fan, FANUC, modules, backups and timeline', () => {
  assert.match(machineWorkspace, /Genel Bakış/);
  assert.match(machineWorkspace, /Pil & Fan/);
  assert.match(machineWorkspace, /FANUC Profili/);
  assert.match(machineWorkspace, /Modüller/);
  assert.match(machineWorkspace, /Yedekleme/);
  assert.match(machineWorkspace, /Zaman Çizelgesi/);
  assert.match(machineWorkspace, /saveMachines/);
});

test('machine detail tabs and modal infrastructure are keyboard accessible', () => {
  assert.match(machineWorkspace, /role="tablist"/);
  assert.match(machineWorkspace, /role="tab"/);
  assert.match(machineWorkspace, /aria-selected=/);
  assert.match(machineWorkspace, /role="tabpanel"/);
  assert.match(machineWorkspace, /ArrowLeft/);
  assert.match(machineWorkspace, /ArrowRight/);
  assert.match(machineWorkspace, /Home/);
  assert.match(machineWorkspace, /End/);
  assert.match(modal, /setAttribute\('role', 'dialog'\)/);
  assert.match(modal, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(modal, /event\.key !== 'Escape'/);
  assert.match(modal, /modal-overlay\.open/);
  assert.match(modal, /returnFocus/);
});

test('machine context is carried to maintenance and backup tracker filters', () => {
  assert.match(machineWorkspace, /navigate\?\.\(nav\.dataset\.machineNav,\{machineId:/);
  assert.match(renderer, /renderMaintenance\(extraData\)/);
  assert.match(renderer, /renderBackupTracker\(extraData\)/);
  assert.match(lifecycle, /maint-clear-machine-context/);
  assert.match(renderer, /backup-clear-machine-context/);
  assert.match(renderer, /contextMachineId/);
});

test('machine workspace filters have labels and an announced result count', () => {
  assert.match(machineWorkspace, /for="machine-workspace-search"/);
  assert.match(machineWorkspace, /for="machine-workspace-dept"/);
  assert.match(machineWorkspace, /for="machine-workspace-status"/);
  assert.match(machineWorkspace, /aria-live="polite"/);
  assert.match(machineWorkspaceStyle, /\.sr-only/);
});

test('machine workspace keeps context visible and explains status without scoring', () => {
  assert.match(machineWorkspace, /machine-detail-context/);
  assert.match(machineWorkspace, /Aktif tezgâh bağlamı/);
  assert.match(machineWorkspace, /machine-reasons/);
  assert.match(machineWorkspace, /diğer nedeni göster/);
  assert.doesNotMatch(machineWorkspace, /healthScore|riskScore|sağlık puanı|risk puanı/i);
});

test('machine table supports density, sticky headers and reduced motion', () => {
  assert.match(machineWorkspace, /toggle-density/);
  assert.match(machineWorkspace, /machine-table-density/);
  assert.match(machineWorkspaceStyle, /\.machine-workspace-table\.is-compact/);
  assert.match(machineWorkspaceStyle, /position:sticky/);
  assert.match(machineWorkspaceStyle, /180ms/);
  assert.match(machineWorkspaceStyle, /prefers-reduced-motion:reduce/);
});

test('machine empty state and page heading use the shared visual hierarchy', () => {
  assert.match(machineWorkspace, /page-eyebrow/);
  assert.match(machineWorkspace, /Henüz tezgâh eklenmedi/);
  assert.match(machineWorkspace, /Bakım, pil, fan ve FANUC kayıtlarını ilişkilendirmek/);
  assert.match(machineWorkspace, /data-machine-action="new"/);
});
