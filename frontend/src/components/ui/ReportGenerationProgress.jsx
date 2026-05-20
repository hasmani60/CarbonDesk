import { useEffect, useState } from 'react';
import { Check, Loader2, Circle } from 'lucide-react';

const DEFAULT_STEPS = [
  { id: 'collect', label: 'Collecting data', description: 'Gathering emissions and filters for your organisation' },
  { id: 'process', label: 'Processing emissions', description: 'Aggregating scopes, categories, and time periods' },
  { id: 'ai', label: 'Running AI analysis', description: 'Applying GHG Protocol–aligned insights' },
  { id: 'generate', label: 'Generating report', description: 'Drafting narrative sections and recommendations' },
  { id: 'finalize', label: 'Finalizing output', description: 'Preparing preview, charts, and export options' }
];

export default function ReportGenerationProgress({
  active = true,
  steps = DEFAULT_STEPS,
  title = 'Generating your report',
  subtitle = 'This usually takes one to three minutes. You can keep this tab open.'
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return undefined;
    }
    setStepIndex(0);
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2800);
    return () => clearInterval(interval);
  }, [active, steps.length]);

  const progress = Math.min(100, ((stepIndex + 1) / steps.length) * 100);

  return (
    <div
      className="app-card p-8 min-h-[320px] flex flex-col justify-center animate-in fade-in duration-500"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="max-w-md mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-600/20 flex items-center justify-center ring-1 ring-emerald-500/20">
            <Loader2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 animate-spin" aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="space-y-3">
          {steps.map((step, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li
                key={step.id}
                className={`flex gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                  current
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-500/20'
                    : done
                      ? 'opacity-80'
                      : 'opacity-50'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {done ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : current ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-500">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </span>
                  ) : (
                    <Circle className="h-6 w-6 text-gray-300 dark:text-slate-600" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      current ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
