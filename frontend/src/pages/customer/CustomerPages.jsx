import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CreditCard,
  History,
  LayoutDashboard,
  Receipt,
  ScanLine,
  ShoppingBag,
  ShoppingCart,
  User,
  Wallet,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import QrScanner from '../../components/QrScanner';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const links = [
  { to: '/customer/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/customer/start-shopping', label: 'Start Shopping', icon: <ScanLine className="h-4 w-4" /> },
  { to: '/customer/session', label: 'Current Session', icon: <ShoppingBag className="h-4 w-4" /> },
  { to: '/customer/scan-product', label: 'Scan Product', icon: <ScanLine className="h-4 w-4" /> },
  { to: '/customer/cart', label: 'My Cart', icon: <ShoppingCart className="h-4 w-4" /> },
  { to: '/customer/card', label: 'My RFID Card', icon: <CreditCard className="h-4 w-4" /> },
  { to: '/customer/history', label: 'Shopping History', icon: <History className="h-4 w-4" /> },
  { to: '/customer/receipts', label: 'Receipts', icon: <Receipt className="h-4 w-4" /> },
  { to: '/customer/profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
];

export function CustomerShell() {
  return <DashboardLayout title="Customer" links={links} />;
}

export function CustomerDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data.data)).catch(() => {});
  }, []);
  const session = stats?.activeSession;
  const card = stats?.card;
  const remaining = card && session ? Number(card.balance) - Number(session.total_amount || 0) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active session', value: session?.session_code || 'None', icon: ShoppingBag },
          { label: 'Items scanned', value: session?.cart_items?.length || 0, icon: ShoppingCart },
          { label: 'Current total', value: formatRwf(session?.total_amount || 0), icon: Wallet },
          { label: 'Card balance', value: formatRwf(card?.balance || 0), icon: CreditCard },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <c.icon className="h-5 w-5" />
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className="mt-1 font-display text-xl font-bold text-slate-900">{c.value}</div>
          </div>
        ))}
      </div>
      {session && (
        <div className="rounded-2xl bg-slate-900 p-5 text-white">
          <div className="text-sm text-slate-300">Amount remaining after purchase</div>
          <div className="font-display text-3xl font-bold text-teal-300">{formatRwf(remaining)}</div>
          <Link to="/customer/session" className="mt-3 inline-block text-sm text-teal-200 underline">
            View current shopping session
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Link to="/customer/start-shopping" className="rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white">
          Start shopping
        </Link>
        <Link to="/customer/card" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold">
          RFID card & balance
        </Link>
      </div>
    </div>
  );
}

