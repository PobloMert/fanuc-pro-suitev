const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, net, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { DataStore } = require('./lib/data-store');
const { StructuredLogger } = require('./lib/structured-logger');
const { can } = require('./lib/permissions');

if (process.env.FANUC_SMOKE_TEST === '1') app.disableHardwareAcceleration();

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
const configuredDataDir = process.env.FANUC_DATA_DIR ? path.resolve(process.env.FANUC_DATA_DIR) : path.join(os.homedir(), '.fanuc-pro-suite');
app.setPath('userData', path.join(configuredDataDir, 'electron-data'));
app.setPath('temp',     path.join(os.tmpdir(), 'fanuc-pro-suite'));

let mainWindow;
let dataStore;
let logger;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
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

const ALLOWED_DATA_DIR = path.resolve(configuredDataDir);
const APP_ROOT_DATA = path.resolve(path.join(__dirname, 'data'));
const APP_BIN_DIR = path.resolve(app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin')
  : path.join(__dirname, 'bin'));
const ADAPTER_RUNTIME_DIR = path.join(ALLOWED_DATA_DIR, 'adapter');
const ADAPTER_CONFIG_FILE = path.join(ADAPTER_RUNTIME_DIR, 'adapter.config.json');
const USERS_FILE = path.join(APP_ROOT_DATA, 'users.json');
const SECRETS_FILE = path.join(ALLOWED_DATA_DIR, 'secrets.json');
const KNOWLEDGE_PREFS_FILE = path.join(ALLOWED_DATA_DIR, 'knowledge-preferences.json');
const sessions = new Map();
const grantedPaths = new Set();

function isInternetEnabled() {
  try {
    const settingsPath = path.join(ALLOWED_DATA_DIR, 'settings.json');
    if (!fs.existsSync(settingsPath)) return true;
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8')).internetEnabled !== false;
  } catch { return true; }
}

function getConfiguredBackupDir() {
  const fallback = path.join(ALLOWED_DATA_DIR, 'backups');
  try {
    const settingsPath = path.join(ALLOWED_DATA_DIR, 'settings.json');
    if (!fs.existsSync(settingsPath)) return fallback;
    const selected = String(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).backupDirectory || '').trim();
    if (!selected || !path.isAbsolute(selected)) return fallback;
    const resolved = path.resolve(selected);
    const relative = path.relative(path.resolve(os.homedir()), resolved);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? resolved : fallback;
  } catch { return fallback; }
}

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
  const isExplicitlyGranted = grantedPaths.has(resolved);
  return isInsideAllowedDataDir || isInsideAppRootData || isInsideAppBin || isExplicitlyGranted;
}

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return { pinSalt: salt, pinHash: crypto.scryptSync(String(pin), salt, 64).toString('hex') };
}

function verifyPin(pin, user) {
  if (!user.pinHash || !user.pinSalt) return false;
  const actual = Buffer.from(hashPin(pin, user.pinSalt).pinHash, 'hex');
  const expected = Buffer.from(user.pinHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function publicUser(user) {
  const { pin, pinHash, pinSalt, ...safe } = user;
  return safe;
}

function loadUsersSecure() {
  const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  let changed = false;
  parsed.users = (parsed.users || []).map(user => {
    if (user.pin && !user.pinHash) {
      changed = true;
      const { pin, ...rest } = user;
      return { ...rest, ...hashPin(pin) };
    }
    return user;
  });
  if (changed) fs.writeFileSync(USERS_FILE, JSON.stringify(parsed, null, 2), 'utf8');
  return parsed.users;
}

function requireSession(event, roles = []) {
  const session = sessions.get(event.sender.id);
  if (!session) throw new Error('Oturum gerekli.');
  if (roles.length && !roles.includes(session.user.role)) throw new Error('Bu işlem için yetkiniz yok.');
  return session;
}

function requirePermission(event, permission) {
  const session = requireSession(event);
  if (!can(session.user.role, permission)) throw new Error('Bu işlem için yetkiniz yok.');
  return session;
}

function writeAudit(action, user, details = {}) {
  const dir = path.join(ALLOWED_DATA_DIR, 'audit');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'security.jsonl'), JSON.stringify({ timestamp: new Date().toISOString(), action, userId: user?.id || null, userName: user?.name || 'system', details }) + '\n');
}

