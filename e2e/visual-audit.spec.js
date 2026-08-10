'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('primary screens remain visible and usable at desktop size', async () => {
  test.setTimeout(120000);
  const projectRoot = path.resolve(__dirname, '..');
  const dataDir = path.join(projectRoot, '.e2e-visual-data');
  const captureDir = path.join(projectRoot, 'test-results', 'visual-audit');
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(captureDir, { recursive: true });
  const application = await electron.launch({
    args: [projectRoot, '--disable-gpu', '--disable-gpu-compositing'],
    env: { ...process.env, FANUC_SIMULATION: '1', FANUC_E2E: '1', FANUC_DATA_DIR: dataDir }
  });
  const runtimeErrors = [];
  try {
    const page = await application.firstWindow();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#bootstrap-admin-name').fill('Görsel Denetim');
    await page.locator('#bootstrap-admin-pin').fill('654321');
    await page.locator('#bootstrap-admin-pin-confirm').fill('654321');
    await page.locator('#bootstrap-admin-submit').click();
    await expect(page.locator('#page-dashboard')).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(captureDir, '01-dashboard.png') });

    const machinesNav = page.locator('#nav-machines');
    const machinesGroup = machinesNav.locator('xpath=ancestor::details[1]');
    if (await machinesGroup.count() && !(await machinesGroup.evaluate(element => element.open))) {
      await machinesGroup.locator('summary').click();
    }
    await machinesNav.click();
    await expect(page.locator('#page-machines')).toBeVisible();
    await page.screenshot({ path: path.join(captureDir, '02-machines.png') });
    await page.locator('#page-machines [data-machine-action="details"]').first().click();
    await expect(page.locator('#modal-machine-workspace-detail')).toHaveClass(/open/);
    await page.screenshot({ path: path.join(captureDir, '03-machine-detail.png') });

    const firstTab = page.locator('#modal-machine-workspace-detail [role="tab"]').first();
    await firstTab.focus();
    await firstTab.press('End');
    await expect(page.locator('#modal-machine-workspace-detail [role="tab"]').last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal-machine-workspace-detail')).not.toHaveClass(/open/);

    const fanucNav = page.locator('#nav-fanuc_center');
    const fanucGroup = fanucNav.locator('xpath=ancestor::details[1]');
    if (await fanucGroup.count() && !(await fanucGroup.evaluate(element => element.open))) {
      await fanucGroup.locator('summary').click();
    }
    await fanucNav.click();
    await expect(page.locator('#page-fanuc_center')).toBeVisible();
    await page.screenshot({ path: path.join(captureDir, '04-fanuc-center.png') });

    const settingsNav = page.locator('#nav-settings');
    const settingsGroup = settingsNav.locator('xpath=ancestor::details[1]');
    if (await settingsGroup.count() && !(await settingsGroup.evaluate(element => element.open))) {
      await settingsGroup.locator('summary').click();
    }
    await settingsNav.click();
    await expect(page.locator('#page-settings')).toBeVisible();
    await page.screenshot({ path: path.join(captureDir, '05-settings.png') });
    expect(runtimeErrors).toEqual([]);
  } finally {
    await application.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
