// frontend/src/App.jsx - Complete App with Multi-Tenant Support
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ThemeToaster from './components/ThemeToaster';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ActivityProvider } from './context/ActivityContext';
import Layout from './layouts/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { ThemeProvider } from './context/ThemeContext';


// Auth pages
import Login from './pages/auth/Login';
import Contact from './pages/auth/Contact';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Main app pages
import Dashboard from './pages/Dashboard/Dashboard';
import Input from './pages/Input/Input';
import Monitor from './pages/Monitor/Monitor';
import Analytics from './pages/Analytics/Analytics';
import AIReportsPage from './pages/Reports/AIReportsPage';
import Settings from './pages/Settings/Settings';
import OrganisationPage from './pages/Organisation/OrganisationPage';

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
          <ThemeProvider>
            <Router 
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
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
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/contact" element={<Contact />} />
                
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
                  
                  {/* Monitor - Admin, Analyst (review), Viewer */}
                  <Route 
                    path="monitor" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'viewer']}>
                        <Monitor />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Analytics - Admin, Analyst, Viewer (sub-routes: overview, scope-1/2/3) */}
                  <Route
                    path="analytics/*"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'viewer']}>
                        <Analytics />
                      </ProtectedRoute>
                    }
                  />

                  {/* AI Reports - Organisation admins only */}
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute requiredRoles={['admin']}>
                        <AIReportsPage />
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

                  <Route
                    path="organisation"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'contributor', 'viewer']}>
                        <OrganisationPage />
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
                        <Route path="organisation" element={<Navigate to="/organisation" replace />} />
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
              <ThemeToaster />
            </div>
          </Router>
          </ThemeProvider>
        </ActivityProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;