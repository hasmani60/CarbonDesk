/**
 * Export a Recharts (SVG) container to a PNG data URL for report embedding.
 */
export async function captureElementAsPng(
  element,
  { width = 720, height = 360, background = '#ffffff', quality = 0.85 } = {}
) {
  if (!element) throw new Error('Chart element not found');

  const svg = element.querySelector('svg');
  if (!svg) throw new Error('No chart SVG found');

  const rect = element.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width) || width);
  const h = Math.max(1, Math.round(rect.height) || height);

  const cloned = svg.cloneNode(true);
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  cloned.setAttribute('width', String(w));
  cloned.setAttribute('height', String(h));

  if (!cloned.getAttribute('viewBox')) {
    const vb = svg.getAttribute('viewBox');
    if (vb) cloned.setAttribute('viewBox', vb);
    else cloned.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  const svgString = new XMLSerializer().serializeToString(cloned);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png', quality));
      };
      img.onerror = () => reject(new Error('Failed to render chart image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Let the browser lay out and paint Recharts SVG before capture. */
export async function waitForPaint(cycles = 3) {
  for (let i = 0; i < cycles; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  await wait(120);
}

/** True when Recharts has drawn visible geometry (not an empty frame). */
export function chartSvgHasContent(element) {
  const svg = element?.querySelector('svg');
  if (!svg) return false;

  const shapes = svg.querySelectorAll(
    '.recharts-line-curve, .recharts-bar-rectangle, .recharts-pie-sector, .recharts-sector'
  );
  if (shapes.length === 0) return false;

  try {
    const box = svg.getBoundingClientRect();
    return box.width > 40 && box.height > 40;
  } catch {
    return shapes.length > 0;
  }
}

/**
 * Wait for chart paint, then capture. Retries avoid blank overview snapshots.
 */
export async function captureChartSnapshot(element, options = {}) {
  const { maxAttempts = 8, ...captureOpts } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await waitForPaint(attempt === 0 ? 4 : 2);
    if (chartSvgHasContent(element)) {
      return captureElementAsPng(element, captureOpts);
    }
    await wait(200 + attempt * 80);
  }

  return captureElementAsPng(element, captureOpts);
}
