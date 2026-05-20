export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}) {
  return (
    <div
      className={`app-card flex flex-col items-center justify-center text-center p-10 sm:p-12 border-dashed ${className}`}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-800/80 ring-1 ring-gray-200/80 dark:ring-slate-700/80">
          <Icon className="h-7 w-7 text-gray-400 dark:text-slate-500" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
