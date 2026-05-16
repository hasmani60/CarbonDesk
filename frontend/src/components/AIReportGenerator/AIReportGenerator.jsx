import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { reportsAPI } from '../../services/api';

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

function MultiSelectFilters({ label, options, selected, onChange }) {
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
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
        {options.map((opt) => {
          const val = String(opt);
          const checked = selected.map(String).includes(val);
          return (
            <label
              key={val}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                checked
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
                  : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                checked={checked}
                onChange={() => toggle(opt)}
              />
              {val}
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

export default function AIReportGenerator() {
  const { user } = useAuth();
  const canGenerate = ['admin', 'analyst'].includes(user?.role);

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
          await fetchReport(latest.id);
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
          setShowReportViewer(false);
          toast.success('AI report is ready — click View report to read it');
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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="analytics-section-title">
          <Sparkles className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          AI Carbon Report
        </h2>
        {activeReport?.status && <StatusBadge status={activeReport.status} />}
      </div>

      <div className="app-card p-6 space-y-6">
        {loadingOptions ? (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading filter options…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MultiSelectFilters
                label="Scopes"
                options={filterOptions?.scopes || [1, 2, 3]}
                selected={selectedScopes}
                onChange={setSelectedScopes}
              />
              <MultiSelectFilters
                label="Facilities / locations"
                options={facilityOptions}
                selected={selectedFacilities}
                onChange={setSelectedFacilities}
              />
              <MultiSelectFilters
                label="Departments"
                options={filterOptions?.departments}
                selected={selectedDepartments}
                onChange={setSelectedDepartments}
              />
              <MultiSelectFilters
                label="Sites"
                options={filterOptions?.sites}
                selected={selectedSites}
                onChange={setSelectedSites}
              />
              <MultiSelectFilters
                label="Categories"
                options={filterOptions?.categories}
                selected={selectedCategories}
                onChange={setSelectedCategories}
              />
            </div>

            {!N8N_WEBHOOK_URL && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  Set <code className="text-xs">VITE_N8N_REPORT_WEBHOOK_URL</code> in your
                  frontend environment so n8n can process reports asynchronously.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  submitting ||
                  activeReport?.status === 'pending' ||
                  activeReport?.status === 'processing'
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate AI Report
              </button>
              {(activeReport?.status === 'pending' || activeReport?.status === 'processing') && (
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
                    Cancel & try again
                  </button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 w-full sm:w-auto">
                    Stuck? Cancel clears this run so you can test again.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {activeReport?.status === 'failed' && (
        <div className="app-card p-4 border-red-200 dark:border-red-900 space-y-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            {activeReport.error || 'Report generation failed. Please try again.'}
          </p>
          <button
            type="button"
            onClick={() => setActiveReport(null)}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Dismiss and start fresh
          </button>
        </div>
      )}

      {activeReport?.status === 'completed' && activeReport.reportContent && (
        <div className="app-card overflow-hidden">
          <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-700/80">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {reportTitleFromContent(activeReport.reportContent)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatReportPeriodLabel(activeReport) || 'Report ready'}
                  {activeReport.generatedAt && (
                    <span>
                      {' '}
                      · Generated{' '}
                      {new Date(activeReport.generatedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReportViewer((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 shrink-0"
            >
              {showReportViewer ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide report
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  View report
                </>
              )}
            </button>
          </div>
          {showReportViewer && (
            <article className="p-6 prose prose-emerald dark:prose-invert max-w-none max-h-[70vh] overflow-y-auto">
              <ReactMarkdown>{activeReport.reportContent}</ReactMarkdown>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
