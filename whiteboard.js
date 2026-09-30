// One local classroom board, retained across concept routes. No network writes.
const STORAGE_KEY = 'mini-quiz-class-whiteboard-v1';
const WIDTH = 1600, HEIGHT = 1000;
const colors = [['#172d36','Ink'],['#006a68','Teal'],['#bc3e35','Red'],['#6f46ac','Purple']];
let actions = [], redo = [], active = null, tool = 'pen', color = colors[0][0];
let penSize = 4, eraserSize = 28, opener, restoreFailed = false;

function validAction(action) {
  if (action?.tool === 'clear') return true;
  return action && ['pen','eraser'].includes(action.tool) && /^#[0-9a-f]{6}$/i.test(action.color) &&
    Number.isFinite(action.width) && action.width > 0 && action.width <= WIDTH * 80 &&
    Array.isArray(action.points) && action.points.length > 0 && action.points.every(point =>
      Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) &&
      point[0] >= 0 && point[0] <= WIDTH && point[1] >= 0 && point[1] <= HEIGHT);
}
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !Array.isArray(saved.actions) || !saved.actions.every(validAction)) throw new Error('Invalid saved board');
    actions = saved.actions;
  }
} catch { restoreFailed = true; }

const dialog = document.createElement('dialog');
dialog.id = 'class-whiteboard';
dialog.className = 'whiteboard-dialog';
dialog.setAttribute('aria-labelledby', 'whiteboard-title');
dialog.innerHTML = `
  <header class="whiteboard-header"><div><p class="eyebrow">THINK IT THROUGH TOGETHER</p><h2 id="whiteboard-title">Class whiteboard</h2></div><button id="whiteboard-close" aria-label="Close whiteboard">✕</button></header>
  <div class="whiteboard-tools" role="group" aria-label="Whiteboard tools">
    <div class="whiteboard-tool-pair"><button id="whiteboard-pen" aria-pressed="true">✎ Pen</button><button id="whiteboard-eraser" aria-pressed="false">Eraser</button></div>
    <div class="whiteboard-colors" role="group" aria-label="Pen color">${colors.map(([value,label],i)=>`<button data-ink="${value}" aria-label="${label} pen" aria-pressed="${i===0}" style="--ink-color:${value}"><span aria-hidden="true"></span></button>`).join('')}</div>
    <label class="whiteboard-size">Size <input id="whiteboard-size" type="range" min="1" max="16" value="4" aria-label="Pen size"><output id="whiteboard-size-value" for="whiteboard-size">4</output></label>
    <div class="whiteboard-tool-pair"><button id="whiteboard-undo" aria-label="Undo drawing action">↶ Undo</button><button id="whiteboard-redo" aria-label="Redo drawing action">↷ Redo</button></div>
    <button id="whiteboard-clear">Clear board</button><button id="whiteboard-download">Download PNG</button>
  </div>
  <p id="whiteboard-instructions" class="whiteboard-hint">Draw with a mouse, finger, or pen. Select Eraser to rub out marks. Undo can restore an erased or cleared drawing.</p>
  <div class="whiteboard-space"><canvas id="whiteboard-canvas" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Freehand classroom drawing" aria-describedby="whiteboard-instructions">A pointer-operated drawing canvas. Use the pen and eraser controls above.</canvas></div>
  <footer class="whiteboard-footer"><span id="whiteboard-status" role="status">${restoreFailed?'Stored drawing could not be restored. New marks will start a new board.':'Saved on this browser. Your board stays with you between lessons.'}</span><button id="whiteboard-done">Return to lesson</button></footer>`;
