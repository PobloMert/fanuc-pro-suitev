'use strict';

module.exports = {
  testDir: './e2e',
  timeout: 30000,
  workers: 1,
  reporter: 'line',
  use: { trace: 'retain-on-failure' }
};
