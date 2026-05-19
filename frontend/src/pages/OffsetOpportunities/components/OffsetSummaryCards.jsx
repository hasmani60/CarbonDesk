import { Leaf, Package, TrendingDown, BarChart3 } from 'lucide-react';

function Card({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="app-card p-5 flex flex-col gap-2">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );
}

export default function OffsetSummaryCards({ summary, reportingYear }) {
  const fmt = (n) =>
    Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card
        icon={Leaf}
        label="Total offsets"
        value={summary?.total_offsets ?? '—'}
        sub="Registered instruments"
        accent="bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300"
      />
      <Card
        icon={Package}
        label="Available quantity"
        value={fmt(summary?.available_quantity ?? 0)}
        sub="Across all units"
        accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300"
      />
      <Card
        icon={BarChart3}
        label="Utilized quantity"
        value={fmt(summary?.utilized_quantity ?? 0)}
        sub="Applied to inventory"
        accent="bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300"
      />
      <Card
        icon={TrendingDown}
        label="Net emissions reduced"
        value={`${fmt(summary?.net_emissions_reduced ?? summary?.total_offsets_applied ?? 0)} tCO₂e`}
        sub={`Reporting year ${reportingYear}`}
        accent="bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300"
      />
    </div>
  );
}
