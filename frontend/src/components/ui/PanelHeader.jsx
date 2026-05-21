/**
 * Section header inside cards and panels.
 */
export default function PanelHeader({ title, description, action, className = '' }) {
  return (
    <div className={`panel-header ${className}`}>
      <div className="min-w-0">
        <h2 className="panel-title">{title}</h2>
        {description && <p className="panel-description">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
