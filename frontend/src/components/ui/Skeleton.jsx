/**
 * Shimmer skeleton primitives — layout-stable placeholders for async content.
 */
export function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return (
    <div
      className={`skeleton-shimmer ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  const widths = ['w-full', 'w-full', 'w-4/5', 'w-2/3', 'w-11/12'];
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${widths[i % widths.length]}`}
          rounded="rounded-md"
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({ size = 'h-10 w-10', className = '' }) {
  return <Skeleton className={`${size} ${className}`} rounded="rounded-full" />;
}

export function SkeletonCard({ className = 'h-28' }) {
  return (
    <div className={`app-card p-5 space-y-3 ${className}`} aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" rounded="rounded-md" />
        <SkeletonCircle size="h-9 w-9" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" rounded="rounded-md" />
    </div>
  );
}

export function SkeletonChart({ height = 'h-64', className = '' }) {
  return (
    <div className={`app-card p-5 ${className}`} aria-hidden="true">
      <Skeleton className="h-5 w-40 mb-4" rounded="rounded-md" />
      <Skeleton className={`w-full ${height}`} />
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5, className = '' }) {
  return (
    <div className={`app-card overflow-hidden ${className}`} aria-hidden="true">
      <div className="px-4 py-3 border-b border-gray-200/80 dark:border-slate-700/80 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 max-w-[120px]" rounded="rounded-md" />
        ))}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-4 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-4 flex-1 ${c === 0 ? 'max-w-[180px]' : 'max-w-[100px]'}`}
                rounded="rounded-md"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto page-enter" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart height="h-56" />
        <SkeletonChart height="h-56" />
      </div>
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}

export function SkeletonAnalytics() {
  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 page-enter" aria-busy="true" aria-label="Loading analytics">
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" rounded="rounded-md" />
        <Skeleton className="h-4 w-64" rounded="rounded-md" />
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28" rounded="rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24" />
        ))}
      </div>
      <SkeletonChart height="h-72" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart height="h-64" />
        <SkeletonChart height="h-64" />
      </div>
    </div>
  );
}

export function SkeletonInputPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto page-enter" aria-busy="true">
      <Skeleton className="h-10 w-56" rounded="rounded-md" />
      <Skeleton className="h-4 w-96 max-w-full" rounded="rounded-md" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 flex-1 min-w-[120px]" rounded="rounded-xl" />
        ))}
      </div>
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}

export function SkeletonOrganisation() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto page-enter" aria-busy="true">
      <Skeleton className="h-10 w-48" rounded="rounded-md" />
      <div className="app-card p-6 space-y-4">
        <Skeleton className="h-6 w-40" rounded="rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" rounded="rounded-md" />
              <Skeleton className="h-10 w-full" rounded="rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function SkeletonOffsetList() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto page-enter" aria-busy="true">
      <Skeleton className="h-10 w-64" rounded="rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24" />
        ))}
      </div>
      <SkeletonTable rows={6} cols={7} />
    </div>
  );
}

export function SkeletonAppShell() {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950" aria-busy="true">
      <Skeleton className="hidden lg:block w-64 shrink-0 h-screen rounded-none" rounded="rounded-none" />
      <div className="flex-1 p-8 space-y-6">
        <Skeleton className="h-12 w-full max-w-3xl" rounded="rounded-lg" />
        <SkeletonDashboard />
      </div>
    </div>
  );
}

export function SkeletonReportFilters() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200/80 dark:border-slate-700/80 overflow-hidden">
          <Skeleton className="h-11 w-full rounded-none" rounded="rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-9 w-full" rounded="rounded-lg" />
            <Skeleton className="h-9 w-3/4" rounded="rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
