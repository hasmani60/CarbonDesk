import React from 'react';

const SkeletonLoader = ({ className = '', type = 'rect', lines = 1 }) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';

  if (type === 'text') {
    return (
      <div className="space-y-3 w-full">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} h-4 rounded w-${i === lines - 1 && lines > 1 ? '2/3' : 'full'} ${className}`}
          />
        ))}
      </div>
    );
  }

  if (type === 'circle') {
    return <div className={`${baseClasses} rounded-full ${className}`} />;
  }

  // Default rectangle
  return <div className={`${baseClasses} rounded-lg ${className}`} />;
};

export default SkeletonLoader;
