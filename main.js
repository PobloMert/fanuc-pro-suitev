const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');
const { pathToFileURL } = require('url');

// ── Global Process Uncaught Error & Rejection Handlers ──
process.on('uncaughtException', (err) => {
  console.error('Main Process Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Main Process Unhandled Rejection:', reason);
});

// ── Register app-file scheme as privileged (must be called before app is ready) ──
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-file', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

// ── Redirect userData to local drive (avoids OneDrive cache permission errors) ──
app.setPath('userData', path.join(os.homedir(), '.fanuc-pro-suite', 'electron-data'));
app.setPath('temp',     path.join(os.tmpdir(), 'fanuc-pro-suite'));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    // icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true, // Secure webSecurity enabled with net.fetch proxying
    },

    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0f1a',
    show: true
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load HTML:', errorCode, errorDescription, validatedURL);
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true);
  mainWindow.focus();
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(false);
    }
  }, 1500);


  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
        }
      }, 1500);
    }
  });



  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const ALLOWED_DATA_DIR = path.resolve(path.join(os.homedir(), '.fanuc-pro-suite'));
const APP_ROOT_DATA = path.resolve(path.join(__dirname, 'data'));
const APP_BIN_DIR = path.resolve(path.join(__dirname, 'bin'));
const USER_HOME_DIR = path.resolve(os.homedir());

function isSafePath(filePath) {
  if (!filePath) return false;
  // Resolve path to absolute form to prevent traversal (e.g. via '..')
  let resolved = path.isAbsolute(filePath) 
    ? path.resolve(filePath) 
    : path.resolve(path.join(__dirname, filePath));
  
  let allowed = ALLOWED_DATA_DIR;
  let appRoot = APP_ROOT_DATA;
  let appBin = APP_BIN_DIR;
  let userHome = USER_HOME_DIR;

  // On Windows, paths are case-insensitive
  if (process.platform === 'win32') {
    resolved = resolved.toLowerCase();
    allowed = allowed.toLowerCase();
    appRoot = appRoot.toLowerCase();
    appBin = appBin.toLowerCase();
    userHome = userHome.toLowerCase();
  }
  
  const isInsideAllowedDataDir = resolved.startsWith(allowed + path.sep) || resolved === allowed;
  const isInsideAppRootData = resolved.startsWith(appRoot + path.sep) || resolved === appRoot;
  const isInsideAppBin = resolved.startsWith(appBin + path.sep) || resolved === appBin;
  const isInsideUserHome = resolved.startsWith(userHome + path.sep) || resolved === userHome;
  
  return isInsideAllowedDataDir || isInsideAppRootData || isInsideAppBin || isInsideUserHome;
}

let adapterProcess = null;
let adapterStatus = {
  state: 'stopped', // 'running', 'restarting', 'stopped', 'error', 'starting'
  attempts: 0,
  maxAttempts: 10,
  lastError: null,
  lastStartTime: null
};
let isIntentionalStop = false;
let autoRestartTimer = null;
let healthyDurationTimer = null;

function notifyAdapterStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('adapter-status-changed', adapterStatus);
  }
}

function updateAdapterState(newState, extra = {}) {
  adapterStatus = { ...adapterStatus, state: newState, ...extra };
  console.log(`[Adapter Status] State: ${newState}, Attempts: ${adapterStatus.attempts}/${adapterStatus.maxAttempts}`);
  notifyAdapterStatus();
}

function startAdapter(manualReset = false) {
  isIntentionalStop = false;
  if (manualReset) {
    adapterStatus.attempts = 0;
    adapterStatus.lastError = null;
  }

  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }

  updateAdapterState('starting');

  // Terminate any existing instance first to prevent port conflicts
  exec('taskkill /F /IM FanucSHDRAdapter.exe', () => {
    const adapterPath = path.join(__dirname, 'bin', 'FanucSHDRAdapter.exe');
    const adapterCwd = path.join(__dirname, 'bin');
    if (!fs.existsSync(adapterPath)) {
      const errStr = 'FanucSHDRAdapter.exe bulunamadı: ' + adapterPath;
      console.error(errStr);
      updateAdapterState('error', { lastError: errStr });
      return;
    }

    console.log('Spawning FanucSHDRAdapter.exe...');
    setTimeout(() => {
      try {
        adapterProcess = spawn(adapterPath, [], {
          cwd: adapterCwd,
          stdio: 'ignore',
          detached: false
        });

        adapterStatus.lastStartTime = Date.now();
        updateAdapterState('running');

        // Reset attempt counter after 30 seconds of stable execution
        if (healthyDurationTimer) clearTimeout(healthyDurationTimer);
        healthyDurationTimer = setTimeout(() => {
          if (adapterStatus.state === 'running') {
            adapterStatus.attempts = 0;
            console.log('[Adapter Health] 30s saniye kararlı çalışma sağlandı. Yeniden deneme sayacı sıfırlandı.');
          }
        }, 30000);

        adapterProcess.on('error', (err) => {
          console.error('Failed to start FanucSHDRAdapter:', err);
          handleAdapterCrash(err ? err.message : 'Spawn hatası');
        });

        adapterProcess.on('close', (code) => {
          console.log(`FanucSHDRAdapter exited with code ${code}`);
          adapterProcess = null;
          if (!isIntentionalStop) {
            handleAdapterCrash(`Proses kapandı (kod: ${code})`);
          } else {
            updateAdapterState('stopped');
          }
        });
      } catch (err) {
        console.error('Exception spawning adapter:', err);
        handleAdapterCrash(err.message);
      }
    }, 800);
  });
}

