const test = require('node:test');
const assert = require('node:assert/strict');
const alarmParameter = require('../src/js/features/alarm_parameter');
const aiKnowledge = require('../src/js/features/ai_knowledge');
const fs = require('node:fs');
const path = require('node:path');

test('alarm feature filters category, series and tolerant code search', () => {
  const items = [{ code:'SV0401', category:'servo', series:['0i-F'], title:'Aşırı yük', description:'' }, { code:'PS0010', category:'program', series:['30i'], title:'Format', description:'' }];
  assert.equal(alarmParameter.filterAlarms(items, { query:'SV400', category:'servo', series:'0i-F' }).length, 1);
  assert.equal(alarmParameter.filterAlarms(items, { category:'program' })[0].code, 'PS0010');
});

test('parameter feature filters text and numeric ranges safely', () => {
  const items = [{ no:1320, name:'Limit', description:'Artı sınır', category:'axis' }, { no:4002, name:'Spindle', description:'Oran', category:'spindle' }];
  assert.deepEqual(alarmParameter.filterParameters(items, { range:'1300-1400' }).map(x => x.no), [1320]);
  assert.deepEqual(alarmParameter.filterParameters(items, { query:'oran' }).map(x => x.no), [4002]);
});

test('AI knowledge feature builds bounded local context and delegates masking', () => {
  const state = { activeDiagnostic:{ type:'alarm', code:'SV0401' }, machines:Array.from({length:7}, (_,i)=>({name:`M${i}`, model:'0i-F'})), currentUser:{name:'Ahmet'} };
  const context = aiKnowledge.buildMachineContext(state);
  assert.match(context, /SV0401/);
  assert.doesNotMatch(context, /M4/);
  assert.equal(aiKnowledge.maskForCloud('Ahmet', state, (text,names,user)=>`${text}:${names.length}:${user}`), 'Ahmet:7:Ahmet');
});

test('alarm, parameter and knowledge screen bodies live outside renderer', () => {
  const root = path.resolve(__dirname, '..');
  const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  const alarmScreens = fs.readFileSync(path.join(root, 'src/js/features/alarm_parameter_screens.js'), 'utf8');
  const knowledgeScreens = fs.readFileSync(path.join(root, 'src/js/features/knowledge_screens.js'), 'utf8');
  assert.match(alarmScreens, /window\.showAlarmDetail/);
  assert.match(alarmScreens, /window\.showParamDetail/);
  assert.doesNotMatch(renderer, /window\.showAlarmDetail\s*=/);
  assert.doesNotMatch(renderer, /window\.showParamDetail\s*=/);
  assert.match(knowledgeScreens, /window\.openBook\s*=/);
  assert.doesNotMatch(renderer, /window\.openBook\s*=/);
  assert.match(renderer, /MTBAlarmParameterScreens\.initialize/);
  assert.match(renderer, /MTBKnowledgeScreens\.initialize/);
});

test('AI chat screen and actions are owned by the AI feature', () => {
  const root = path.resolve(__dirname, '..');
  const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  const aiScreen = fs.readFileSync(path.join(root, 'src/js/features/ai_screen.js'), 'utf8');
  assert.match(aiScreen, /function renderAI\s*\(/);
  assert.match(aiScreen, /window\.sendAIMessage\s*=/);
  assert.match(aiScreen, /function offlineAI\s*\(/);
  assert.match(aiScreen, /DOMPurify\.sanitize/);
  assert.doesNotMatch(renderer, /window\.sendAIMessage\s*=/);
  assert.doesNotMatch(renderer, /function offlineAI\s*\(/);
  assert.match(renderer, /MTBAIScreen\.initialize/);
});
