import { formatLargeNumber } from '../../../utils/analysisHelpers';

export default function CompactParetoTable({ data, onDrillDown, selectedParent, onResetDrillDown }) {
  if (!data?.length) {
    return <p className="analytics-empty">No category data yet.</p>;
  }

  const rows = data.slice(0, 8);

  return (
    <div className="min-h-0 flex flex-col h-full">
      {selectedParent && (
        <div className="flex items-center gap-1 text-[10px] mb-2 text-emerald-600 dark:text-emerald-400">
          <button type="button" onClick={onResetDrillDown} className="font-semibold hover:underline">
            All
          </button>
          <span className="text-zinc-400">›</span>
          <span className="truncate text-zinc-700 dark:text-zinc-300">{selectedParent}</span>
        </div>
      )}
      <div className="overflow-auto flex-1">
        <table className="analytics-compact-table w-full table-fixed">
          <colgroup>
            <col className="w-[58%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr>
              <th>Source</th>
              <th className="text-right">CO₂e</th>
              <th className="text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => (
              <tr key={`${item.name}-${i}`}>
                <td className="truncate font-medium pr-2" title={item.name}>
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle shrink-0"
                    style={{ backgroundColor: `hsl(${(i * 47) % 360}, 55%, 42%)` }}
                  />
                  {item.canDrill && !selectedParent ? (
                    <button
                      type="button"
                      className="text-left hover:text-emerald-600 dark:hover:text-emerald-400 truncate max-w-[calc(100%-1rem)] align-middle"
                      onClick={() => onDrillDown(item)}
                    >
                      {item.name}
                    </button>
                  ) : (
                    item.name
                  )}
                </td>
                <td className="text-right tabular-nums whitespace-nowrap">{formatLargeNumber(item.value)}</td>
                <td className="text-right tabular-nums text-zinc-500 whitespace-nowrap">
                  {item.percentage != null ? `${item.percentage.toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