function handleAdapterCrash(errorMsg) {
  if (healthyDurationTimer) {
    clearTimeout(healthyDurationTimer);
    healthyDurationTimer = null;
  }

  adapterStatus.lastError = errorMsg;
  adapterStatus.attempts += 1;

  if (adapterStatus.attempts > adapterStatus.maxAttempts) {
    updateAdapterState('error', { lastError: `Maksimum yeniden deneme sınırına ulaşıldı (${adapterStatus.maxAttempts}).` });
    console.error('[Adapter Error] Maksimum yeniden deneme sınırına ulaşıldı.');
    return;
  }

  // Exponential backoff delay (1s, 2s, 4s, 8s, up to 30s max)
  const delay = Math.min(30000, 1000 * Math.pow(2, adapterStatus.attempts - 1));
  updateAdapterState('restarting', { nextRetryDelayMs: delay });

  console.log(`[Adapter Auto-Restart] ${delay}ms sonra yeniden başlatılacak (Deneme ${adapterStatus.attempts}/${adapterStatus.maxAttempts})...`);
  autoRestartTimer = setTimeout(() => {
    startAdapter();
  }, delay);
}

function stopAdapter() {
  isIntentionalStop = true;
  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }
  if (healthyDurationTimer) {
    clearTimeout(healthyDurationTimer);
    healthyDurationTimer = null;
  }
  if (adapterProcess) {
    try {
      adapterProcess.kill();
    } catch (e) {}
    adapterProcess = null;
  }
  exec('taskkill /F /IM FanucSHDRAdapter.exe', () => {});
  updateAdapterState('stopped');
}


// App lifecycle
app.whenReady().then(() => {
  // Handle custom file protocol to securely serve local PDFs under webSecurity: true
  protocol.handle('app-file', (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      // Security Validation: prevent arbitrary local file read path traversal
      if (!isSafePath(filePath)) {
        return new Response('Access Denied: Path is outside allowed directories.', { status: 403 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      return new Response('Invalid path', { status: 400 });
    }
  });

  startAdapter();
  createWindow();
  
  // Trigger automatic daily snapshot backup
  setTimeout(() => {
    performAutoBackup();
  }, 3000);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on('window-all-closed', () => {
  stopAdapter();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  stopAdapter();
});

// ── IPC Handlers ──────────────────────────────────────────────

// Window controls
ipcMain.on('window-minimize', () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  } catch (err) {
    console.error('Error minimizing window:', err);
  }
});
ipcMain.on('window-maximize', () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
  } catch (err) {
    console.error('Error maximizing window:', err);
  }
});
ipcMain.on('window-close', () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  } catch (err) {
    console.error('Error closing window:', err);
  }
});

// File dialog – open
ipcMain.handle('dialog-open-file', async (event, filters) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  } catch (err) {
    console.error('Error opening file dialog:', err);
    return null;
  }
});

// File dialog – save
ipcMain.handle('dialog-save-file', async (event, filters, defaultName) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || 'untitled',
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    if (result.canceled) return null;
    return result.filePath;
  } catch (err) {
    console.error('Error saving file dialog:', err);
    return null;
  }
});

