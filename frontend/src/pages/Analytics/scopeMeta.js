export const SCOPE_META = {
  1: {
    title: 'Scope 1 — Direct emissions',
    subtitle: 'Fuels burned on-site, company vehicles, refrigerants, and other direct GHG sources.',
    color: 'emerald',
    ring: 'border-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    chart: '#10b981',
    tips: [
      'Review stationary combustion and fleet fuel data quality.',
      'Prioritise high-consumption sites for efficiency or fuel switching.',
      'Track refrigerant leaks — often material but infrequently reported.'
    ]
  },
  2: {
    title: 'Scope 2 — Energy indirect',
    subtitle: 'Purchased electricity, heat, steam, and cooling consumed by your organisation.',
    color: 'blue',
    ring: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-800 dark:text-blue-300',
    chart: '#3b82f6',
    tips: [
      'Use location-based and market-based factors where relevant.',
      'Identify sites with highest kWh intensity for solar or green tariffs.',
      'Align reporting period with utility billing cycles.'
    ]
  },
  3: {
    title: 'Scope 3 — Value chain',
    subtitle: 'Upstream and downstream impacts including travel, freight, purchased goods, and commuting.',
    color: 'red',
    ring: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-800 dark:text-red-300',
    chart: '#ef4444',
    tips: [
      'Focus on categories that dominate your Pareto hotspots.',
      'Use route-based distance tools for freight and travel where possible.',
      'Employee commuting (Cat. 7) is included when attendance is recorded.'
    ]
  }
};
