import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, Lightbulb } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAnalytics } from '../AnalyticsContext';
import { analyticsAPI } from '../../../services/api';
import { calculatePareto, formatLargeNumber, generateParetoInsights } from '../../../utils/analysisHelpers';
import toast from 'react-hot-toast';
import { getRechartsTheme, chartAxisProps } from '../../../utils/chartTheme';
import { SCOPE_META } from '../scopeMeta';
import ScopeMigrationSection from '../components/ScopeMigrationSection';
import ParetoSection from '../components/ParetoSection';
import Scope3TransportSummary from '../../../components/Scope3TransportSummary/Scope3TransportSummary';
import EmployeeCommuteEmissionsSummary from '../../../components/EmployeeCommuteEmissionsSummary/EmployeeCommuteEmissionsSummary';

export default function AnalyticsScopeTab({ scope }) {
  const meta = SCOPE_META[scope];
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rt = useMemo(() => getRechartsTheme(isDark), [isDark]);

  const {
    overviewStats,
    scopeMigrationData,
    migrationInsights,
    paretoGrouped,
    getParetoForScope,
    getScopeShare,
  } = useAnalytics();

  const [scopePareto, setScopePareto] = useState([]);
  const [scopeInsights, setScopeInsights] = useState(null);
  const [localParent, setLocalParent] = useState(null);

  useEffect(() => {
    const data = getParetoForScope(scope);
    setScopePareto(data);
    setScopeInsights(
      data.length && data[0].percentage !== undefined ? generateParetoInsights(data, 80) : null
    );
    setLocalParent(null);
  }, [scope, paretoGrouped, getParetoForScope]);

  const onDrillDown = async (item) => {
    if (!item.canDrill) return;
    try {
      const result = await analyticsAPI.getParetoDrilldown(item.name);
      const payload = result?.data != null ? result.data : result;
      let rows = payload?.paretoData ?? result?.paretoData ?? result ?? [];
      if (!Array.isArray(rows)) rows = [];
      const grouped = rows.map((row) => ({
        name: row.name ?? row._id ?? 'Unknown',
        value: Number(row.value ?? row.total_co2e ?? row.emissions ?? 0) || 0,
        count: row.count ?? 0,
        canDrill: false
      }));
      const drill = calculatePareto(grouped);
      setScopePareto(drill);
      setScopeInsights(
        drill.length && drill[0].percentage !== undefined ? generateParetoInsights(drill, 80) : null
      );
      setLocalParent(item.name);
      toast.success(`Showing breakdown for ${item.name}`);
    } catch {
      toast.error('Failed to drill down');
    }
  };

  const onResetDrill = () => {
    setLocalParent(null);
    const data = getParetoForScope(scope);
    setScopePareto(data);
    setScopeInsights(
      data.length && data[0].percentage !== undefined ? generateParetoInsights(data, 80) : null
    );
  };

  const scopeKey = `scope${scope}`;
  const scopeVal = overviewStats?.[scopeKey] ?? 0;
  const scopeCount = overviewStats?.[`scope${scope}Count`] ?? 0;
  const share = getScopeShare(scope);

  const monthlyScope = useMemo(
    () =>
      scopeMigrationData.map((row) => ({
        period: row.period,
        emissions: row[scopeKey] || 0
      })),
    [scopeMigrationData, scopeKey]
  );

  return (
    <div className="analytics-tab-panel">
      <section className={`app-card p-6 border-l-4 ${meta.ring}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${meta.text}`}>Scope {scope}</p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{meta.title}</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">{meta.subtitle}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className={`rounded-lg p-4 ${meta.bg}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total CO₂e</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatLargeNumber(scopeVal)}
            </p>
          </div>
          <div className={`rounded-lg p-4 ${meta.bg}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">Share of organisation</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{share.toFixed(1)}%</p>
          </div>
          <div className={`rounded-lg p-4 ${meta.bg}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">Data points</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{scopeCount}</p>
          </div>
        </div>
      </section>

      {scope === 3 && (
        <>
          {(overviewStats?.scope3_commute_co2e > 0 || overviewStats?.scope3_activity_co2e > 0) && (
            <section className="analytics-tab-section grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="app-card p-5 border-l-4 border-red-800/60">
                <p className="text-xs font-medium text-gray-500 uppercase">Activity emissions</p>
                <p className="text-xl font-bold mt-1">
                  {formatLargeNumber(overviewStats.scope3_activity_co2e ?? 0)}
                </p>
              </div>
              <div className="app-card p-5 border-l-4 border-emerald-600">
                <p className="text-xs font-medium text-gray-500 uppercase">Employee commuting</p>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                  {formatLargeNumber(overviewStats.scope3_commute_co2e ?? 0)}
                </p>
              </div>
            </section>
          )}
          <EmployeeCommuteEmissionsSummary embedded />
          <Scope3TransportSummary />
        </>
      )}

      <ScopeMigrationSection
        scopeMigrationData={scopeMigrationData}
        migrationInsights={migrationInsights}
        rt={rt}
        isDark={isDark}
        highlightScope={scope}
      />

      {monthlyScope.length > 0 && (
        <section className="analytics-tab-section">
          <h2 className="analytics-section-title">
            <Target className="w-6 h-6 shrink-0 text-emerald-600" />
            Monthly emissions (Scope {scope})
          </h2>
          <div className="app-card p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyScope}>
                  <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                  <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
                  <YAxis {...chartAxisProps(rt)} />
                  <Tooltip />
                  <Bar dataKey="emissions" fill={meta.chart} name="CO₂e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      <ParetoSection
        title={`Scope ${scope} hotspots by category`}
        paretoData={scopePareto}
        paretoInsights={scopeInsights}
        selectedParent={localParent}
        onDrillDown={onDrillDown}
        onResetDrillDown={onResetDrill}
        rt={rt}
        isDark={isDark}
      />

      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">
          <Lightbulb className="w-6 h-6 shrink-0 text-amber-500" />
          Analysis tips
        </h2>
        <ul className="app-card p-6 space-y-3 list-disc list-inside text-gray-700 dark:text-gray-300 text-sm">
          {meta.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
