import { MoreVertical, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export const ActivityTable = ({ activities, loading, onRefresh }) => {
  const [selectedActivity, setSelectedActivity] = useState(null);

  const columns = [
    { key: 'user', label: 'User', width: 'w-32' },
    { key: 'scope', label: 'Scope', width: 'w-24' },
    { key: 'activityType', label: 'Activity Type', width: 'w-48' },
    { key: 'source', label: 'Source', width: 'w-48' },
    { key: 'accountingPeriod', label: 'Accounting Period', width: 'w-32' },
    { key: 'emissions', label: 'Emissions', width: 'w-24' },
    { key: 'status', label: 'Status', width: 'w-24' },
    { key: 'actions', label: 'Action', width: 'w-16' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-emerald-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider ${column.width}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {activities.map((activity) => (
            <tr key={activity._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {activity.user.avatar}
                    </span>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {activity.user.name}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-900">{activity.scope}</span>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">{activity.activityType}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">{activity.source}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-900">{activity.accountingPeriod}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-900">{activity.emissions}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  activity.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {activity.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center space-x-2">
                  <button className="text-emerald-600 hover:text-emerald-900">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityTable;