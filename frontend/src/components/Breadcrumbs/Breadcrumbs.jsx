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
    <nav className="flex mb-6 text-sm" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        <li className="inline-flex items-center">
          <Link
            to={`/${pathnames[0]}`}
            className="inline-flex items-center text-gray-500 hover:text-primary-teal transition-colors capitalize font-medium"
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
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                {isLast ? (
                  <span className="text-gray-900 font-semibold capitalize cursor-default">
                    {value.replace(/-/g, ' ')}
                  </span>
                ) : (
                  <Link
                    to={to}
                    className="text-gray-500 hover:text-primary-teal transition-colors capitalize font-medium"
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
