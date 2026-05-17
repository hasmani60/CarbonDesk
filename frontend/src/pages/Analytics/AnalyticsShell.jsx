import { Outlet } from 'react-router-dom';
import { RefreshCw, Download, AlertCircle, Database } from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';
import { formatDateTime } from '../../utils/formatters';
import { useAnalytics } from './AnalyticsContext';
import AnalyticsTabNav from './components/AnalyticsTabNav';

export default function AnalyticsShell() {
  const {
    user,
    loading,
    error,
    lastUpdate,
    overviewStats,
    loadAllData,
    handleExport
  } = useAnalytics();

  if (loading && !overviewStats) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 motion-safe:animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader title="Analytics" breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]} />
        <div className="app-card p-10 text-center mt-6">
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
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader title="Analytics" breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]} />
        <div className="app-card p-12 text-center mt-6">
          <Database className="w-14 h-14 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Add emissions data to unlock analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="space-y-4 mb-6">
        <PageHeader
          title="Analytics"
          breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadAllData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium bg-white/80 dark:bg-slate-800/80"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          }
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {user?.organisation?.name && (
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.organisation.name}</span>
          )}
          {user?.organisation?.name && <span className="mx-1">·</span>}
          Updated {formatDateTime(lastUpdate)}
        </p>
        <AnalyticsTabNav />
      </div>
      <Outlet />
    </div>
  );
}
