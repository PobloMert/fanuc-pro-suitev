'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');

test('NSIS setup is built only for manual runs or version tags', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /release-setup:/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(workflow, /npm run build:setup/);
});

test('release setup job verifies and uploads installer checksums', () => {
  assert.match(workflow, /Get-FileHash -Algorithm SHA256/);
  assert.match(workflow, /SHA256SUMS\.txt/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /FANUC-Pro-Suite-Read-Only-Setup-\*\.exe/);
  assert.match(workflow, /if-no-files-found: error/);
});
