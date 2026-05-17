import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DollarSign, Plus } from 'lucide-react';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import { chartAxisProps } from '../../../utils/chartTheme';

export default function MACCSection({
  maccData,
  maccOpportunities,
  onAddClick,
  rt,
  isDark
}) {
  return (
    <section className="analytics-tab-section">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="analytics-section-title mb-0">
          <DollarSign className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Marginal abatement cost curve
        </h2>
        <button
          type="button"
          onClick={onAddClick}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add opportunity
        </button>
      </div>

      {!maccData || !maccOpportunities?.length ? (
        <div className="app-card p-10 text-center">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Add reduction opportunities to build your MACC.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="app-card p-5">
              <p className="text-sm text-gray-500 mb-1">Abatement potential</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatLargeNumber(maccData.summary.totalAbatementPotential)}
              </p>
            </div>
            <div className="app-card p-5">
              <p className="text-sm text-gray-500 mb-1">Total investment</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${formatLargeNumber(Math.abs(maccData.summary.totalCost))}
              </p>
            </div>
            <div className="app-card p-5">
              <p className="text-sm text-gray-500 mb-1">Avg $/tCO₂e</p>
              <p className="text-2xl font-bold">
                ${Math.abs(maccData.summary.avgCostPerTon).toFixed(0)}
              </p>
            </div>
            <div className="app-card p-5">
              <p className="text-sm text-gray-500 mb-1">Cost-effective</p>
              <p className="text-2xl font-bold text-blue-600">
                {maccData.summary.costEffectiveOpportunities} / {maccData.opportunities.length}
              </p>
            </div>
          </div>
          <div className="app-card p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maccData.opportunities} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                  <XAxis type="number" {...chartAxisProps(rt)} />
                  <YAxis type="category" dataKey="name" width={160} {...chartAxisProps(rt)} />
                  <Tooltip />
                  <Bar dataKey="costPerTon" fill="#10b981" />
                  <ReferenceLine x={0} stroke={rt.refLine} strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
