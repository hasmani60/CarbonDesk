import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PageHeader = ({ title, subtitle, breadcrumb = [], action, meta }) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb.length > 0 && (
          <nav
            className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mb-2"
            aria-label="Breadcrumb"
          >
            {breadcrumb.map((item, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 mx-1 shrink-0 text-zinc-400 dark:text-zinc-500" />
                )}
                {item.href ? (
                  <Link
                    to={item.href}
                    className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">{item.label}</span>
                )}
              </div>
            ))}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption">{meta}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
};

export default PageHeader;
