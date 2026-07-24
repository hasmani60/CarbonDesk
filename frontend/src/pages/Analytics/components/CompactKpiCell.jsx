import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import ExpandableAnalyticsPanel from './ExpandableAnalyticsPanel';

function MiniSparkline({ data, color = '#059669', expanded = false }) {
  if (!data?.length || data.length < 2) return null;

  if (expanded) {
    return (
      <div className="mt-4 h-[280px] w-full sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => formatLargeNumber(v)}
            />
            <Tooltip
              formatter={(v) => [`${formatLargeNumber(v)} CO₂e`, 'Emissions']}
              labelFormatter={(l) => l || ''}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              fill={color}
              fillOpacity={0.22}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={{ r: 3, strokeWidth: 0, fill: color }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="relative mt-3 w-full min-h-[72px] flex-1">
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 2, left: 2, bottom: 2 }}>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              fill={color}
              fillOpacity={0.2}
              strokeWidth={2}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KpiBody({
  label,
  value,
  foot,
  sparkData,
  sparkColor,
  to,
  compare,
  expanded = false,
  showDetailsLink = false
}) {
  return (
    <>
      <p className={`analytics-cell-label ${expanded || showDetailsLink ? 'pr-14' : ''}`}>{label}</p>
      <p className={`analytics-cell-value ${expanded ? 'text-3xl sm:text-4xl' : ''}`}>
        {formatLargeNumber(value)}
      </p>
      <MiniSparkline data={sparkData} color={sparkColor} expanded={expanded} />
      <div className={`analytics-cell-foot pt-2 ${expanded ? '' : 'mt-auto'}`}>
        {foot && <span>{foot}</span>}
        {compare?.length > 0 &&
          compare.map((c) => (
            <span key={c.label} className={c.up ? 'analytics-delta-up' : 'analytics-delta-down'}>
              {c.label}: {c.text}
            </span>
          ))}
        {showDetailsLink && to && (
          <Link
            to={to}
            className="text-emerald-700 dark:text-emerald-400 font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View details →
          </Link>
        )}
      </div>
    </>
  );
}

export default function CompactKpiCell({
  label,
  value,
  foot,
  sparkData,
  sparkColor,
  to,
  compare,
  className = '',
  expandable = false
}) {
  const bodyProps = { label, value, foot, sparkData, sparkColor, to, compare };

  if (expandable) {
    return (
      <ExpandableAnalyticsPanel
        title={label}
        className={`analytics-report-cell analytics-report-cell--kpi ${className}`}
        content={({ expanded }) => (
          <KpiBody {...bodyProps} expanded={expanded} showDetailsLink={Boolean(to)} />
        )}
      />
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        className={`analytics-report-cell analytics-report-cell--link analytics-report-cell--kpi ${className}`}
      >
        <KpiBody {...bodyProps} />
      </Link>
    );
  }

  return (
    <div className={`analytics-report-cell analytics-report-cell--kpi ${className}`}>
      <KpiBody {...bodyProps} />
    </div>
  );
}

