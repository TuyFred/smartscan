import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ScanLine,
  ShoppingBag,
  Store,
} from 'lucide-react';
import api from '../lib/api';

const STORE_IMAGE =
  'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1600&q=80';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    nationalId: '',
    password: '',
    confirmPassword: '',
    role: 'CUSTOMER',
    supermarketName: '',
    supermarketAddress: '',
    supermarketPhone: '',
    supermarketEmail: '',
    supermarketDescription: '',
    branchName: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isManager = form.role === 'MANAGER';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('fullName', form.fullName.trim());
      fd.append('email', form.email.trim());
      fd.append('phone', form.phone.trim());
      fd.append('address', (isManager ? form.supermarketAddress : form.address).trim());
      fd.append('password', form.password);
      fd.append('confirmPassword', form.confirmPassword);
      fd.append('role', form.role);
      if (!isManager && form.nationalId) fd.append('nationalId', form.nationalId.trim());
      if (isManager) {
        fd.append('supermarketName', form.supermarketName.trim());
        fd.append('supermarketAddress', form.supermarketAddress.trim());
        fd.append('supermarketPhone', (form.supermarketPhone || form.phone).trim());
        fd.append('supermarketEmail', (form.supermarketEmail || form.email).trim());
        fd.append('supermarketDescription', form.supermarketDescription.trim());
        fd.append('branchName', form.branchName.trim());
      }
      await api.post('/auth/register', fd);
      navigate(`/verify-otp?email=${encodeURIComponent(form.email)}&purpose=REGISTER`);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 text-white sm:px-6 sm:py-8">
      <div className={`mx-auto ${isManager ? 'max-w-5xl' : 'max-w-md'}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white sm:text-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold tracking-[0.16em] text-teal-300">
            <ScanLine className="h-3.5 w-3.5" /> SMARTSCAN
          </span>
        </div>

        <div className={`overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-900 shadow-2xl ${isManager ? 'md:grid md:grid-cols-5' : ''}`}>
          {isManager && (
            <div className="relative hidden min-h-[520px] md:col-span-2 md:block">
              <img src={STORE_IMAGE} alt="Supermarket aisle" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-teal-200">Store onboarding</p>
                <h2 className="mt-2 font-display text-2xl font-bold">Register your supermarket</h2>
                <p className="mt-2 text-sm text-slate-200">
                  Create the real store profile customers will see: name, branch, address, and contact desk.
                </p>
              </div>
            </div>
          )}

          <div className={isManager ? 'md:col-span-3' : ''}>
            <div className="border-b border-slate-100 px-4 py-3">
              <h1 className="font-display text-lg font-bold">
                {isManager ? 'Supermarket registration' : 'Create account'}
              </h1>
              <p className="text-xs text-slate-500">
                {isManager
                  ? 'Owner account + live supermarket details. Admin approval is required before login.'
                  : 'Customer registration'}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-2.5 p-4">
              {error && <div className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</div>}

              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'CUSTOMER', title: 'Customer', icon: ShoppingBag },
                  { value: 'MANAGER', title: 'Supermarket', icon: Store },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('role', opt.value)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition ${
                      form.role === opt.value
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <opt.icon className="h-3.5 w-3.5 shrink-0" />
                    {opt.title}
                  </button>
                ))}
              </div>

              {isManager ? (
                <>
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Store profile</p>
                  <CompactField
                    label="Supermarket name"
                    required
                    value={form.supermarketName}
                    onChange={(v) => set('supermarketName', v)}
                    placeholder="e.g. Simba Supermarket"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <CompactField
                      label="Main branch"
                      value={form.branchName}
                      onChange={(v) => set('branchName', v)}
                      placeholder="Kigali Main"
                    />
                    <CompactField
                      label="Store phone"
                      type="tel"
                      value={form.supermarketPhone}
                      onChange={(v) => set('supermarketPhone', v)}
                      placeholder="078xxxxxxx"
                    />
                  </div>
                  <CompactField
                    label="Store address"
                    required
                    value={form.supermarketAddress}
                    onChange={(v) => set('supermarketAddress', v)}
                    placeholder="KN 4 Ave, Kigali"
                  />
                  <CompactField
                    label="Store email"
                    type="email"
                    value={form.supermarketEmail}
                    onChange={(v) => set('supermarketEmail', v)}
                    placeholder="store@supermarket.rw"
                  />
                  <label className="block text-xs font-medium text-slate-700">
                    About the supermarket
                    <textarea
                      className="compact-input mt-1 min-h-[64px]"
                      value={form.supermarketDescription}
                      onChange={(e) => set('supermarketDescription', e.target.value)}
                      placeholder="Fresh groceries, household items, and SMARTSCAN self-checkout."
                    />
                  </label>

                  <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Owner login</p>
                  <CompactField
                    label="Owner / manager name"
                    required
                    value={form.fullName}
                    onChange={(v) => set('fullName', v)}
                    placeholder="Business owner name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <CompactField
                      label="Login email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(v) => set('email', v)}
                      placeholder="owner@email.com"
                    />
                    <CompactField
                      label="Owner phone"
                      type="tel"
                      value={form.phone}
                      onChange={(v) => set('phone', v)}
                      placeholder="07xxxxxxxx"
                    />
                  </div>
                </>
              ) : (
                <>
                  <CompactField
                    label="Full name"
                    required
                    value={form.fullName}
                    onChange={(v) => set('fullName', v)}
                    placeholder="John Doe"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <CompactField
                      label="Email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(v) => set('email', v)}
                      placeholder="you@email.com"
                    />
                    <CompactField
                      label="Phone"
                      type="tel"
                      value={form.phone}
                      onChange={(v) => set('phone', v)}
                      placeholder="07xxxxxxxx"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <CompactField
                      label="National ID"
                      value={form.nationalId}
                      onChange={(v) => set('nationalId', v)}
                      placeholder="ID number"
                    />
                    <CompactField
                      label="Address"
                      value={form.address}
                      onChange={(v) => set('address', v)}
                      placeholder="Your address"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-slate-700">
                  Password
                  <div className="relative mt-1">
                    <input
                      required
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      className="compact-input pr-8"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                      onClick={() => setShowPass((v) => !v)}
                    >
                      {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </label>
                <CompactField
                  label="Confirm"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={(v) => set('confirmPassword', v)}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isManager ? 'Register supermarket' : 'Create account'}
              </button>

              <p className="text-center text-[11px] text-slate-500">
                Already registered?{' '}
                <Link to="/" className="font-semibold text-teal-700 hover:underline">
                  Login
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactField({ label, value, onChange, type = 'text', required, placeholder }) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="compact-input mt-1"
        placeholder={placeholder}
      />
    </label>
  );
}
