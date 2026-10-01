import { expect, test } from '@playwright/test';
import { ADMIN, WEB, playKeys } from './piano';

// One journey across both apps: capture a new shape, see it refused as a
// duplicate in another key, then find it in the library by chord and by ear.
test('a captured voicing is findable in every key', async ({ page }) => {
  await page.goto(ADMIN);
  // Am9 in root position: not one of the seeded shapes.
  await playKeys(page, 'A3 C4 E4 G4 B4');
  const readings = page.getByRole('list').filter({ hasText: 'Amin9' });
  await expect(readings.getByRole('button').first()).toContainText('Amin9');
  await expect(page.getByText('Rootless A')).toHaveCount(0);

  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('1');
  await expect(readings.getByRole('button').first()).toContainText('Primary');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Saved Amin9.')).toBeVisible();
  await expect(page.getByText('This session · 1 saved')).toBeVisible();

  // The same shape a fourth higher is the same voicing.
  await playKeys(page, 'D4 F4 A4 C5 E5');
  await expect(page.getByText(/Already in the library as/)).toContainText('Dmin9');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Already saved with these readings and collections.')).toBeVisible();

  // The library finds it as F#m9, transposed near where it was captured.
  await page.goto(`${WEB}/?q=F%23m9`);
  const card = page.getByRole('article').filter({ hasText: 'F#3 A3 Db4 E4 Ab4' });
  await expect(card.getByRole('link', { name: 'F#min9' })).toBeVisible();

  // Played in yet another key, the exact shape is recognised.
  await page.getByRole('tab', { name: 'Play a chord' }).click();
  await playKeys(page, 'C4 Eb4 G4 Bb4 D5');
  await expect(page.getByText('This exact voicing is in the library')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cmin9', pressed: true })).toBeVisible();
});
