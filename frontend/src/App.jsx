// App.jsx - Updated with multi-user support and activity logging
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ActivityProvider } from './context/ActivityContext';
import Layout from './layouts/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Main app pages
import Dashboard from './pages/Dashboard/Dashboard';
import Input from './pages/Input/Input';
import Monitor from './pages/Monitor/Monitor';
import Analytics from './pages/Analytics/Analytics';
import Permissions from './pages/Permissions/Permissions';
import Settings from './pages/Settings/Settings';

// Admin pages
import AdminMonitor from './pages/Admin/AdminMonitor';

import './index.css';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ActivityProvider>
          <Router 
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <div className="min-h-screen bg-gray-50">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Protected Routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="input" element={<Input />} />
                  <Route path="monitor" element={<Monitor />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="permissions" element={<Permissions />} />
                  <Route path="settings" element={<Settings />} />
                  
                  {/* Admin Routes */}
                  <Route path="admin/*" element={
                    <AdminRoute>
                      <Routes>
                        <Route index element={<Navigate to="/admin/monitor" replace />} />
                        <Route path="monitor" element={<AdminMonitor />} />
                        <Route path="users" element={<Permissions />} />
                        <Route path="system" element={<AdminMonitor />} />
                      </Routes>
                    </AdminRoute>
                  } />
                </Route>
                
                {/* Catch all - redirect based on auth state */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              
              {/* Toast Notifications */}
              <Toaster 
                position="top-right" 
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    style: {
                      background: '#10b981',
                    },
                    iconTheme: {
                      primary: '#fff',
                      secondary: '#10b981',
                    },
                  },
                  error: {
                    duration: 5000,
                    style: {
                      background: '#ef4444',
                    },
                    iconTheme: {
                      primary: '#fff',
                      secondary: '#ef4444',
                    },
                  },
                  loading: {
                    style: {
                      background: '#3b82f6',
                    },
                  },
                }}
              />
            </div>
          </Router>
        </ActivityProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;