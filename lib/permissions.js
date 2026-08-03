'use strict';
const MATRIX = Object.freeze({
  'telemetry.read': ['operator','technician','admin'],
  'records.read': ['operator','technician','admin'],
  'records.write': ['technician','admin'],
  'records.delete': ['admin'],
  'backup.create': ['technician','admin'],
  'backup.restore': ['admin'],
  'adapter.restart': ['technician','admin'],
  'network.configure': ['admin'],
  'users.manage': ['admin'],
  'ai.use': ['technician','admin']
});
function can(role, permission) { return Boolean(MATRIX[permission]?.includes(role)); }
module.exports = { MATRIX, can };