function verifyAdapterIntegrity(adapterDir) {
  const manifestPath = path.join(adapterDir, 'adapter.integrity.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [fileName, expected] of Object.entries(manifest)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(adapterDir, fileName))).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))) {
      throw new Error(`Adaptör bütünlük kontrolü başarısız: ${fileName}`);
    }
  }
}

function ensureAdapterRuntime() {
  fs.mkdirSync(ADAPTER_RUNTIME_DIR, { recursive: true });
  if (!fs.existsSync(APP_BIN_DIR)) throw new Error(`Paketlenmiş adaptör klasörü bulunamadı: ${APP_BIN_DIR}`);
  for (const entry of fs.readdirSync(APP_BIN_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === 'adapter.config.json' || entry.name === 'adapter_crash.log') continue;
    fs.copyFileSync(path.join(APP_BIN_DIR, entry.name), path.join(ADAPTER_RUNTIME_DIR, entry.name));
  }
  if (!fs.existsSync(ADAPTER_CONFIG_FILE)) {
    fs.copyFileSync(path.join(APP_BIN_DIR, 'adapter.config.json'), ADAPTER_CONFIG_FILE);
  }
  verifyAdapterIntegrity(ADAPTER_RUNTIME_DIR);
}

function resolveDataPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  if (normalized === 'bin/adapter.config.json') return ADAPTER_CONFIG_FILE;
  return path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(path.join(__dirname, filePath));
}

function migrateLegacyAISecret() {
  const settingsPath = path.join(ALLOWED_DATA_DIR, 'settings.json');
  if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(settingsPath)) return;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!settings.aiApiKey) return;
  fs.mkdirSync(ALLOWED_DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRETS_FILE, JSON.stringify({ aiApiKey: safeStorage.encryptString(String(settings.aiApiKey)).toString('base64') }), 'utf8');
  delete settings.aiApiKey;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  writeAudit('secret.migrated', null);
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
let isSpawning = false;
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
  if (logger) logger.write('adapter', newState === 'error' ? 'error' : 'info', 'Adapter state changed', adapterStatus);
  notifyAdapterStatus();
}

function startAdapter(manualReset = false) {
  isIntentionalStop = false;
  if (manualReset) {
    adapterStatus.attempts = 0;
    adapterStatus.lastError = null;
  }

  // ── Guard: prevent concurrent spawn calls ──
  if (isSpawning) {
    console.log('[Adapter] startAdapter() ignored: a spawn is already in progress.');
    return;
  }

  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }

  updateAdapterState('starting');
  isSpawning = true;

  // Never terminate adapters owned by another application. Only this child PID is managed.
  if (adapterProcess && !adapterProcess.killed) {
    console.log('[Adapter] Existing managed process is still running; restart ignored.');
    isSpawning = false;
    updateAdapterState('running');
    return;
  }
  {
    const adapterPath = path.join(ADAPTER_RUNTIME_DIR, 'FanucSHDRAdapter.exe');
    const adapterCwd = ADAPTER_RUNTIME_DIR;
    try {
      ensureAdapterRuntime();
    } catch (err) {
      updateAdapterState('error', { lastError: err.message });
      isSpawning = false;
      return;
    }
    if (!fs.existsSync(adapterPath)) {
      const errStr = 'FanucSHDRAdapter.exe bulunamadı: ' + adapterPath;
      console.error(errStr);
      updateAdapterState('error', { lastError: errStr });
      isSpawning = false;
      return;
    }

    try {
      verifyAdapterIntegrity(adapterCwd);
    } catch (err) {
      updateAdapterState('error', { lastError: err.message });
      isSpawning = false;
      return;
    }

    console.log('Spawning FanucSHDRAdapter.exe...');
    // Wait 2000ms for OS to release ports 7880, 7881, 8090
    setTimeout(() => {
      try {
        const adapterLogPath = path.join(adapterCwd, 'adapter_crash.log');
        const logStream = fs.createWriteStream(adapterLogPath, { flags: 'a' });
        logStream.write(`\n=== Adapter Start: ${new Date().toISOString()} ===\n`);

        adapterProcess = spawn(adapterPath, [], {
          cwd: adapterCwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });

        adapterProcess.stdout.on('data', (d) => logStream.write(d));
        adapterProcess.stderr.on('data', (d) => logStream.write('[STDERR] ' + d));

        adapterStatus.lastStartTime = Date.now();
        updateAdapterState('running');
        isSpawning = false;

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
          isSpawning = false;
          handleAdapterCrash(err ? err.message : 'Spawn hatası');
        });

        adapterProcess.on('close', (code) => {
          console.log(`FanucSHDRAdapter exited with code ${code}`);
          adapterProcess = null;
          isSpawning = false;
          if (!isIntentionalStop) {
            handleAdapterCrash(`Proses kapandı (kod: ${code})`);
          } else {
            updateAdapterState('stopped');
          }
        });
      } catch (err) {
        console.error('Exception spawning adapter:', err);
        isSpawning = false;
        handleAdapterCrash(err.message);
      }
    }, 2000);
  }
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
  updateAdapterState('stopped');
}


