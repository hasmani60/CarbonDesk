/**
 * Export a Recharts (SVG) container to a PNG data URL for report embedding.
 */
export async function captureElementAsPng(element, { width = 720, height = 360, background = '#ffffff' } = {}) {
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
    cloned.setAttribute('viewBox', `0 0 ${w} ${h}`);
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
        resolve(canvas.toDataURL('image/png', 0.92));
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
