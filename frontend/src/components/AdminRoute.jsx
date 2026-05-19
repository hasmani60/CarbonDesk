// components/AdminRoute.jsx - Route protection for admin-only pages
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, AlertTriangle } from 'lucide-react';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full app-card rounded-xl p-8 text-center border border-gray-200/80 dark:border-slate-600/80">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h1>
          
          <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900/60 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mr-3 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Admin Privileges Required
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300/90 mt-1">
                  You need administrator privileges to access this area.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            <p className="mb-2">
              <span className="font-medium">Your current role:</span>{' '}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                getRoleBadgeColor(user?.role)
              }`}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
              </span>
            </p>
            <p>
              Contact your system administrator to request admin access if needed.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => window.history.back()}
              className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

// Helper function to get role badge colors
const getRoleBadgeColor = (role) => {
  const colors = {
    admin: 'bg-red-100 dark:bg-red-950/45 text-red-800 dark:text-red-300',
    analyst: 'bg-blue-100 dark:bg-blue-950/45 text-blue-800 dark:text-blue-300', 
    contributor: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300',
    viewer: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200'
  };
  return colors[role] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200';
};

export default AdminRoute;