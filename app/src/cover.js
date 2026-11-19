// Palm Noir cover renderer: a dark two-panel noir cover with a diagonal seam,
// silhouette palms, a lone figure, a teal-orange night grade, deep vignette and
// bold caption lettering with a neon rim light. Everything draws on a 2D canvas
// at whatever size the caller asks for, so the preview and the PNG exports
// share one code path.
//
// State shape the editor keeps:
//   panels: [{ img, zoom, ox, oy }, { img, zoom, ox, oy }]
//     img is an HTMLImageElement (or null), zoom a scale >= 1, ox/oy the pan
//     offset in canvas pixels from the panel centre.
//   caption, captionScale, captionColor, rimColor, glowColor: the lettering.

/** The two panel polygons: a diagonal seam leaning left as it falls. */
export function panelShapes(w, h) {
  const top = w * 0.60;
  const bottom = w * 0.55;
  return [
    [[0, 0], [top, 0], [bottom, h], [0, h]],
    [[top, 0], [w, 0], [w, h], [bottom, h]],
  ];
}

function tracePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function panelBox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Draws one panel's photo, cover-fit inside its polygon, with zoom and pan. */
function drawPanelPhoto(ctx, panel, shape) {
  const img = panel.img;
  if (!img) return;
  const box = panelBox(shape);
  const base = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = box.x + box.w / 2 + (panel.ox || 0);
  const cy = box.y + box.h / 2 + (panel.oy || 0);
  ctx.save();
  tracePath(ctx, shape);
  ctx.clip();
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

/** The noir grade inside one panel: teal shadows from the top, a warm orange
 *  glow rising from the foot, and a dark floor so the caption stays readable. */
function gradePanel(ctx, shape, w, h) {
  const box = panelBox(shape);
  ctx.save();
  tracePath(ctx, shape);
  ctx.clip();
  let g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h * 0.55);
  g.addColorStop(0, 'rgba(8, 64, 74, 0.55)');
  g.addColorStop(1, 'rgba(8, 64, 74, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  g = ctx.createLinearGradient(0, h * 0.55, 0, h);
  g.addColorStop(0, 'rgba(255, 122, 26, 0)');
  g.addColorStop(1, 'rgba(255, 122, 26, 0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  g = ctx.createLinearGradient(0, h * 0.72, 0, h);
  g.addColorStop(0, 'rgba(2, 6, 10, 0)');
  g.addColorStop(1, 'rgba(2, 6, 10, 0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

/** A palm silhouette: a curved trunk rising from the frame's edge to a crown
 *  of thin drooping fronds, drawn as strokes. (x, y) is the crown; the trunk
 *  and the fronds fan out from it, so the palm reads even over a bright photo.
 *  `flip` mirrors it for the right-hand corner. */
function drawPalm(ctx, x, y, size, flip) {
  const s = flip ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, 1);
  ctx.strokeStyle = '#02090f';
  ctx.lineCap = 'round';
  // Trunk, sweeping in from the lower frame edge up to the crown.
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, size * 0.95);
  ctx.quadraticCurveTo(-size * 0.28, size * 0.45, 0, 0);
  ctx.stroke();
  // Fronds fanning from the crown, each drooping toward its tip.
  ctx.lineWidth = size * 0.038;
  const fronds = [
    [-0.55, -0.28, -1.05, 0.02],
    [-0.5, -0.6, -0.95, -0.38],
    [-0.3, -0.78, -0.6, -0.68],
    [-0.02, -0.85, -0.15, -0.82],
    [0.28, -0.78, 0.32, -0.7],
    [0.55, -0.6, 0.72, -0.42],
    [0.75, -0.32, 1.0, -0.08],
  ];
  for (const [cx, cy, tx, ty] of fronds) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(cx * size, cy * size, tx * size, ty * size);
    ctx.stroke();
  }
  ctx.restore();
}

/** A lone figure in a wide-brim hat, seen from behind: hat, head, long coat
 *  and legs as one dark silhouette, with a thin teal rim on its lit side.
 *  The hat hides the head-to-shoulder join, so the silhouette reads clean. */
function drawFigure(ctx, x, baseY, size) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(size, size);
  ctx.fillStyle = '#01060b';
  ctx.beginPath();
  // Hat: wide brim with a low dome.
  ctx.ellipse(0, -1.66, 0.34, 0.055, 0, 0, Math.PI * 2);
  ctx.moveTo(-0.17, -1.66);
  ctx.quadraticCurveTo(-0.17, -1.86, 0, -1.86);
  ctx.quadraticCurveTo(0.17, -1.66, 0.17, -1.66);
  ctx.closePath();
  // Head, tucked under the brim and overlapping the shoulders.
  ctx.moveTo(0.15, -1.56);
  ctx.arc(0, -1.56, 0.15, 0, Math.PI * 2);
  // Neck block, so no sliver of photo shows between the brim and the coat.
  ctx.moveTo(-0.14, -1.68);
  ctx.lineTo(0.14, -1.68);
  ctx.lineTo(0.14, -1.42);
  ctx.lineTo(-0.14, -1.42);
  ctx.closePath();
  // Coat: shoulders out, body tapering, splitting into two legs.
  ctx.moveTo(-0.34, -1.44);
  ctx.quadraticCurveTo(-0.38, -1.1, -0.3, -0.62);
  ctx.lineTo(-0.26, 0);
  ctx.lineTo(-0.08, 0);
  ctx.lineTo(-0.05, -0.55);
  ctx.lineTo(0.05, -0.55);
  ctx.lineTo(0.08, 0);
  ctx.lineTo(0.26, 0);
  ctx.lineTo(0.3, -0.62);
  ctx.quadraticCurveTo(0.38, -1.1, 0.34, -1.44);
  ctx.quadraticCurveTo(0.2, -1.54, 0, -1.54);
  ctx.quadraticCurveTo(-0.2, -1.54, -0.34, -1.44);
  ctx.closePath();
  ctx.fill();
  // Teal rim light along the figure's right edge.
  ctx.strokeStyle = 'rgba(25, 227, 214, 0.85)';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(0.3, -1.4);
  ctx.quadraticCurveTo(0.36, -1.05, 0.28, -0.6);
  ctx.lineTo(0.24, 0);
  ctx.stroke();
  ctx.restore();
}

