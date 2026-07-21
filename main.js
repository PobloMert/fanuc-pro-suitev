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
      webSecurity: false, // Set to false to allow local MTConnect Agent HTTP iframe loading
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0f1a',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const ALLOWED_DATA_DIR = path.resolve(path.join(os.homedir(), '.fanuc-pro-suite'));
const APP_ROOT_DATA = path.resolve(path.join(__dirname, 'data'));
const APP_BIN_DIR = path.resolve(path.join(__dirname, 'bin'));

function isSafePath(filePath) {
  if (!filePath) return false;
  // Resolve path to absolute form to prevent traversal (e.g. via '..')
  let resolved = path.isAbsolute(filePath) 
    ? path.resolve(filePath) 
    : path.resolve(path.join(__dirname, filePath));
  
  let allowed = ALLOWED_DATA_DIR;
  let appRoot = APP_ROOT_DATA;
  let appBin = APP_BIN_DIR;

  // On Windows, paths are case-insensitive
  if (process.platform === 'win32') {
    resolved = resolved.toLowerCase();
    allowed = allowed.toLowerCase();
    appRoot = appRoot.toLowerCase();
    appBin = appBin.toLowerCase();
  }
  
  const isInsideAllowedDataDir = resolved.startsWith(allowed + path.sep) || resolved === allowed;
  const isInsideAppRootData = resolved.startsWith(appRoot + path.sep) || resolved === appRoot;
  const isInsideAppBin = resolved.startsWith(appBin + path.sep) || resolved === appBin;
  
  return isInsideAllowedDataDir || isInsideAppRootData || isInsideAppBin;
}

let adapterProcess = null;

function startAdapter() {
  // Terminate any existing instance first to prevent port conflicts
  exec('taskkill /F /IM FanucSHDRAdapter.exe', () => {
    const adapterPath = path.join(__dirname, 'bin', 'FanucSHDRAdapter.exe');
    const adapterCwd = path.join(__dirname, 'bin');
    if (!fs.existsSync(adapterPath)) {
      console.error('FanucSHDRAdapter.exe not found at:', adapterPath);
      return;
    }

    console.log('Spawning FanucSHDRAdapter.exe...');
    setTimeout(() => {
      adapterProcess = spawn(adapterPath, [], {
        cwd: adapterCwd,
        stdio: 'ignore',
        detached: false
      });

      adapterProcess.on('error', (err) => {
        console.error('Failed to start FanucSHDRAdapter:', err);
      });

      adapterProcess.on('close', (code) => {
        console.log(`FanucSHDRAdapter exited with code ${code}`);
        adapterProcess = null;
      });
    }, 800);
  });
}

function stopAdapter() {
  if (adapterProcess) {
    try {
      adapterProcess.kill();
    } catch (e) {}
    adapterProcess = null;
  }
  exec('taskkill /F /IM FanucSHDRAdapter.exe', () => {});
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

// Restart C# Telemetry Adapter
ipcMain.handle('restart-adapter', async () => {
  try {
    startAdapter();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Open external (with Protocol and Safe Path Validation)
ipcMain.on('open-external', (event, url) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      shell.openExternal(url);
    } else if (parsedUrl.protocol === 'app-file:') {
      let filePath = decodeURIComponent(parsedUrl.pathname);
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      if (isSafePath(filePath)) {
        shell.openPath(filePath);
      } else {
        console.warn(`Blocked open-external call for unsafe path: ${filePath}`);
      }
    } else {
      console.warn(`Blocked open-external call for protocol: ${parsedUrl.protocol}`);
    }
  } catch (err) {
    console.error(`Invalid URL in open-external: ${url}`);
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
