import type { Page } from '@playwright/test';

export const WEB = 'http://127.0.0.1:3100';
export const ADMIN = 'http://127.0.0.1:3101';

/** Click virtual piano keys by pitch name, e.g. "Bb3 D4 F4". */
export async function playKeys(page: Page, pitches: string): Promise<void> {
  for (const pitch of pitches.split(' ')) {
    await page.getByRole('button', { name: new RegExp(`^${pitch}(,|$)`) }).click();
  }
}
