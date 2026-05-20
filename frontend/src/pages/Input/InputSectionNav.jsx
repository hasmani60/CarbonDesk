const SECTIONS = [
  { id: 'emissions', label: 'Emissions', description: 'Scope 1, 2 & 3 activity data' },
  { id: 'production', label: 'Production', description: 'Monthly output volumes' },
  { id: 'commute', label: 'Employee commuting', description: 'Scope 3 Category 7' }
];

export default function InputSectionNav({ activeSection, onSectionChange, showCommute }) {
  const tabs = showCommute ? SECTIONS : SECTIONS.filter((s) => s.id !== 'commute');

  return (
    <nav className="segmented-nav" aria-label="Input sections">
      {tabs.map((tab) => {
        const isActive = activeSection === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSectionChange(tab.id)}
            className={[
              'segmented-nav-item',
              isActive ? 'segmented-nav-item-active' : 'segmented-nav-item-inactive'
            ].join(' ')}
          >
            <span className="block font-medium">{tab.label}</span>
            <span className="block text-caption mt-0.5">{tab.description}</span>
          </button>
        );
      })}
    </nav>
  );
}
