import { useEffect, useRef, useState } from 'react';

/**
 * Sized container for Recharts — fixes 0-width flex parents and stray SVG layout.
 */
export default function ChartFrame({ height = 360, className = '', children }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`w-full min-w-0 max-w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      {width > 0 ? children(width, height) : (
        <div className="h-full w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800" aria-hidden />
      )}
    </div>
  );
}
