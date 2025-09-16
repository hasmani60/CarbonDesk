import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './layouts/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Input from './pages/Input/Input';
import Monitor from './pages/Monitor/Monitor';
import Analytics from './pages/Analytics/Analytics';
import Permissions from './pages/Permissions/Permissions';
import Settings from './pages/Settings/Settings';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
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
              </Route>
              
              {/* Catch all - redirect to dashboard if authenticated, login if not */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
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
                },
                error: {
                  duration: 4000,
                  style: {
                    background: '#ef4444',
                  },
                },
              }}
            />
          </div>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;