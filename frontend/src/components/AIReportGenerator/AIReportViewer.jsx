import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Printer, Download } from 'lucide-react';

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-2xl md:text-3xl font-bold text-emerald-900 dark:text-emerald-100 border-b-2 border-emerald-600/30 pb-3 mb-6 mt-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-10 mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-emerald-500 rounded-full shrink-0" aria-hidden />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-700 dark:text-gray-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1 text-gray-700 dark:text-gray-300">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  hr: () => <hr className="my-8 border-gray-200 dark:border-slate-600" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-emerald-500 pl-4 py-1 my-4 text-gray-600 dark:text-gray-400 italic bg-emerald-50/50 dark:bg-emerald-950/20 rounded-r-lg">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-emerald-700 text-white dark:bg-emerald-800">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-900/50">
      {children}
    </tbody>
  ),
  tr: ({ children }) => <tr className="even:bg-gray-50/80 dark:even:bg-slate-800/40">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 align-top">{children}</td>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-sm font-mono">
        {children}
      </code>
    ) : (
      <pre className="my-4 p-4 rounded-lg bg-gray-900 text-gray-100 text-sm overflow-x-auto">
        <code>{children}</code>
      </pre>
    )
};

function buildStandaloneHtml({ title, periodLabel, generatedAt, markdown }) {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title.replace(/</g, '')}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1f2937; line-height: 1.6; }
    h1 { color: #047857; border-bottom: 2px solid #a7f3d0; padding-bottom: 0.5rem; }
    h2 { color: #111827; margin-top: 2rem; border-left: 4px solid #10b981; padding-left: 0.75rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
    th { background: #047857; color: white; text-align: left; padding: 0.6rem 0.75rem; }
    td { border-bottom: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; }
    tr:nth-child(even) td { background: #f9fafb; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
    .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 2rem; }
    @media print { body { padding: 0.5in; } }
  </style>
</head>
<body>
  <p class="meta">${periodLabel || ''}${generatedAt ? ` · Generated ${generatedAt}` : ''}</p>
  <pre style="white-space: pre-wrap; font-family: inherit; font-size: inherit;">${escaped}</pre>
</body>
</html>`;
}

/** Avoid duplicate title when markdown starts with # Title */
function bodyMarkdown(markdown, title) {
  if (!markdown) return '';
  const trimmed = markdown.trim();
  const m = trimmed.match(/^#\s+(.+)$/m);
  if (m && title && m[1].trim() === title.trim()) {
    return trimmed.replace(/^#\s+.+$/m, '').trim();
  }
  return trimmed;
}

export default function AIReportViewer({ title, periodLabel, generatedAt, markdown }) {
  const content = bodyMarkdown(markdown, title);
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const html = buildStandaloneHtml({
      title: title || 'Carbon Report',
      periodLabel,
      generatedAt: generatedAt ? new Date(generatedAt).toLocaleString() : '',
      markdown: markdown || ''
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'carbon-report').replace(/[^\w\-]+/g, '-').slice(0, 60)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!markdown) return null;

  return (
    <div className="ai-report-document">
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          type="button"
          onClick={handleDownloadHtml}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700"
        >
          <Download className="w-4 h-4" />
          Download HTML
        </button>
      </div>

      <div className="bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-900 px-6 md:px-10 py-8 border-b border-emerald-100 dark:border-emerald-900/40 print:bg-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
          GHG emissions report
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {(periodLabel || generatedAt) && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {periodLabel}
            {generatedAt && (
              <span> · Generated {new Date(generatedAt).toLocaleString()}</span>
            )}
          </p>
        )}
      </div>

      <article className="px-6 md:px-10 py-8 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible bg-white dark:bg-slate-900/80">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
