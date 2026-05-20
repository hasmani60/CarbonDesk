import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/analytics', label: 'Overview', description: 'Organisation-wide summary & trends', end: true },
  { to: '/analytics/scope-1', label: 'Scope 1', description: 'Direct emissions from owned sources', scope: 1 },
  { to: '/analytics/scope-2', label: 'Scope 2', description: 'Indirect energy & purchased power', scope: 2 },
  { to: '/analytics/scope-3', label: 'Scope 3', description: 'Value chain & other indirect emissions', scope: 3 }
];

const scopeIndicator = {
  1: 'bg-emerald-600',
  2: 'bg-sky-600',
  3: 'bg-amber-600'
};

export default function AnalyticsTabNav() {
  return (
    <nav className="segmented-nav" aria-label="Analytics sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            ['segmented-nav-item', isActive ? 'segmented-nav-item-active' : 'segmented-nav-item-inactive'].join(
              ' '
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className="flex items-center gap-2 font-medium">
                {tab.scope != null && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${scopeIndicator[tab.scope]}`}
                    aria-hidden
                  />
                )}
                {tab.label}
              </span>
              <span className="block text-caption mt-0.5">{tab.description}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
