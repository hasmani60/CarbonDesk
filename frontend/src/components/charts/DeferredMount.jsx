import { useEffect, useRef, useState } from 'react';

/**
 * Mount children only when near the viewport — keeps initial Analytics paint fast.
 */
export default function DeferredMount({
  children,
  minHeight = 280,
  rootMargin = '120px',
  className = ''
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : (
        <div
          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
          style={{ minHeight }}
          aria-hidden
        />
      )}
    </div>
  );
}
