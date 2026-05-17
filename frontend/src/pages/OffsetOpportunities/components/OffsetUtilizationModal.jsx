import { createPortal } from 'react-dom';
import { formatOffsetUnit } from '../../../utils/offsetConstants';

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500';

export default function OffsetUtilizationModal({
  open,
  reportingYear,
  setReportingYear,
  offsets,
  selectedOffsetId,
  setSelectedOffsetId,
  quantity,
  setQuantity,
  notes,
  setNotes,
  emissions,
  saving,
  onClose,
  onSubmit
}) {
  if (!open) return null;

  const selected = offsets.find((o) => o.id === selectedOffsetId);
  const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-600 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Apply offset utilization</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Apply certificates against calculated emissions for a reporting year.
          </p>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Reporting year *</label>
            <input
              type="number"
              required
              min="1990"
              max="2100"
              value={reportingYear}
              onChange={(e) => setReportingYear(parseInt(e.target.value, 10))}
              className={inputClass}
            />
          </div>

          {emissions && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Gross emissions</span>
                <span className="font-medium tabular-nums">{fmt(emissions.gross_emissions)} tCO₂e</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Offsets applied</span>
                <span className="font-medium tabular-nums">{fmt(emissions.total_offsets_applied)} tCO₂e</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-slate-600 pt-2">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Net emissions</span>
                <span className="font-semibold text-violet-600 tabular-nums">
                  {fmt(emissions.net_emissions)} tCO₂e
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Offset asset *</label>
            <select
              required
              value={selectedOffsetId}
              onChange={(e) => setSelectedOffsetId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select offset…</option>
              {offsets.map((o) => (
                <option key={o.id} value={o.id} disabled={o.status === 'expired' || o.status === 'utilized'}>
                  {o.offset_name} — {fmt(o.available_quantity)} {formatOffsetUnit(o.unit)} available
                  {o.status === 'expired' ? ' (expired)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <p className="text-xs text-gray-500">
              Certificate: {selected.certificate_number} · Expires{' '}
              {selected.expiry_date
                ? new Date(selected.expiry_date).toLocaleDateString()
                : '—'}
              {selected.unit !== 'tco2e' && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  Only tCO₂e offsets reduce net emissions in calculations.
                </span>
              )}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Quantity to apply *</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedOffsetId}
              className="flex-1 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Applying…' : 'Apply offset'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