export function StartShopping() {
  const [scanner, setScanner] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onScan = async (qrPayload) => {
    setScanner(false);
    setError('');
    try {
      const { data } = await api.post('/sessions/start', { qrPayload });
      setMsg(data.message);
      navigate('/customer/session');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start session');
    }
  };

  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-display text-2xl font-bold">Start shopping</h2>
      <p className="mt-2 text-sm text-slate-500">
        You must scan the supermarket / branch entrance QR before scanning any products.
      </p>
      <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
        Expected format: SMARTSCAN_BRANCH:BRANCH-001
      </p>
      {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {msg && <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</div>}
      <button
        type="button"
        onClick={() => setScanner(true)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-semibold text-white"
      >
        <ScanLine className="h-4 w-4" /> Open camera & scan branch QR
      </button>
      {scanner && <QrScanner title="Scan supermarket QR" onScan={onScan} onClose={() => setScanner(false)} />}
    </div>
  );
}

function SessionView({ allowScan }) {
  const { triggerPaymentRequest, user } = useAuth();
  const [session, setSession] = useState(null);
  const [scanner, setScanner] = useState(false);
  const [paymentHelp, setPaymentHelp] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await api.get('/sessions/active');
    setSession(data.data);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const onScanProduct = async (qrPayload) => {
    setScanner(false);
    try {
      await api.post(`/sessions/${session.id}/scan-product`, { qrPayload });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Scan failed');
    }
  };

  const updateQty = async (itemId, quantity) => {
    await api.put(`/cart/${itemId}`, { quantity });
    await load();
  };

  const removeItem = async (itemId) => {
    await api.delete(`/cart/${itemId}`);
    await load();
  };

  if (!session) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-slate-500">No active shopping session.</p>
        <Link to="/customer/start-shopping" className="mt-3 inline-block font-semibold text-teal-700">
          Start shopping by scanning branch QR
        </Link>
      </div>
    );
  }

  const items = session.cart_items || [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900 p-5 text-white">
        <div className="text-sm uppercase tracking-wide text-teal-300">{session.supermarkets?.name}</div>
        <div className="text-lg font-semibold">{session.branches?.name}</div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>Session<br /><strong>{session.session_code}</strong></div>
          <div>Status<br /><strong>{session.status}</strong></div>
          <div>Items<br /><strong>{items.reduce((s, i) => s + i.quantity, 0)}</strong></div>
          <div>Total<br /><strong className="text-teal-300">{formatRwf(session.total_amount)}</strong></div>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="table-wrap">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Subtotal</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{item.product_name}</td>
                <td className="px-4 py-3">{item.weight} {item.unit}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button type="button" className="rounded bg-slate-100 px-2" onClick={() => item.quantity > 1 && updateQty(item.id, item.quantity - 1)}>-</button>
                    {item.quantity}
                    <button type="button" className="rounded bg-slate-100 px-2" onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                  </div>
                </td>
                <td className="px-4 py-3">{formatRwf(item.unit_price)}</td>
                <td className="px-4 py-3 font-semibold">{formatRwf(item.subtotal)}</td>
                <td className="px-4 py-3">
                  <button type="button" className="text-red-600" onClick={() => removeItem(item.id)}>Remove</button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No products yet. Scan product QR codes.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="sticky bottom-4 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="mr-auto">
          <div className="text-xs text-slate-500">Current shopping total</div>
          <div className="font-display text-2xl font-bold text-teal-700">{formatRwf(session.total_amount)}</div>
        </div>
        {(allowScan || true) && (
          <button type="button" onClick={() => setScanner(true)} className="rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white">
            Scan more products
          </button>
        )}
        <button type="button" onClick={() => navigate('/customer/cart')} className="rounded-xl border px-4 py-2.5 font-semibold">
          View cart
        </button>
        <button
          type="button"
          onClick={() => {
            if (import.meta.env.DEV && session?.total_amount > 0) {
              triggerPaymentRequest({
                authorizationId: 'local-dev-payment',
                customer: { full_name: user?.fullName || 'Customer' },
                session: { session_code: session?.session_code || 'LOCAL-DEV' },
                amountToPay: Number(session?.total_amount || 0),
                cardBalance: Number(user?.cardBalance || 0),
                cardUid: 'LOCAL-DEV',
              });
              return;
            }
            setPaymentHelp(true);
          }}
          className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white"
        >
          Checkout (tap RFID)
        </button>
      </div>
      {paymentHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <CreditCard className="h-3.5 w-3.5" /> PAYMENT HELP
            </div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Checkout payment guide</h3>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <div className="rounded-full bg-amber-50 px-2 py-1.5 text-amber-700">1. PIN</div>
              <div className="rounded-full bg-slate-100 px-2 py-1.5">2. Tap</div>
              <div className="rounded-full bg-slate-100 px-2 py-1.5">3. Paid</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Step 1: enter your payment PIN when prompted. Step 2: tap your RFID card at the checkout counter. Step 3: once the PIN is verified, the amount is removed from the card and the payment succeeds.
            </p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Available alternatives</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Pay with cash at the checkout.</li>
                <li>Ask staff to recharge your RFID card.</li>
                <li>Use another active card if available.</li>
              </ul>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPaymentHelp(false)} className="rounded-xl border border-slate-200 py-3 font-semibold text-slate-700">
                Close
              </button>
              <button type="button" onClick={() => { setPaymentHelp(false); navigate('/customer/card'); }} className="rounded-xl bg-teal-600 py-3 font-semibold text-white">
                View card
              </button>
            </div>
          </div>
        </div>
      )}
      {scanner && <QrScanner title="Scan product QR" onScan={onScanProduct} onClose={() => setScanner(false)} />}
    </div>
  );
}

export function CurrentSession() {
  return <SessionView />;
}

export function ScanProductPage() {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    api.get('/sessions/active').then((r) => {
      if (!r.data.data) navigate('/customer/start-shopping');
      else setSession(r.data.data);
    });
  }, [navigate]);
  if (!session) return null;
  return <SessionView allowScan />;
}

export function CartPage() {
  return <SessionView />;
}

export function CardPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/cards/me').then((r) => setData(r.data.data)).catch(() => {});
  }, []);
  if (!data) return <div className="rounded-2xl bg-white p-6">Loading card…</div>;
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-teal-800 p-6 text-white shadow-lg">
        <div className="text-sm text-teal-100">My SMARTSCAN card</div>
        <div className="mt-2 font-display text-2xl font-bold">{data.card.card_uid}</div>
        <div className="mt-6 text-sm text-teal-100">Current balance</div>
        <div className="font-display text-4xl font-bold">{formatRwf(data.card.balance)}</div>
        <div className="mt-2 text-xs uppercase tracking-wide text-teal-200">Status: {data.card.status}</div>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Card transaction history</h3>
        <div className="mt-3 space-y-2">
          {(data.transactions || []).map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
              <div>
                <div className="font-medium">{t.type}</div>
                <div className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className={Number(t.amount) >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
                {Number(t.amount) >= 0 ? '+' : ''}
                {formatRwf(t.amount)}
              </div>
            </div>
          ))}
          {!data.transactions?.length && <p className="text-sm text-slate-400">No transactions yet.</p>}
        </div>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/sessions').then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Session</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Started</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-3 font-medium">{s.session_code}</td>
              <td className="px-4 py-3">{s.status}</td>
              <td className="px-4 py-3">{formatRwf(s.total_amount)}</td>
              <td className="px-4 py-3">{new Date(s.started_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReceiptsPage() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/receipts').then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((r) => (
        <Link key={r.id} to={`/customer/receipt/${r.id}`} className="rounded-2xl bg-white p-5 shadow-sm hover:ring-2 hover:ring-teal-200">
          <div className="font-semibold">{r.receipt_number}</div>
          <div className="text-sm text-slate-500">{r.supermarkets?.name}</div>
          <div className="mt-2 font-display text-xl font-bold text-teal-700">{formatRwf(r.total_amount)}</div>
          <div className="text-xs uppercase text-slate-400">{r.status}</div>
        </Link>
      ))}
    </div>
  );
}

