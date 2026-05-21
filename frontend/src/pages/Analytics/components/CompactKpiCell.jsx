import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { formatLargeNumber } from '../../../utils/analysisHelpers';

function MiniSparkline({ data, color = '#059669' }) {
  if (!data?.length || data.length < 2) return null;
  return (
    <div className="h-10 w-full mt-2 -mx-0.5">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CompactKpiCell({
  label,
  value,
  foot,
  sparkData,
  sparkColor,
  to,
  compare
}) {
  const inner = (
    <>
      <p className="analytics-cell-label">{label}</p>
      <p className="analytics-cell-value">{formatLargeNumber(value)}</p>
      <MiniSparkline data={sparkData} color={sparkColor} />
      <div className="analytics-cell-foot mt-auto pt-2">
        {foot && <span>{foot}</span>}
        {compare?.length > 0 &&
          compare.map((c) => (
            <span key={c.label} className={c.up ? 'analytics-delta-up' : 'analytics-delta-down'}>
              {c.label}: {c.text}
            </span>
          ))}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="analytics-report-cell analytics-report-cell--link">
        {inner}
      </Link>
    );
  }

  return <div className="analytics-report-cell">{inner}</div>;
}
