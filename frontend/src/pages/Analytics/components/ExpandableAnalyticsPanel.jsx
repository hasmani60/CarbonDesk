import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';

/**
 * Hover-to-expand wrapper for analytics charts/sections.
 * Opens a large modal so sparse or dense charts are easier to read.
 */
export default function ExpandableAnalyticsPanel({
  title,
  children,
  className = '',
  /** Compact content; if function, receives { expanded: false } */
  content,
  /** Optional dedicated expanded content; defaults to content/children with expanded: true */
  expandedContent
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const renderCompact =
    typeof content === 'function'
      ? content({ expanded: false })
      : content ?? children;
  const renderExpanded =
    typeof expandedContent === 'function'
      ? expandedContent({ expanded: true })
      : typeof content === 'function'
        ? content({ expanded: true })
        : expandedContent ?? content ?? children;

  return (
    <>
      <div className={`analytics-expandable group/expand relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="analytics-expand-btn"
          title={`Expand ${title || 'chart'}`}
          aria-label={`Expand ${title || 'chart'}`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Expand</span>
        </button>
        {renderCompact}
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/55 backdrop-blur-[2px]"
              aria-label="Close expanded view"
              onClick={() => setOpen(false)}
            />
            <div className="analytics-expand-modal relative z-10 flex w-full max-w-6xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
                <div className="min-w-0">
                  <p id={titleId} className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50 sm:text-base">
                    {title || 'Expanded view'}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Press Esc or click outside to close
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="hidden items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 sm:inline-flex">
                    <Minimize2 className="w-3 h-3" />
                    Expanded
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="analytics-expand-modal-body min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                {renderExpanded}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
