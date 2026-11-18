// crit-md-shortcuts.js — GitHub-style Markdown formatting shortcuts for
// comment textareas: Cmd/Ctrl+B bold, +I italic, +E inline code, +K link.
//
// One document-level keydown listener covers every <textarea> in the review
// UI (comment, edit and reply forms in both modes), all of which hold a
// Markdown comment body. No window.crit.* dependencies.
(function () {
  'use strict';

  var WRAPS = { b: '**', i: '_', e: '`' };

  // Returns the edit for `key` on `value` with [start, end) selected:
  // replace [from, to) with `text`, then select [selStart, selEnd).
  // Returns null for a key that is not a formatting shortcut.
  function formatEdit(value, start, end, key) {
    var sel = value.slice(start, end);
    // Keep surrounding whitespace outside the markers: "**word **" is not
    // bold in CommonMark, and a double-click often selects a trailing space.
    var core = sel.trim();
    var lead = sel.slice(0, sel.length - sel.trimStart().length);
    var trail = sel.slice(lead.length + core.length);

    if (key === 'k') {
      // [text](url) with "url" selected; no selection puts the caret in [].
      var open = start + lead.length + 1;
      return {
        from: start, to: end, text: lead + '[' + core + '](url)' + trail,
        selStart: core ? open + core.length + 2 : open,
        selEnd: core ? open + core.length + 5 : open,
      };
    }

    var mark = WRAPS[key];
    if (!mark) return null;
    var n = mark.length;
    // Second press removes the markers, whether they sit around the
    // selection or inside it.
    if (start >= n && value.slice(start - n, start) === mark && value.slice(end, end + n) === mark) {
      return { from: start - n, to: end + n, text: sel, selStart: start - n, selEnd: end - n };
    }
    if (core.length >= 2 * n && core.slice(0, n) === mark && core.slice(-n) === mark) {
      var inner = core.slice(n, -n);
      return {
        from: start, to: end, text: lead + inner + trail,
        selStart: start + lead.length, selEnd: start + lead.length + inner.length,
      };
    }
    return {
      from: start, to: end, text: lead + mark + core + mark + trail,
      selStart: start + lead.length + n, selEnd: start + lead.length + n + core.length,
    };
  }

  // The formatting key for a keydown, or '' when it is not one. Cmd on macOS
  // (Ctrl+B/E/K move the caret and kill the line there), Ctrl elsewhere.
  function shortcutKey(e, isMac) {
    if (e.isComposing || e.altKey || e.shiftKey) return '';
    var mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!mod || typeof e.key !== 'string') return '';
    var key = e.key.toLowerCase();
    return key === 'k' || WRAPS[key] ? key : '';
  }

  function applyEdit(textarea, edit) {
    textarea.setSelectionRange(edit.from, edit.to);
    // execCommand keeps the edit on the native undo stack and fires `input`
    // (draft autosave, reply-form state). setRangeText is the fallback.
    var done = false;
    try {
      done = edit.text
        ? document.execCommand('insertText', false, edit.text)
        : document.execCommand('delete');
    } catch (_) { /* fall through */ }
    if (!done) {
      textarea.setRangeText(edit.text, edit.from, edit.to, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    textarea.setSelectionRange(edit.selStart, edit.selEnd);
  }

  function onKeydown(e, isMac) {
    var ta = e.target;
    if (e.defaultPrevented || !ta || ta.tagName !== 'TEXTAREA' || ta.readOnly || ta.disabled) return;
    var key = shortcutKey(e, isMac);
    if (!key) return;
    e.preventDefault();
    applyEdit(ta, formatEdit(ta.value, ta.selectionStart, ta.selectionEnd, key));
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    var isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    document.addEventListener('keydown', function (e) { onKeydown(e, isMac); });
  }

  var api = { formatEdit: formatEdit, shortcutKey: shortcutKey, onKeydown: onKeydown };

  if (typeof window !== 'undefined') {
    window.crit = window.crit || {};
    window.crit.mdShortcuts = api;
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})();
