'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'js', 'app.js'), 'utf8');

test('mutable data and users live outside app.asar', () => {
  assert.match(main, /const WRITABLE_DATA_DIR = path\.join\(ALLOWED_DATA_DIR, 'data'\)/);
  assert.match(main, /const USERS_FILE = path\.join\(WRITABLE_DATA_DIR, 'users\.json'\)/);
  assert.match(main, /new DataStore\([^\n]+WRITABLE_DATA_DIR\)/);
  assert.doesNotMatch(main, /path\.join\(__dirname, 'data', file\)/);
});

test('authentication has throttling, lockout and idle expiry', () => {
  assert.match(main, /MAX_LOGIN_ATTEMPTS = 5/);
  assert.match(main, /LOGIN_LOCKOUT_MS = 5 \* 60 \* 1000/);
  assert.match(main, /SESSION_IDLE_TIMEOUT_MS = 30 \* 60 \* 1000/);
  assert.match(main, /auth\.login_failed/);
  assert.match(main, /auth\.session_expired/);
});

test('first run creates a user-defined administrator with no distributed accounts', () => {
  const users = JSON.parse(fs.readFileSync(path.join(root, 'data', 'users.json'), 'utf8'));
  assert.deepEqual(users.users, []);
  assert.match(main, /auth-bootstrap-admin/);
  assert.match(main, /loadUsersSecure\(\)\.length !== 0/);
  assert.match(main, /\^\\d\{6\}\$/);
});

test('backups use versioned SHA-256 integrity and rollback recovery', () => {
  assert.match(main, /schemaVersion: 3/);
  assert.match(main, /snapshot\.checksums\[file\]/);
  assert.match(main, /Yedek bütünlük doğrulaması başarısız/);
  assert.match(main, /Geri yükleme geri alındı/);
});

test('backup manifest covers business data, SQLite and excludes identity', () => {
  for (const name of ['backup_logs.json', 'pmc_signals.json', 'library.json']) assert.match(main, new RegExp(name.replace('.', '\\.')));
  assert.match(main, /scope: 'business-data'/);
  assert.match(main, /identityData: \{ included: false/);
  assert.match(main, /backupTo\(sqliteTemp, \{ excludeIdentity: true \}\)/);
  assert.match(main, /validateBackupSnapshot\(snapshot\)/);
});

test('restore stages changes and removes newly created files during rollback', () => {
  const handler = main.slice(main.indexOf("ipcMain.handle('restore-backup'"), main.indexOf('// IPC Handler for Secure Fetch Proxy'));
  assert.match(handler, /restore-staging/);
  assert.match(handler, /restore-journal\.json/);
  assert.match(handler, /prior === null/);
  assert.match(handler, /fs\.unlinkSync\(target\)/);
  assert.match(main, /function recoverInterruptedRestore/);
  assert.match(main, /preExisting/);
});

test('backup listing is independent from PDF content and automatic backups are daily', () => {
  const listHandler = main.slice(main.indexOf("ipcMain.handle('get-backups-list'"), main.indexOf("ipcMain.handle('create-manual-backup'"));
  assert.doesNotMatch(listHandler, /htmlContent/);
  assert.match(main, /reason: 'daily-backup-exists'/);
  assert.match(main, /performAutoBackup\(\{ force: true \}\)/);
});

test('PDF export requires a session, limits input and disables active content', () => {
  const handler = main.slice(main.indexOf("ipcMain.handle('print-to-pdf'"), main.indexOf('// Auto-Backup Engine'));
  assert.match(handler, /requireSession\(event\)/);
  assert.match(handler, /5 \* 1024 \* 1024/);
  assert.match(handler, /script-src 'none'/);
  assert.match(handler, /connect-src 'none'/);
  assert.match(handler, /replace\(\/<\(script\|iframe\|object\|embed\|base\)/);
});

test('successful restore invalidates all active sessions', () => {
  const handler = main.slice(main.indexOf("ipcMain.handle('restore-backup'"), main.indexOf('// IPC Handler for Secure Fetch Proxy'));
  assert.match(handler, /sessions\.clear\(\)/);
  assert.match(handler, /requiresRelogin: true/);
});

test('release checksum generator covers executable artifacts', () => {
  const generator = fs.readFileSync(path.join(root, 'scripts', 'generate-checksums.js'), 'utf8');
  assert.match(generator, /sha256/);
  assert.match(generator, /SHA256SUMS\.txt/);
});

test('diagnostic exports redact secrets and create a checksum sidecar', () => {
  assert.match(main, /diagnostics-export/);
  assert.match(main, /\(key\|pin\|secret\|token\|password\|directory\|path\)/);
  assert.match(main, /result\.filePath\}\.sha256/);
});

test('telemetry ingestion validates schema and applies a rate limit', () => {
  assert.match(main, /function validateTelemetrySample/);
  assert.match(main, /rate\.count > 1200/);
  assert.match(main, /Geçersiz telemetri zamanı/);
});

test('Electron renderer is sandboxed and navigation is denied', () => {
  assert.match(main, /sandbox: true/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(main, /webContents\.on\('will-navigate'/);
});

test('protected data loads only after authentication', () => {
  assert.match(app, /initializeAuthenticatedApp/);
  const initBody = app.slice(app.indexOf('async function init()'));
  const protectedLoader = initBody.indexOf('await loadData()');
  assert.equal(protectedLoader, -1);
});

test('renderer contains no dynamic code execution', () => {
  assert.doesNotMatch(renderer, /\bnew Function\s*\(/);
  assert.doesNotMatch(renderer, /\beval\s*\(/);
  assert.match(renderer, /evaluateSafeMathExpression/);
});

test('script CSP rejects inline JavaScript and legacy handlers use an allowlist', () => {
  const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'src', 'dashboard', 'index.html'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'src', 'js', 'inline_actions.js'), 'utf8');
  assert.doesNotMatch(index.match(/Content-Security-Policy[^>]+/)[0], /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(dashboard.match(/Content-Security-Policy[^>]+/)[0], /script-src[^;]*unsafe-inline/);
  assert.match(actions, /allowedActions/);
  assert.doesNotMatch(actions, /\beval\s*\(|\bnew Function\s*\(/);
  assert.match(actions, /\bloginSelectUser\b/);
});

test('every declared inline UI action is present in the delegated allowlist', () => {
  const actions = fs.readFileSync(path.join(root, 'src', 'js', 'inline_actions.js'), 'utf8');
  const allowBlock = actions.match(/new Set\(`([\s\S]*?)`\.trim/)[1];
  const allowed = new Set(allowBlock.trim().split(/\s+/));
  const intentionallyBlocked = new Set(['activateProgram', 'deleteProgram']);
  const missing = new Set();
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(full);
      else if (/\.(?:js|html)$/.test(entry.name)) {
        const source = fs.readFileSync(full, 'utf8');
        for (const attribute of source.matchAll(/on(?:click|change|input)="([^"]*)"/g)) {
          for (const statement of attribute[1].split(';')) {
            const call = statement.trim().match(/^(?:window\.)?(?:electronAPI\.)?([A-Za-z_$][\w$]*)\(/);
            if (call && !['event', 'document', 'openExternal'].includes(call[1]) && !allowed.has(call[1]) && !intentionallyBlocked.has(call[1])) missing.add(call[1]);
          }
        }
      }
    }
  }
  inspect(path.join(root, 'src'));
  assert.deepEqual([...missing], []);
  for (const action of intentionallyBlocked) assert.equal(allowed.has(action), false);
});
