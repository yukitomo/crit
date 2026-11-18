import { test, expect, type Locator } from '@playwright/test';
import { clearAllComments, loadPage, switchToDocumentView, openDocLineComment, addComment, getMdPath } from './helpers';

// Cmd on macOS, Ctrl elsewhere (same as GitHub).
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

function select(textarea: Locator, start: number, end: number) {
  return textarea.evaluate((el: HTMLTextAreaElement, [s, e]) => el.setSelectionRange(s, e), [start, end]);
}

function selection(textarea: Locator) {
  return textarea.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd));
}

test.describe('Markdown formatting shortcuts', () => {
  test.beforeEach(async ({ request }) => {
    await clearAllComments(request);
  });

  test('comment form: bold, italic, code and link wrap the selection; undo and a second press revert', async ({ page }) => {
    await loadPage(page);
    const doc = await switchToDocumentView(page);
    const textarea = await openDocLineComment(page, doc);

    await textarea.fill('make this bold');
    await select(textarea, 10, 14);
    await textarea.press(`${MOD}+b`);
    await expect(textarea).toHaveValue('make this **bold**');
    expect(await selection(textarea)).toBe('bold');

    // The edit is one step on the native undo stack.
    await textarea.press(`${MOD}+z`);
    await expect(textarea).toHaveValue('make this bold');

    // A second press removes the markers again.
    await select(textarea, 10, 14);
    await textarea.press(`${MOD}+b`);
    await textarea.press(`${MOD}+b`);
    await expect(textarea).toHaveValue('make this bold');

    await select(textarea, 0, 4);
    await textarea.press(`${MOD}+i`);
    await expect(textarea).toHaveValue('_make_ this bold');

    await select(textarea, 7, 11);
    await textarea.press(`${MOD}+e`);
    await expect(textarea).toHaveValue('_make_ `this` bold');

    // Link: the url placeholder is selected, ready to be typed over.
    await select(textarea, 14, 18);
    await textarea.press(`${MOD}+k`);
    await expect(textarea).toHaveValue('_make_ `this` [bold](url)');
    expect(await selection(textarea)).toBe('url');

    // The shortcut edit reaches the draft autosave like typing does (checked
    // before any typing, which would save the whole value by itself).
    await expect.poll(() => page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('crit-draft-'));
      return key ? JSON.parse(localStorage.getItem(key)!).body : null;
    })).toBe('_make_ `this` [bold](url)');

    await page.keyboard.type('https://example.com');
    await expect(textarea).toHaveValue('_make_ `this` [bold](https://example.com)');
  });

  test('reply form: no selection inserts the markers around the caret, and the reply renders formatted', async ({ page, request }) => {
    const mdPath = await getMdPath(request);
    await addComment(request, mdPath, 1, 'Review this');
    await loadPage(page);
    const doc = await switchToDocumentView(page);
    const card = doc.locator('.comment-card');

    await card.locator('.reply-input').click();
    const textarea = card.locator('.reply-textarea');
    await expect(textarea).toBeFocused();

    await textarea.press(`${MOD}+b`);
    await expect(textarea).toHaveValue('****');
    await page.keyboard.type('done');
    await expect(textarea).toHaveValue('**done**');

    await textarea.press('Control+Enter');
    await expect(card.locator('.reply-body strong')).toHaveText('done');
  });
});