const $ = id => dialog.querySelector('#' + id);
const canvas = $('whiteboard-canvas'), ctx = canvas.getContext('2d');
const space = dialog.querySelector('.whiteboard-space');

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1, actions}));
    $('whiteboard-status').textContent = 'Saved on this browser. Your board stays with you between lessons.';
  } catch {
    $('whiteboard-status').textContent = 'Kept for this page only. Download PNG to keep a copy.';
  }
}
function updateTools() {
  $('whiteboard-pen').setAttribute('aria-pressed', String(tool === 'pen'));
  $('whiteboard-eraser').setAttribute('aria-pressed', String(tool === 'eraser'));
  const slider = $('whiteboard-size');
  slider.min = tool === 'pen' ? '1' : '8';
  slider.max = tool === 'pen' ? '16' : '80';
  slider.value = String(tool === 'pen' ? penSize : eraserSize);
  slider.setAttribute('aria-label', tool === 'pen' ? 'Pen size' : 'Eraser size');
  $('whiteboard-size-value').value = slider.value;
  $('whiteboard-undo').disabled = actions.length === 0;
  $('whiteboard-redo').disabled = redo.length === 0;
  $('whiteboard-clear').disabled = actions.length === 0 || actions.at(-1)?.tool === 'clear';
  canvas.dataset.tool = tool;
  dialog.querySelectorAll('[data-ink]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ink===color)));
}
function segment(stroke, from, to) {
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (!from) { ctx.arc(to[0], to[1], stroke.width / 2, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke(); }
  ctx.restore();
}
function redraw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  for (const action of actions) {
    if (action.tool === 'clear') { ctx.clearRect(0, 0, WIDTH, HEIGHT); continue; }
    action.points.forEach((point,i)=>segment(action, i ? action.points[i-1] : null, point));
  }
}
function position(event) {
  const rect = canvas.getBoundingClientRect();
  return [Math.max(0, Math.min(WIDTH, (event.clientX - rect.left) * WIDTH / rect.width)),
          Math.max(0, Math.min(HEIGHT, (event.clientY - rect.top) * HEIGHT / rect.height))];
}
function finishStroke() {
  if (!active) return;
  const stroke = active;
  active = null;
  actions.push({tool:stroke.tool, color:stroke.color, width:stroke.width, points:stroke.points});
  redo = [];
  if (canvas.hasPointerCapture(stroke.pointerId)) canvas.releasePointerCapture(stroke.pointerId);
  updateTools(); save();
}
canvas.addEventListener('pointerdown', event => {
  if (active || !event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  active = {pointerId:event.pointerId, tool, color,
    width:(tool === 'pen' ? penSize : eraserSize) * WIDTH / canvas.getBoundingClientRect().width,
    points:[position(event)]};
  canvas.setPointerCapture(event.pointerId);
  segment(active, null, active.points[0]);
});
canvas.addEventListener('pointermove', event => {
  if (!active || active.pointerId !== event.pointerId) return;
  event.preventDefault();
  const events = event.getCoalescedEvents?.() || [];
  for (const sample of events.length ? events : [event]) {
    const point = position(sample), previous = active.points.at(-1);
    if (Math.hypot(point[0]-previous[0], point[1]-previous[1]) < 0.6) continue;
    active.points.push(point); segment(active, previous, point);
  }
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  canvas.addEventListener(type, event => { if (active?.pointerId === event.pointerId) finishStroke(); });
}
function selectTool(next) { finishStroke(); tool = next; updateTools(); }
$('whiteboard-pen').onclick = () => selectTool('pen');
$('whiteboard-eraser').onclick = () => selectTool('eraser');
dialog.querySelectorAll('[data-ink]').forEach(button=>button.onclick=()=>{color=button.dataset.ink;selectTool('pen');});
$('whiteboard-size').oninput = event => {
  if (tool === 'pen') penSize = Number(event.target.value); else eraserSize = Number(event.target.value);
  $('whiteboard-size-value').value = event.target.value;
};
$('whiteboard-undo').onclick = () => { finishStroke(); if (actions.length) redo.push(actions.pop()); redraw(); updateTools(); save(); };
$('whiteboard-redo').onclick = () => { finishStroke(); if (redo.length) actions.push(redo.pop()); redraw(); updateTools(); save(); };
$('whiteboard-clear').onclick = () => { finishStroke(); actions.push({tool:'clear'}); redo=[]; redraw(); updateTools(); save(); };
$('whiteboard-download').onclick = () => {
  finishStroke();
  const exported = document.createElement('canvas'); exported.width=WIDTH; exported.height=HEIGHT;
  const output = exported.getContext('2d'); output.fillStyle='#ffffff'; output.fillRect(0,0,WIDTH,HEIGHT); output.drawImage(canvas,0,0);
  const link = document.createElement('a'); link.download='mini-quiz-whiteboard.png'; link.href=exported.toDataURL('image/png'); link.click();
};
function fitBoard() {
  const width = Math.max(1, Math.min(space.clientWidth, space.clientHeight * WIDTH / HEIGHT));
  canvas.style.width = `${width}px`; canvas.style.height = `${width * HEIGHT / WIDTH}px`;
}
new ResizeObserver(()=>{finishStroke();fitBoard();}).observe(space);
dialog.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    const redoKey = event.key.toLowerCase() === 'y' || event.shiftKey;
    $(redoKey?'whiteboard-redo':'whiteboard-undo').click();
  }
});
function closeBoard() { finishStroke(); dialog.close(); }
$('whiteboard-close').onclick = closeBoard;
$('whiteboard-done').onclick = closeBoard;
dialog.addEventListener('cancel', ()=>finishStroke());
dialog.addEventListener('close', ()=>{finishStroke();dialog.remove();opener?.focus();});
window.addEventListener('pagehide', finishStroke);
export function openWhiteboard(button) {
  if (dialog.open) return;
  opener = button;
  document.body.append(dialog);
  dialog.showModal(); fitBoard(); redraw(); updateTools(); $('whiteboard-pen').focus();
}
const launch = document.querySelector('#whiteboard-launch');
launch.addEventListener('click', ()=>openWhiteboard(launch));
if (new URLSearchParams(location.search).get('board') === '1') openWhiteboard(launch);
