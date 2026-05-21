/**
 * Metric tile for dashboards and overview strips.
 */
export default function KpiCard({ label, value, hint, icon: Icon, scope, className = '' }) {
  const scopeClass =
    scope === 1 ? 'scope-pill scope-pill-1' : scope === 2 ? 'scope-pill scope-pill-2' : scope === 3 ? 'scope-pill scope-pill-3' : '';

  return (
    <div className={`kpi-card ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
          {hint && <p className="kpi-hint">{hint}</p>}
        </div>
        {scope != null ? (
          <span className={scopeClass} aria-hidden>
            {scope}
          </span>
        ) : Icon ? (
          <span className="kpi-icon-wrap">
            <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
