import { useState, useEffect, useCallback } from 'react';
import { Truck, RefreshCw } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { analyticsAPI } from '../../services/api';
import { formatLargeNumber } from '../../utils/analysisHelpers';

const CHART_COLORS = ['#059669', '#2563eb'];

const Scope3TransportSummary = ({ filterParams = {} }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await analyticsAPI.getScope3TransportBreakdown(filterParams);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filterParams)]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="app-card p-6 text-sm text-gray-500 text-center">
        Loading material transport breakdown…
      </div>
    );
  }

  if (!data?.transport_subtotal?.count) {
    return null;
  }

  const rows = [
    data.category_4_upstream,
    data.category_9_downstream,
    data.transport_subtotal
  ].filter(Boolean);

  const chartData = data.chart_data || [];

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="analytics-section-title mb-0">
          <Truck className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Scope 3 — Material Transport
        </h2>
        <button
          type="button"
          onClick={load}
          className="p-2 text-gray-500 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="app-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/80">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  GHG category
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  CO₂e
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Entries
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className={
                    i === rows.length - 1
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 font-semibold'
                      : ''
                  }
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{row.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatLargeNumber(row.total_co2e)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {row.count ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {chartData.length > 0 && (
          <div className="app-card p-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Transport CO₂e by direction
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) =>
                      `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatLargeNumber(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Scope3TransportSummary;
