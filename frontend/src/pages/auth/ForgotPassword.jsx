import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import Sustain360Logo from '../../assets/Sustain360_Logo.svg';

const ForgotPassword = () => {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Enter your email address');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email.trim().toLowerCase());
      const msg =
        res?.message ||
        'If an account exists for that email, check your inbox for reset instructions.';
      toast.success(msg);
      setSubmitted(true);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Something went wrong. Try again later.'
      );
    } finally {
      setLoading(false);
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
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center mb-6">
            <img
              src={Sustain360Logo}
              alt="Sustain360"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Forgot password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your account email and we&apos;ll send you a link to choose a new password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitted}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60"
                placeholder="you@organisation.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || submitted}
            className="w-full flex justify-center py-3 px-4 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending…' : submitted ? 'Email sent' : 'Send reset link'}
          </button>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
