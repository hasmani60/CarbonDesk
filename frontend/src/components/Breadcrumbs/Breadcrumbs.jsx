import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Don't show breadcrumbs on top-level pages
  if (pathnames.length <= 1) {
    return null;
  }

  return (
    <nav className="flex mb-4 text-xs" aria-label="Breadcrumb">
      <ol className="inline-flex items-center flex-wrap gap-x-1 gap-y-1">
        <li className="inline-flex items-center">
          <Link
            to={`/${pathnames[0]}`}
            className="inline-flex items-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors capitalize"
          >
            {pathnames[0]}
          </Link>
        </li>
        {pathnames.slice(1).map((value, index) => {
          const isLast = index === pathnames.slice(1).length - 1;
          const to = `/${pathnames.slice(0, index + 2).join('/')}`;

          return (
            <li key={to}>
              <div className="flex items-center">
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 mx-1" />
                {isLast ? (
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium capitalize">
                    {value.replace(/-/g, ' ')}
                  </span>
                ) : (
                  <Link
                    to={to}
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors capitalize"
                  >
                    {value.replace(/-/g, ' ')}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
