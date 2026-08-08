(function () {
  'use strict';

  const allowedActions = new Set(`
    closeModal sendCncKeypress setWizardConfig navigate switchParamRangeFilter drawFssbTopology
    selectTuningWizard selectCheatSheetTab askAIPreset switchDriveTab spotlightGo checkNotifications
    toggleNotifPanel downloadOfflinePack openAlarmFromKnowledge toggleKnowledgeFavorite openBook openChapters
    openBookPDF openKnowledgeNote openBookPDFPage changeBookPDF openProject showAlarmDetail
    goToParameterFromAlarm saveCustomAlarmNote editCustomAlarmNote cancelEditCustomAlarmNote askAIAboutAlarm
    showParamDetail toggleParamDetailBit askAIAboutParam setThemeOption checkForAppUpdates deleteUser
    addNewUser changeMyPin chooseBackupDirectory exportSafeConfiguration importSafeConfiguration resetSafeSettings
    saveConnectionProfile applyConnectionProfile deleteConnectionProfile openDataDir exportAlarmsCSV
    exportMaintenanceCSV startDatabaseSync saveKnowledgeNote exportAIConversationReport quickAsk sendAIMessage
    showNewMachineModal showMachineDetailsModal printMachineCard deleteMachine createNewMachine openFanucCenter editMachineDetails saveMachineDetails
    printMaintenanceReport showNewMaintModal deleteMaint createNewMaint showNewBattModal showNewFanModal
    resetBatteryLife deleteBattery resetFanHours deleteFan createNewBattery createNewFan showNcDetail
    askAIAboutNc showPmcDetail askAIAboutPmc toggleGeneratorFields generateGcode copyGcodeToClipboard
    showNewKeepRelayModal showEditKeepRelayModal saveKeepRelayNote createNewKeepRelay evaluateMacro
    startDncTransmission stopDncTransmission updateDiagLedDisplay runDriveDiagnosis calculateFlexibleGearRatio
    runGcodeCheck loadDefaultGcodeBug compareParameterFiles loadDefaultParamDiff filterDiffRows exportDiffPDF exportDiffCSV loadPresetBackupForDiff
    showIoSlotMapping checkWizardStepsCompletion showNewWikiArticleModal deleteWikiArticle createNewWikiArticle
    showNewBackupLogModal handleBackupFileSelect showBackupHistoryModal createNewBackupLog
    generateBacklashGcode copyBacklashGcode calculateNewBacklash showSpindleAlarmDetail calculateSpindleGearRatio
    showNewBuilderItemModal deleteCustomMcode deleteCustomAlarm createNewCustomMcode createNewCustomAlarm
    showRsNSchematic showRs232Schematic calculateNewLimits captureCncScreenSnapshot onCncScreenMachineChange
    connectCncScreenStream disconnectCncScreenStream switchBatteryTab uploadParamFile clearParamInput
    filterDiffMode navigateTroubleshootNode switchIOTab switchBackupTab switchBuilderTab switchLimitTab
    switchParamTab switchSpindleTab switchMachine viewProgramCode setFssbSimulationMode onFlowchartNodeClick onFssbNodeClick clearActiveDiagnostic loginSelectUser loginSubmitPin loginBack closeSpotlight closeNotifPanel
    showFocasScannerModal runFocasScanner saveDiscoveredMachine exportScannerResultsCSV autoCreateMachineFromScan
    runOfflineRootCauseAnalysis selectOfflinePreset printOfflineDiagnosticPDF
    runKeepRelayDiffComparison loadDefaultKeepRelayDiff exportKeepRelayDiffPDF exportKeepRelayDiffCSV filterKeepRelayDiffRows filterKeepRelayDiffMode uploadKeepRelayFile clearKeepRelayInput
  `.trim().split(/\s+/));

  function splitTopLevel(source, separator) {
    const result = [];
    let start = 0, quote = '', depth = 0;
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = '';
      } else if (char === "'" || char === '"') quote = char;
      else if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      else if (char === separator && depth === 0) { result.push(source.slice(start, index).trim()); start = index + 1; }
    }
    result.push(source.slice(start).trim());
    return result.filter(Boolean);
  }

  function parseArgument(source, event, element) {
    const value = source.trim();
    if (value === 'event') return event;
    if (value === 'this') return element;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
    const quoted = value.match(/^(['"])([\s\S]*)\1$/);
    if (quoted) return quoted[2].replace(/\\(['"\\])/g, '$1');
    const field = value.match(/^document\.getElementById\((['"])([\w:-]+)\1\)\.value$/);
    if (field) return document.getElementById(field[2])?.value;
    throw new Error(`İzin verilmeyen inline argüman: ${value}`);
  }

  function executeStatement(statement, event, element) {
    if (statement === 'event.stopPropagation()') { event.stopPropagation(); return; }
    const click = statement.match(/^document\.getElementById\((['"])([\w:-]+)\1\)\.click\(\)$/);
    if (click) { document.getElementById(click[2])?.click(); return; }
    const external = statement.match(/^window\.electronAPI\.openExternal\(([\s\S]*)\)$/);
    if (external) { window.electronAPI.openExternal(parseArgument(external[1], event, element)); return; }
    const call = statement.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
    if (!call || !allowedActions.has(call[1]) || typeof window[call[1]] !== 'function') throw new Error('İzin verilmeyen UI eylemi.');
    const args = call[2].trim() ? splitTopLevel(call[2], ',').map(arg => parseArgument(arg, event, element)) : [];
    return window[call[1]](...args);
  }

  function migrate(root) {
    const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll('*')] : [...document.querySelectorAll('*')];
    for (const element of elements) {
      for (const eventName of ['click', 'change', 'input']) {
        const attribute = `on${eventName}`;
        if (!element.hasAttribute?.(attribute)) continue;
        element.dataset[`inline${eventName[0].toUpperCase()}${eventName.slice(1)}`] = element.getAttribute(attribute);
        element.removeAttribute(attribute);
      }
    }
  }

  for (const eventName of ['click', 'change', 'input']) {
    document.addEventListener(eventName, event => {
      const key = `inline${eventName[0].toUpperCase()}${eventName.slice(1)}`;
      const element = event.target.closest?.(`[data-${key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}]`);
      if (!element) return;
      try { for (const statement of splitTopLevel(element.dataset[key], ';')) executeStatement(statement, event, element); }
      catch (error) { console.error('UI eylemi engellendi:', error); }
    });
  }

  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => migrate(node))))
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => migrate(document));
  else migrate(document);
})();
