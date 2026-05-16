import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  MessageSquare,
  Loader2,
  Send,
  Plus,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { analyticsChatsAPI } from '../../services/api';

const SUGGESTED_PROMPTS = [
  'What are our top emission sources this period?',
  'How is emissions split across Scope 1, 2, and 3?',
  'Summarise monthly trends and any seasonal pattern.',
  'What reduction opportunities stand out from the data?'
];

export default function AnalyticsChat() {
  const { user } = useAuth();
  const canChat = user?.role === 'admin';

  const [expanded, setExpanded] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [quota, setQuota] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportingMonth, setReportingMonth] = useState('');
  const [reportingYear, setReportingYear] = useState('');

  const messagesEndRef = useRef(null);

  const buildFilters = useCallback(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      reportingMonth: reportingMonth ? parseInt(reportingMonth, 10) : undefined,
      reportingYear: reportingYear ? parseInt(reportingYear, 10) : undefined
    }),
    [startDate, endDate, reportingMonth, reportingYear]
  );

  const hasPeriod =
    (startDate && endDate) ||
    (reportingYear && reportingMonth) ||
    reportingYear;

  const quotaExhausted = quota != null && !quota.canGenerate;

  useEffect(() => {
    if (!canChat) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [q, list, options] = await Promise.all([
          analyticsChatsAPI.getQuota(),
          analyticsChatsAPI.list({ limit: 15 }),
          analyticsChatsAPI.getFilterOptions()
        ]);
        if (cancelled) return;
        setQuota(q);
        setChats(Array.isArray(list) ? list : []);
        setFilterOptions(options);
        if (options?.dateRange?.minDate && !startDate) {
          setStartDate(new Date(options.dateRange.minDate).toISOString().slice(0, 10));
        }
        if (options?.dateRange?.maxDate && !endDate) {
          setEndDate(new Date(options.dateRange.maxDate).toISOString().slice(0, 10));
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not load analytics chat');
      } finally {
        if (!cancelled) {
          setLoadingChats(false);
          setLoadingOptions(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const loadChat = async (id) => {
    const data = await analyticsChatsAPI.getById(id);
    setActiveChat(data);
    if (data.filters?.startDate) setStartDate(data.filters.startDate.slice(0, 10));
    if (data.filters?.endDate) setEndDate(data.filters.endDate.slice(0, 10));
    if (data.filters?.reportingMonth) setReportingMonth(String(data.filters.reportingMonth));
    if (data.filters?.reportingYear) setReportingYear(String(data.filters.reportingYear));
  };

  const startNewChat = () => {
    setActiveChat(null);
    setInput('');
  };

  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending || quotaExhausted) return;
    if (!hasPeriod) {
      toast.error('Select a date range or reporting period first');
      return;
    }

    try {
      setSending(true);
      const filters = buildFilters();

      if (!activeChat?.id) {
        const created = await analyticsChatsAPI.create({ filters, message: content });
        setActiveChat(created);
        const q = await analyticsChatsAPI.getQuota();
        setQuota(q);
        setChats((prev) => [
          {
            id: created.id,
            title: created.title,
            messageCount: created.messages?.length || 0,
            lastMessage: content.slice(0, 120),
            updatedAt: created.updatedAt
          },
          ...prev.filter((c) => c.id !== created.id)
        ]);
      } else {
        const updated = await analyticsChatsAPI.sendMessage(activeChat.id, content);
        setActiveChat(updated);
        const q = await analyticsChatsAPI.getQuota();
        setQuota(q);
      }
      setInput('');
    } catch (err) {
      console.error(err);
      if (err.code === 'AI_REPORT_QUOTA_EXCEEDED' && err.quota) setQuota(err.quota);
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    try {
      await analyticsChatsAPI.delete(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChat?.id === id) setActiveChat(null);
      toast.success('Chat deleted');
    } catch (err) {
      toast.error(err.message || 'Could not delete chat');
    }
  };

  if (!canChat) return null;

  const quotaLabel =
    quota != null ? `${quota.used} / ${quota.limit} AI uses (reports + chat)` : null;

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex flex-wrap items-center justify-between gap-3 text-left"
      >
        <h2 className="analytics-section-title mb-0">
          <MessageSquare className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Analytics AI Chat
        </h2>
        <div className="flex items-center gap-3">
          {quotaLabel && (
            <span className="text-sm text-gray-600 dark:text-gray-400">{quotaLabel}</span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="app-card overflow-hidden flex flex-col lg:flex-row min-h-[420px]">
          <aside className="lg:w-56 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-slate-700 p-3 space-y-2">
            <button
              type="button"
              onClick={startNewChat}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
            {loadingChats ? (
              <p className="text-sm text-gray-500 flex items-center gap-2 p-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </p>
            ) : chats.length === 0 ? (
              <p className="text-sm text-gray-500 p-2">No chats yet</p>
            ) : (
              <ul className="space-y-1 max-h-64 lg:max-h-[340px] overflow-y-auto">
                {chats.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => loadChat(c.id)}
                      className={`w-full text-left px-2 py-2 rounded-lg text-sm truncate group flex items-center gap-1 ${
                        activeChat?.id === c.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="flex-1 truncate">{c.title}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDelete(c.id, e)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDelete(c.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Start
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={!!activeChat?.id}
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  End
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={!!activeChat?.id}
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Month
                </label>
                <select
                  value={reportingMonth}
                  onChange={(e) => setReportingMonth(e.target.value)}
                  disabled={!!activeChat?.id}
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-60"
                >
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleString('default', { month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={reportingYear}
                  onChange={(e) => setReportingYear(e.target.value)}
                  disabled={!!activeChat?.id}
                  placeholder="2026"
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            {quotaExhausted && (
              <div className="mx-4 mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>AI usage limit reached. Contact your platform administrator for more capacity.</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
              {!activeChat?.messages?.length ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ask questions about your emissions for the selected period. Each reply uses
                    your org AI quota (shared with report generation).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={sending || quotaExhausted || loadingOptions}
                        onClick={() => handleSend(p)}
                        className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeChat.messages
                  .filter((m) => m.role !== 'system')
                  .map((m, i) => (
                    <div
                      key={`${m.createdAt || i}-${m.role}`}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                          m.role === 'user'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 prose prose-sm dark:prose-invert max-w-none'
                        }`}
                      >
                        {m.role === 'assistant' ? (
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        ) : (
                          m.content
                        )}
                      </div>
                    </div>
                  ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about scopes, trends, hotspots…"
                disabled={sending || quotaExhausted}
                className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={sending || !input.trim() || quotaExhausted}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
