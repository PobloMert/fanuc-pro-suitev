/**
 * MTB Elektrik Bakım — Data & JSON Database Loader
 */

import { State, StartupErrors } from './state.js';
import { safeParseJSON, showToast } from './utils.js';

export async function loadJSONDatabase(fileName, key, defaultValue) {
  const filePath = `./data/${fileName}`;
  const backupPath = `${filePath}.bak`;
  let dataStr = null;
  let fromBackup = false;

  // 1. Try reading the primary database file
  let res = await window.electronAPI.readFile(filePath);
  if (res.ok) {
    dataStr = res.data;
  } else {
    StartupErrors.push(`${fileName} ana dosyası okunamadı: ${res.error || 'Dosya bulunamadı'}`);
    
    // Try reading backup file
    let backupRes = await window.electronAPI.readFile(backupPath);
    if (backupRes.ok) {
      dataStr = backupRes.data;
      fromBackup = true;
    }
  }

  // 2. Parse JSON data
  let parsedData = defaultValue;
  if (dataStr && dataStr.trim()) {
    try {
      const parsed = JSON.parse(dataStr);
      parsedData = key ? (parsed[key] !== undefined ? parsed[key] : defaultValue) : parsed;
      
      if (fromBackup) {
        await window.electronAPI.writeFile(filePath, dataStr);
        StartupErrors.push(`${fileName} yedek dosyadan kurtarılarak otomatik onarıldı.`);
      }
    } catch (e) {
      StartupErrors.push(`${fileName} JSON ayrıştırma hatası: ${e.message}`);
      
      if (!fromBackup) {
        let backupRes = await window.electronAPI.readFile(backupPath);
        if (backupRes.ok && backupRes.data.trim()) {
          try {
            const parsed = JSON.parse(backupRes.data);
            parsedData = key ? (parsed[key] !== undefined ? parsed[key] : defaultValue) : parsed;
            await window.electronAPI.writeFile(filePath, backupRes.data);
            StartupErrors.push(`${fileName} bozuk dosya yedek sürümden geri yüklenerek onarıldı.`);
          } catch (backupErr) {
            StartupErrors.push(`${fileName} yedek dosyası da bozuk: ${backupErr.message}`);
          }
        }
      }
    }
  } else {
    try {
      const emptyPayload = key ? JSON.stringify({ [key]: defaultValue }, null, 2) : JSON.stringify(defaultValue, null, 2);
      await window.electronAPI.writeFile(filePath, emptyPayload);
      StartupErrors.push(`${fileName} bulunamadı, şablon otomatik oluşturuldu.`);
    } catch (writeErr) {
      console.error(`Failed to self-heal missing database ${fileName}:`, writeErr);
    }
  }

  return parsedData;
}

export async function loadData() {
  StartupErrors.length = 0; // Reset
  try {
    const results = await Promise.all([
      loadJSONDatabase('alarms.json', 'alarms', []),
      loadJSONDatabase('parameters.json', 'parameters', []),
      loadJSONDatabase('library.json', 'books', []),
      loadJSONDatabase('nc_codes.json', 'nc_codes', []),
      loadJSONDatabase('pmc_signals.json', 'pmc_signals', []),
      loadJSONDatabase('machines.json', 'machines', []),
      loadJSONDatabase('maintenances.json', 'maintenances', []),
      loadJSONDatabase('batteries.json', 'batteries', []),
      loadJSONDatabase('keep_relays.json', 'keep_relays', []),
      loadJSONDatabase('drive_alarms.json', 'drive_alarms', []),
      loadJSONDatabase('fans.json', 'fans', []),
      loadJSONDatabase('wiki.json', 'articles', []),
      loadJSONDatabase('backup_logs.json', 'backup_logs', []),
      loadJSONDatabase('custom_mcodes.json', 'mcodes', []),
      loadJSONDatabase('custom_alarms.json', 'alarms', []),
      loadJSONDatabase('custom_alarm_notes.json', 'notes', {})
    ]);

    State.alarms = results[0];
    State.parameters = results[1];
    State.library = results[2];
    State.nc_codes = results[3];
    State.pmc_signals = results[4];
    State.machines = results[5];
    State.maintenances = results[6];
    State.batteries = results[7];
    State.keep_relays = results[8];
    State.drive_alarms = results[9];
    State.fans = results[10];
    State.wiki = results[11];
    State.backup_logs = results[12];
    State.custom_mcodes = results[13];
    State.custom_alarms = results[14];
    State.custom_alarm_notes = results[15];

    if (StartupErrors.length > 0) {
      console.warn('Veri yükleme sırasında uyarılar oluştu:\n', StartupErrors.join('\n'));
      const warningCount = StartupErrors.filter(e => e.includes('kurtarılarak') || e.includes('onarıldı') || e.includes('bulunamadı')).length;
      const errorCount = StartupErrors.length - warningCount;
      
      if (errorCount > 0) {
        showToast(`Veri yüklemede ${errorCount} hata oluştu. Lütfen log dosyasını kontrol edin.`, 'error');
      } else if (warningCount > 0) {
        showToast(`${warningCount} veritabanı otomatik onarıldı veya oluşturuldu.`, 'info');
      }
      
      try {
        const errText = `Startup Log [${new Date().toISOString()}]:\n` + StartupErrors.join('\n') + '\n\n';
        await window.electronAPI.writeFile('./data/ui_error_log.txt', errText, 'utf8');
      } catch {}
    }
  } catch (e) {
    console.error('Data load exception:', e);
    alert('Kritik veri yükleme hatası: ' + e.message);
  }

  await loadProjects();
}

export async function loadUsers() {
  try {
    const res = await window.electronAPI.readFile('./data/users.json');
    if (res.ok) {
      State.users = safeParseJSON(res.data, 'users', []);
    }
  } catch {}
  if (!State.users.length) {
    State.users = [{ id: 1, name: 'Admin', role: 'admin', pin: '1234', color: '#3b82f6', initials: 'AD' }];
  }
}

export async function loadProjects() {
  try {
    const projDir = State.appDataDir + '/projects';
    const listRes = await window.electronAPI.listDir(projDir);
    if (listRes.ok) {
      State.projects = [];
      for (const item of listRes.items) {
        if (item.isDir) {
          const metaPath = item.path + '/meta.json';
          const metaRes = await window.electronAPI.readFile(metaPath);
          if (metaRes.ok) {
            try { State.projects.push(JSON.parse(metaRes.data)); } catch {}
          }
        }
      }
    }
  } catch {}
}

export async function loadSettings() {
  const settingsPath = State.appDataDir + '/settings.json';
  const res = await window.electronAPI.readFile(settingsPath);
  if (res.ok) {
    try {
      Object.assign(State.settings, JSON.parse(res.data));
      if (!State.settings.pdfPaths) State.settings.pdfPaths = {};
    } catch {}
  }
}

export async function saveSettings() {
  const settingsPath = State.appDataDir + '/settings.json';
  try {
    const res = await window.electronAPI.writeFile(settingsPath, JSON.stringify(State.settings, null, 2));
    if (!res || !res.ok) {
      showToast('Ayarlar kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Ayarlar kaydedilirken hata oluştu: ' + err.message, 'error');
  }
}

if (typeof window !== 'undefined') {
  window.loadData = loadData;
  window.loadUsers = loadUsers;
  window.loadProjects = loadProjects;
  window.loadSettings = loadSettings;
  window.saveSettings = saveSettings;
}
