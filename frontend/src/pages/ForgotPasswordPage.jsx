import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, ScanLine, ShieldCheck } from 'lucide-react';
import api from '../lib/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState('email'); // email | reset | done
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const sendCode = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setInfo(data.message);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send reset code');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      const { data } = await api.post('/auth/resend-otp', { email, purpose: 'RESET_PASSWORD' });
      setInfo(data.message || 'A new code was sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code');
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        email,
        code,
        password,
        confirmPassword,
      });
      setInfo(data.message);
      setStep('done');
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-3 py-6 text-white sm:px-4">
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to login
          </Link>
          <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold tracking-[0.16em] text-teal-300">
            <ScanLine className="h-3.5 w-3.5" /> SMARTSCAN
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-900 shadow-2xl">
          <div className="ss-gradient px-4 py-4 text-white sm:px-5">
            <h1 className="font-display text-xl font-bold">Forgot password</h1>
            <p className="mt-1 text-xs text-slate-200 sm:text-sm">
              Enter your account email. We will send a reset code to that inbox.
            </p>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {info && <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">{info}</div>}

            {step === 'email' && (
              <form onSubmit={sendCode} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  <span className="mb-1 inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-teal-600" /> Account email
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500"
                    placeholder="you@email.com"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset code
                </button>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={resetPassword} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="mb-1 inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Code from email
                  </span>
                  <input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-center text-2xl tracking-[0.35em] outline-none focus:border-teal-500"
                    placeholder="••••••"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  New password
                  <div className="relative mt-1">
                    <input
                      required
                      minLength={6}
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 outline-none focus:border-teal-500"
                      placeholder="At least 6 characters"
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
                <label className="block text-sm font-medium text-slate-700">
                  Confirm new password
                  <input
                    required
                    minLength={6}
                    type={showPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500"
                    placeholder="Repeat password"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update password
                </button>
                <button type="button" onClick={resend} className="w-full text-sm font-medium text-teal-700 hover:underline">
                  Resend code to email
                </button>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Change email
                </button>
              </form>
            )}

            {step === 'done' && (
              <div className="space-y-3 text-center">
                <p className="text-sm text-slate-600">Your password was updated. Redirecting to login…</p>
                <Link to="/" className="inline-block font-semibold text-teal-700 hover:underline">
                  Sign in now
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
