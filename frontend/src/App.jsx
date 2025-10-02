
// frontend/src/App.jsx - Complete App with Multi-Tenant Support
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
import Settings from './pages/Settings/Settings';

// Admin pages
import AdminMonitor from './pages/Admin/AdminMonitor';
import UserManagement from './pages/Admin/UserManagement';

// Company Operations Portal (HIDDEN)
import CompanyOperationsPortal from './pages/Company/CompanyOperationsPortal';

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
                {/* ========================================== */}
                {/* HIDDEN COMPANY PORTAL ROUTE               */}
                {/* ========================================== */}
                {/* 
                  ⚠️  WARNING: This route is INTENTIONALLY HIDDEN
                  - NOT linked in any navigation menu
                  - NOT accessible to regular users
                  - Only accessible via direct URL
                  - Requires company operator credentials
                  - Completely isolated from regular app
                  
                  Access: http://localhost:5173/company-portal
                  Credentials: See backend startup console
                */}
                <Route 
                  path="/company-portal" 
                  element={<CompanyOperationsPortal />} 
                />
                
                {/* ========================================== */}
                {/* PUBLIC ROUTES                              */}
                {/* ========================================== */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* ========================================== */}
                {/* PROTECTED ROUTES (REGULAR USERS)           */}
                {/* ========================================== */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  {/* Default redirect to dashboard */}
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  
                  {/* Dashboard - Admin, Viewer, Contributor */}
                  <Route 
                    path="dashboard" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'viewer', 'contributor']}>
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Input - Admin, Contributor */}
                  <Route 
                    path="input" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'contributor']}>
                        <Input />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Monitor - Admin, Viewer */}
                  <Route 
                    path="monitor" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'viewer']}>
                        <Monitor />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Analytics - Admin, Analyst, Viewer */}
                  <Route 
                    path="analytics" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'viewer']}>
                        <Analytics />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Settings - All authenticated users */}
                  <Route 
                    path="settings" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'contributor', 'viewer']}>
                        <Settings />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* ========================================== */}
                  {/* ADMIN ROUTES (ADMIN ONLY)                  */}
                  {/* ========================================== */}
                  <Route path="admin/*" element={
                    <AdminRoute>
                      <Routes>
                        <Route index element={<Navigate to="/admin/monitor" replace />} />
                        <Route path="monitor" element={<AdminMonitor />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="system" element={<AdminMonitor />} />
                      </Routes>
                    </AdminRoute>
                  } />
                </Route>
                
                {/* ========================================== */}
                {/* CATCH ALL - REDIRECT                       */}
                {/* ========================================== */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              
              {/* ========================================== */}
              {/* TOAST NOTIFICATIONS                        */}
              {/* ========================================== */}
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