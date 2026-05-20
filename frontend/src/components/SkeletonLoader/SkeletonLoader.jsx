/**
 * @deprecated Prefer imports from `../ui/Skeleton` — this wrapper keeps legacy props working.
 */
import { Skeleton, SkeletonText, SkeletonCircle } from '../ui/Skeleton';

const SkeletonLoader = ({ className = '', type = 'rect', lines = 1 }) => {
  if (type === 'text') {
    return <SkeletonText lines={lines} className={className} />;
  }
  if (type === 'circle') {
    return <SkeletonCircle className={className} />;
  }
  return <Skeleton className={className} />;
};

export default SkeletonLoader;
export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonCard,
  SkeletonChart,
  SkeletonTable,
  SkeletonDashboard,
  SkeletonAnalytics,
  SkeletonInputPage,
  SkeletonOrganisation,
  SkeletonOffsetList,
  SkeletonAppShell,
  SkeletonReportFilters
} from '../ui/Skeleton';
