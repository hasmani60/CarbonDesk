// PageHeader.jsx
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PageHeader = ({ title, breadcrumb = [], action }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
          {breadcrumb.map((item, index) => (
            <div key={index} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 mx-2" />}
              {item.href ? (
                <Link to={item.href} className="hover:text-emerald-600">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-900 font-medium">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export default PageHeader;