import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/analytics', label: 'Overview', end: true },
  { to: '/analytics/scope-1', label: 'Scope 1', scope: 1 },
  { to: '/analytics/scope-2', label: 'Scope 2', scope: 2 },
  { to: '/analytics/scope-3', label: 'Scope 3', scope: 3 }
];

const scopeAccent = {
  1: 'data-[active=true]:border-emerald-600 data-[active=true]:text-emerald-700 dark:data-[active=true]:text-emerald-400',
  2: 'data-[active=true]:border-blue-600 data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-400',
  3: 'data-[active=true]:border-red-600 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-400'
};

export default function AnalyticsTabNav() {
  return (
    <nav
      className="flex flex-wrap gap-2 p-1.5 rounded-xl bg-gray-100/80 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/80"
      aria-label="Analytics sections"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            [
              'px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border-b-2 border-transparent',
              'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50',
              isActive
                ? tab.scope
                  ? `bg-white dark:bg-slate-900 shadow-sm ${scopeAccent[tab.scope]}`
                  : 'bg-white dark:bg-slate-900 shadow-sm border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : ''
            ].join(' ')
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
