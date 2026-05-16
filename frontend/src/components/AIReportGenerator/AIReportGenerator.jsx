import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Filter,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { reportsAPI } from '../../services/api';
import AIReportViewer from './AIReportViewer';

const POLL_MS = 4000;
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_REPORT_WEBHOOK_URL;

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800'
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    className:
      'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800',
    spin: true
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
  }
};

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200/80 dark:border-slate-700/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/80 dark:bg-slate-800/50 hover:bg-gray-100/80 dark:hover:bg-slate-800 text-left transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          {Icon && <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
          {title}
          {badge != null && badge > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
              {badge}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        )}
      </button>
      {open && <div className="p-4 pt-3 space-y-4 border-t border-gray-200/60 dark:border-slate-700/60">{children}</div>}
    </div>
  );
}

function MultiSelectFilters({ label, options, selected, onChange, compact }) {
  if (!options?.length) return null;

  const toggle = (value) => {
    const key = String(value);
    const normalized = selected.map(String);
    const next = normalized.includes(key)
      ? selected.filter((v) => String(v) !== key)
      : [...selected, value];
    onChange(next);
  };

  return (
    <div>
      {label && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      )}
      <div
        className={`flex flex-wrap gap-2 ${compact ? 'max-h-28' : 'max-h-36'} overflow-y-auto pr-1`}
      >
        {options.map((opt) => {
          const val = String(opt);
          const checked = selected.map(String).includes(val);
          return (
            <label
              key={val}
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                checked
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
                  : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-500'
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                checked={checked}
                onChange={() => toggle(opt)}
              />
              <span className="leading-tight">{val}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${cfg.className}`}
    >
      <Icon className={`w-4 h-4 ${cfg.spin ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

function QuotaBar({ quota }) {
  if (!quota) return null;
  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const low = quota.remaining <= 5 && quota.remaining > 0;
  const exhausted = !quota.canGenerate;

  return (
    <div className="app-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">AI report quota</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {quota.used} of {quota.limit} used
            {quota.remaining != null && ` · ${quota.remaining} remaining`}
          </p>
        </div>
        <span
          className={`text-sm font-semibold tabular-nums ${
            exhausted
              ? 'text-amber-700 dark:text-amber-300'
              : low
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            exhausted ? 'bg-amber-500' : low ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function toDateInputValue(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function reportTitleFromContent(content) {
  if (!content) return 'AI Carbon Report';
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'AI Carbon Report';
}

function formatReportPeriodLabel(report) {
  const f = report?.filters;
  if (!f) return null;
  if (f.startDate && f.endDate) {
    return `${f.startDate} – ${f.endDate}`;
  }
  if (f.reportingYear && f.reportingMonth) {
    return `${f.reportingMonth}/${f.reportingYear}`;
  }
  if (f.reportingYear) return String(f.reportingYear);
  return null;
}

function countFilters(filters) {
  if (!filters) return 0;
  let n = 0;
  if (filters.selectedScopes?.length) n += filters.selectedScopes.length;
  if (filters.selectedFacilities?.length) n += filters.selectedFacilities.length;
  if (filters.selectedDepartments?.length) n += filters.selectedDepartments.length;
  if (filters.selectedSites?.length) n += filters.selectedSites.length;
  if (filters.selectedCategories?.length) n += filters.selectedCategories.length;
  return n;
}

export default function AIReportGenerator() {
  const { user } = useAuth();
  const canGenerate = user?.role === 'admin';

  const [quota, setQuota] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportingMonth, setReportingMonth] = useState('');
  const [reportingYear, setReportingYear] = useState('');
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [activeReport, setActiveReport] = useState(null);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef(null);

  const buildFiltersPayload = useCallback(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      reportingMonth: reportingMonth ? parseInt(reportingMonth, 10) : undefined,
      reportingYear: reportingYear ? parseInt(reportingYear, 10) : undefined,
      selectedScopes: selectedScopes.length ? selectedScopes.map(Number) : undefined,
      selectedFacilities: selectedFacilities.length ? selectedFacilities : undefined,
      selectedDepartments: selectedDepartments.length ? selectedDepartments : undefined,
      selectedSites: selectedSites.length ? selectedSites : undefined,
      selectedCategories: selectedCategories.length ? selectedCategories : undefined
    }),
    [
      startDate,
      endDate,
      reportingMonth,
      reportingYear,
      selectedScopes,
      selectedFacilities,
      selectedDepartments,
      selectedSites,
      selectedCategories
    ]
  );

  const fetchReport = useCallback(async (reportId) => {
    const data = await reportsAPI.getById(reportId);
    setActiveReport(data);
    return data;
  }, []);

  useEffect(() => {
    if (!canGenerate) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const q = await reportsAPI.getQuota();
        if (!cancelled) setQuota(q);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canGenerate]);

  useEffect(() => {
    if (!canGenerate) return undefined;

    let cancelled = false;
    (async () => {
      try {
        setLoadingOptions(true);
        const options = await reportsAPI.getFilterOptions();
        if (cancelled) return;
        setFilterOptions(options);

        if (options?.dateRange?.minDate) {
          const min = toDateInputValue(options.dateRange.minDate);
          const max = toDateInputValue(options.dateRange.maxDate);
          if (!startDate && min) setStartDate(min);
          if (!endDate && max) setEndDate(max);
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not load report filters');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canGenerate]);

  useEffect(() => {
    if (!canGenerate) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const list = await reportsAPI.list({ limit: 1 });
        const latest = Array.isArray(list) ? list[0] : null;
        if (cancelled || !latest) return;
        if (['pending', 'processing', 'completed'].includes(latest.status)) {
          const data = await fetchReport(latest.id);
          if (data.status === 'completed' && data.reportContent) {
            setShowReportViewer(true);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canGenerate, fetchReport]);

  useEffect(() => {
    if (!activeReport?.id) return undefined;
    const terminal = ['completed', 'failed'];
    if (terminal.includes(activeReport.status)) return undefined;

    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchReport(activeReport.id);
        if (data.status === 'completed') {
          setShowReportViewer(true);
          toast.success('Your AI report is ready');
          clearInterval(pollRef.current);
        } else if (data.status === 'failed') {
          setShowReportViewer(false);
          toast.error(data.error || 'Report generation failed');
          clearInterval(pollRef.current);
        }
      } catch (err) {
        console.error('Poll error', err);
      }
    }, POLL_MS);

    return () => clearInterval(pollRef.current);
  }, [activeReport?.id, activeReport?.status, fetchReport]);

  const triggerN8nWebhook = async (reportId, filters) => {
    if (!N8N_WEBHOOK_URL) {
      throw new Error(
        'N8N webhook URL is not configured (VITE_N8N_REPORT_WEBHOOK_URL)'
      );
    }

    const payload = {
      reportId,
      organisationId: user.organisation_id,
      userId: user.id,
      ...filters
    };

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Webhook failed (${res.status})`);
    }
  };

  const handleCancel = async () => {
    if (!activeReport?.id) return;
    try {
      setCancelling(true);
      clearInterval(pollRef.current);
      await reportsAPI.cancel(activeReport.id);
      setShowReportViewer(false);
      setActiveReport((prev) =>
        prev
          ? { ...prev, status: 'failed', error: 'Cancelled by user' }
          : null
      );
      toast.success('Report cancelled — you can generate a new one');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not cancel report');
    } finally {
      setCancelling(false);
    }
  };

  const handleGenerate = async () => {
    const filters = buildFiltersPayload();
    const hasPeriod =
      (filters.startDate && filters.endDate) ||
      (filters.reportingYear && filters.reportingMonth) ||
      filters.reportingYear;

    if (!hasPeriod) {
      toast.error('Select a date range or reporting month/year');
      return;
    }

    try {
      setSubmitting(true);
      const created = await reportsAPI.generate(filters);
      const reportId = created.id;
      if (created.quota) {
        setQuota((prev) => ({
          ...(prev || {}),
          used: created.quota.used,
          limit: created.quota.limit,
          remaining: created.quota.remaining,
          canGenerate: created.quota.remaining > 0
        }));
      }

      setShowReportViewer(false);
      setActiveReport({
        id: reportId,
        status: 'pending',
        filters,
        reportContent: null
      });

      try {
        await triggerN8nWebhook(reportId, filters);
        toast.success('Report queued — generating in the background');
      } catch (webhookErr) {
        console.error(webhookErr);
        toast.error(
          webhookErr.message ||
            'Report created but automation webhook failed. Check n8n configuration.'
        );
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'AI_REPORT_QUOTA_EXCEEDED' && err.quota) {
        setQuota(err.quota);
      }
      toast.error(err.message || 'Failed to start report generation');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canGenerate) {
    return null;
  }

  const facilityOptions =
    filterOptions?.facilities?.length > 0
      ? filterOptions.facilities
      : filterOptions?.locations || [];

  const quotaExhausted = quota != null && !quota.canGenerate;
  const filterCount =
    selectedScopes.length +
    selectedFacilities.length +
    selectedDepartments.length +
    selectedSites.length +
    selectedCategories.length;

  const isRunning =
    activeReport?.status === 'pending' || activeReport?.status === 'processing';
  const hasCompletedReport =
    activeReport?.status === 'completed' && activeReport.reportContent;

  const previewTitle = hasCompletedReport
    ? reportTitleFromContent(activeReport.reportContent)
    : null;
  const previewPeriod = hasCompletedReport ? formatReportPeriodLabel(activeReport) : null;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex-1 min-w-[min(100%,260px)]">
          <QuotaBar quota={quota} />
        </div>
        {activeReport?.status && (
          <div className="app-card px-5 flex items-center shrink-0">
            <StatusBadge status={activeReport.status} />
          </div>
        )}
      </div>

      {quotaExhausted && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            Your organisation has used all AI report generations allowed on your plan.
            Contact your platform administrator to increase the limit.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Configuration */}
        <div className="app-card p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Report configuration
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Choose the reporting period and optional filters. Generation typically takes 1–3
              minutes.
            </p>
          </div>

          {loadingOptions ? (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading filter options…
            </div>
          ) : (
            <div className="space-y-4">
              <CollapsibleSection title="Reporting period" icon={Calendar} defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reporting month
                    </label>
                    <select
                      value={reportingMonth}
                      onChange={(e) => setReportingMonth(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reporting year
                    </label>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      placeholder="e.g. 2025"
                      value={reportingYear}
                      onChange={(e) => setReportingYear(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Use either a date range or reporting month/year (or year only).
                </p>
              </CollapsibleSection>

              <CollapsibleSection
                title="Scopes & breakdowns"
                icon={Layers}
                defaultOpen={false}
                badge={filterCount}
              >
                <MultiSelectFilters
                  label="Scopes"
                  options={filterOptions?.scopes || [1, 2, 3]}
                  selected={selectedScopes}
                  onChange={setSelectedScopes}
                  compact
                />
                <MultiSelectFilters
                  label="Facilities / locations"
                  options={facilityOptions}
                  selected={selectedFacilities}
                  onChange={setSelectedFacilities}
                  compact
                />
                <MultiSelectFilters
                  label="Departments"
                  options={filterOptions?.departments}
                  selected={selectedDepartments}
                  onChange={setSelectedDepartments}
                  compact
                />
                <MultiSelectFilters
                  label="Sites"
                  options={filterOptions?.sites}
                  selected={selectedSites}
                  onChange={setSelectedSites}
                  compact
                />
              </CollapsibleSection>

              <CollapsibleSection
                title="Emission categories"
                icon={Filter}
                defaultOpen={false}
                badge={selectedCategories.length}
              >
                <MultiSelectFilters
                  options={filterOptions?.categories}
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                />
              </CollapsibleSection>

              {!N8N_WEBHOOK_URL && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>
                    Set <code className="text-xs">VITE_N8N_REPORT_WEBHOOK_URL</code> in your
                    frontend environment so n8n can process reports asynchronously.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={submitting || quotaExhausted || isRunning}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium shadow-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Generate AI Report
                </button>
                {isRunning && (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
                    >
                      {cancelling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Cancel
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 w-full">
                      Stuck? Cancel clears this run so you can try again.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview / status */}
        <div className="space-y-4 min-h-[320px]">
          {activeReport?.status === 'failed' && (
            <div className="app-card p-5 border-red-200 dark:border-red-900 space-y-3">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Generation failed</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {activeReport.error || 'Report generation failed. Please try again.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Dismiss and start fresh
              </button>
            </div>
          )}

          {isRunning && (
            <div className="app-card p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4">
                <Loader2 className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">Generating your report</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
                AI is analysing your emissions data and drafting a GHG Protocol–aligned report.
                This panel will update automatically when ready.
              </p>
              {countFilters(activeReport.filters) > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                  {countFilters(activeReport.filters)} filter
                  {countFilters(activeReport.filters) !== 1 ? 's' : ''} applied
                </p>
              )}
            </div>
          )}

          {hasCompletedReport && (
            <div className="app-card overflow-hidden flex flex-col min-h-[320px]">
              {showReportViewer ? (
                <>
                  <AIReportViewer
                    title={previewTitle}
                    periodLabel={previewPeriod}
                    generatedAt={activeReport.generatedAt}
                    markdown={activeReport.reportContent}
                  />
                  <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700/80 bg-gray-50/50 dark:bg-slate-800/30">
                    <button
                      type="button"
                      onClick={() => setShowReportViewer(false)}
                      className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      Collapse preview
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center text-center flex-1 min-h-[280px]">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">{previewTitle}</p>
                  {previewPeriod && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{previewPeriod}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowReportViewer(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    <FileText className="w-4 h-4" />
                    View full report
                  </button>
                </div>
              )}
            </div>
          )}

          {!activeReport && !loadingOptions && (
            <div className="app-card p-8 flex flex-col items-center justify-center text-center min-h-[320px] border-dashed">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="font-medium text-gray-900 dark:text-white">Report preview</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
                Configure filters on the left and generate a report. The finished document will
                appear here with print and download options.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
