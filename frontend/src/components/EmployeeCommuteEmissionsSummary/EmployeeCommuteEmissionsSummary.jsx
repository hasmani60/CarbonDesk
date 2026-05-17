import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Car, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { employeesAPI } from '../../services/api';
import { formatLargeNumber } from '../../utils/analysisHelpers';
import {
  COMMUTE_CHART_COLORS,
  currentMonthISO,
  formatCommuteMode
} from '../../utils/commuteModes';
import { useTheme } from '../../context/ThemeContext';
import { getChartTooltipProps } from '../../utils/chartTheme';

const EmployeeCommuteEmissionsSummary = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [summaryMonth, setSummaryMonth] = useState(currentMonthISO());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await employeesAPI.getEmissions(summaryMonth);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [summaryMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const barData = (summary?.by_employee || [])
    .filter((e) => e.total_co2e_kg > 0)
    .map((e) => ({ name: e.name, co2e: e.total_co2e_kg }));

  const pieData = (summary?.by_mode || []).map((m) => ({
    name: formatCommuteMode(m.transport_mode),
    value: m.total_co2e_kg
  }));

  const hasData =
    summary &&
    (summary.employee_count > 0 ||
      summary.working_days_recorded > 0 ||
      (summary.total_co2e_kg ?? 0) > 0);

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="analytics-section-title mb-0">
          <Car className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Employee Commuting (Scope 3 — Category 7)
        </h2>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">Month</span>
            <input
              type="month"
              value={summaryMonth}
              onChange={(e) => setSummaryMonth(e.target.value)}
              className="border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
            />
          </label>
          <button
            type="button"
            onClick={load}
            className="p-2 text-gray-500 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {summary?.missing_factors?.length > 0 && (
        <div className="mb-4 flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Missing emission factors</p>
            <p>
              No scope3_commute factors for:{' '}
              {summary.missing_factors.map(formatCommuteMode).join(', ')}. Refresh after the
              backend redeploys.
            </p>
          </div>
        </div>
      )}

      {summary?.missing_fuel_efficiency?.length > 0 && (
        <div className="mb-4 flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Fuel efficiency required</p>
            <p>
              Add km/L for: {summary.missing_fuel_efficiency.map((e) => e.name).join(', ')} in{' '}
              <Link to="/input?scope=3" className="underline font-medium">
                Input → Scope 3
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="app-card p-8 text-sm text-gray-500 text-center">
          Calculating commute emissions…
        </div>
      ) : !hasData ? (
        <div className="app-card p-8 text-sm text-gray-500 text-center">
          No commute data for this month. Add employees and mark attendance in{' '}
          <Link to="/input?scope=3" className="text-emerald-600 underline font-medium">
            Input → Scope 3
          </Link>
          .
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="app-card p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Active employees</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.employee_count}
              </p>
            </div>
            <div className="app-card p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Working days recorded</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.working_days_recorded}
              </p>
            </div>
            <div className="app-card p-4 border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Total CO₂e</p>
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                {summary.total_co2e_kg?.toFixed(2)} kg
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {(summary.total_co2e_tonnes ?? summary.total_co2e_kg / 1000).toFixed(4)} t
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-card p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                CO₂e per employee
              </h3>
              <div className="h-64">
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <Tooltip
                        {...getChartTooltipProps(isDark)}
                        formatter={(v) => [`${Number(v).toFixed(2)} kg`, 'CO₂e']}
                      />
                      <Bar dataKey="co2e" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-16">
                    No per-employee emissions yet (check attendance and factors).
                  </p>
                )}
              </div>
            </div>

            <div className="app-card p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                By transport mode
              </h3>
              <div className="h-64">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={COMMUTE_CHART_COLORS[i % COMMUTE_CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        {...getChartTooltipProps(isDark)}
                        formatter={(v) => formatLargeNumber(v)}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-16">
                    No emissions by mode for this month.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default EmployeeCommuteEmissionsSummary;
