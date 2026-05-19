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
    <div className="space-y-6">
      <PageHeader
        title="AI Carbon Reports"
        subtitle="Generate GHG Protocol–aligned emissions reports from your organisation data. Organisation admins only."
        breadcrumb={[
          { label: 'Home', href: '/dashboard' },
          { label: 'AI Reports' }
        ]}
      />
      <AIReportGenerator />
    </div>
  );
}
