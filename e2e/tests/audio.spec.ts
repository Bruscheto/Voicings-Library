import { expect, test } from '@playwright/test';
import { WEB } from './piano';

const SAMPLE_COUNT = 29;

test('the piano loads its samples once, from this site, and plays', async ({ page }) => {
  const samples: string[] = [];
  const failed: string[] = [];
  page.on('response', (response) => {
    if (!response.url().includes('/samples/piano/')) return;
    samples.push(response.url());
    if (response.status() !== 200) failed.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${WEB}/voicings`);
  await page.locator('a.voicing-card').first().click();
  await expect(page.getByText('Piano ready')).toBeVisible({ timeout: 30_000 });
  expect(samples).toHaveLength(SAMPLE_COUNT);
  expect(failed).toEqual([]);
  expect(samples.every((url) => url.startsWith(`${WEB}/samples/piano/`))).toBe(true);
  // Names with "#" (e.g. "Mf D#0") must arrive encoded, not cut off as a fragment.
  expect(samples.some((url) => url.includes('%23'))).toBe(true);

  await page.getByRole('button', { name: 'Play', exact: true }).click();

  // Moving to another page reuses the decoded samples.
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'ii–V–I' })
    .click();
  await expect(page).toHaveURL(/\/paths/);
  await page.getByRole('button', { name: /^Play/ }).first().click();
  expect(samples).toHaveLength(SAMPLE_COUNT);
});
