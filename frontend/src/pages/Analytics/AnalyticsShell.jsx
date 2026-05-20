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

  if (initialLoading && overviewStats == null) {
    return <SkeletonAnalytics />;
  }

  if (error) {
    return (
      <div className="space-y-8 w-full max-w-none">
        <PageHeader title="Analytics" breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]} />
        <div className="input-section-panel premium-glass-panel p-10 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button type="button" onClick={loadAllData} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!overviewStats) {
    return (
      <div className="space-y-8 w-full max-w-none">
        <PageHeader title="Analytics" breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]} />
        <div className="input-section-panel premium-glass-panel p-12 text-center">
          <Database className="w-14 h-14 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Add emissions data to unlock analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-none pb-12">
      <PageHeader
        title="Analytics"
        breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAllData}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm font-medium bg-white dark:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold shadow-teal-md"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        }
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400 -mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        {user?.organisation?.name && (
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{user.organisation.name}</span>
        )}
        {user?.organisation?.name && <span>·</span>}
        <span>Updated {formatDateTime(lastUpdate)}</span>
        {refreshing && <span className="text-caption">Refreshing…</span>}
        {chartsLoading && !refreshing && <span className="text-caption">Loading charts…</span>}
      </p>
      <AnalyticsTabNav />
      <div className="input-section-panel p-4 md:p-6 lg:p-8 w-full min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
