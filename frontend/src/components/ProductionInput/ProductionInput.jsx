import { useState, useEffect, useCallback } from 'react';
import { Factory, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { productionAPI } from '../../services/api';
import {
  PRODUCTION_UNITS,
  formatProductionUnit,
  currentPeriodMonth,
  toMonthInputValue,
  fromMonthInputValue
} from '../../utils/productionUnits';
import toast from 'react-hot-toast';

const emptyForm = (periodMonth) => ({
  product_name: '',
  product_code: '',
  quantity: '',
  unit: 'units',
  period_month: periodMonth,
  notes: ''
});

export default function ProductionInput() {
  const { user } = useAuth();
  const role = user?.role || 'viewer';
  const canWrite = ['admin', 'analyst', 'contributor'].includes(role);
  const canDelete = ['admin', 'analyst'].includes(role);

  const [periodMonth, setPeriodMonth] = useState(currentPeriodMonth());
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm(currentPeriodMonth()));
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, summaryRes] = await Promise.all([
        productionAPI.list({ month: periodMonth }),
        productionAPI.getSummary({ month: periodMonth })
      ]);
      const list = Array.isArray(listRes) ? listRes : listRes?.data ?? [];
      setRecords(list);
      setSummary(summaryRes?.data ?? summaryRes ?? null);
    } catch (err) {
      toast.error(err.message || 'Failed to load production data');
      setRecords([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [periodMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm(periodMonth));
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      product_name: row.product_name || '',
      product_code: row.product_code || '',
      quantity: String(row.quantity ?? ''),
      unit: row.unit || 'units',
      period_month: row.period_month || periodMonth,
      notes: row.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canWrite) return;

    const payload = {
      product_name: form.product_name.trim(),
      product_code: form.product_code.trim(),
      quantity: parseFloat(form.quantity),
      unit: form.unit,
      period_month: fromMonthInputValue(form.period_month),
      notes: form.notes.trim()
    };

    if (!payload.product_name) {
      toast.error('Product name is required');
      return;
    }
    if (Number.isNaN(payload.quantity) || payload.quantity < 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await productionAPI.update(editing.id || editing._id, payload);
        toast.success('Production record updated');
      } else {
        await productionAPI.create(payload);
        toast.success('Production record added');
      }
      setModalOpen(false);
      if (payload.period_month !== periodMonth) {
        setPeriodMonth(payload.period_month);
      } else {
        await loadData();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete production entry for "${row.product_name}"?`)) return;
    try {
      await productionAPI.remove(row.id || row._id);
      toast.success('Deleted');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const formatQty = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <div className="app-card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-violet-50/60 dark:bg-violet-950/25">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Factory className="w-8 h-8 text-violet-600 dark:text-violet-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Production output</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Record what your organisation produced each month — used for emissions intensity
                (e.g. CO₂e per unit).
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4 text-violet-600" />
            <span className="sr-only">Reporting month</span>
            <input
              type="month"
              value={toMonthInputValue(periodMonth)}
              onChange={(e) => setPeriodMonth(fromMonthInputValue(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            />
          </label>
        </div>
      </div>

      <div className="p-4">
        {summary?.by_product?.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {summary.by_product.map((row) => (
              <span
                key={`${row.product_name}-${row.unit}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
              >
                {row.product_name}: {formatQty(row.total_quantity)} {formatProductionUnit(row.unit)}
              </span>
            ))}
          </div>
        )}

        {canWrite && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700"
            >
              <Plus className="w-4 h-4" />
              Add production
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading production records…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No production recorded for {periodMonth}.{' '}
            {canWrite ? 'Click “Add production” to log output.' : ''}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-slate-700">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Code / SKU</th>
                  <th className="py-2 pr-3">Quantity</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3">Month</th>
                  <th className="py-2 pr-3">Notes</th>
                  {canWrite && <th className="py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id || row._id} className="border-b dark:border-slate-800">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                      {row.product_name}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">
                      {row.product_code || '—'}
                    </td>
                    <td className="py-2 pr-3">{formatQty(row.quantity)}</td>
                    <td className="py-2 pr-3">{formatProductionUnit(row.unit)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.period_month}</td>
                    <td className="py-2 pr-3 text-gray-500 max-w-[12rem] truncate">
                      {row.notes || '—'}
                    </td>
                    {canWrite && (
                      <td className="py-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="p-1 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-slate-600">
            <div className="px-6 py-4 border-b dark:border-slate-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Edit production' : 'Add production'}
              </h4>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product name *
                </label>
                <input
                  type="text"
                  required
                  value={form.product_name}
                  onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                  placeholder="e.g. Finished steel coils"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product code / SKU
                </label>
                <input
                  type="text"
                  value={form.product_code}
                  onChange={(e) => setForm({ ...form, product_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit *
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                  >
                    {PRODUCTION_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reporting month *
                </label>
                <input
                  type="month"
                  required
                  value={toMonthInputValue(form.period_month)}
                  onChange={(e) =>
                    setForm({ ...form, period_month: fromMonthInputValue(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg dark:border-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
