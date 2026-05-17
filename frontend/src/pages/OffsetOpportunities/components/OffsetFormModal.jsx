import { createPortal } from 'react-dom';
import {
  OFFSET_TYPES,
  OFFSET_UNITS,
  APPLICABLE_SCOPES,
  currentReportingYear
} from '../../../utils/offsetConstants';

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500';

export const emptyOffsetForm = () => ({
  offset_name: '',
  offset_type: 'carbon_credit',
  certificate_number: '',
  issuing_authority: '',
  vintage_year: currentReportingYear(),
  expiry_date: '',
  reporting_year: currentReportingYear(),
  applicable_scopes: [1, 2, 3],
  total_quantity: '',
  unit: 'tco2e',
  notes: ''
});

export default function OffsetFormModal({
  open,
  editing,
  form,
  setForm,
  saving,
  onClose,
  onSubmit
}) {
  if (!open) return null;

  const toggleScope = (scope) => {
    const has = form.applicable_scopes.includes(scope);
    setForm({
      ...form,
      applicable_scopes: has
        ? form.applicable_scopes.filter((s) => s !== scope)
        : [...form.applicable_scopes, scope].sort()
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? 'Edit offset opportunity' : 'Add offset opportunity'}
          </h3>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Offset name *</label>
              <input
                required
                value={form.offset_name}
                onChange={(e) => setForm({ ...form, offset_name: e.target.value })}
                className={inputClass}
                placeholder="e.g. VCS carbon credits batch 2024"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Offset type *</label>
              <select
                value={form.offset_type}
                onChange={(e) => setForm({ ...form, offset_type: e.target.value })}
                className={inputClass}
              >
                {OFFSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Certificate number *</label>
              <input
                required
                value={form.certificate_number}
                onChange={(e) => setForm({ ...form, certificate_number: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Issuing authority</label>
              <input
                value={form.issuing_authority}
                onChange={(e) => setForm({ ...form, issuing_authority: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Vintage year</label>
              <input
                type="number"
                min="1990"
                max="2100"
                value={form.vintage_year}
                onChange={(e) => setForm({ ...form, vintage_year: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expiry date</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reporting year *</label>
              <input
                type="number"
                required
                min="1990"
                max="2100"
                value={form.reporting_year}
                onChange={(e) => setForm({ ...form, reporting_year: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Total quantity *</label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={form.total_quantity}
                onChange={(e) => setForm({ ...form, total_quantity: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Unit *</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className={inputClass}
              >
                {OFFSET_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Applicable scopes *</label>
              <div className="flex flex-wrap gap-2">
                {APPLICABLE_SCOPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleScope(s.value)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      form.applicable_scopes.includes(s.value)
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300'
                    ].join(' ')}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.applicable_scopes?.length}
              className="flex-1 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
