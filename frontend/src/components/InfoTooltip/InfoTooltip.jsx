// frontend/src/components/InfoTooltip/InfoTooltip.jsx
import { useState } from 'react';
import { Info } from 'lucide-react';

const InfoTooltip = ({ content, className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>
      
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2">
          <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 max-w-xs shadow-lg">
            <p>{content}</p>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;