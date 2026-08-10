const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const installer = fs.readFileSync(path.join(root, 'build/installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const example = JSON.parse(fs.readFileSync(path.join(root, 'FANUC-Provisioning.example.json'), 'utf8'));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false, 'Uninstall must preserve application data.');
assert.equal(pkg.build.nsis.include, 'build/installer.nsh');
assert.match(installer, /\$EXEDIR\\FANUC-Provisioning\.json/);
assert.match(installer, /\$PROFILE\\\.fanuc-pro-suite\\FANUC-Provisioning\.json/);
assert.match(main, /safeStorage\.encryptString/);
assert.match(main, /fs\.unlinkSync\(source\)/);
assert.match(main, /DRIVE_PROVISIONING_STATE_FILE/);
assert.equal(example.schemaVersion, 1);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fanuc-release-lifecycle-'));
try {
  const profile = path.join(temp, 'profile');
  const appData = path.join(profile, '.fanuc-pro-suite');
  const installV1 = path.join(temp, 'install-v1');
  const installV2 = path.join(temp, 'install-v2');
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(installV1);
  fs.mkdirSync(installV2);

  const businessData = JSON.stringify({ machines: [{ id: 'M-1', name: 'Protected machine' }] });
  const dataFile = path.join(appData, 'machines.json');
  fs.writeFileSync(dataFile, businessData);
  const before = digest(fs.readFileSync(dataFile));

  fs.writeFileSync(path.join(installV1, 'app-version.txt'), '1.4.1');
  fs.writeFileSync(path.join(installV2, 'app-version.txt'), '1.4.2');
  fs.rmSync(installV1, { recursive: true }); // simulated uninstall: installation files only
  assert.equal(digest(fs.readFileSync(dataFile)), before, 'Uninstall simulation changed user data.');
  assert.equal(fs.readFileSync(path.join(installV2, 'app-version.txt'), 'utf8'), '1.4.2');
  assert.equal(digest(fs.readFileSync(dataFile)), before, 'Upgrade simulation changed user data.');

  const provisioning = { ...example, driveEndpoint: 'https://script.google.com/macros/s/TEST_DEPLOYMENT_123/exec', driveFolderId: 'TEST_FOLDER_12345', enrollmentKey: 'test-only-enrollment-key' };
  const besideSetup = path.join(temp, 'FANUC-Provisioning.json');
  const copied = path.join(appData, 'FANUC-Provisioning.json');
  fs.writeFileSync(besideSetup, JSON.stringify(provisioning));
  fs.copyFileSync(besideSetup, copied); // NSIS customInstall behavior
  assert.deepEqual(JSON.parse(fs.readFileSync(copied, 'utf8')), provisioning);
  fs.rmSync(copied); // first-launch plaintext cleanup behavior
  assert.equal(fs.existsSync(copied), false);
  assert.equal(fs.existsSync(besideSetup), true, 'Distribution-side provisioning must not be deleted.');

  console.log('Release lifecycle validation passed: clean install, provisioning copy/import cleanup, upgrade, uninstall/reinstall data preservation.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
