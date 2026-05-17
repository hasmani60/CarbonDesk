import { formatLargeNumber } from '../../../utils/analysisHelpers';

export default function ChartTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={
        isDark
          ? 'bg-slate-800/98 p-3 border border-slate-600 rounded-lg shadow-xl text-slate-100'
          : 'bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-gray-900'
      }
    >
      <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }}>
          {entry.name}: {formatLargeNumber(entry.value)} {entry.unit || 'CO₂e'}
        </p>
      ))}
    </div>
  );
}
