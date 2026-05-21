/** Transform waterfall steps for stacked Recharts bars */
export function toWaterfallBars(steps = []) {
  if (!steps.length) return [];
  const out = [];
  let running = 0;

  steps.forEach((step, i) => {
    if (step.type === 'total') {
      if (i === 0) {
        running = step.value || 0;
        out.push({ ...step, base: 0, bar: running, fill: '#059669' });
      } else {
        out.push({ ...step, base: 0, bar: step.value || 0, fill: '#0f766e' });
      }
      return;
    }
    const delta = step.value || 0;
    const base = delta >= 0 ? running : running + delta;
    out.push({
      ...step,
      base,
      bar: Math.abs(delta),
      fill: delta >= 0 ? '#f87171' : '#60a5fa'
    });
    running += delta;
  });

  return out;
}

export function filterActivitiesByScope(activities, scopeNum) {
  return (activities || []).filter((a) => Number(a.scope) === scopeNum);
}
