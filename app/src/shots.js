// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo
// loaded; ?shot=cover shows the cover alone, rendered at the export size that
// matches the window's shape (wide 1920x1080, tall 1080x1350, square 1080x1080),
// so the screenshot is the app's own drawing at full cover resolution.
// `photo` picks the sample (samples/<photo>.jpg) and `caption` the words.
// window.__shotReady is set once the cover has painted.
export async function runShot(shot, query, load, hooks) {
  const { canvas, state, redraw } = hooks;
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect > 1.15) { canvas.width = 1920; canvas.height = 1080; }
    else if (aspect < 0.9) { canvas.width = 1080; canvas.height = 1350; }
    else { canvas.width = 1080; canvas.height = 1080; }
  }
  await load(`samples/${query.get('photo') ?? 'pier'}.jpg`, query.get('caption') ?? 'PALM NOIR');
  if (shot === 'cover') {
    // Crop the right panel tighter than the left, so the two panels read as
    // two different shots of the same photo.
    state.panels[1].zoom = 1.9;
    state.panels[1].ox = -canvas.width * 0.06;
    state.panels[1].oy = canvas.height * 0.05;
    redraw();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