// Read file (with Path Validation)
ipcMain.handle('fs-read-file', async (event, filePath, encoding) => {
  try {
    const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(path.join(__dirname, filePath));
    if (!isSafePath(resolved)) {
      return { ok: false, error: 'Access Denied: Path is outside allowed directories.' };
    }
    if (encoding === 'binary') {
      const buf = fs.readFileSync(resolved);
      return { ok: true, data: Array.from(buf) };
    }
    const data = fs.readFileSync(resolved, encoding || 'utf8');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Write file (with Path Validation & Atomic Writes)
ipcMain.handle('fs-write-file', async (event, filePath, data, encoding) => {
  try {
    const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(path.join(__dirname, filePath));
    if (!isSafePath(resolved)) {
      return { ok: false, error: 'Access Denied: Path is outside allowed directories.' };
    }
    
    // Ensure the target directory exists
    const parentDir = path.dirname(resolved);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Atomic write using a temp file
    const tempPath = resolved + '.tmp';
    try {
      if (Array.isArray(data)) {
        fs.writeFileSync(tempPath, Buffer.from(data));
      } else {
        fs.writeFileSync(tempPath, data, encoding || 'utf8');
      }
      fs.renameSync(tempPath, resolved);
      return { ok: true };
    } catch (writeErr) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      throw writeErr;
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// App data dir
ipcMain.handle('get-app-data-dir', () => {
  try {
    const dir = path.join(os.homedir(), '.fanuc-pro-suite');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // sub-dirs
    ['projects', 'library'].forEach(sub => {
      const p = path.join(dir, sub);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });
    return dir;
  } catch (err) {
    console.error('Failed to initialize app data directories:', err);
    return path.join(os.homedir(), '.fanuc-pro-suite');
  }
});

// List directory (with Path Validation)
ipcMain.handle('fs-list-dir', async (event, dirPath) => {
  try {
    const resolved = path.isAbsolute(dirPath) ? path.resolve(dirPath) : path.resolve(path.join(__dirname, dirPath));
    if (!isSafePath(resolved)) {
      return { ok: false, error: 'Access Denied: Path is outside allowed directories.' };
    }
    const items = fs.readdirSync(resolved, { withFileTypes: true });
    return {
      ok: true,
      items: items.map(i => ({
        name: i.name,
        isDir: i.isDirectory(),
        path: path.join(resolved, i.name)
      }))
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Ensure dir (with Path Validation)
ipcMain.handle('fs-ensure-dir', async (event, dirPath) => {
  try {
    const resolved = path.isAbsolute(dirPath) ? path.resolve(dirPath) : path.resolve(path.join(__dirname, dirPath));
    if (!isSafePath(resolved)) {
      return { ok: false, error: 'Access Denied: Path is outside allowed directories.' };
    }
    if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Telemetry Adapter Status & Control
ipcMain.handle('get-adapter-status', () => {
  return { ok: true, data: adapterStatus };
});

ipcMain.handle('restart-adapter', async () => {
  try {
    startAdapter(true);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// REAL TCP Socket Connectivity Check
ipcMain.handle('ping-tcp-port', async (event, { host, port, timeoutMs = 2500 }) => {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    let isSettled = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve({ ok: true, connected: true });
      }
    });

    socket.on('timeout', () => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve({ ok: false, error: 'Bağlantı Zaman Aşımı (Timeout). Cihaz veya Port yanıt vermiyor.' });
      }
    });

    socket.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve({ ok: false, error: `Bağlantı Reddedildi (${err.message})` });
      }
    });

    try {
      socket.connect(port, host);
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
});



// Open external (with Protocol and Safe Path Validation)
ipcMain.on('open-external', (event, targetPath) => {
  try {
    if (!targetPath) return;
    if (typeof targetPath === 'string' && (targetPath.startsWith('http://') || targetPath.startsWith('https://'))) {
      shell.openExternal(targetPath);
      return;
    }

    let filePath = targetPath;
    if (targetPath.startsWith('app-file://')) {
      filePath = targetPath.replace('app-file://', '');
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
    }

    filePath = path.resolve(decodeURIComponent(filePath));
    if (isSafePath(filePath)) {
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
      shell.openPath(filePath);
    } else {
      console.warn(`Blocked open-external call for unsafe path: ${filePath}`);
    }
  } catch (err) {
    console.error(`Invalid URL or path in open-external: ${targetPath}`, err);
  }
});


// Export CSV
ipcMain.handle('export-csv', async (event, csvContent, defaultName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || 'export.csv',
      filters: [{ name: 'CSV Dosyası', extensions: ['csv'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false };
    
    const resolved = path.resolve(result.filePath);
    const parentDir = path.dirname(resolved);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(resolved, '\ufeff' + csvContent, 'utf8'); // BOM for Excel
    return { ok: true, filePath: resolved };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Show native notification
ipcMain.on('show-notification', (event, { title, body }) => {
  try {
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show();
    }
  } catch (err) {
    console.error('Error showing notification:', err);
  }
});

// Print to PDF
ipcMain.handle('print-to-pdf', async (event, htmlContent, defaultName) => {
  let printWin = null;
  let tempPath = null;
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || 'rapor.pdf',
      filters: [{ name: 'PDF Dosyası', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false };

    // Create a hidden BrowserWindow to render the HTML
    printWin = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: { 
        nodeIntegration: false, 
        contextIsolation: true,
        webSecurity: true
      }
    });

    // Write HTML content to a secure temporary file to avoid URL length limits on large reports
    const tempDir = app.getPath('temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempPath = path.join(tempDir, `print_temp_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);
    fs.writeFileSync(tempPath, htmlContent, 'utf8');

    // Load local HTML file
    await printWin.loadFile(tempPath);

    // Small delay for rendering
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: false,
      margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    });

    fs.writeFileSync(result.filePath, pdfData);
    return { ok: true, filePath: result.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) {
      try {
        printWin.close();
      } catch (e) {
        console.error('Error closing print window:', e);
      }
    }
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        console.error('Error deleting temp HTML file:', e);
      }
    }
  }
});

// ── Auto-Backup Engine ──────────────────────────────────────────
async function performAutoBackup() {
  try {
    const backupDir = path.join(os.homedir(), '.fanuc-pro-suite', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const filesToBackup = [
      'alarms.json', 'parameters.json', 'machines.json', 'maintenances.json',
      'batteries.json', 'fans.json', 'users.json', 'keep_relays.json',
      'wiki.json', 'custom_alarms.json', 'custom_mcodes.json', 'custom_alarm_notes.json'
    ];

    const snapshot = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {}
    };

    for (const file of filesToBackup) {
      const p = path.join(__dirname, 'data', file);
      if (fs.existsSync(p)) {
        try {
          snapshot.data[file] = fs.readFileSync(p, 'utf8');
        } catch {}
      }
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(backupDir, `backup_${dateStr}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log('[Auto-Backup] Snapshot created:', backupFile);

    // Retain last 30 daily backup snapshots
    const existing = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (existing.length > 30) {
      existing.slice(30).forEach(old => {
        try { fs.unlinkSync(old.path); } catch {}
      });
    }
    return { ok: true, file: backupFile };
  } catch (err) {
    console.error('[Auto-Backup Error]:', err);
    return { ok: false, error: err.message };
  }
}

// IPC Handlers for Backup & Restore
ipcMain.handle('get-backups-list', async () => {
  try {
    const backupDir = path.join(os.homedir(), '.fanuc-pro-suite', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => {
        const full = path.join(backupDir, f);
        const stat = fs.statSync(full);
        return {
          filename: f,
          path: full,
          sizeBytes: stat.size,
          mtime: stat.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    return { ok: true, items: files };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('create-manual-backup', async () => {
  return await performAutoBackup();
});

ipcMain.handle('restore-backup', async (event, backupFilePath) => {
  try {
    if (!fs.existsSync(backupFilePath)) return { ok: false, error: 'Yedek dosyası bulunamadı.' };
    const content = fs.readFileSync(backupFilePath, 'utf8');
    const snapshot = JSON.parse(content);
    if (!snapshot || !snapshot.data) return { ok: false, error: 'Geçersiz yedek dosyası formatı.' };

    for (const [fileName, fileData] of Object.entries(snapshot.data)) {
      const targetPath = path.join(__dirname, 'data', fileName);
      if (isSafePath(targetPath)) {
        fs.writeFileSync(targetPath, fileData, 'utf8');
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC Handler for Secure Fetch Proxy (webSecurity: true compliance)
ipcMain.handle('fetch-proxy', async (event, url, options = {}) => {
  try {
    const response = await net.fetch(url, options);
    const text = await response.text();
    return { ok: true, status: response.status, data: text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC Handler for PDF Text Search
ipcMain.handle('search-pdf-text', async (event, pdfPath, query) => {
  try {
    const resolved = path.isAbsolute(pdfPath) ? path.resolve(pdfPath) : path.resolve(path.join(__dirname, pdfPath));
    if (!isSafePath(resolved) || !fs.existsSync(resolved)) {
      return { ok: false, error: 'Dosya bulunamadı veya erişim engellendi.' };
    }

    const buf = fs.readFileSync(resolved);
    const textContent = buf.toString('latin1');
    const q = (query || '').toLowerCase();
    
    const matches = [];
    const lowerText = textContent.toLowerCase();
    let pos = 0;
    let count = 0;
    while ((pos = lowerText.indexOf(q, pos)) !== -1 && count < 10) {
      const start = Math.max(0, pos - 40);
      const end = Math.min(textContent.length, pos + query.length + 40);
      const snippet = textContent.slice(start, end).replace(/[\r\n]+/g, ' ');
      matches.push({ pos, snippet });
      pos += query.length + 5;
      count++;
    }

    return { ok: true, matches };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

