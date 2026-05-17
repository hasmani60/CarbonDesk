import { getTransportCategoryMeta } from '../../utils/transportCategory';

const TransportCategoryBadge = ({ category }) => {
  const meta = getTransportCategoryMeta(category || 'raw_material');
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${meta.badgeClass}`}>
      {meta.shortLabel}
    </span>
  );
};

export default TransportCategoryBadge;
