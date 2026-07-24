import { Outlet } from 'react-router-dom';
import { RefreshCw, Download, AlertCircle, Database } from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';
import { formatDateTime } from '../../utils/formatters';
import { useAnalytics } from './AnalyticsContext';
import AnalyticsTabNav from './components/AnalyticsTabNav';
import { SkeletonAnalytics } from '../../components/ui/Skeleton';

export default function AnalyticsShell() {
  const {
    user,
    initialLoading,
    refreshing,
    chartsLoading,
    error,
    lastUpdate,
    overviewStats,
    loadAllData,
    handleExport
  } = useAnalytics();

  if (initialLoading) {
    return <SkeletonAnalytics />;
  }

  if (error) {
    return (
      <div className="space-y-6 w-full max-w-none">
        <PageHeader
          eyebrow="Insights"
          title="Analytics"
          breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Analytics' }]}
        />
        <div className="app-card p-10 text-center max-w-lg mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{error}</p>
          <button type="button" onClick={loadAllData} className="btn-primary">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!overviewStats) {
    return (
      <div className="space-y-6 w-full max-w-none">
        <PageHeader
          eyebrow="Insights"
          title="Analytics"
          breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Analytics' }]}
        />
        <div className="app-card p-12 text-center max-w-md mx-auto">
          <Database className="w-10 h-10 text-zinc-400 mx-auto mb-4" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Add emissions data to unlock analytics and reporting.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none pb-12">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        subtitle="Scope breakdowns, trends, and abatement opportunities for your organisation."
        breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Analytics' }]}
        meta={
          <>
            {user?.organisation?.name && (
              <span className="badge bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                {user.organisation.name}
              </span>
            )}
            <span className="text-caption">Updated {formatDateTime(lastUpdate)}</span>
            {refreshing && <span className="badge bg-zinc-100 text-zinc-600 border-zinc-200">Refreshing…</span>}
            {chartsLoading && !refreshing && (
              <span className="badge bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.2)]">
                Loading charts…
              </span>
            )}
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAllData}
              disabled={refreshing}
              className="btn-secondary"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
              Refresh
            </button>
            <button type="button" onClick={handleExport} className="btn-primary">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        }
      />
      <AnalyticsTabNav />
      <div className="input-section-panel p-2 sm:p-3 md:p-4 w-full min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
