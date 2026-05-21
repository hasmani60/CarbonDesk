// frontend/src/App.jsx - Complete App with Multi-Tenant Support
import { lazy, Suspense } from 'react';
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

import { SkeletonAnalytics } from './components/ui/Skeleton';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Input = lazy(() => import('./pages/Input/Input'));
const Monitor = lazy(() => import('./pages/Monitor/Monitor'));
const Analytics = lazy(() => import('./pages/Analytics/Analytics'));
const AIReportsPage = lazy(() => import('./pages/Reports/AIReportsPage'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const OrganisationPage = lazy(() => import('./pages/Organisation/OrganisationPage'));
const OffsetOpportunitiesPage = lazy(() => import('./pages/OffsetOpportunities/OffsetOpportunitiesPage'));
const OffsetDetailPage = lazy(() => import('./pages/OffsetOpportunities/OffsetDetailPage'));
const AdminMonitor = lazy(() => import('./pages/Admin/AdminMonitor'));
const UserManagement = lazy(() => import('./pages/Admin/UserManagement'));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div className="brand-mark">CD</div>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
      <p className="text-caption">Loading…</p>
    </div>
  );
}

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
                        <Suspense fallback={<PageFallback />}>
                          <Dashboard />
                        </Suspense>
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Input - Admin, Contributor */}
                  <Route 
                    path="input" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'contributor']}>
                        <Suspense fallback={<PageFallback />}>
                          <Input />
                        </Suspense>
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Monitor - Admin, Analyst (review), Viewer */}
                  <Route 
                    path="monitor" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'viewer']}>
                        <Suspense fallback={<PageFallback />}>
                          <Monitor />
                        </Suspense>
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Analytics - Admin, Analyst, Viewer (sub-routes: overview, scope-1/2/3) */}
                  <Route
                    path="analytics/*"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'viewer']}>
                        <Suspense fallback={<SkeletonAnalytics />}>
                          <Analytics />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* Offset Opportunities */}
                  <Route
                    path="offset-opportunities"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'contributor', 'viewer']}>
                        <Suspense fallback={<PageFallback />}>
                          <OffsetOpportunitiesPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="offset-opportunities/:id"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'contributor', 'viewer']}>
                        <Suspense fallback={<PageFallback />}>
                          <OffsetDetailPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* AI Reports - Organisation admins only */}
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute requiredRoles={['admin']}>
                        <Suspense fallback={<PageFallback />}>
                          <AIReportsPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Settings - All authenticated users */}
                  <Route 
                    path="settings" 
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'contributor', 'viewer']}>
                        <Suspense fallback={<PageFallback />}>
                          <Settings />
                        </Suspense>
                      </ProtectedRoute>
                    } 
                  />

                  <Route
                    path="organisation"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'analyst', 'contributor', 'viewer']}>
                        <Suspense fallback={<PageFallback />}>
                          <OrganisationPage />
                        </Suspense>
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
                        <Route path="monitor" element={<Suspense fallback={<PageFallback />}><AdminMonitor /></Suspense>} />
                        <Route path="users" element={<Suspense fallback={<PageFallback />}><UserManagement /></Suspense>} />
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