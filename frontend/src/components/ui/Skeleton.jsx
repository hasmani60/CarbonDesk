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

/** Overview tab — 8 spaced sections matching AnalyticsCompactDashboard rows */
export function SkeletonAnalyticsOverview() {
  return (
    <div className="analytics-report" aria-busy="true" aria-label="Loading overview">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="analytics-report-body">
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            <Skeleton className="col-span-12 lg:col-span-3 h-[188px] rounded-lg" />
            <Skeleton className="col-span-12 lg:col-span-9 h-[188px] rounded-lg" />
          </div>
        </div>
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="col-span-6 sm:col-span-3 h-[140px] rounded-lg" />
            ))}
          </div>
        </div>
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            <Skeleton className="col-span-12 lg:col-span-5 h-[220px] rounded-lg" />
            <Skeleton className="col-span-12 lg:col-span-7 h-[220px] rounded-lg" />
          </div>
        </div>
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            <Skeleton className="col-span-12 lg:col-span-6 h-[200px] rounded-lg" />
            <Skeleton className="col-span-12 lg:col-span-6 h-[200px] rounded-lg" />
          </div>
        </div>
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            <Skeleton className="col-span-12 h-[200px] rounded-lg" />
          </div>
        </div>
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            <Skeleton className="col-span-12 lg:col-span-6 h-[220px] rounded-lg" />
            <Skeleton className="col-span-12 lg:col-span-6 h-[220px] rounded-lg" />
          </div>
        </div>
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            <Skeleton className="col-span-12 h-[100px] rounded-lg" />
          </div>
        </div>
        <div className="analytics-report-section">
          <div className="analytics-report-grid">
            <Skeleton className="col-span-12 h-[140px] rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Scope 1/2/3 — header + migration + monthly + activities + pareto + tips (+ scope3 extras) */
export function SkeletonAnalyticsScope({ scope = 1 }) {
  const isScope3 = Number(scope) === 3;
  return (
    <div className="analytics-tab-panel space-y-6" aria-busy="true" aria-label={`Loading scope ${scope}`}>
      <div className="app-card p-6 md:p-8 space-y-5">
        <Skeleton className="h-3 w-20" rounded="rounded-md" />
        <Skeleton className="h-8 w-64 max-w-full" rounded="rounded-md" />
        <Skeleton className="h-4 w-96 max-w-full" rounded="rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
      {isScope3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}
      <SkeletonChart height="h-72" />
      <SkeletonChart height="h-72" />
      <SkeletonChart height="h-64" />
      <div className="app-card p-6 space-y-3">
        <Skeleton className="h-6 w-40" rounded="rounded-md" />
        <Skeleton className="h-4 w-full" rounded="rounded-md" />
        <Skeleton className="h-4 w-5/6" rounded="rounded-md" />
        <Skeleton className="h-4 w-4/5" rounded="rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonAnalytics({ variant = 'overview', scope } = {}) {
  const panel =
    variant === 'scope' ? (
      <SkeletonAnalyticsScope scope={scope} />
    ) : (
      <SkeletonAnalyticsOverview />
    );

  return (
    <div className="space-y-6 w-full max-w-none pb-12 page-enter" aria-busy="true" aria-label="Loading analytics">
      <Skeleton className="h-10 w-56" rounded="rounded-md" />
      <Skeleton className="h-4 w-72 max-w-full" rounded="rounded-md" />
      <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl bg-gray-100/80 dark:bg-slate-800/60">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] flex-1 min-w-[160px]" rounded="rounded-xl" />
        ))}
      </div>
      <div className="input-section-panel p-2 sm:p-3 md:p-4 w-full min-w-0 overflow-hidden">{panel}</div>
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
