import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Printer, Download, ExternalLink, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  downloadReportHtml,
  printReportHtml,
  openReportHtmlPreview
} from '../../utils/reportExport';
import { formatDateTime } from '../../utils/formatters';

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 border-b border-emerald-200 dark:border-emerald-800 pb-2 mb-5 mt-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3 pl-3 border-l-4 border-emerald-500">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-7 mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-4 space-y-1.5 text-gray-700 dark:text-gray-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-gray-700 dark:text-gray-300">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  hr: () => <hr className="my-8 border-gray-200 dark:border-slate-700" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-emerald-500 pl-4 py-2 my-4 text-gray-600 dark:text-gray-400 bg-emerald-50/60 dark:bg-emerald-950/25 rounded-r-md">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-600">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-emerald-700 text-white">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-slate-50/90 dark:even:bg-slate-800/50">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 align-top">{children}</td>
  ),
  code: ({ inline, className, children, ...props }) => {
    const isInline = inline ?? !className?.includes('language-');
    if (isInline) {
      return (
        <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-sm">
          {children}
        </code>
      );
    }
    return (
      <pre className="my-4 p-4 rounded-lg bg-slate-900 text-slate-100 text-sm overflow-x-auto">
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
    generatedAt: generatedAt ? formatDateTime(generatedAt) : '',
    markdown: markdown || ''
  };
}

export default function AIReportViewer({
  title,
  periodLabel,
  generatedAt,
  markdown,
  showCover = false
}) {
  const content = bodyMarkdown(markdown, title);
  const opts = exportOptions(title, periodLabel, generatedAt, markdown);

  const handlePrint = () => {
    const result = printReportHtml(opts);
    if (!result.ok) toast.error(result.message);
  };

  const handleDownloadHtml = () => {
    try {
      downloadReportHtml(opts);
      toast.success('Report downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Could not export report');
    }
  };

  const handleOpenHtmlPreview = () => {
    const result = openReportHtmlPreview(opts);
    if (!result.ok) toast.error(result.message);
  };

  if (!markdown) return null;

  const metaLine = [periodLabel, generatedAt && `Generated ${formatDateTime(generatedAt)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="ai-report-document flex flex-col min-h-[320px]">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{title}</p>
            {metaLine && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{metaLine}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            type="button"
            onClick={handleOpenHtmlPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </button>
        </div>
      </div>

      {showCover && (
        <div className="shrink-0 px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">GHG emissions report</p>
          <h2 className="text-xl font-bold mt-1">{title}</h2>
          {metaLine && <p className="text-sm opacity-90 mt-1">{metaLine}</p>}
        </div>
      )}

      <article className="flex-1 overflow-y-auto px-6 md:px-10 py-8 bg-white dark:bg-slate-900 report-markdown-body max-h-[min(70vh,900px)]">
        <div className="max-w-3xl mx-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
