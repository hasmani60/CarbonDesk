import { Routes, Route, Navigate } from 'react-router-dom';
import { AnalyticsProvider } from './AnalyticsContext';
import AnalyticsShell from './AnalyticsShell';
import AnalyticsOverviewTab from './tabs/AnalyticsOverviewTab';
import AnalyticsScopeTab from './tabs/AnalyticsScopeTab';

export default function Analytics() {
  return (
    <AnalyticsProvider>
      <Routes>
        <Route element={<AnalyticsShell />}>
          <Route index element={<AnalyticsOverviewTab />} />
          <Route path="scope-1" element={<AnalyticsScopeTab scope={1} />} />
          <Route path="scope-2" element={<AnalyticsScopeTab scope={2} />} />
          <Route path="scope-3" element={<AnalyticsScopeTab scope={3} />} />
          <Route path="*" element={<Navigate to="/analytics" replace />} />
        </Route>
      </Routes>
    </AnalyticsProvider>
  );
}
