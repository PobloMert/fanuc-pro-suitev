'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('first-run administrator setup opens the protected dashboard', async () => {
  test.setTimeout(120000);
  const projectRoot = path.resolve(__dirname, '..');
  const dataDir = path.join(projectRoot, '.e2e-data');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const application = await electron.launch({
    args: [projectRoot, '--disable-gpu', '--disable-gpu-compositing'],
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
    const machinesNav = page.locator('#nav-machines');
    const machinesGroup = machinesNav.locator('xpath=ancestor::details[1]');
    if (await machinesGroup.count() && !(await machinesGroup.evaluate(element => element.open))) {
      await machinesGroup.locator('summary').click();
    }
    await machinesNav.click();
    await expect(page.locator('#page-machines')).toBeVisible();
    await expect(page.locator('#page-machines tbody tr[data-machine-id]').first()).toBeVisible();
    await page.locator('#page-machines [data-machine-action="details"]').first().click();
    await expect(page.locator('#modal-machine-workspace-detail')).toHaveClass(/open/);
    await page.locator('#modal-machine-workspace-detail [data-machine-detail-tab="backup"]').click();
    await expect(page.locator('#modal-machine-workspace-detail .machine-detail-content')).toContainText('Yedekleme geçmişi');
    await page.locator('#modal-machine-workspace-detail').getByRole('button', { name: 'Kapat', exact: true }).click();
    await page.locator('#machine-workspace-search').fill('__eslesmeyen_tezgah__');
    await expect(page.locator('#machine-filter-empty')).toBeVisible();
    await page.locator('#machine-filter-empty [data-machine-action="clear-filters"]').click();
    await expect(page.locator('#page-machines tbody tr[data-machine-id]').first()).toBeVisible();
    await page.locator('#nav-dashboard').click();
    await page.locator('[data-ops-nav="fanuc_center"]').first().click();
    await expect(page.locator('#page-fanuc_center')).toBeVisible();
  } finally {
    await application.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
