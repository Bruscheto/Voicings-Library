import { expect, test } from '@playwright/test';
import { WEB, playKeys } from './piano';

test('finder offers real examples and supports keyboard mode selection', async ({ page }) => {
  await page.goto(WEB);
  const starters = page.getByRole('region', { name: 'A place to start' });
  await expect(starters.getByRole('article')).toHaveCount(3);
  await expect(starters.getByRole('button', { name: /^Play / }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Type a chord' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Play a chord' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Play a chord' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Play a chord' }).press('Home');
  await page.getByLabel('Chord symbol', { exact: true }).fill('Cxyz');
  await expect(page.getByLabel('Chord symbol', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByRole('main').getByRole('alert')).toContainText('is not a chord symbol');
});

test('library filters expose selected state and can be reset', async ({ page }) => {
  await page.goto(`${WEB}/voicings`);
  await expect(page.getByLabel('Quality', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'No tensions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'No tensions', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'b9', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page).toHaveURL(`${WEB}/voicings`);
  await expect(page.getByRole('button', { name: 'b9', exact: true })).toBeEnabled();
});

for (const width of [390, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`public routes fit ${width}px in ${colorScheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const route of ['/', '/paths', '/voicings']) {
        await page.goto(`${WEB}${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(
          page
            .getByRole('navigation', { name: 'Main navigation' })
            .locator('[aria-current="page"]'),
        ).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        expect(await page.locator('html').evaluate((el) => getComputedStyle(el).colorScheme)).toBe(
          colorScheme,
        );
      }
      await page.getByRole('main').getByRole('link').first().click();
      await expect(page.getByRole('region', { name: 'Key', exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const opposite = colorScheme === 'dark' ? 'light' : 'dark';
      await page.getByRole('button', { name: `Switch to ${opposite} theme` }).click();
      expect(await page.locator('html').evaluate((el) => getComputedStyle(el).colorScheme)).toBe(
        opposite,
      );
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    });
  }
}

test('played notes list their readings with how likely each is', async ({ page }) => {
  await page.goto(WEB);
  await page.getByRole('tab', { name: 'Play a chord' }).click();
  await playKeys(page, 'C4 E4 G4 A4');
  const chips = page.getByRole('button', { name: /^\S+ (\d+|<1)%$/ });
  await expect(chips.first()).toHaveText(/^CMaj6 \d+%$/);
  await expect(chips.nth(1)).toHaveText(/^Amin7\/C \d+%$/);
});

test('the library filters by structure and each card shows its structure', async ({ page }) => {
  await page.goto(`${WEB}/voicings`, { waitUntil: 'networkidle' });
  const structure = page.getByRole('group', { name: 'Structure' });
  await structure.getByRole('button', { name: 'Drop 2', exact: true }).click();
  await expect(page).toHaveURL(/structure=drop2/);
  const cards = page.locator('a.voicing-card');
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) await expect(card).toContainText('Drop 2');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page).toHaveURL(`${WEB}/voicings`);
});

test('played notes show the structure they form under the chosen reading', async ({ page }) => {
  await page.goto(WEB);
  await page.getByRole('tab', { name: 'Play a chord' }).click();
  await playKeys(page, 'B3 E4 F4 A4');
  const played = page.getByRole('group', { name: 'Played structure' });
  await expect(played).toContainText('Rootless A');
  await page.getByRole('button', { name: /^Dmin6\/9\/B / }).click();
  await expect(played).toContainText('Rootless B');
});
