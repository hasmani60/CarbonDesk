const SECTIONS = [
  { id: 'emissions', label: 'Emissions', description: 'Scope 1, 2 & 3 activity data' },
  { id: 'production', label: 'Production', description: 'Monthly output volumes' },
  { id: 'commute', label: 'Employee commuting', description: 'Scope 3 Category 7' }
];

export default function InputSectionNav({ activeSection, onSectionChange, showCommute }) {
  const tabs = showCommute ? SECTIONS : SECTIONS.filter((s) => s.id !== 'commute');

  return (
    <nav
      className="flex flex-col sm:flex-row sm:flex-wrap gap-2 p-1.5 rounded-xl bg-gray-100/80 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/80"
      aria-label="Input sections"
    >
      {tabs.map((tab) => {
        const isActive = activeSection === tab.id;
        const accent =
          tab.id === 'production'
            ? 'bg-white dark:bg-slate-900 shadow-sm text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/40'
            : tab.id === 'commute'
              ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40'
              : 'bg-white dark:bg-slate-900 shadow-sm text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40';

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSectionChange(tab.id)}
            className={[
              'flex-1 min-w-[140px] text-left px-4 py-3 rounded-lg transition-colors',
              isActive
                ? accent
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-slate-700/50'
            ].join(' ')}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            <span className="block text-xs mt-0.5 opacity-80 font-normal">{tab.description}</span>
          </button>
        );
      })}
    </nav>
  );
}
