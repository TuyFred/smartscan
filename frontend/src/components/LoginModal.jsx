import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ScanLine, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LoginModal({ open, onClose }) {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const roleHome = (role) => {
    if (role === 'ADMIN') return '/admin/dashboard';
    if (role === 'MANAGER') return '/manager/dashboard';
    if (role === 'CASHIER') return '/cashier/dashboard';
    return '/customer/dashboard';
  };

  const submitCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.data?.token) {
        await loginWithToken(data.data.token, data.data.user);
        onClose();
        navigate(roleHome(data.data.user.role));
      }
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError('Email not verified. Please verify your email first.');
        navigate(`/verify-otp?email=${encodeURIComponent(email)}&purpose=REGISTER`);
        onClose();
      } else {
        setError(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-fade-up">
        <div className="ss-gradient px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
                <ScanLine className="h-3.5 w-3.5" /> Secure access
              </div>
              <h2 className="font-display text-2xl font-bold">Welcome back</h2>
              <p className="mt-1 text-sm text-slate-200">Sign in with email and password.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <form onSubmit={submitCredentials} className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500"
                placeholder="you@email.com"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="relative mt-1">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 outline-none focus:border-teal-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <div className="text-right">
              <Link
                to={email ? `/forgot-password?email=${encodeURIComponent(email)}` : '/forgot-password'}
                onClick={onClose}
                className="text-sm font-medium text-teal-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            New here?{' '}
            <Link to="/register" onClick={onClose} className="font-semibold text-teal-700 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
