import { expect, test } from '@playwright/test';
import { WEB } from './piano';

test('a typed chord lists seeded voicings grouped by structure, exact matches first', async ({
  page,
}) => {
  await page.goto(`${WEB}/?q=G7`);
  await expect(page.getByText(/voicings for/)).toContainText('G7');
  const first = page.getByRole('article').first();
  await expect(first.getByRole('link')).toHaveText('G7');
  await expect(first).not.toContainText('adds tensions');
  await expect(page.getByRole('heading', { name: 'Rootless A' })).toBeVisible();
});

test('an unknown symbol explains itself and an absent chord suggests a looser one', async ({
  page,
}) => {
  await page.goto(WEB);
  const input = page.getByLabel('Chord symbol');
  await input.fill('Cxyz');
  await expect(page.getByText('is not a chord symbol this library can read')).toBeVisible();
  await input.fill('Dm11');
  await expect(page.getByText('No voicings for')).toBeVisible();
  await page.getByRole('button', { name: 'Dmin7' }).click();
  await expect(input).toHaveValue('Dmin7');
  await expect(page.getByRole('article').first()).toBeVisible();
});

test('a voicing can be moved to any key', async ({ page }) => {
  await page.goto(`${WEB}/?q=G13`);
  await page.getByRole('link', { name: 'G13/B' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('G13/B');
  await page.getByRole('region', { name: 'Key' }).getByRole('button', { name: 'Eb' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eb13/G');
  await expect(page).toHaveURL(/root=3/);
  const degrees = page.getByRole('list', { name: 'Notes and degrees' });
  await expect(degrees).toContainText('G3');
  await expect(degrees.getByRole('listitem')).toHaveText([
    /G3\s*3/,
    /C4\s*13/,
    /Db4\s*b7/,
    /F4\s*9/,
  ]);
});

test('a ii–V–I is voice-led and re-solves around a swapped chord', async ({ page }) => {
  await page.goto(`${WEB}/paths?key=0&mode=major`);
  const steps = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: /^Swap/ }) });
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('Dmin9');
  await expect(steps.nth(1)).toContainText('G13');
  await expect(steps.nth(2)).toContainText('CMaj9');

  await steps.nth(1).getByRole('button', { name: /^Swap/ }).click();
  const alternative = steps.nth(1).getByRole('list').getByRole('button').first();
  const chosen = (await alternative.locator('span').first().textContent())!.trim();
  await alternative.click();
  await expect(steps.nth(1).getByRole('link')).toHaveText(chosen);
  await expect(steps.nth(1).getByRole('button', { name: 'Unpin' })).toBeVisible();
  await expect(page.getByText(/Total movement/)).toBeVisible();

  await page.getByRole('radio', { name: 'minor' }).click();
  await expect(page).toHaveURL(/mode=minor/);
  await expect(steps.nth(0)).toContainText('iiø');
  await expect(steps.nth(1)).toContainText('V7alt');
});
