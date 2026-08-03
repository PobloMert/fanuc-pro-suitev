'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const {can}=require('../lib/permissions');
test('role matrix protects privileged operations',()=>{ assert.equal(can('operator','records.read'),true); assert.equal(can('operator','records.write'),false); assert.equal(can('technician','records.write'),true); assert.equal(can('technician','records.delete'),false); assert.equal(can('admin','records.delete'),true); });
