import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PageHeader = ({
  eyebrow = 'Carbon Desk',
  title,
  subtitle,
  breadcrumb = [],
  action,
  meta
}) => {
  const showEyebrow = Boolean(eyebrow);

  return (
    <header className="page-header w-full mb-6">
      {breadcrumb.length > 0 && (
        <nav
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mb-3"
          aria-label="Breadcrumb"
        >
          {breadcrumb.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex items-center min-w-0">
              {index > 0 && (
                <ChevronRight className="w-3.5 h-3.5 mx-1 shrink-0 text-zinc-400 dark:text-zinc-500" />
              )}
              {item.href ? (
                <Link
                  to={item.href}
                  className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 flex-1 md:pr-4">
          {showEyebrow && <p className="page-eyebrow">{eyebrow}</p>}
          <h1 className="page-title break-words">{title}</h1>
          {subtitle && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-3xl leading-relaxed">
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>

        {action && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 md:pt-0.5 md:max-w-[min(100%,280px)] md:justify-end">
            {action}
          </div>
        )}
      </div>
    </header>
  );
};

export default PageHeader;
