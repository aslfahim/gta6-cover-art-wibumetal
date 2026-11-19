// Palm Noir editor: wires the controls to the cover renderer. A photo lands in
// a panel from its file input or by dropping it on that half of the preview;
// dragging a panel pans its photo, its zoom slider scales it; the caption
// controls restyle the lettering live; the three export buttons render the
// cover at full post size and download it as a PNG. A `?shot=` query sets up
// a fixed scene for a screenshot instead (./shots.js).
import { drawCover, freshState, panelShapes, renderCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = freshState();

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  drawCover(canvas, state);
}

function say(text) {
  status.textContent = text;
}

/** Puts an image into one panel, resetting its pan so the photo starts centred. */
function setPanelPhoto(index, img) {
  state.panels[index].img = img;
  state.panels[index].ox = 0;
  state.panels[index].oy = 0;
  redraw();
}

async function photoFromFile(index, file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    setPanelPhoto(index, await loadImage(URL.createObjectURL(file)));
    say(`Panel ${index + 1} photo loaded.`);
  } catch {
    say('That file could not be read as a photo.');
  }
}

document.getElementById('photo-a').addEventListener('change', (e) => photoFromFile(0, e.target.files[0]));
document.getElementById('photo-b').addEventListener('change', (e) => photoFromFile(1, e.target.files[0]));

document.getElementById('zoom-a').addEventListener('input', (e) => {
  state.panels[0].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('zoom-b').addEventListener('input', (e) => {
  state.panels[1].zoom = Number(e.target.value);
  redraw();
});

document.getElementById('fill-both').addEventListener('click', () => {
  const img = state.panels[0].img;
  if (!img) { say('Load a left-panel photo first.'); return; }
  state.panels[1].img = img;
  state.panels[1].ox = 0;
  state.panels[1].oy = 0;
  redraw();
  say('Both panels now use the left photo — drag each half to crop it differently.');
});

document.getElementById('sample').addEventListener('click', async () => {
  try {
    const img = await loadImage('samples/pier.jpg');
    setPanelPhoto(0, img);
    setPanelPhoto(1, img);
    say('Sample photo loaded in both panels.');
  } catch {
    say('The sample photo could not be loaded.');
  }
});

const captionInput = document.getElementById('caption');
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
document.getElementById('caption-size').addEventListener('input', (e) => {
  state.captionScale = Number(e.target.value);
  redraw();
});
document.getElementById('caption-color').addEventListener('input', (e) => {
  state.captionColor = e.target.value;
  redraw();
});
document.getElementById('caption-rim').addEventListener('input', (e) => {
  state.rimColor = e.target.value;
  redraw();
});
document.getElementById('caption-glow').addEventListener('input', (e) => {
  state.glowColor = e.target.value;
  redraw();
});

// Drag to pan: pointer down on a panel starts a drag on that panel, moving the
// pointer pans its photo by the same on-screen distance, scaled to the
// canvas's own resolution. Which panel a point falls in follows the diagonal
// seam: left of the seam line is panel 0, right of it panel 1.
let drag = null;

function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  const seamX = canvas.width * (0.60 - 0.05 * (y / canvas.height));
  return { index: x < seamX ? 0 : 1, x, y };
}

canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!state.panels[hit.index].img) return;
  drag = { ...hit, startOx: state.panels[hit.index].ox, startOy: state.panels[hit.index].oy };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const hit = panelAt(e.clientX, e.clientY);
  const panel = state.panels[drag.index];
  panel.ox = drag.startOx + (hit.x - drag.x);
  panel.oy = drag.startOy + (hit.y - drag.y);
  redraw();
});

function endDrag() {
  drag = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// Drop a photo file straight onto the cover: the half it lands on takes it.
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  photoFromFile(panelAt(e.clientX, e.clientY).index, file);
});

/** Renders the cover at an exact post size and downloads it as a PNG. */
function exportPng(width, height, label) {
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  renderCover(off.getContext('2d'), width, height, state);
  off.toBlob((blob) => {
    if (!blob) { say('Export failed.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `palm-noir-${label}.png`;
    a.click();
    say(`Saved palm-noir-${label}.png (${width} x ${height}).`);
  }, 'image/png');
}

document.getElementById('export-square').addEventListener('click', () => exportPng(1080, 1080, '1080x1080'));
document.getElementById('export-portrait').addEventListener('click', () => exportPng(1080, 1350, '1080x1350'));
document.getElementById('export-wide').addEventListener('click', () => exportPng(1920, 1080, '1920x1080'));

// Screenshot scenes, or the live editor with no photo yet.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (sample, text) => {
    const img = await loadImage(sample);
    setPanelPhoto(0, img);
    setPanelPhoto(1, img);
    captionInput.value = text;
    state.caption = text;
    redraw();
  }, { canvas, state, redraw });
} else {
  redraw();
}
