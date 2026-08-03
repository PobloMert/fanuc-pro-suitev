'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
test('bundled adapter binaries match reviewed SHA-256 manifest',()=>{const root=path.resolve(__dirname,'..'); const manifest=JSON.parse(fs.readFileSync(path.join(root,'bin','adapter.integrity.json'))); for(const [name,expected] of Object.entries(manifest)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'bin',name))).digest('hex'); assert.equal(actual,expected,name);}});
