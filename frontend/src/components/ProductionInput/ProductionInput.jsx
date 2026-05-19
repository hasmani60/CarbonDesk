import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Factory, Plus, Pencil, Trash2, Calendar, Package } from 'lucide-react';
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

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500';

const emptyForm = (periodMonth) => ({
  product_name: '',
  product_code: '',
  quantity: '',
  unit: 'units',
  period_month: periodMonth,
  notes: ''
});

function ProductionFormModal({ open, editing, form, setForm, saving, canWrite, onClose, onSubmit }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="production-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-600 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h4 id="production-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? 'Edit production record' : 'Add production record'}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Log output for one product. Use the list view to see all entries for the month.
          </p>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Product name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              placeholder="e.g. Finished steel coils"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Product code / SKU
            </label>
            <input
              type="text"
              value={form.product_code}
              onChange={(e) => setForm({ ...form, product_code: e.target.value })}
              placeholder="Optional"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className={inputClass}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Reporting month <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              required
              value={toMonthInputValue(form.period_month)}
              onChange={(e) =>
                setForm({ ...form, period_month: fromMonthInputValue(e.target.value) })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notes
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional comments"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !canWrite}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save record'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

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

  const monthLabel = (() => {
    const [y, m] = periodMonth.split('-').map(Number);
    if (!y || !m) return periodMonth;
    return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  })();

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/80">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
              <Factory className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Reporting period</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{monthLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Calendar className="h-4 w-4 text-violet-600 shrink-0" />
              <input
                type="month"
                value={toMonthInputValue(periodMonth)}
                onChange={(e) => setPeriodMonth(fromMonthInputValue(e.target.value))}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
              />
            </label>
            {canWrite && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Add production
              </button>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {summary?.by_product?.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {summary.by_product.map((row) => (
                <span
                  key={`${row.product_name}-${row.unit}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
                >
                  {row.product_name}: {formatQty(row.total_quantity)}{' '}
                  {formatProductionUnit(row.unit)}
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-500 py-12 text-center">Loading production records…</p>
          ) : records.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-800/30">
              <Package className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No production for {monthLabel}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                Add what your organisation produced this month to track emissions intensity (CO₂e per
                unit).
              </p>
              {canWrite && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  <Plus className="h-4 w-4" />
                  Add first record
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/80">
                  <tr className="text-left text-gray-600 dark:text-gray-400">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Code / SKU</th>
                    <th className="px-4 py-3 font-medium text-right">Quantity</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Notes</th>
                    {canWrite && <th className="px-4 py-3 font-medium w-24">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {records.map((row) => (
                    <tr key={row.id || row._id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {row.product_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {row.product_code || '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatQty(row.quantity)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {formatProductionUnit(row.unit)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-[10rem] truncate">
                        {row.notes || '—'}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="p-2 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ProductionFormModal
        open={modalOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        canWrite={canWrite}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      />
    </>
  );
}
