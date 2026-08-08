'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('all navigation pages and safe tabs open without blank screens or runtime errors', async () => {
  test.setTimeout(180000);
  const projectRoot = path.resolve(__dirname, '..');
  const dataDir = path.join(projectRoot, '.e2e-full-data');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const application = await electron.launch({
    args: [projectRoot, '--disable-gpu', '--disable-gpu-compositing'],
    env: { ...process.env, FANUC_SIMULATION: '1', FANUC_E2E: '1', FANUC_DATA_DIR: dataDir }
  });
  const runtimeErrors = [];
  const consoleErrors = [];
  const visited = [];
  try {
    const page = await application.firstWindow();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#bootstrap-admin-name').fill('Tam Uygulama Testi');
    await page.locator('#bootstrap-admin-pin').fill('654321');
    await page.locator('#bootstrap-admin-pin-confirm').fill('654321');
    await page.locator('#bootstrap-admin-submit').click();
    await expect(page.locator('#login-overlay')).toHaveClass(/hidden/);

    const navigationIds = await page.locator('.nav-item[data-page]').evaluateAll(items => items.map(item => item.id).filter(Boolean));
    expect(navigationIds.length).toBeGreaterThan(20);
    for (const id of navigationIds) {
      const button = page.locator(`#${id}`);
      const details = button.locator('xpath=ancestor::details[1]');
      if (await details.count() && !(await details.evaluate(element => element.open))) await details.locator('summary').click();
      await button.scrollIntoViewIfNeeded();
      await button.click();
      if (runtimeErrors.length) throw new Error(`${id} runtime error: ${runtimeErrors.join(' | ')}`);
      if (consoleErrors.length) throw new Error(`${id} console error: ${consoleErrors.join(' | ')}`);
      const pageId = `#page-${id.replace(/^nav-/, '')}`;
      await expect(page.locator(pageId), `${id} sayfası görünür olmalı`).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#main-content'), `${id} hata ekranına düşmemeli`).not.toContainText('Ekran açılamadı');
      await expect(page.locator('#main-content .page-loading-state'), `${id} yüklemede takılmamalı`).toHaveCount(0);
      const visibleText = (await page.locator(pageId).innerText()).trim();
      expect(visibleText.length, `${id} boş ekran olmamalı`).toBeGreaterThan(0);
      visited.push(id);
    }

    await page.locator('#nav-machines').click();
    await page.locator('#page-machines [data-machine-action="details"]').first().click();
    const detail = page.locator('#modal-machine-workspace-detail');
    await expect(detail).toHaveClass(/open/);
    const detailTabs = detail.locator('[data-machine-detail-tab]');
    for (let index = 0; index < await detailTabs.count(); index += 1) {
      const tab = detailTabs.nth(index);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(detail.locator('[role="tabpanel"]')).toBeVisible();
      expect((await detail.locator('[role="tabpanel"]').innerText()).trim().length).toBeGreaterThan(0);
    }
    await page.keyboard.press('Escape');
    await expect(detail).not.toHaveClass(/open/);

    await page.locator('#nav-fanuc_center').click();
    const fanucTabs = page.locator('#page-fanuc_center [data-fanuc-tab]');
    for (let index = 0; index < await fanucTabs.count(); index += 1) {
      const tab = fanucTabs.nth(index);
      await tab.click();
      await expect(tab).toHaveClass(/active/);
      expect((await page.locator('#fanuc-center-content').innerText()).trim().length).toBeGreaterThan(0);
    }

    expect(visited).toHaveLength(navigationIds.length);
    expect(runtimeErrors).toEqual([]);
    expect(consoleErrors.filter(message => !/favicon|DevTools/i.test(message))).toEqual([]);
  } finally {
    await application.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
