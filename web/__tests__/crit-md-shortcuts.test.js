'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { formatEdit, shortcutKey, onKeydown } = require('../crit-md-shortcuts.js');

// Apply formatEdit to "text" where [ ] marks the selection, and return the
// result in the same notation ("|" for a bare caret).
function run(marked, key) {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  const value = marked.replace('[', '').replace(']', '');
  const edit = formatEdit(value, start, end, key);
  const out = value.slice(0, edit.from) + edit.text + value.slice(edit.to);
  const selected = out.slice(edit.selStart, edit.selEnd);
  return out.slice(0, edit.selStart) + (selected ? '[' + selected + ']' : '|') + out.slice(edit.selEnd);
}

test('wraps the selection and keeps it selected', () => {
  assert.equal(run('a [word] b', 'b'), 'a **[word]** b');
  assert.equal(run('a [word] b', 'i'), 'a _[word]_ b');
  assert.equal(run('a [word] b', 'e'), 'a `[word]` b');
});

test('without a selection inserts the markers around the caret', () => {
  assert.equal(run('ab[]', 'b'), 'ab**|**');
  assert.equal(run('[]', 'e'), '`|`');
});

test('leaves surrounding whitespace outside the markers', () => {
  assert.equal(run('a[ word ]b', 'b'), 'a **[word]** b');
  assert.equal(run('[word ](x)', 'k'), '[word]([url]) (x)');
});

test('a second press removes the markers', () => {
  assert.equal(run('a **[word]** b', 'b'), 'a [word] b');
  assert.equal(run('a [**word**] b', 'b'), 'a [word] b');
  assert.equal(run('ab**[]**', 'b'), 'ab|');
  assert.equal(run('a `[x]` b', 'e'), 'a [x] b');
  // Other markers are left alone.
  assert.equal(run('**[word]**', 'i'), '**_[word]_**');
});

test('link selects the url placeholder, or puts the caret in the brackets', () => {
  assert.equal(run('see [docs] here', 'k'), 'see [docs]([url]) here');
  assert.equal(run('see []', 'k'), 'see [|](url)');
});

test('unknown keys produce no edit', () => {
  assert.equal(formatEdit('abc', 0, 3, 'u'), null);
});

test('shortcutKey takes Cmd on macOS and Ctrl elsewhere', () => {
  assert.equal(shortcutKey({ key: 'b', metaKey: true }, true), 'b');
  assert.equal(shortcutKey({ key: 'K', metaKey: true }, true), 'k');
  assert.equal(shortcutKey({ key: 'e', ctrlKey: true }, false), 'e');
  // Ctrl+B/E/K are caret keys in macOS text fields.
  assert.equal(shortcutKey({ key: 'e', ctrlKey: true }, true), '');
  assert.equal(shortcutKey({ key: 'b', metaKey: true }, false), '');
  assert.equal(shortcutKey({ key: 'b' }, false), '');
  assert.equal(shortcutKey({ key: 'u', ctrlKey: true }, false), '');
  assert.equal(shortcutKey({ key: 'b', ctrlKey: true, shiftKey: true }, false), '');
  assert.equal(shortcutKey({ key: 'b', ctrlKey: true, altKey: true }, false), '');
  assert.equal(shortcutKey({ key: 'b', ctrlKey: true, isComposing: true }, false), '');
});

function fakeTextarea(value, start, end) {
  const events = [];
  return {
    tagName: 'TEXTAREA', value, selectionStart: start, selectionEnd: end, events,
    setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; },
    setRangeText(text, from, to) { this.value = this.value.slice(0, from) + text + this.value.slice(to); },
    dispatchEvent(ev) { events.push(ev.type); },
  };
}

test('onKeydown edits a textarea, fires input and prevents the default', () => {
  const ta = fakeTextarea('a word b', 2, 6);
  let prevented = false;
  onKeydown({ target: ta, key: 'b', ctrlKey: true, preventDefault() { prevented = true; } }, false);
  assert.equal(ta.value, 'a **word** b');
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [4, 8]);
  assert.deepEqual(ta.events, ['input']);
  assert.equal(prevented, true);
});

test('onKeydown ignores other elements, read-only textareas and handled events', () => {
  const cases = [
    Object.assign(fakeTextarea('word', 0, 4), { tagName: 'INPUT' }),
    Object.assign(fakeTextarea('word', 0, 4), { readOnly: true }),
    Object.assign(fakeTextarea('word', 0, 4), { disabled: true }),
  ];
  for (const ta of cases) {
    onKeydown({ target: ta, key: 'b', ctrlKey: true, preventDefault() { assert.fail('must not handle'); } }, false);
    assert.equal(ta.value, 'word');
  }
  const ta = fakeTextarea('word', 0, 4);
  onKeydown({ target: ta, key: 'b', ctrlKey: true, defaultPrevented: true, preventDefault() {} }, false);
  assert.equal(ta.value, 'word');
});

test('onKeydown swallows key repeats without toggling again', () => {
  const ta = fakeTextarea('a word b', 2, 6);
  let prevented = false;
  onKeydown({ target: ta, key: 'b', ctrlKey: true, repeat: true, preventDefault() { prevented = true; } }, false);
  assert.equal(ta.value, 'a word b');
  assert.equal(prevented, true);
});
