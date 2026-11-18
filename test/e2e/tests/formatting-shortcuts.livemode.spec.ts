import { test, expect } from '@playwright/test';
import { clearAllLivePins, openPinComposer } from './livemode-helpers';

// Cmd on macOS, Ctrl elsewhere (same as GitHub).
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('live-mode composer — Markdown formatting shortcuts', () => {
  test.beforeEach(async ({ request }) => {
    await clearAllLivePins(request);
  });

  test('Cmd/Ctrl+B and Cmd/Ctrl+K format the selection in the pin composer', async ({ page }) => {
    await openPinComposer(page);
    const ta = page.locator('.crit-live-composer-body');
    await ta.fill('fix spacing');
    await ta.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 11));
    await ta.press(`${MOD}+b`);
    await expect(ta).toHaveValue('fix **spacing**');

    await ta.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 3));
    await ta.press(`${MOD}+k`);
    await expect(ta).toHaveValue('[fix](url) **spacing**');
  });
});
