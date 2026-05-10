// pages/auth/Login.jsx - Updated with Sustain360 logo
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, LogIn, AlertCircle, Sun, Moon, MailPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
// Import the Sustain360 logo
import Sustain360Logo from '../../assets/Sustain360_Logo.svg';

const Login = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Helper function to get first accessible route for user based on role
  const getFirstAccessibleRoute = (userRole) => {
    const roleRouteMap = {
      admin: '/dashboard',
      analyst: '/analytics',
      contributor: '/input',
      viewer: '/dashboard'
    };
    return roleRouteMap[userRole] || '/dashboard';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setNeedsEmailVerification(false);
      console.log('Attempting login with:', { email: formData.email });

      const result = await login({
        email: formData.email.trim(),
        password: formData.password
      });

      console.log('Login result:', result);

      if (result && result.success !== false) {
        console.log('Login successful, redirecting based on role:', result.user?.role);
        
        // Redirect user to their first accessible page based on role
        const redirectPath = getFirstAccessibleRoute(result.user?.role);
        console.log('Redirecting to:', redirectPath);
        navigate(redirectPath);
      }
    } catch (error) {
      console.error('Login error in component:', error);

      let errorMessage = 'Login failed';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      if (error.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsEmailVerification(true);
        setErrors({
          general:
            errorMessage ||
            'Please verify your email before signing in. Check your inbox or request a new link.'
        });
        return;
      }

      console.error('Extracted error message:', errorMessage);

      if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('password')) {
        setErrors({ general: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleResendVerification = async () => {
    const email = formData.email.trim();
    if (!email) {
      toast.error('Enter your email address first.');
      return;
    }
    setResendLoading(true);
    try {
      await authAPI.requestVerificationEmail(email);
      toast.success(
        'If that account needs verification, you will receive an email shortly.'
      );
    } catch (e) {
      toast.error(e?.message || 'Could not send email. Try again later.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    if (errors.general) {
      setErrors(prev => ({
        ...prev,
        general: ''
      }));
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white/80 dark:bg-slate-800/90 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <div className="max-w-md w-full space-y-8">
        {/* Header with Sustain360 Logo */}
        <div className="text-center">
          {/* Sustain360 Logo */}
          <div className="mx-auto flex items-center justify-center mb-6">
            <img 
              src={Sustain360Logo} 
              alt="Sustain360" 
              className="h-16 w-auto object-contain"
            />
          </div>
          
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Monitor and manage your carbon emissions
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errors.general && (
            <div
              className={`rounded-lg p-4 flex flex-col gap-3 ${
                needsEmailVerification
                  ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-start space-x-2">
                <AlertCircle
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    needsEmailVerification
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                />
                <span
                  className={`text-sm ${
                    needsEmailVerification
                      ? 'text-amber-900 dark:text-amber-100'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {errors.general}
                </span>
              </div>
              {needsEmailVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {resendLoading ? (
                    'Sending…'
                  ) : (
                    <>
                      <MailPlus className="w-4 h-4" />
                      Resend verification email
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    errors.email ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-gray-300 dark:border-slate-600'
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    errors.password ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-gray-300 dark:border-slate-600'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Login Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <LogIn className="h-4 w-4" />
                  <span>Sign in</span>
                </div>
              )}
            </button>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/contact"
                className="font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
              >
                Contact your administrator
              </Link>
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Secure carbon accounting and emissions tracking
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            © {new Date().getFullYear()} Sustain360. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;