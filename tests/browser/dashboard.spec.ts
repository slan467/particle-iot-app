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
  await expect(page.getByRole('heading', { name: 'Training overview.' })).toBeVisible();
  await expect(page.getByText('Collector connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Repetitions per set' })).toBeVisible();

  await page.getByRole('button', { name: 'Read device now' }).click();
  await expect(
    page.getByText('Current state read from the device.', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Sensor OK', { exact: true })).toBeVisible();
  const totalCard = page.locator('.metric-card').filter({ hasText: 'TOTAL REPS' });
  await expect(totalCard.locator('.metric-value')).toHaveText(/^\d+reps$/);

  // Cancelling the confirmation must not call the device.
  let resetCalls = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/device/reset')) resetCalls++;
  });
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Reset total count' }).click();
  expect(resetCalls).toBe(0);

  const resetResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/device/reset') && response.request().method() === 'POST'
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset total count' }).click();
  expect((await resetResponse).status()).toBe(200);
  await expect(
    page.getByText('Reset confirmed by the device. The total starts again at 0.', { exact: true })
  ).toBeVisible();
  // A running simulated set may add a few repetitions right after the reset.
  await expect(totalCard.locator('.metric-value')).toHaveText(/^([0-9]|1[0-5])reps$/);

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

test('shows a set in progress from the device variables', async ({ page }) => {
  await page.route('**/api/device/state', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        repetitions: 7,
        totalCount: 1234,
        sensorOk: false,
        readAt: new Date().toISOString()
      })
    })
  );
  await page.goto('/');
  const liveCard = page.locator('.metric-card.featured');
  await expect(liveCard).toContainText('SET IN PROGRESS');
  await expect(liveCard.locator('.metric-value')).toHaveText('7reps');
  await expect(page.getByText('Sensor fault', { exact: true })).toBeVisible();
  await expect(page.getByText(/reports a sensor fault/)).toBeVisible();
});

test('lists stored sets and changes the history range', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Repetitions per set' })).toBeVisible();
  // The simulator seeds fifteen sets over the last week.
  await expect(page.locator('.events-panel tbody tr')).toHaveCount(8);
  await expect(page.locator('.events-panel tbody tr').first()).toContainText(/s\/rep/);

  const changedRange = page.waitForResponse((response) =>
    response.url().includes('/api/trainings?days=30&')
  );
  await page.getByRole('combobox', { name: 'History range' }).selectOption('30');
  expect((await changedRange).status()).toBe(200);
  await expect(page.getByRole('combobox', { name: 'History range' })).toHaveValue('30');
});

test('keeps stored sets visible during a temporary API failure and recovers', async ({ page }) => {
  let fail = true;
  await page.route('**/api/trainings?*', async (route) => {
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
  await expect(page.getByRole('img', { name: 'Repetitions per set' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole('link', { name: 'Project guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How it works.' })).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Training overview.' })).toBeVisible();
});
