import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const REPORT_DOCUMENT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    max-width: 920px;
    margin: 0 auto;
    padding: 2rem 2.5rem;
    color: #1f2937;
    line-height: 1.65;
    background: #fff;
  }
  .report-cover {
    background: linear-gradient(180deg, #ecfdf5 0%, #fff 100%);
    border-bottom: 2px solid #a7f3d0;
    padding: 1.5rem 0 2rem;
    margin-bottom: 2rem;
  }
  .report-cover .label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #047857;
    margin: 0 0 0.5rem;
  }
  .report-cover h1 {
    font-size: 1.75rem;
    color: #111827;
    margin: 0 0 0.5rem;
    border: none;
    padding: 0;
  }
  .report-cover .meta { color: #6b7280; font-size: 0.875rem; margin: 0; }
  .report-body h1 {
    font-size: 1.5rem;
    color: #047857;
    border-bottom: 2px solid #d1fae5;
    padding-bottom: 0.35rem;
    margin: 1.5rem 0 1rem;
  }
  .report-body h2 {
    font-size: 1.2rem;
    color: #111827;
    margin: 2rem 0 0.75rem;
    padding-left: 0.75rem;
    border-left: 4px solid #10b981;
  }
  .report-body h3 { font-size: 1.05rem; margin: 1.25rem 0 0.5rem; }
  .report-body p { margin: 0 0 1rem; }
  .report-body ul, .report-body ol { margin: 0 0 1rem; padding-left: 1.5rem; }
  .report-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
  .report-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0 1.5rem;
    font-size: 0.875rem;
  }
  .report-body th {
    background: #047857;
    color: #fff;
    text-align: left;
    padding: 0.6rem 0.75rem;
  }
  .report-body td {
    border-bottom: 1px solid #e5e7eb;
    padding: 0.5rem 0.75rem;
    vertical-align: top;
  }
  .report-body tr:nth-child(even) td { background: #f9fafb; }
  .report-body blockquote {
    border-left: 4px solid #10b981;
    margin: 1rem 0;
    padding: 0.25rem 0 0.25rem 1rem;
    color: #4b5563;
    background: #f0fdf4;
  }
  .report-body code {
    background: #f3f4f6;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-size: 0.85em;
  }
  .report-body pre {
    background: #111827;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
  }
  @media print {
    body { padding: 0.5in; }
    .report-cover { break-after: avoid; }
    .report-body h2 { break-after: avoid; }
    .report-body table { break-inside: avoid; }
  }
`;

export function markdownToHtml(markdown) {
  if (!markdown) return '';
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown)
  );
}

export function buildFullReportHtml({ title, periodLabel, generatedAt, markdown }) {
  const safeTitle = (title || 'Carbon Report').replace(/</g, '');
  const metaParts = [periodLabel, generatedAt ? `Generated ${generatedAt}` : ''].filter(Boolean);
  const bodyHtml = markdownToHtml(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${REPORT_DOCUMENT_STYLES}</style>
</head>
<body>
  <header class="report-cover">
    <p class="label">GHG emissions report</p>
    <h1>${safeTitle}</h1>
    ${metaParts.length ? `<p class="meta">${metaParts.join(' · ')}</p>` : ''}
  </header>
  <main class="report-body">${bodyHtml}</main>
</body>
</html>`;
}

function createHtmlBlobUrl(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

export function downloadReportHtml(options) {
  const html = buildFullReportHtml(options);
  const url = createHtmlBlobUrl(html);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(options.title || 'carbon-report').replace(/[^\w\-]+/g, '-').slice(0, 60)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Print via hidden iframe — no pop-up window required.
 */
export function printReportHtml(options) {
  try {
    const html = buildFullReportHtml(options);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Print carbon report');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return { ok: false, message: 'Could not open print view.' };
    }

    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    const cleanup = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    const runPrint = () => {
      win.focus();
      win.print();
      win.addEventListener('afterprint', cleanup, { once: true });
      setTimeout(cleanup, 60_000);
    };

    setTimeout(runPrint, 300);
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, message: 'Could not print report.' };
  }
}

/**
 * Open styled HTML in a new tab via blob URL (no empty pop-up).
 */
export function openReportHtmlPreview(options) {
  try {
    const html = buildFullReportHtml(options);
    const url = createHtmlBlobUrl(html);

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, message: 'Could not open report preview.' };
  }
}
