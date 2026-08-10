(function initializePageManifest() {
  const groups = [
    { id: 'daily', label: 'Günlük Operasyon' },
    { id: 'machines', label: 'Tezgâh ve Bakım' },
    { id: 'diagnostics', label: 'FANUC Teşhis' },
    { id: 'engineering', label: 'Parametre ve Program Araçları' },
    { id: 'knowledge', label: 'Dokümanlar ve Bilgi' },
    { id: 'management', label: 'Yönetim' }
  ];

  const pages = [
    ['dashboard', 'Günlük Operasyon Özeti', 'home', 'renderDashboard'],
    ['cnc_dashboard', 'Canlı İzleme', 'daily', 'renderCncDashboard'],
    ['cnc_screen_viewer', 'Canlı CNC Ekran İzleyici', 'daily', 'renderCncScreenViewer'],
    ['machines', 'Tezgâh Listesi', 'machines', 'renderMachines'],
    ['maintenance', 'Bakım Defteri', 'machines', 'renderMaintenance', 'extra'],
    ['battery', 'Pil Takibi', 'machines', 'renderBattery'],
    ['reports', 'Raporlar ve Analiz', 'daily', 'renderReports'],
    ['predictive', 'Kestirimci Bakım', 'machines', 'renderPredictive'],
    ['reliability', 'MTBF / MTTR Güvenilirlik', 'machines', 'renderReliability'],
    ['projects', 'Projeler', 'machines', 'renderProjects'],
    ['fanuc_center', 'FANUC Merkezi', 'diagnostics', 'renderFanucCenter', 'optional-extra'],
    ['diagnostic_history', 'Teşhis ve Geçmiş Merkezi', 'diagnostics', 'MTBDiagnosticHistory.render'],
    ['troubleshooter', 'Arıza Teşhis Ağacı', 'diagnostics', 'renderTroubleshooter'],
    ['io_link', 'I/O Link Teşhisi', 'diagnostics', 'renderIOLink'],
    ['drive_diagnostics', 'Sürücü Teşhisi', 'diagnostics', 'renderDriveDiagnostics'],
    ['spindle_diagnostics', 'Spindle Teşhisi', 'diagnostics', 'renderSpindleDiagnostics'],
    ['backup_wizard', 'Yedekleme Sihirbazı', 'diagnostics', 'renderBackupWizard'],
    ['backup_tracker', 'Yedek Takip Defteri', 'diagnostics', 'renderBackupTracker', 'extra'],
    ['troubleshoot_wiki', 'Arıza Bilgi Bankası', 'knowledge', 'renderTroubleshootWiki'],
    ['tuning', 'Ayar Sihirbazı', 'engineering', 'renderTuning'],
    ['generator', 'G-Code Üretici', 'engineering', 'renderGenerator'],
    ['gcode_checker', 'G-Code Hata Tarayıcı', 'engineering', 'renderGcodeChecker'],
    ['param_comparator', 'Parametre Karşılaştırıcı', 'engineering', 'renderParamComparator'],
    ['param_inspector', 'Parametre Yedeği İnceleyici', 'engineering', 'ParamInspectorFeature.renderParamInspector'],
    ['gear_ratio', 'Dişli Oranı Hesabı', 'engineering', 'renderGearRatio'],
    ['backlash_helper', 'Eksen Boşluk Sihirbazı', 'engineering', 'renderBacklashHelper'],
    ['axis_limits_helper', 'Eksen Limit Sihirbazı', 'engineering', 'renderAxisLimitsHelper'],
    ['rs232', 'RS232 Haberleşme', 'engineering', 'renderRS232'],
    ['rs232_cables', 'RS232 Pin ve Lehim Rehberi', 'engineering', 'renderRs232Cables'],
    ['fssb_topology', 'FSSB Fiber Topolojisi', 'engineering', 'renderFssbTopology'],
    ['library', 'Doküman Kütüphanesi', 'knowledge', 'renderLibrary'],
    ['alarms', 'Alarm Veritabanı', 'knowledge', 'renderAlarms'],
    ['parameters', 'Parametre Veritabanı', 'knowledge', 'renderParameters'],
    ['keep_relays', 'Keep Relay ve Zamanlayıcı', 'knowledge', 'renderKeepRelays'],
    ['macro', 'Makro Değişkenleri', 'knowledge', 'renderMacroVariables'],
    ['nc_codes', 'G/M NC Kodları', 'knowledge', 'renderNcCodes'],
    ['pmc_signals', 'PMC Sinyal Listesi', 'knowledge', 'renderPmcSignals'],
    ['custom_builder_library', 'Üretici Alarm ve M-Kodu', 'knowledge', 'renderCustomBuilderLibrary'],
    ['cheat_sheets', 'Hızlı Kılavuzlar', 'knowledge', 'renderCheatSheets'],
    ['ai', 'AI Asistan', 'assistant', 'renderAI'],
    ['sync_center', 'Senkronizasyon Merkezi', 'management', 'MTBSyncCenter.render'],
    ['performance_diagnostics', 'Performans Teşhisi', 'management', 'MTBPerformanceDiagnostics.render'],
    ['archive', 'Silinen Kayıtlar', 'management', 'renderArchive'],
    ['settings', 'Ayarlar', 'management', 'renderSettings'],
    ['pdf_viewer', 'PDF Görüntüleyici', 'hidden', 'renderPdfViewer', 'extra']
  ].map(([id, title, group, renderer, argument]) => Object.freeze({ id, title, group, renderer, argument }));

  const byId = Object.freeze(Object.fromEntries(pages.map(page => [page.id, page])));
  window.MTBPageManifest = Object.freeze({ groups: Object.freeze(groups), pages: Object.freeze(pages), byId });
})();
