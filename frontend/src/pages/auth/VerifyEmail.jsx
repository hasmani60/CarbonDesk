import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token || !token.trim()) {
      setStatus('error');
      setMessage('This verification link is missing a token. Open the link from your email, or request a new one from the login page.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await authAPI.verifyEmail(token.trim());
        if (cancelled) return;
        const msg =
          res?.message ||
          'Your email is verified. You can sign in now.';
        setMessage(msg);
        setStatus('success');
        toast.success(msg);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          'Verification failed. The link may have expired—request a new one from login.';
        setMessage(msg);
        setStatus('error');
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-12 px-4">
      <div className="max-w-md w-full bg-white/90 dark:bg-slate-900/80 backdrop-blur rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xl p-8 text-center">
        <div className="flex justify-center mb-4" aria-live="polite">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" aria-hidden />
              <span className="sr-only">Verifying your email</span>
            </>
          )}
          {status === 'success' && (
            <CheckCircle className="w-12 h-12 text-emerald-600" aria-hidden />
          )}
          {status === 'error' && (
            <AlertCircle className="w-12 h-12 text-amber-600" aria-hidden />
          )}
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Mail className="w-5 h-5 text-gray-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Email verification
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">{message}</p>
        {status === 'success' && (
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            Go to sign in
          </Link>
        )}
        {status === 'error' && (
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-800 dark:text-gray-100 font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Back to login
          </Link>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
