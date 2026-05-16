import { useEffect } from 'react';
import { useActivity } from '../../context/ActivityContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import AIReportGenerator from '../../components/AIReportGenerator/AIReportGenerator';

export default function AIReportsPage() {
  const { logPageView } = useActivity();

  useEffect(() => {
    logPageView('AI Reports');
  }, [logPageView]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Carbon Reports"
        breadcrumb={[
          { label: 'Home', href: '/dashboard' },
          { label: 'AI Reports' }
        ]}
      />
      <p className="text-sm text-gray-600 dark:text-gray-400 -mt-4">
        Generate GHG Protocol–aligned emissions reports from your organisation data. Organisation
        admins only.
      </p>
      <AIReportGenerator />
    </div>
  );
}
