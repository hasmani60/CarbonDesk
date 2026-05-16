import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Printer, Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  downloadReportHtml,
  printReportHtml,
  openReportHtmlPreview
} from '../../utils/reportExport';

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
  code: ({ inline, className, children, ...props }) => {
    const isInline = inline ?? !className?.includes('language-');
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <pre className="my-4 p-4 rounded-lg bg-gray-900 text-gray-100 text-sm overflow-x-auto">
        <code {...props}>{children}</code>
      </pre>
    );
  }
};

function bodyMarkdown(markdown, title) {
  if (!markdown) return '';
  const trimmed = markdown.trim();
  const m = trimmed.match(/^#\s+(.+)$/m);
  if (m && title && m[1].trim() === title.trim()) {
    return trimmed.replace(/^#\s+.+$/m, '').trim();
  }
  return trimmed;
}

function exportOptions(title, periodLabel, generatedAt, markdown) {
  return {
    title: title || 'Carbon Report',
    periodLabel: periodLabel || '',
    generatedAt: generatedAt ? new Date(generatedAt).toLocaleString() : '',
    markdown: markdown || ''
  };
}

export default function AIReportViewer({ title, periodLabel, generatedAt, markdown }) {
  const content = bodyMarkdown(markdown, title);
  const opts = exportOptions(title, periodLabel, generatedAt, markdown);

  const handlePrint = () => {
    const result = printReportHtml(opts);
    if (!result.ok) {
      toast.error(result.message);
    }
  };

  const handleDownloadHtml = () => {
    try {
      downloadReportHtml(opts);
      toast.success('Report downloaded as HTML');
    } catch (err) {
      console.error(err);
      toast.error('Could not export report');
    }
  };

  const handleOpenHtmlPreview = () => {
    const result = openReportHtmlPreview(opts);
    if (!result.ok) {
      toast.error(result.message);
    } else {
      toast.success('Report opened in a new tab');
    }
  };

  if (!markdown) return null;

  return (
    <div className="ai-report-document rounded-b-xl overflow-hidden border border-gray-200 dark:border-slate-700">
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          type="button"
          onClick={handleDownloadHtml}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Download className="w-4 h-4" />
          Download HTML
        </button>
        <button
          type="button"
          onClick={handleOpenHtmlPreview}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </button>
      </div>

      <div className="bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-900 px-6 md:px-10 py-8 border-b border-emerald-100 dark:border-emerald-900/40">
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

      <article className="px-6 md:px-10 py-8 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900/80 report-markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