/** Bold caption lettering with a neon rim: a coloured stroke and a warm glow
 *  behind the fill, plus a small letterspaced tagline above it. */
function drawCaption(ctx, w, h, state) {
  const text = (state.caption || '').trim().toUpperCase();
  const tagline = 'VICE AFTER DARK';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (tagline) {
    const tagSize = Math.max(10, h * 0.021);
    ctx.font = `700 ${tagSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${tagSize * 0.42}px`; } catch { /* older canvas */ }
    ctx.fillStyle = 'rgba(25, 227, 214, 0.9)';
    ctx.shadowColor = 'rgba(25, 227, 214, 0.7)';
    ctx.shadowBlur = tagSize * 0.9;
    ctx.fillText(tagline, w / 2, h * 0.845);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  if (!text) return;
  let size = h * 0.105 * (state.captionScale || 1);
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > w * 0.92 && size > 10) {
    size -= 2;
    ctx.font = `900 ${size}px system-ui, sans-serif`;
  }
  const baseline = h * 0.94;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = state.rimColor || '#19e3d6';
  ctx.lineWidth = Math.max(2, size * 0.055);
  ctx.shadowColor = state.glowColor || '#ff7a1a';
  ctx.shadowBlur = size * 0.32;
  ctx.strokeText(text, w / 2, baseline);
  ctx.fillStyle = state.captionColor || '#f5efe0';
  ctx.fillText(text, w / 2, baseline);
  ctx.shadowBlur = 0;
}

/** Renders the whole cover onto any 2D context at width w and height h. */
export function renderCover(ctx, w, h, state) {
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, w, h);
  const shapes = panelShapes(w, h);
  const empty = '#0a1218';
  for (let i = 0; i < 2; i++) {
    const shape = shapes[i];
    if (!state.panels[i].img) {
      ctx.save();
      tracePath(ctx, shape);
      ctx.clip();
      ctx.fillStyle = empty;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    drawPanelPhoto(ctx, state.panels[i], shape);
    gradePanel(ctx, shape, w, h);
  }
  // Dusk wash: a cool multiply pass that pulls the bright daylight photos
  // down into night, before the seam and silhouettes go on.
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(110, 130, 140, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Neon seam between the panels.
  const seam = ctx.createLinearGradient(0, 0, 0, h);
  seam.addColorStop(0, '#19e3d6');
  seam.addColorStop(0.55, '#7fd8cf');
  seam.addColorStop(1, '#ff7a1a');
  ctx.save();
  ctx.strokeStyle = seam;
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.shadowColor = 'rgba(25, 227, 214, 0.8)';
  ctx.shadowBlur = w * 0.012;
  ctx.beginPath();
  ctx.moveTo(w * 0.60, 0);
  ctx.lineTo(w * 0.55, h);
  ctx.stroke();
  ctx.restore();
  // Silhouette palms crowning the top corners, figure standing in the right
  // panel, clear of the tagline so the lettering never crosses the silhouette.
  drawPalm(ctx, w * 0.1, h * 0.1, w * 0.3, false);
  drawPalm(ctx, w * 0.9, h * 0.08, w * 0.22, true);
  drawFigure(ctx, w * 0.79, h * 0.86, h * 0.19);
  // Deep vignette over the whole cover.
  const vig = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.32, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.66)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  drawCaption(ctx, w, h, state);
}

/** Draws the cover onto a canvas element at the canvas's own size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  renderCover(ctx, canvas.width, canvas.height, state);
}

/** A fresh empty editor state: no photos yet, default Palm Noir lettering. */
export function freshState() {
  return {
    panels: [
      { img: null, zoom: 1.15, ox: 0, oy: 0 },
      { img: null, zoom: 1.35, ox: 0, oy: 0 },
    ],
    caption: 'PALM NOIR',
    captionScale: 1,
    captionColor: '#f5efe0',
    rimColor: '#19e3d6',
    glowColor: '#ff7a1a',
  };
}
