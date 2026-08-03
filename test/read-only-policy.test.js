'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'..');
function sources(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name); if(['node_modules','.git','dist','test'].includes(e.name))return[]; return e.isDirectory()?sources(p):(e.name.endsWith('.js')?[p]:[]);});}
test('source tree contains no CNC mutation endpoints or FOCAS write calls',()=>{const text=sources(root).map(f=>fs.readFileSync(f,'utf8')).join('\n').toLowerCase(); const forbidden=[/\/activateprogram/,/\/deleteprogram/,/\/uploadprogram/,/\/writeprogram/,/\/setparameter/,/\/writeparameter/,/\/pmcwrite/,/\/setoffset/,/cnc_wrparam/,/cnc_download/,/pmc_wrpmcrng/]; forbidden.forEach(pattern=>assert.doesNotMatch(text,pattern));});
test('role matrix exposes no CNC mutation permission',()=>{const {MATRIX}=require('../lib/permissions'); assert.equal(Object.keys(MATRIX).some(k=>/cnc.*(write|control|mutate)|program.*(delete|activate|upload)/i.test(k)),false);});
