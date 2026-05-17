import { createContext, useContext } from 'react';
import useAnalyticsData from './useAnalyticsData';

const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const value = useAnalyticsData();
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return ctx;
}
