import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Scale,
  ArrowRightLeft,
  Eye,
  Pencil,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/PageHeader/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { offsetsAPI } from '../../services/api';
import OffsetSummaryCards from './components/OffsetSummaryCards';
import OffsetFormModal, { emptyOffsetForm } from './components/OffsetFormModal';
import OffsetUtilizationModal from './components/OffsetUtilizationModal';
import {
  formatOffsetType,
  formatOffsetUnit,
  formatOffsetStatus,
  statusBadgeClass,
  currentReportingYear,
  OFFSET_TYPES,
  OFFSET_STATUSES
} from '../../utils/offsetConstants';

export default function OffsetOpportunitiesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || 'viewer';
  const canWrite = ['admin', 'analyst'].includes(role);
  const canUtilize = ['admin', 'analyst', 'contributor'].includes(role);

  const [reportingYear, setReportingYear] = useState(currentReportingYear());
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [utilOpen, setUtilOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyOffsetForm());
  const [saving, setSaving] = useState(false);

  const [utilOffsetId, setUtilOffsetId] = useState('');
  const [utilQty, setUtilQty] = useState('');
  const [utilNotes, setUtilNotes] = useState('');
  const [utilEmissions, setUtilEmissions] = useState(null);
  const [utilSaving, setUtilSaving] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const data = await offsetsAPI.getSummary({ reporting_year: reportingYear });
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [reportingYear]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await offsetsAPI.list({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        offset_type: typeFilter || undefined,
        reporting_year: reportingYear,
        sort,
        order
      });
      setItems(res?.items || []);
      setPagination(res?.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      toast.error(err.message || 'Failed to load offsets');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, reportingYear, sort, order]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!utilOpen) return;
    offsetsAPI
      .getNetEmissions({ reporting_year: reportingYear })
      .then(setUtilEmissions)
      .catch(() => setUtilEmissions(null));
  }, [utilOpen, reportingYear]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyOffsetForm());
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      offset_name: row.offset_name || '',
      offset_type: row.offset_type || 'carbon_credit',
      certificate_number: row.certificate_number || '',
      issuing_authority: row.issuing_authority || '',
      vintage_year: row.vintage_year || currentReportingYear(),
      expiry_date: row.expiry_date ? row.expiry_date.slice(0, 10) : '',
      reporting_year: row.reporting_year || currentReportingYear(),
      applicable_scopes: row.applicable_scopes || [1, 2, 3],
      total_quantity: String(row.total_quantity ?? ''),
      unit: row.unit || 'tco2e',
      notes: row.notes || ''
    });
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const payload = {
      ...form,
      vintage_year: form.vintage_year ? parseInt(form.vintage_year, 10) : undefined,
      reporting_year: parseInt(form.reporting_year, 10),
      total_quantity: parseFloat(form.total_quantity),
      expiry_date: form.expiry_date || undefined
    };
    setSaving(true);
    try {
      if (editing) {
        await offsetsAPI.update(editing.id, payload);
        toast.success('Offset updated');
      } else {
        await offsetsAPI.create(payload);
        toast.success('Offset created');
      }
      setFormOpen(false);
      loadList();
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!canWrite) return;
    if (!window.confirm(`Delete "${row.offset_name}"?`)) return;
    try {
      await offsetsAPI.remove(row.id);
      toast.success('Deleted');
      loadList();
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const handleUtilize = async (e) => {
    e.preventDefault();
    if (!canUtilize) return;
    setUtilSaving(true);
    try {
      const res = await offsetsAPI.applyUtilization({
        offset_id: utilOffsetId,
        reporting_year: reportingYear,
        quantity_applied: parseFloat(utilQty),
        notes: utilNotes
      });
      toast.success('Offset applied');
      setUtilEmissions(res?.emissions || null);
      setUtilOpen(false);
      setUtilQty('');
      setUtilNotes('');
      loadList();
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to apply offset');
    } finally {
      setUtilSaving(false);
    }
  };

  const availableForUtil = items.filter(
    (o) => o.status !== 'expired' && o.status !== 'utilized' && (o.available_quantity || 0) > 0
  );

  const fmtQty = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Offset Opportunities"
        subtitle="Manage emission offset assets, track utilization, and calculate net emissions."
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Offset Opportunities' }
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            {canUtilize && (
              <button
                type="button"
                onClick={() => {
                  setUtilOpen(true);
                  setUtilOffsetId('');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Apply utilization
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                <Plus className="h-4 w-4" />
                Add offset
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600 dark:text-gray-400">Reporting year</label>
        <input
          type="number"
          min="1990"
          max="2100"
          value={reportingYear}
          onChange={(e) => {
            setReportingYear(parseInt(e.target.value, 10) || currentReportingYear());
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 w-28"
        />
      </div>

      <OffsetSummaryCards summary={summary} reportingYear={reportingYear} />

      {summary && (
        <div className="app-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Gross emissions ({reportingYear})</p>
            <p className="text-lg font-semibold tabular-nums">
              {fmtQty(summary.gross_emissions)} tCO₂e
            </p>
          </div>
          <div>
            <p className="text-gray-500">Total offsets applied</p>
            <p className="text-lg font-semibold tabular-nums text-amber-600">
              {fmtQty(summary.total_offsets_applied)} tCO₂e
            </p>
          </div>
          <div>
            <p className="text-gray-500">Net emissions</p>
            <p className="text-lg font-semibold tabular-nums text-violet-600">
              {fmtQty(summary.net_emissions)} tCO₂e
            </p>
          </div>
        </div>
      )}

      <div className="app-card overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search name, certificate…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-gray-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            >
              <option value="">All statuses</option>
              {OFFSET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            >
              <option value="">All types</option>
              {OFFSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={`${sort}-${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split('-');
                setSort(s);
                setOrder(o);
              }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            >
              <option value="createdAt-desc">Newest</option>
              <option value="createdAt-asc">Oldest</option>
              <option value="offset_name-asc">Name A–Z</option>
              <option value="expiry_date-asc">Expiry soonest</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Scale className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700 dark:text-gray-300">No offset opportunities yet</p>
            {canWrite && (
              <button
                type="button"
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg"
              >
                <Plus className="h-4 w-4" />
                Add first offset
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Offset name</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Certificate</th>
                    <th className="px-4 py-3 text-right font-medium">Available</th>
                    <th className="px-4 py-3 text-right font-medium">Utilized</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Expiry</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        <Link
                          to={`/offset-opportunities/${row.id}`}
                          className="text-violet-600 hover:underline"
                        >
                          {row.offset_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{formatOffsetType(row.offset_type)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500">{row.certificate_number}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtQty(row.available_quantity)} {formatOffsetUnit(row.unit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtQty(row.utilized_quantity)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500">
                        {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status)}`}
                        >
                          {formatOffsetStatus(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/offset-opportunities/${row.id}`)}
                            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="p-2 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-2 rounded-lg border disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-lg border disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <OffsetFormModal
        open={formOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSave}
      />

      <OffsetUtilizationModal
        open={utilOpen}
        reportingYear={reportingYear}
        setReportingYear={setReportingYear}
        offsets={availableForUtil.length ? availableForUtil : items}
        selectedOffsetId={utilOffsetId}
        setSelectedOffsetId={setUtilOffsetId}
        quantity={utilQty}
        setQuantity={setUtilQty}
        notes={utilNotes}
        setNotes={setUtilNotes}
        emissions={utilEmissions}
        saving={utilSaving}
        onClose={() => setUtilOpen(false)}
        onSubmit={handleUtilize}
      />
    </div>
  );
}
