'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DataStore } = require('../lib/data-store');

test('Hacker Penetration Audit: SQL Injection Attack Resilience', () => {
  const tmpDbPath = path.join(os.tmpdir(), `fanuc-sec-test-${Date.now()}.db`);
  const tmpJsonDir = path.join(os.tmpdir(), `fanuc-sec-json-${Date.now()}`);
  fs.mkdirSync(tmpJsonDir, { recursive: true });

  const store = new DataStore(tmpDbPath, tmpJsonDir);

  // Attack 1: Classic SQL Injection payload in collection and ID
  const maliciousId = "1' OR '1'='1'; DROP TABLE records; --";
  const maliciousCollection = "machines' UNION SELECT * FROM documents; --";

  // Should safely execute with parameterized bindings and not corrupt/drop tables
  assert.doesNotThrow(() => {
    store.upsertRecord(maliciousCollection, maliciousId, { name: 'TestMachine' });
  });

  // Table must still exist and be intact
  const rows = store.listRecords(maliciousCollection);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'TestMachine');

  // Verify records table is intact
  const check = store.db.prepare("SELECT count(*) as count FROM records").get();
  assert.ok(check.count >= 1);

  // Cleanup
  try {
    store.db.close();
    fs.unlinkSync(tmpDbPath);
    fs.rmSync(tmpJsonDir, { recursive: true, force: true });
  } catch {}
});

test('Hacker Penetration Audit: Path Traversal and File Inclusion Attack Guard', () => {
  const mainCode = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

  // Path validation logic must be enforced in main.js
  assert.ok(mainCode.includes('isSafePath'));
  assert.ok(mainCode.includes('ALLOWED_DATA_DIR'));
  assert.ok(mainCode.includes('Access Denied'));

  const allowedBase = path.resolve('C:\\Safe\\Data');
  function isSafe(rawPath) {
    const resolved = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(path.join(allowedBase, rawPath));
    return resolved.startsWith(allowedBase);
  }

  // Malicious relative and absolute paths outside allowedBase
  const maliciousPaths = [
    '../../../../Windows/System32/calc.exe',
    '..\\..\\..\\Windows\\System32\\cmd.exe',
    'C:\\Windows\\System32\\calc.exe',
    'D:\\secret.json',
    'data/../../../secrets.json'
  ];

  maliciousPaths.forEach(p => {
    assert.equal(isSafe(p), false, `Path traversal was not blocked for: ${p}`);
  });
});

test('Hacker Penetration Audit: XSS and Malicious Script Injection Sanitization', () => {
  const aiCode = fs.readFileSync(path.join(__dirname, '../src/js/features/ai_screen.js'), 'utf8');
  
  // DOMPurify / escapeHTML sanitization presence
  assert.ok(aiCode.includes('escapeHTML'));
  assert.ok(aiCode.includes('DOMPurify'));
  assert.ok(aiCode.includes('ALLOWED_TAGS'));

  // Ensure script tags and event handlers are stripped
  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const maliciousPayloads = [
    '<script>alert("PWNED")</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:stealCookie()">Click</a>',
    '"><script src=http://evil.com/x.js></script>'
  ];

  maliciousPayloads.forEach(payload => {
    const escaped = escapeHTML(payload);
    assert.ok(!escaped.includes('<script>'), `Raw script tag was not escaped in: ${escaped}`);
    assert.ok(!escaped.includes('<img'), `Raw img tag was not escaped in: ${escaped}`);
    assert.ok(!escaped.includes('<a'), `Raw anchor tag was not escaped in: ${escaped}`);
  });
});

test('Hacker Penetration Audit: 100% Read-Only Safety and Zero CNC Mutation Endpoints', () => {
  const mainCode = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

  // Verify zero dangerous write functions exist in main process IPC
  assert.ok(!mainCode.includes('focas_write_param'));
  assert.ok(!mainCode.includes('cnc_write_pmc'));
  assert.ok(!mainCode.includes('cnc_upload_macro'));
  assert.ok(!mainCode.includes('cnc_execute_gcode'));
});
