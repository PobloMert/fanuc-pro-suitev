const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('NSIS imports a provisioning file placed beside Setup', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build.nsis.include, 'build/installer.nsh');
  const nsis = read('build/installer.nsh');
  assert.match(nsis, /\$EXEDIR\\FANUC-Provisioning\.json/);
  assert.match(nsis, /\$PROFILE\\\.fanuc-pro-suite/);
});

test('provisioning secret is encrypted and plaintext user-data copy is removed', () => {
  const main = read('main.js');
  assert.match(main, /validateDriveProvisioning/);
  assert.match(main, /writeEncryptedSecret\('driveAccessToken', validated\.enrollmentKey\)/);
  assert.match(main, /source === path\.resolve\(DRIVE_PROVISIONING_FILE\).*fs\.unlinkSync\(source\)/s);
  assert.match(main, /getDriveEndpoint\(\)/);
  const stateBlock = main.slice(main.indexOf('const state = {', main.indexOf('function importDriveProvisioning')), main.indexOf('const temporary', main.indexOf('function importDriveProvisioning')));
  assert.doesNotMatch(stateBlock, /enrollmentKey/);
});

test('real provisioning files stay outside source control and renderer cannot read token', () => {
  assert.match(read('.gitignore'), /^FANUC-Provisioning\.json$/m);
  assert.ok(fs.existsSync(path.join(root, 'FANUC-Provisioning.example.json')));
  assert.doesNotMatch(read('preload.js'), /getDriveSecretValue|enrollmentKey/);
  assert.match(read('preload.js'), /getDriveProvisioningStatus/);
});
