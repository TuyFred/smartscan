import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Mail, ScanLine, ShieldCheck } from 'lucide-react';
import api from '../lib/api';

export default function VerifyOtpPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const purpose = params.get('purpose') || 'REGISTER';
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp, purpose });
      setMsg(data.message);
      if (purpose === 'REGISTER') {
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.post('/auth/resend-otp', { email, purpose });
      setMsg('A new verification code was sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-3 py-8 sm:px-4 sm:py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
        <div className="ss-gradient px-5 py-5 text-white sm:px-6 sm:py-6">
          <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm text-teal-100">
            <ScanLine className="h-4 w-4" /> SMARTSCAN
          </Link>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Verify your email</h1>
          <p className="mt-1 text-sm text-slate-200">Enter the 6-digit code from your inbox.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {msg && <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</div>}
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-1 inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-teal-600" /> Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input mt-1"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-1 inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Verification code
            </span>
            <input
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="field-input mt-1 text-center text-2xl tracking-[0.4em]"
              placeholder="••••••"
              inputMode="numeric"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Continue
          </button>
          <button type="button" onClick={resend} className="w-full text-sm font-medium text-teal-700 hover:underline">
            Resend code
          </button>
          <Link to="/" className="block text-center text-sm text-slate-500 hover:text-slate-700">
            Back home
          </Link>
        </form>
      </div>
    </div>
  );
}
