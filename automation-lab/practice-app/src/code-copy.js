// Shared copy controls for static and dynamically rendered Academy code boxes.
const selector = 'pre, .lab-download-grid article > code, .lab-command-guide td > code';
function source(pre) { return pre.querySelector('code') || pre; }
function selectCode(node) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return; } catch {}
  const field = document.createElement('textarea');
  field.value = text;
  field.className = 'academy-copy-fallback';
  document.body.append(field);
  field.select();
  try { if (!document.execCommand('copy')) throw new Error('Clipboard unavailable'); }
  finally { field.remove(); }
}
function enhance() {
  for (const pre of document.querySelectorAll(selector)) {
    // The workspace launch command already owns its Copy command control.
    if (pre.closest('.academy-code-box') || pre.querySelector('#lab-command') || pre.id === 'lab-command') continue;
    const box = document.createElement('div');
    box.className = 'academy-code-box';
    const actions = document.createElement('div');
    actions.className = 'academy-code-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Copy code';
    button.setAttribute('aria-label', 'Copy code from this box');
    const status = document.createElement('span');
    status.className = 'academy-copy-status';
    status.setAttribute('role', 'status');
    actions.append(button, status);
    pre.before(box);
    box.append(actions, pre);
    button.addEventListener('click', async () => {
      status.textContent = '';
      try {
        await copy(source(pre).textContent);
        status.textContent = 'Copied.';
        button.focus({preventScroll: true});
      } catch {
        selectCode(source(pre));
        status.textContent = 'Copy blocked. Press Ctrl+C, or use your browser’s Copy command.';
      }
    });
  }
}
enhance();
new MutationObserver(enhance).observe(document.body, {childList: true, subtree: true});