// App lifecycle
app.whenReady().then(() => {
  logger = new StructuredLogger(path.join(ALLOWED_DATA_DIR, 'logs'));
  dataStore = new DataStore(path.join(ALLOWED_DATA_DIR, 'fanuc-pro-suite.db'), APP_ROOT_DATA);
  dataStore.migrateJsonDirectory();
  const retentionDays = (() => { try { const p=path.join(ALLOWED_DATA_DIR,'settings.json'); return fs.existsSync(p) ? Number(JSON.parse(fs.readFileSync(p,'utf8')).retentionDays)||30 : 30; } catch { return 30; } })();
  dataStore.purgeTelemetry(retentionDays);
  setInterval(() => { try { const p=path.join(ALLOWED_DATA_DIR,'settings.json'); const days=fs.existsSync(p)?Number(JSON.parse(fs.readFileSync(p,'utf8')).retentionDays)||30:30; const deleted=dataStore.purgeTelemetry(days); if(deleted) logger.write('data','info','Telemetry retention completed',{deleted,rawDays:days}); } catch(err){ logger.write('data','error','Telemetry retention failed',{error:err.message}); } }, 24*60*60*1000).unref();
  logger.write('application', 'info', 'Application started', { version: app.getVersion(), dataStore: dataStore.status() });
  try { migrateLegacyAISecret(); } catch (err) { console.error('Secret migration failed:', err); }
  try { ensureAdapterRuntime(); } catch (err) { console.error('Adapter runtime preparation failed:', err); }
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

  if (process.env.FANUC_SIMULATION !== '1') startAdapter();
  createWindow();
  if (process.env.FANUC_SMOKE_TEST === '1') setTimeout(() => app.quit(), 5000);
  
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
  if (dataStore) dataStore.close();
});

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('auth-list-users', () => {
  try { return { ok: true, users: loadUsersSecure().map(publicUser) }; }
  catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('auth-login', (event, userId, pin) => {
  try {
    const user = loadUsersSecure().find(item => item.id === userId);
    if (!user || !verifyPin(pin, user)) return { ok: false, error: 'Hatalı kullanıcı veya PIN.' };
    const session = { user: publicUser(user), createdAt: Date.now() };
    sessions.set(event.sender.id, session);
    event.sender.once('destroyed', () => sessions.delete(event.sender.id));
    writeAudit('auth.login', session.user);
    return { ok: true, user: session.user };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('auth-logout', event => {
  const session = sessions.get(event.sender.id);
  if (session) writeAudit('auth.logout', session.user);
  sessions.delete(event.sender.id);
  return { ok: true };
});

ipcMain.handle('data-store-status', event => {
  try { requireSession(event); return { ok: true, data: dataStore.status() }; }
  catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('records-list', (event, collection) => {
  try { requirePermission(event, 'records.read'); return { ok: true, items: dataStore.listRecords(String(collection)) }; }
  catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('records-upsert', (event, collection, id, record) => {
  try { const session=requirePermission(event,'records.write'); dataStore.upsertRecord(String(collection),id,record); writeAudit('record.upsert',session.user,{collection,id}); return {ok:true}; }
  catch(err){ return {ok:false,error:err.message}; }
});
ipcMain.handle('records-delete', (event, collection, id) => {
  try { const session=requirePermission(event,'records.delete'); const deleted=dataStore.deleteRecord(String(collection),id); writeAudit('record.delete',session.user,{collection,id}); return {ok:true,deleted}; }
  catch(err){ return {ok:false,error:err.message}; }
});

ipcMain.handle('telemetry-record', (event, samples) => {
  try { requirePermission(event,'telemetry.read'); (Array.isArray(samples)?samples:[]).slice(0,20).forEach(s=>dataStore.insertTelemetry(s)); return {ok:true}; }
  catch(err){return {ok:false,error:err.message};}
});
ipcMain.handle('telemetry-query', (event, machine, since, limit) => {
  try { requirePermission(event,'telemetry.read'); return {ok:true,items:dataStore.queryTelemetry(machine,since,limit)}; }
  catch(err){return {ok:false,error:err.message};}
});
ipcMain.handle('telemetry-summary', (event, since) => {
  try { requirePermission(event,'telemetry.read'); return {ok:true,items:dataStore.telemetrySummary(since),alarms:dataStore.alarmAnalytics(since)}; }
  catch(err){return {ok:false,error:err.message};}
});
ipcMain.handle('alarm-record', (event, alarm) => {
  try { requirePermission(event,'telemetry.read'); dataStore.recordAlarm(alarm); return {ok:true}; }
  catch(err){return {ok:false,error:err.message};}
});
ipcMain.handle('retention-run', event => {
  try { const session=requirePermission(event,'records.delete'); const deleted=dataStore.purgeTelemetry(30); writeAudit('retention.run',session.user,{deleted}); return {ok:true,deleted}; }
  catch(err){return {ok:false,error:err.message};}
});

ipcMain.handle('backup-health', event => {
  try {
    requirePermission(event,'records.read');
    const dir=path.join(ALLOWED_DATA_DIR,'backups');
    const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>path.join(dir,f)):[];
    if(!files.length)return {ok:true,data:{status:'missing',message:'Henüz yedek yok'}};
    const latest=files.sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
    const raw=fs.readFileSync(latest,'utf8'); JSON.parse(raw);
    return {ok:true,data:{status:'healthy',file:path.basename(latest),ageMs:Date.now()-fs.statSync(latest).mtimeMs,sha256:crypto.createHash('sha256').update(raw).digest('hex')}};
  } catch(err){return {ok:true,data:{status:'invalid',message:err.message}};}
});

ipcMain.handle('auth-add-user', (event, input) => {
  try {
    const actor = requireSession(event, ['admin']);
    if (!input?.name || !/^\d{4,6}$/.test(input.pin || '')) throw new Error('Geçerli ad ve 4-6 haneli PIN gerekli.');
    if (!['admin', 'technician', 'operator'].includes(input.role)) throw new Error('Geçersiz rol.');
    const users = loadUsersSecure();
    const user = { id: Date.now(), name: String(input.name).slice(0, 80), role: input.role, initials: String(input.initials || '').slice(0, 2), color: input.color || '#3b82f6', ...hashPin(input.pin) };
    users.push(user);
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), 'utf8');
    writeAudit('user.create', actor.user, { targetUserId: user.id, role: user.role });
    return { ok: true, user: publicUser(user) };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('auth-delete-user', (event, userId) => {
  try {
    const actor = requireSession(event, ['admin']);
    if (actor.user.id === userId) throw new Error('Kendi hesabınızı silemezsiniz.');
    const users = loadUsersSecure();
    const updated = users.filter(user => user.id !== userId);
    if (updated.length === users.length) throw new Error('Kullanıcı bulunamadı.');
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: updated }, null, 2), 'utf8');
    writeAudit('user.delete', actor.user, { targetUserId: userId });
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('auth-change-pin', (event, oldPin, newPin) => {
  try {
    const session = requireSession(event);
    if (!/^\d{4,6}$/.test(newPin || '')) throw new Error('Yeni PIN 4-6 haneli olmalı.');
    const users = loadUsersSecure();
    const index = users.findIndex(user => user.id === session.user.id);
    if (index < 0 || !verifyPin(oldPin, users[index])) throw new Error('Mevcut PIN hatalı.');
    Object.assign(users[index], hashPin(newPin));
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), 'utf8');
    writeAudit('user.pin_change', session.user);
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('secret-get', event => {
  try {
    requireSession(event, ['admin']);
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(SECRETS_FILE)) return { ok: true, value: '' };
    const stored = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
    return { ok: true, value: safeStorage.decryptString(Buffer.from(stored.aiApiKey, 'base64')) };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('secret-set', (event, value) => {
  try {
    requireSession(event, ['admin']);
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows güvenli depolama kullanılamıyor.');
    fs.mkdirSync(ALLOWED_DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRETS_FILE, JSON.stringify({ aiApiKey: safeStorage.encryptString(String(value || '')).toString('base64') }), 'utf8');
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('knowledge-preferences-get', () => {
  try {
    if (!fs.existsSync(KNOWLEDGE_PREFS_FILE)) return { ok: true, data: { favorites: [], recent: [], notes: {} } };
    return { ok: true, data: JSON.parse(fs.readFileSync(KNOWLEDGE_PREFS_FILE, 'utf8')) };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('knowledge-preferences-set', (event, input = {}) => {
  try {
    requireSession(event);
    const favorites = Array.isArray(input.favorites) ? input.favorites.map(String).slice(0, 200) : [];
    const recent = Array.isArray(input.recent) ? input.recent.map(String).slice(0, 20) : [];
    const notes = {};
    for (const [key, value] of Object.entries(input.notes || {}).slice(0, 500)) notes[String(key).slice(0, 100)] = String(value).slice(0, 20000);
    fs.mkdirSync(ALLOWED_DATA_DIR, { recursive: true });
    fs.writeFileSync(KNOWLEDGE_PREFS_FILE, JSON.stringify({ favorites, recent, notes }, null, 2), 'utf8');
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('ai-complete', async (event, request) => {
  try {
    const session = requireSession(event, ['admin', 'technician']);
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(SECRETS_FILE)) throw new Error('AI API anahtarı yapılandırılmamış.');
    const encrypted = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')).aiApiKey;
    const apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    const settingsPath = path.join(ALLOWED_DATA_DIR, 'settings.json');
    const appSettings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
    if (appSettings.internetEnabled === false) throw new Error('İnternet erişimi Ayarlar bölümünden kapatılmış.');
    const provider = request?.provider;
    const history = Array.isArray(request?.history) ? request.history.slice(-8) : [];
    const userMessage = String(request?.userMessage || '').slice(0, 12000);
    const systemPrompt = 'Sen FANUC CNC konusunda salt-okunur teknik asistansın. Türkçe yanıt ver. Yalnızca kullanıcı mesajındaki YEREL KAYNAKLAR bölümüne dayanan teknik ayrıntıları kesin ifade et ve kullandığın kaynak kimliklerini [Kaynak: ...] biçiminde belirt. Kaynak yoksa kesin teşhis veya değer verme; belirsizliği açıkça söyle. CNC üzerinde işlem yaptığını veya komut gönderebildiğini asla iddia etme. Her yanıtın sonunda bunun yalnızca öneri olduğunu ve yetkili teknisyen doğrulaması gerektiğini belirt.';
    let response;
    if (provider === 'openai') {
      response = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: request.model || 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: userMessage }], max_tokens: 1500, temperature: 0.4 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`OpenAI API hatası: ${response.status}`);
      writeAudit('ai.request', session.user, { provider, model: request.model || 'gpt-4o' });
      return { ok: true, content: data.choices?.[0]?.message?.content || '', confidence: 'advisory', requiresTechnicianVerification: true };
    }
    if (provider === 'gemini') {
      const model = String(request.model || 'gemini-pro').replace(/[^a-zA-Z0-9._-]/g, '');
      response = await net.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`Gemini API hatası: ${response.status}`);
      writeAudit('ai.request', session.user, { provider, model });
      return { ok: true, content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', confidence: 'advisory', requiresTechnicianVerification: true };
    }
    throw new Error('Desteklenmeyen AI sağlayıcısı.');
  } catch (err) {
    if (logger) logger.write('security', 'warning', 'AI request rejected', { error: err.message });
    return { ok: false, error: err.message };
  }
});

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
    const selected = path.resolve(result.filePaths[0]);
    grantedPaths.add(process.platform === 'win32' ? selected.toLowerCase() : selected);
    return selected;
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
    const selected = path.resolve(result.filePath);
    grantedPaths.add(process.platform === 'win32' ? selected.toLowerCase() : selected);
    return selected;
  } catch (err) {
    console.error('Error saving file dialog:', err);
    return null;
  }
});

// Read file (with Path Validation)
ipcMain.handle('fs-read-file', async (event, filePath, encoding) => {
  try {
    const resolved = resolveDataPath(filePath);
    if (!isSafePath(resolved)) {
      return { ok: false, error: 'Access Denied: Path is outside allowed directories.' };
    }
    if (resolved.toLowerCase() === USERS_FILE.toLowerCase()) {
      return { ok: false, error: 'Kullanıcı verileri yalnızca güvenli kimlik API\'siyle değiştirilebilir.' };
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
    const resolved = resolveDataPath(filePath);
    if (!isSafePath(resolved)) {
      return { ok: false, error: 'Access Denied: Path is outside allowed directories.' };
    }
    if (dataStore && path.dirname(resolved).toLowerCase() === APP_ROOT_DATA.toLowerCase() && path.extname(resolved).toLowerCase() === '.json') {
      const stored = dataStore.readDocument(path.basename(resolved));
      if (stored !== null) return { ok: true, data: stored };
    }
    if (resolved.toLowerCase() === USERS_FILE.toLowerCase()) {
      return { ok: false, error: 'Kullanıcı verileri yalnızca güvenli kimlik API\'siyle değiştirilebilir.' };
    }
    const isUiLog = path.basename(resolved).toLowerCase() === 'ui_error_log.txt';
    if (!isUiLog) requireSession(event, ['admin', 'technician']);
    if (resolved.toLowerCase().startsWith((APP_BIN_DIR + path.sep).toLowerCase())) {
      requireSession(event, ['admin']);
    }
    if (dataStore && path.dirname(resolved).toLowerCase() === APP_ROOT_DATA.toLowerCase() && path.extname(resolved).toLowerCase() === '.json') {
      dataStore.writeDocument(path.basename(resolved), String(data));
      logger.write('data', 'info', 'Document updated', { name: path.basename(resolved) });
      return { ok: true };
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
    requireSession(event, ['admin', 'technician']);
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

ipcMain.handle('restart-adapter', async (event) => {
  try {
    requireSession(event, ['admin', 'technician']);
    stopAdapter();
    setTimeout(() => startAdapter(true), 2000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// REAL TCP Socket Connectivity Check
ipcMain.handle('ping-tcp-port', async (event, { host, port, timeoutMs = 2500 }) => {
  requireSession(event, ['admin', 'technician']);
  const normalizedHost = String(host || '').trim();
  const isPrivateHost = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || /^10\./.test(normalizedHost) || /^192\.168\./.test(normalizedHost) || /^172\.(1[6-9]|2\d|3[01])\./.test(normalizedHost);
  if (!isPrivateHost || !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
    return { ok: false, error: 'Yalnızca özel ağdaki geçerli CNC hedeflerine izin verilir.' };
  }
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
    if (typeof targetPath === 'string' && targetPath.startsWith('https://')) {
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
    const backupDir = getConfiguredBackupDir();
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
    const backupDir = getConfiguredBackupDir();
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

ipcMain.handle('create-manual-backup', async (event) => {
  try {
    const session = requireSession(event, ['admin', 'technician']);
    const result = await performAutoBackup();
    if (result.ok) writeAudit('backup.create', session.user, { file: path.basename(result.file) });
    return result;
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('dialog-open-directory', async event => {
  try {
    requireSession(event, ['admin', 'technician']);
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = path.resolve(result.filePaths[0]);
    grantedPaths.add(process.platform === 'win32' ? selected.toLowerCase() : selected);
    return selected;
  } catch (err) { return null; }
});

ipcMain.handle('storage-policy-apply', (event, policy = {}) => {
  try {
    requireSession(event, ['admin']);
    const retentionDays = Math.max(1, Math.min(3650, Number(policy.retentionDays) || 30));
    const diskLimitMB = Math.max(250, Math.min(102400, Number(policy.diskLimitMB) || 2048));
    let deleted = dataStore ? dataStore.purgeTelemetry(retentionDays) : 0;
    const dbPath = path.join(ALLOWED_DATA_DIR, 'fanuc-pro-suite.db');
    const limitBytes = diskLimitMB * 1024 * 1024;
    let databaseBytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    if (dataStore && databaseBytes > limitBytes) {
      deleted += dataStore.purgeTelemetry(1);
      databaseBytes = dataStore.compact();
    }
    return { ok: true, retentionDays, diskLimitMB, deleted, databaseBytes, overLimit: databaseBytes > limitBytes };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('restore-backup', async (event, backupFilePath) => {
  try {
    const session = requireSession(event, ['admin']);
    const resolvedBackup = path.resolve(backupFilePath);
    const backupDir = path.resolve(getConfiguredBackupDir());
    if (!(resolvedBackup.startsWith(backupDir + path.sep)) || !fs.existsSync(resolvedBackup)) return { ok: false, error: 'Yedek dosyası bulunamadı veya izin verilen klasörde değil.' };
    const content = fs.readFileSync(resolvedBackup, 'utf8');
    const snapshot = JSON.parse(content);
    if (!snapshot || !snapshot.data) return { ok: false, error: 'Geçersiz yedek dosyası formatı.' };

    for (const [fileName, fileData] of Object.entries(snapshot.data)) {
      if (path.basename(fileName) !== fileName || !fileName.endsWith('.json')) throw new Error(`Geçersiz yedek girdisi: ${fileName}`);
      const targetPath = path.join(__dirname, 'data', fileName);
      if (isSafePath(targetPath)) {
        fs.writeFileSync(targetPath, fileData, 'utf8');
      }
    }
    writeAudit('backup.restore', session.user, { backup: path.basename(resolvedBackup) });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC Handler for Secure Fetch Proxy (webSecurity: true compliance)
ipcMain.handle('fetch-proxy', async (event, url, options = {}) => {
  try {
    if (!isInternetEnabled()) throw new Error('İnternet erişimi Ayarlar bölümünden kapatılmış.');
    const parsed = new URL(url);
    const allowedHosts = new Set(['api.openai.com', 'generativelanguage.googleapis.com']);
    if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {
      throw new Error('Ağ hedefi izin listesinde değil.');
    }
    const response = await net.fetch(url, options);
    const text = await response.text();
    return { ok: true, status: response.status, data: text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Salt okunur güncelleme denetimi. Sabit uç nokta, renderer'ın bu işlevi
// genel amaçlı bir ağ vekiline dönüştürmesini engeller.
ipcMain.handle('update-check', async event => {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Güvenilmeyen IPC kaynağı.');
  const currentVersion = app.getVersion();
  const releasesUrl = 'https://github.com/PobloMert/fanuc-pro-suitev/releases';
  try {
    if (!isInternetEnabled()) throw new Error('İnternet erişimi Ayarlar bölümünden kapatılmış.');
    const response = await net.fetch('https://api.github.com/repos/PobloMert/fanuc-pro-suitev/releases/latest', {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `FANUC-Pro-Suite/${currentVersion}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 1024 * 1024) throw new Error('Sürüm yanıtı beklenenden büyük.');
    const release = JSON.parse(raw);
    const version = String(release.tag_name || '').replace(/^v/i, '');
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Geçersiz sürüm etiketi.');
    const releaseUrl = String(release.html_url || '');
    if (!releaseUrl.startsWith(`${releasesUrl}/tag/`)) throw new Error('Geçersiz sürüm bağlantısı.');
    const setup = Array.isArray(release.assets)
      ? release.assets.find(asset => /^FANUC-Pro-Suite-Read-Only-Setup-[\w.-]+\.exe$/i.test(String(asset.name || '')))
      : null;
    const downloadUrl = setup ? String(setup.browser_download_url || '') : '';
    if (downloadUrl && !downloadUrl.startsWith('https://github.com/PobloMert/fanuc-pro-suitev/releases/download/')) {
      throw new Error('Geçersiz indirme bağlantısı.');
    }
    return {
      ok: true,
      currentVersion,
      latestVersion: version,
      releaseName: String(release.name || release.tag_name || '').slice(0, 160),
      releaseUrl,
      downloadUrl: downloadUrl || releaseUrl,
      publishedAt: release.published_at || null,
      notes: String(release.body || '').slice(0, 4000)
    };
  } catch (err) {
    return { ok: false, currentVersion, releasesUrl, error: err.message };
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

