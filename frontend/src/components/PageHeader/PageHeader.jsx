// PageHeader.jsx
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PageHeader = ({ title, breadcrumb = [], action }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mb-2">
          {breadcrumb.map((item, index) => (
            <div key={index} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 mx-2 shrink-0 text-gray-400 dark:text-gray-500" />}
              {item.href ? (
                <Link to={item.href} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-900 dark:text-white font-medium">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export default PageHeader;