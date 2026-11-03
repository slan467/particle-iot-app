import { expect, test } from '@playwright/test';

test('renders without hydration errors and operates public controls', async ({
  page
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/hydration|state_unsafe_mutation/.test(message.text())) errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Device overview.' })).toBeVisible();
  await expect(page.getByText('Collector connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Counter history' })).toBeVisible();

  await page.getByRole('button', { name: 'Get counter value' }).click();
  await expect(
    page.getByText('Current variable read from the device.', { exact: true })
  ).toBeVisible();
  await expect(
    page.locator('.metric-card').filter({ hasText: 'DEVICE VARIABLE' }).locator('.metric-value')
  ).toHaveText(/^\d+count$/);

  const resetResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/device/reset') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Reset counter to 0' }).click();
  expect((await resetResponse).status()).toBe(200);
  await expect(
    page.getByText('Reset confirmed by the device. Waiting for its event.', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: '0', exact: true }).first()).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await expect
    .poll(() =>
      page
        .locator('.chart-label')
        .first()
        .evaluate((label) => {
          const matrix = (label as SVGTextElement).getScreenCTM()!;
          return parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.a, matrix.b);
        })
    )
    .toBeGreaterThanOrEqual(8);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
});

test('clears only the plotted view, then receives new readings and changes range', async ({
  page,
  request
}) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Counter history' })).toBeVisible();
  // A device read confirms hydration before clicking a button without navigation.
  await page.getByRole('button', { name: 'Get counter value' }).click();
  await expect(
    page.getByText('Current variable read from the device.', { exact: true })
  ).toBeVisible();
  const before = await (await request.get('/api/readings')).json();
  await page.getByRole('button', { name: 'Clear chart view' }).click();
  await expect(page.getByText('Waiting for the next reading', { exact: true })).toBeVisible();
  const after = await (await request.get('/api/readings')).json();
  expect(after.readings.some((reading: { id: string }) => reading.id === before.latest.id)).toBe(
    true
  );
  await expect(page.getByRole('img', { name: 'Counter history' })).toBeVisible({ timeout: 25_000 });

  const changedRange = page.waitForResponse((response) =>
    response.url().includes('/api/readings?minutes=15&')
  );
  await page.getByRole('combobox', { name: 'History range' }).selectOption('15');
  expect((await changedRange).status()).toBe(200);
  await expect(page.getByRole('combobox', { name: 'History range' })).toHaveValue('15');
});

test('keeps stored readings visible during a temporary API failure and recovers', async ({
  page
}) => {
  let fail = true;
  await page.route('**/api/readings?*', async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Temporary test outage.' })
      });
    } else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Temporary test outage.');
  await expect(page.getByRole('img', { name: 'Counter history' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole('link', { name: 'Project guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make it your own.' })).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Device overview.' })).toBeVisible();
});
