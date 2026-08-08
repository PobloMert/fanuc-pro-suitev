(function () {
  'use strict';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function saveJSONDatabase(fileName, key, data) {
    const filePath = `./data/${fileName}`;
    const payload = JSON.stringify(key ? { [key]: data } : data, null, 2);
    try {
      const current = await window.electronAPI.readFile(filePath);
      if (current?.ok && current.data) {
        try { JSON.parse(current.data); await window.electronAPI.writeFile(`${filePath}.bak`, current.data); }
        catch { console.warn(`Mevcut dosya ${fileName} bozuk olduğundan yedeklenmedi.`); }
      }
    } catch (error) { console.error(`${fileName} yedeklenemedi:`, error); }
    let result;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try { result = await window.electronAPI.writeFile(filePath, payload); if (result?.ok) return true; }
      catch (error) { result = { error: error.message }; }
      if (attempt === 1) await wait(1000);
    }
    const message = result?.error || 'Bilinmeyen yazma hatası';
    console.error(`Yazma başarısız (${fileName}): ${message}`);
    window.showToast?.(`Veri kaydedilemedi: ${fileName} yazma hatası. Değişiklikler sadece oturum boyunca geçerlidir. Detay: ${message}`, 'error');
    try {
      await window.electronAPI.writeFile('./data/ui_error_log.txt', `Write Error [${new Date().toISOString()}]: Failed to write ${fileName}. Detail: ${message}\n\n`, 'utf8');
    } catch {}
    return false;
  }
  const definitions = {
    saveMachines: ['machines.json', 'machines', 'machines'], saveMaintenances: ['maintenances.json', 'maintenances', 'maintenances'],
    saveBatteries: ['batteries.json', 'batteries', 'batteries'], saveFans: ['fans.json', 'fans', 'fans'],
    saveWiki: ['wiki.json', 'articles', 'wiki'], saveBackupLogs: ['backup_logs.json', 'backup_logs', 'backup_logs'],
    saveCustomMCodes: ['custom_mcodes.json', 'mcodes', 'custom_mcodes'], saveCustomAlarms: ['custom_alarms.json', 'alarms', 'custom_alarms'],
    saveCustomAlarmNotes: ['custom_alarm_notes.json', 'notes', 'custom_alarm_notes']
  };
  const api = { saveJSONDatabase };
  Object.entries(definitions).forEach(([name, [file, key, stateKey]]) => {
    api[name] = () => saveJSONDatabase(file, key, window.State?.[stateKey] || []);
  });
  window.DataPersistence = Object.freeze(api);
})();
