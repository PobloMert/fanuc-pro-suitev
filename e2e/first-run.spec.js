'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('first-run administrator setup opens the protected dashboard', async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const dataDir = path.join(projectRoot, '.e2e-data');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const application = await electron.launch({
    args: [projectRoot, '--disable-gpu', '--in-process-gpu', '--disable-gpu-compositing'],
    env: { ...process.env, FANUC_SIMULATION: '1', FANUC_E2E: '1', FANUC_DATA_DIR: dataDir }
  });
  try {
    const page = await application.firstWindow();
    await expect(page.locator('#bootstrap-admin-wrap')).toBeVisible();
    await page.locator('#bootstrap-admin-name').fill('Test Yöneticisi');
    await page.locator('#bootstrap-admin-pin').fill('654321');
    await page.locator('#bootstrap-admin-pin-confirm').fill('654321');
    await page.locator('#bootstrap-admin-submit').click();
    await expect(page.locator('#login-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#user-avatar-name')).toContainText('Test Yöneticisi');
  } finally {
    await application.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