export function ReceiptDetail() {
  const [data, setData] = useState(null);
  const { id } = useParams();
  useEffect(() => {
    api.get(`/receipts/${id}`).then((r) => setData(r.data.data));
  }, [id]);
  if (!data) return null;
  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-white p-6 text-center shadow-sm">
      <h2 className="font-display text-2xl font-bold">SMARTSCAN RECEIPT</h2>
      <p className="mt-2 text-sm">{data.receipt_number}</p>
      <p className="text-sm text-slate-500">{data.users?.full_name} · {data.supermarkets?.name}</p>
      <p className="mt-4 font-display text-3xl font-bold text-teal-700">{formatRwf(data.total_amount)}</p>
      <p className="text-xs uppercase text-slate-400">Payment: SMARTSCAN RFID CARD · {data.status}</p>
      {data.qrDataUrl && <img src={data.qrDataUrl} alt="QR" className="mx-auto mt-4 h-48 w-48" />}
      <p className="mt-2 text-xs text-slate-500">Present this QR at the exit scanner.</p>
    </div>
  );
}

export function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('form'); // form | otp | done
  const [purpose, setPurpose] = useState('PIN_CREATE');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [pinStatus, setPinStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const { data } = await api.get('/auth/payment-pin/status');
      setPinStatus(data.data);
      if (data.data?.pendingRequest?.status === 'PENDING_OTP') setStep('otp');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const isReset = Boolean(user?.hasPaymentPin);

  const requestPin = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (pin !== confirmPin) {
      setError('PIN confirmation does not match');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/payment-pin/request', {
        pin,
        confirmPin,
        currentPassword: password,
        requestType: isReset ? 'RESET' : 'CREATE',
      });
      setPurpose(data.data.purpose);
      setStep('otp');
      setMsg(data.message);
      await loadStatus();
      refreshMe();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit PIN');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/payment-pin/verify-otp', { otp, purpose });
      setMsg(data.message);
      setStep('done');
      setOtp('');
      setPin('');
      setConfirmPin('');
      setPassword('');
      await loadStatus();
      refreshMe();
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      const { data } = await api.post('/auth/payment-pin/resend-otp');
      setMsg(data.message);
      setPurpose(data.data?.purpose || purpose);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP');
    }
  };

  const statusLabel = pinStatus?.paymentPinStatus || user?.paymentPinStatus || 'NONE';

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold">{user?.fullName}</h2>
        <p className="text-sm text-slate-500">{user?.email}</p>
        <p className="text-sm text-slate-500">{user?.phone}</p>
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <div>
            Payment PIN:{' '}
            <strong className={user?.hasPaymentPin ? 'text-teal-700' : 'text-amber-700'}>
              {user?.hasPaymentPin ? 'Approved & active' : statusLabel}
            </strong>
          </div>
          {pinStatus?.pendingRequest && (
            <div className="mt-1 text-xs text-slate-500">
              Pending {pinStatus.pendingRequest.request_type.toLowerCase()} · {pinStatus.pendingRequest.status}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold">{isReset ? 'Reset payment PIN' : 'Create payment PIN'}</h3>
        <p className="text-sm text-slate-500">
          Your PIN authorizes RFID payments. Create or reset it, verify your email code, then wait for admin approval.
        </p>
        {msg && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</p>}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {step === 'form' || step === 'done' ? (
          <form onSubmit={requestPin} className="space-y-3">
            <input
              type="password"
              placeholder="Account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              required
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="New 4-6 digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-xl border px-3 py-2"
              required
              maxLength={6}
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-xl border px-3 py-2"
              required
              maxLength={6}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            >
              {isReset ? 'Reset payment PIN' : 'Create payment PIN'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-3">
            <p className="text-sm text-slate-600">Enter the code sent to <strong>{user?.email}</strong></p>
            <input
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-xl border px-3 py-3 text-center text-2xl tracking-[0.4em]"
              placeholder="••••••"
              required
            />
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full rounded-xl bg-teal-600 py-2.5 font-semibold text-white disabled:opacity-60"
            >
              Verify code
            </button>
            <button type="button" onClick={resendOtp} className="w-full text-sm text-teal-700">
              Resend code
            </button>
            <button type="button" onClick={() => setStep('form')} className="w-full text-sm text-slate-500">
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
