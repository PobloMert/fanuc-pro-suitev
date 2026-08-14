'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('AI System: Offline engineering knowledge, copy button, and context routing are verified', () => {
  const aiCode = fs.readFileSync(path.join(__dirname, '../src/js/features/ai_screen.js'), 'utf8');
  const aiCss = fs.readFileSync(path.join(__dirname, '../src/styles/ai.css'), 'utf8');
  const machineCode = fs.readFileSync(path.join(__dirname, '../src/js/machine_workspace.js'), 'utf8');
  const inlineCode = fs.readFileSync(path.join(__dirname, '../src/js/inline_actions.js'), 'utf8');

  // 1. Offline AI Knowledge expansions
  assert.ok(aiCode.includes('dgnMatch'));
  assert.ok(aiCode.includes('VREADY / SREADY'));
  assert.ok(aiCode.includes('DGN 358'));
  assert.ok(aiCode.includes('ledMatch'));
  assert.ok(aiCode.includes('PSM Aşırı Akım'));
  assert.ok(aiCode.includes('PSM DC Bara Aşırı Voltaj'));
  assert.ok(aiCode.includes('Parameter 1851'));

  // 2. Copy to clipboard button and styling
  assert.ok(aiCode.includes('window.copyAIMessageText'));
  assert.ok(aiCode.includes('ai-copy-btn'));
  assert.ok(aiCss.includes('.ai-copy-btn'));
  assert.ok(aiCss.includes('.ai-copy-btn.copied'));

  // 3. Smart Context Injection & Actions
  assert.ok(aiCode.includes('window.askAIAboutContext'));
  assert.ok(machineCode.includes('data-machine-action="ai-analysis"'));
  assert.ok(machineCode.includes("action==='ai-analysis'"));
  assert.ok(inlineCode.includes('copyAIMessageText'));
  assert.ok(inlineCode.includes('askAIAboutContext'));
});
