import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CreditCard,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  Users,
  BarChart3,
  Shield,
  QrCode,
  Download,
  X,
  Scale,
  Wallet,
  LifeBuoy,
  Banknote,
  Search,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const managerLinks = [
  { to: '/manager/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/manager/sessions', label: 'Active Sessions', icon: <ShoppingBag className="h-4 w-4" /> },
  { to: '/manager/products', label: 'Products', icon: <Package className="h-4 w-4" /> },
  { to: '/manager/customers', label: 'Customers', icon: <Users className="h-4 w-4" /> },
  { to: '/manager/payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
  { to: '/manager/supermarket', label: 'My Supermarket', icon: <Store className="h-4 w-4" /> },
  { to: '/manager/devices', label: 'Device Status', icon: <Shield className="h-4 w-4" /> },
  { to: '/manager/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
];

export function ManagerShell() {
  return <DashboardLayout title="Manager" links={managerLinks} />;
}

export function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const { socket } = useAuth();

  const loadDashboard = () => {
    api.get('/admin/stats').then((r) => setStats(r.data.data)).catch(() => {});
    api.get('/sessions?status=ACTIVE').then((r) => setSessions(r.data.data || [])).catch(() => {});
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const handlers = ['payment:success', 'session:paid', 'card:updated'];
    const onRefresh = () => loadDashboard();
    handlers.forEach((eventName) => socket.on(eventName, onRefresh));
    return () => {
      handlers.forEach((eventName) => socket.off(eventName, onRefresh));
    };
  }, [socket]);

  const actions = [
    { to: '/manager/sessions', title: 'Active sessions', text: 'Watch live carts and totals', tone: 'bg-sky-600 hover:bg-sky-500', icon: ShoppingBag },
    { to: '/manager/products', title: 'Products', text: 'Add stock and QR labels', tone: 'bg-teal-600 hover:bg-teal-500', icon: Package },
    { to: '/manager/customers', title: 'Store customers', text: 'Only shoppers of this supermarket', tone: 'bg-indigo-600 hover:bg-indigo-500', icon: Users },
    { to: '/manager/payments', title: 'Payments', text: 'Paid sessions and amounts', tone: 'bg-emerald-600 hover:bg-emerald-500', icon: CreditCard },
    { to: '/manager/supermarket', title: 'My supermarket', text: 'Branches and store QR', tone: 'bg-amber-600 hover:bg-amber-500', icon: Store },
    { to: '/manager/devices', title: 'Devices', text: 'RFID / exit gate status', tone: 'bg-slate-800 hover:bg-slate-700', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-6 text-white">
        <h2 className="font-display text-2xl font-bold">Manager control desk</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Track your store only. Each action button below is color-coded by task.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Active sessions" value={stats?.activeSessions || 0} />
        <Stat label="Products" value={stats?.products || 0} />
        <Stat label="Store customers" value={stats?.customers || 0} />
        <Stat label="Sales total" value={formatRwf(stats?.salesTotal || 0)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`group flex items-start gap-3 rounded-2xl px-4 py-4 text-white shadow-sm transition ${item.tone}`}
          >
            <item.icon className="mt-0.5 h-6 w-6 shrink-0 opacity-90" />
            <div>
              <div className="font-display text-lg font-bold">{item.title}</div>
              <p className="mt-1 text-sm text-white/80">{item.text}</p>
              <span className="mt-3 inline-block text-xs font-semibold uppercase tracking-wide text-white/90 group-hover:underline">
                Open →
              </span>
            </div>
          </Link>
        ))}
      </div>
      <SessionsTable rows={sessions.slice(0, 8)} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function SessionsTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b px-4 py-3 font-semibold">Active shopping sessions</div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Session</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link className="font-medium text-teal-700" to={`/manager/sessions/${s.id}`}>
                  {s.session_code}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {s.users?.profile_image ? (
                    <img src={s.users.profile_image} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs">
                      {s.users?.full_name?.[0]}
                    </div>
                  )}
                  {s.users?.full_name}
                </div>
              </td>
              <td className="px-4 py-3">{s.branches?.name}</td>
              <td className="px-4 py-3">{s.cart_items?.length || 0}</td>
              <td className="px-4 py-3 font-semibold">{formatRwf(s.total_amount)}</td>
              <td className="px-4 py-3">{s.status}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No active sessions</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ManagerSessions() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/sessions').then((r) => setRows(r.data.data || []));
  }, []);
  return <SessionsTable rows={rows} />;
}

export function ManagerSessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  useEffect(() => {
    api.get(`/sessions/${id}`).then((r) => setSession(r.data.data));
    const t = setInterval(() => api.get(`/sessions/${id}`).then((r) => setSession(r.data.data)), 5000);
    return () => clearInterval(t);
  }, [id]);
  if (!session) return null;
  const c = session.users;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Customer profile</h3>
          <div className="mt-3 flex items-center gap-3">
            {c?.profile_image ? (
              <img src={c.profile_image} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-800">
                {c?.full_name?.[0]}
              </div>
            )}
            <div>
              <div className="font-display text-xl font-bold">{c?.full_name}</div>
              <div className="text-sm text-slate-500">{c?.email}</div>
              <div className="text-sm text-slate-500">{c?.phone}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900 p-5 text-white">
          <div className="text-sm text-slate-300">Session {session.session_code}</div>
          <div className="mt-2 text-2xl font-bold">{formatRwf(session.total_amount)}</div>
          <div className="mt-2 text-sm">Status: {session.status} · Payment: {session.payment_status}</div>
          <div className="text-sm text-slate-300">Started: {new Date(session.started_at).toLocaleString()}</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(session.cart_items || []).map((i) => (
              <tr key={i.id} className="border-t text-center">
                <td className="px-4 py-3 text-left font-medium">{i.product_name}</td>
                <td className="px-4 py-3">{i.weight}{i.unit}</td>
                <td className="px-4 py-3">{i.quantity}</td>
                <td className="px-4 py-3">{formatRwf(i.unit_price)}</td>
                <td className="px-4 py-3 font-semibold">{formatRwf(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Managers can view card balances but cannot deduct funds.</p>
    </div>
  );
}

export function ManagerProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: '',
    price: '',
    weight: '',
    unit: 'kg',
    quantityAvailable: '50',
    category: 'Grocery',
    description: '',
  });
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/products').then((r) => setProducts(r.data.data || []));
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/products', {
        ...form,
        weight: Number(form.weight || 0),
        supermarketId: user.supermarketId,
      });
      setQr(data.data);
      setForm({
        name: '',
        price: '',
        weight: '',
        unit: 'kg',
        quantityAvailable: '50',
        category: 'Grocery',
        description: '',
      });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create product');
    } finally {
      setLoading(false);
    }
  };

  const showQr = async (id) => {
    const { data } = await api.get(`/products/${id}/qrcode`);
    setQr(data.data);
  };

  const downloadQr = () => {
    if (!qr?.qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qr.qrDataUrl;
    a.download = `${qr.product?.product_code || 'product'}-qr.png`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Add product</h2>
            <p className="mt-1 text-sm text-slate-500">
              Include weight and unit. After saving, a unique product QR code is generated automatically.
            </p>
          </div>
          <Scale className="h-6 w-6 text-teal-600" />
        </div>

        {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Product name
            <input required className="field-input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sugar" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Category
            <input className="field-input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Price (RWF)
            <input required type="number" min="0" step="1" className="field-input mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="1500" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Weight
            <input required type="number" min="0" step="0.001" className="field-input mt-1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="1" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Unit
            <select className="field-input mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Quantity available
            <input type="number" min="0" className="field-input mt-1" value={form.quantityAvailable} onChange={(e) => setForm({ ...form, quantityAvailable: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Description
            <input className="field-input mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </label>
          <button disabled={loading} className="rounded-xl bg-teal-600 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            {loading ? 'Creating…' : 'Create product + QR'}
          </button>
        </form>
      </div>

      {qr && (
        <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                <QrCode className="h-3.5 w-3.5" /> Product QR generated
              </div>
              <h3 className="mt-3 font-display text-xl font-bold">{qr.product?.name}</h3>
              <p className="text-sm text-slate-600">
                Weight: {qr.product?.weight} {qr.product?.unit} · Price: {formatRwf(qr.product?.price)}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">{qr.qrPayload}</p>
            </div>
            <button type="button" onClick={() => setQr(null)} className="rounded-lg p-2 hover:bg-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-end">
            <img src={qr.qrDataUrl} alt="Product QR" className="h-52 w-52 rounded-2xl border border-slate-200 bg-white p-3" />
            <div className="space-y-2">
              <p className="max-w-xs text-sm text-slate-600 text-justify">
                Print or download this QR and place it on the product. Customers scan it during shopping.
              </p>
              <button type="button" onClick={downloadQr} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
                <Download className="h-4 w-4" /> Download QR PNG
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">Product list & QR codes</div>
        <div className="table-wrap">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">QR code</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.product_code}</div>
                </td>
                <td className="px-4 py-3 text-center">{p.weight} {p.unit}</td>
                <td className="px-4 py-3 text-center">{formatRwf(p.price)}</td>
                <td className="px-4 py-3 text-center">{p.quantity_available}</td>
                <td className="px-4 py-3 text-center">
                  <button type="button" className="inline-flex items-center gap-1 font-semibold text-teal-700" onClick={() => showQr(p.id)}>
                    <QrCode className="h-4 w-4" /> View / download
                  </button>
                </td>
              </tr>
            ))}
            {!products.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No products yet</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export function ManagerCustomers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/cards/store-customers');
        if (!cancelled) setRows(data.data || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = !needle
    ? rows
    : rows.filter((u) => {
        const blob = `${u.full_name || ''} ${u.email || ''} ${u.phone || ''} ${u.customer_cards?.[0]?.card_uid || ''}`.toLowerCase();
        return blob.includes(needle);
      });

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Store customers</h2>
            <p className="text-sm text-slate-500">
              Only shoppers who bought in your supermarket. Live filter as you type.
            </p>
          </div>
          <div className="ss-search max-w-md">
            <Search className="ss-search-icon h-4 w-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter name, email, phone, UID…" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Card</th>
                <th className="center">Balance</th>
                <th className="center">Visits</th>
                <th className="center">Spent here</th>
                <th className="center">Last visit</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="center text-slate-400">Loading…</td></tr>}
              {!loading && filtered.map((u) => {
                const card = u.customer_cards?.[0];
                const hasCard = Boolean(card?.card_uid);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="ss-avatar">{(u.full_name || '?')[0]}</span>
                        <div>
                          <div className="font-semibold">{u.full_name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                          <div className="text-xs text-slate-400">{u.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {hasCard ? (
                        <div className="space-y-1">
                          <span className="ss-uid">{card.card_uid}</span>
                          <div><span className="ss-badge ss-badge-ok">Has card</span></div>
                        </div>
                      ) : (
                        <span className="ss-badge ss-badge-warn">No card</span>
                      )}
                    </td>
                    <td className="center font-semibold text-teal-800">{formatRwf(card?.balance || 0)}</td>
                    <td className="center">{u.visits || 0}</td>
                    <td className="center font-semibold">{formatRwf(u.totalSpent || 0)}</td>
                    <td className="center text-xs text-slate-500">
                      {u.lastVisit ? new Date(u.lastVisit).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={6} className="center text-slate-400">
                    No customers match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ManagerPayments() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/payments').then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Payment</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-4 py-3 font-medium">{p.payment_code}</td>
              <td className="px-4 py-3 text-center">{p.users?.full_name}</td>
              <td className="px-4 py-3 text-center font-semibold">{formatRwf(p.amount)}</td>
              <td className="px-4 py-3 text-center">{new Date(p.paid_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ManagerSupermarket() {
  const [markets, setMarkets] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', address: '', branchName: '' });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/supermarkets').then((r) => setMarkets(r.data.data || []));
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/supermarkets', form);
      setCreated(data.data);
      if (data.data?.token) {
        localStorage.setItem('smartscan_token', data.data.token);
      }
      setForm({ name: '', description: '', address: '', branchName: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create supermarket');
    }
  };

  const showBranchQr = async (branchId) => {
    const { data } = await api.get(`/supermarkets/branches/${branchId}/qrcode`);
    setCreated({
      supermarket: { name: data.data.branch?.supermarkets?.name },
      branch: data.data.branch,
      branchQr: data.data.qrDataUrl,
      qrPayload: data.data.qrPayload,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadQr = () => {
    if (!created?.branchQr) return;
    const a = document.createElement('a');
    a.href = created.branchQr;
    a.download = `${created.branch?.code || 'branch'}-qr.png`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <strong>Where to check supermarket QR:</strong> After creating a supermarket, the branch entrance QR
        appears below. You can also open <em>My Supermarket</em>, find your branch, and click{' '}
        <strong>View entrance QR</strong> anytime.
      </div>

      <form onSubmit={create} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="font-display text-xl font-bold">Create supermarket</h3>
          <p className="mt-1 text-sm text-slate-500">You become the owner. A main-branch QR is generated automatically.</p>
        </div>
        {error && <div className="md:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium text-slate-700">
          Supermarket name
          <input required className="field-input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ABC Supermarket" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Main branch name
          <input className="field-input mt-1" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} placeholder="Kigali Main Branch" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Address
          <input className="field-input mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Description
          <textarea className="field-input mt-1" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <button className="rounded-xl bg-teal-600 py-3 font-semibold text-white md:col-span-2 hover:bg-teal-700">
          Create supermarket + generate branch QR
        </button>
      </form>

      {created?.branchQr && (
        <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
            <QrCode className="h-3.5 w-3.5" /> Branch entrance QR ready
          </div>
          <h3 className="mt-3 font-display text-xl font-bold">
            {created.supermarket?.name || 'Supermarket'} · {created.branch?.name}
          </h3>
          <p className="text-sm text-slate-600">Place this QR at the supermarket/branch entrance for customers to start shopping.</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{created.qrPayload}</p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
            <img src={created.branchQr} alt="Branch QR" className="h-56 w-56 rounded-2xl border border-slate-200 bg-white p-3" />
            <button type="button" onClick={downloadQr} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
              <Download className="h-4 w-4" /> Download entrance QR
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 font-display text-lg font-bold">Your supermarkets & branch QR codes</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {markets.map((m) => (
            <div key={m.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-lg font-bold">{m.name}</div>
                  <div className="text-sm text-slate-500">{m.address || 'No address'}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">Status: {m.status}</div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Branches — check QR here</p>
                {(m.branches || []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => showBranchQr(b.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-left text-sm hover:border-teal-300 hover:bg-teal-50"
                  >
                    <span>
                      <span className="font-medium">{b.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{b.code}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                      <QrCode className="h-4 w-4" /> View entrance QR
                    </span>
                  </button>
                ))}
                {!m.branches?.length && <p className="text-sm text-slate-400">No branches yet</p>}
              </div>
            </div>
          ))}
          {!markets.length && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400 md:col-span-2">
              No supermarket yet. Create one above to get your entrance QR.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ManagerReports() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data.data));
  }, []);
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="font-display text-xl font-bold">Sales snapshot</h3>
      <p className="mt-2 text-3xl font-bold text-teal-700">{formatRwf(stats?.salesTotal || 0)}</p>
      <p className="text-sm text-slate-500">{stats?.paymentsCount || 0} completed payments</p>
    </div>
  );
}

const cashierLinks = [
  { to: '/cashier/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/cashier/sell-card', label: 'Sell Card', icon: <CreditCard className="h-4 w-4" /> },
  { to: '/cashier/deposits', label: 'Add Money', icon: <Wallet className="h-4 w-4" /> },
  { to: '/cashier/customers', label: 'Customers', icon: <Users className="h-4 w-4" /> },
  { to: '/cashier/help', label: 'Help Customer', icon: <LifeBuoy className="h-4 w-4" /> },
  { to: '/cashier/rfid', label: 'RFID Read', icon: <Shield className="h-4 w-4" /> },
];

export function CashierShell() {
  return <DashboardLayout title="Cashier" links={cashierLinks} />;
}

export function CashierDashboard() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/cards/customers?limit=200&q=${encodeURIComponent(q)}`);
        if (!cancelled) setRows(data.data || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q ? 280 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const withCard = rows.filter((u) => u.customer_cards?.[0]?.card_uid).length;
  const noCard = rows.length - withCard;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-slate-900 p-6 text-white">
        <h2 className="font-display text-2xl font-bold">Cashier desk</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Search customers instantly. See who already has an RFID card, their UID, and balance before you sell or deposit.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Showing</div>
          <div className="mt-1 font-display text-2xl font-bold">{rows.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Have card</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-800">{withCard}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Need card</div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-900">{noCard}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { to: '/cashier/sell-card', title: 'Sell RFID card', text: 'Issue one UID to one customer', icon: CreditCard, tone: 'bg-teal-600 hover:bg-teal-500' },
          { to: '/cashier/deposits', title: 'Add money', text: 'Deposit cash onto a card', icon: Banknote, tone: 'bg-emerald-600 hover:bg-emerald-500' },
          { to: '/cashier/customers', title: 'Full customer list', text: 'Browse every shopper', icon: Users, tone: 'bg-sky-600 hover:bg-sky-500' },
          { to: '/cashier/help', title: 'Help customer', text: 'Guide shopping & balance', icon: LifeBuoy, tone: 'bg-amber-600 hover:bg-amber-500' },
          { to: '/cashier/rfid', title: 'Read RFID', text: 'Live card tap lookup', icon: Shield, tone: 'bg-indigo-600 hover:bg-indigo-500' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className={`rounded-2xl px-4 py-4 text-white shadow-sm transition ${item.tone}`}>
            <item.icon className="h-5 w-5 opacity-90" />
            <div className="mt-2 font-display text-base font-bold">{item.title}</div>
            <p className="mt-0.5 text-xs text-white/80">{item.text}</p>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">Customers & cards</h3>
            <p className="text-xs text-slate-500">Type to auto-filter by name, email, phone, or card UID</p>
          </div>
          <div className="ss-search max-w-md">
            <Search className="ss-search-icon h-4 w-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customers or card UID…"
              aria-label="Search customers"
            />
          </div>
        </div>
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Card UID</th>
                <th className="center">Balance</th>
                <th className="center">Card status</th>
                <th className="center">Account</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="center text-slate-400">Refreshing results…</td>
                </tr>
              )}
              {!loading && rows.map((u) => {
                const card = u.customer_cards?.[0];
                const hasCard = Boolean(card?.card_uid);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {u.profile_image ? (
                          <img src={u.profile_image} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <span className="ss-avatar">{(u.full_name || '?')[0]}</span>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">{u.full_name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                          <div className="text-xs text-slate-400">{u.phone || 'No phone'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {hasCard ? <span className="ss-uid">{card.card_uid}</span> : <span className="text-slate-400">Not issued</span>}
                    </td>
                    <td className="center font-semibold text-teal-800">{formatRwf(card?.balance || 0)}</td>
                    <td className="center">
                      <span className={`ss-badge ${hasCard ? 'ss-badge-ok' : 'ss-badge-warn'}`}>
                        {hasCard ? 'Has card' : 'Needs card'}
                      </span>
                    </td>
                    <td className="center">
                      <span className={`ss-badge ${u.account_status === 'APPROVED' ? 'ss-badge-info' : 'ss-badge-muted'}`}>
                        {u.account_status || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={5} className="center text-slate-400">No customers match “{q || 'all'}”</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomerSearch({ selected, onSelect, hint, autoLoad = true }) {
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!autoLoad && !q) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/cards/customers?limit=200&q=${encodeURIComponent(q)}`);
        if (cancelled) return;
        setCustomers(data.data || []);
        if (!(data.data || []).length) setError(q ? `No match for “${q}”` : 'No customers found');
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q ? 280 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, autoLoad]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="ss-search">
          <Search className="ss-search-icon h-4 w-4" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Live search: name, email, phone, or card UID"
            aria-label="Search customers"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{hint || 'Results refresh automatically as you type'}</span>
          <span>{loading ? 'Searching…' : `${customers.length} result${customers.length === 1 ? '' : 's'}`}</span>
        </div>
      </div>
      {error && !customers.length && <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {customers.map((c) => {
          const card = c.customer_cards?.[0];
          const hasCard = Boolean(card?.card_uid);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
                selected?.id === c.id ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="ss-avatar">{(c.full_name || '?')[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate font-semibold text-slate-900">{c.full_name}</div>
                    <span className={`ss-badge ${hasCard ? 'ss-badge-ok' : 'ss-badge-warn'}`}>
                      {hasCard ? 'Has card' : 'Needs card'}
                    </span>
                  </div>
                  <div className="truncate text-sm text-slate-500">{c.email}</div>
                  <div className="text-xs text-slate-400">{c.phone || 'No phone'}</div>
                  <div className="mt-2">
                    {hasCard ? <span className="ss-uid">{card.card_uid}</span> : <span className="text-xs text-slate-400">No RFID card yet</span>}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-teal-800">Balance: {formatRwf(card?.balance || 0)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CashierSellCard() {
  const { socket } = useAuth();
  const [selected, setSelected] = useState(null);
  const [cardUid, setCardUid] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingTap, setWaitingTap] = useState(false);
  const [uidStatus, setUidStatus] = useState(null);
  const [checkingUid, setCheckingUid] = useState(false);

  const checkUid = async (uidValue) => {
    const uid = String(uidValue || '').trim();
    if (!uid) {
      setUidStatus(null);
      return;
    }
    setCheckingUid(true);
    try {
      const { data } = await api.get(`/cards/check-uid?uid=${encodeURIComponent(uid)}`);
      setUidStatus(data.data);
    } catch (err) {
      setUidStatus({ taken: false, available: true, message: err.response?.data?.message || 'Could not check UID' });
    } finally {
      setCheckingUid(false);
    }
  };

  useEffect(() => {
    if (!socket) return undefined;
    const onRead = (payload) => {
      const uid = payload?.cardUid || payload?.card?.cardUid;
      if (!uid) return;
      setCardUid(uid);
      setWaitingTap(false);
      checkUid(uid);
    };
    socket.on('rfid:card-read', onRead);
    return () => socket.off('rfid:card-read', onRead);
  }, [socket]);

  useEffect(() => {
    const t = setTimeout(() => checkUid(cardUid), 350);
    return () => clearTimeout(t);
  }, [cardUid]);

  const sell = async (e) => {
    e.preventDefault();
    setError('');
    if (uidStatus?.taken && uidStatus?.owner?.id !== selected?.id) {
      setError(uidStatus.message || 'This card UID is already taken by another customer');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/cards/sell', {
        customerId: selected.id,
        cardUid,
        initialBalance: Number(amount || 0),
      });
      setResult(data.data);
      setCardUid('');
      setAmount('');
      setUidStatus(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sell card');
    } finally {
      setLoading(false);
    }
  };

  const uidBlocked = Boolean(uidStatus?.taken && uidStatus?.owner?.id !== selected?.id);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900 p-5 text-white">
        <h2 className="font-display text-xl font-bold">Sell RFID card</h2>
        <p className="mt-1 text-sm text-slate-300">
          Pick a customer, tap one physical card, and sell that UID only once. If the UID is already taken, selling is blocked.
        </p>
      </div>
      <CustomerSearch
        selected={selected}
        onSelect={setSelected}
        hint="All registered customers are listed. Green = already has a card. Amber = needs a card."
      />
      {selected && (
        <form onSubmit={sell} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Issue card to {selected.full_name}</h3>
          {selected.customer_cards?.[0]?.card_uid && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              Current card: <span className="font-mono font-semibold">{selected.customer_cards[0].card_uid}</span>
              {' '}· Selling a new UID will replace it for this customer only.
            </div>
          )}
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="block text-sm font-medium">
            Physical RFID card UID (one card → one customer)
            <div className="mt-1 flex gap-2">
              <input
                required
                value={cardUid}
                onChange={(e) => setCardUid(e.target.value)}
                placeholder="Tap card or type UID"
                className={`w-full rounded-xl border px-3 py-2 ${uidBlocked ? 'border-red-400 bg-red-50' : uidStatus?.available ? 'border-emerald-400 bg-emerald-50' : ''}`}
              />
              <button
                type="button"
                onClick={() => { setWaitingTap(true); setCardUid(''); setUidStatus(null); }}
                className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                {waitingTap ? 'Waiting…' : 'Tap card'}
              </button>
            </div>
          </label>
          {waitingTap && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Tap the RFID card on the reader now. The UID will fill in automatically.
            </div>
          )}
          {checkingUid && <p className="text-xs text-slate-500">Checking if this UID is already taken…</p>}
          {uidStatus && !checkingUid && (
            <div
              className={`rounded-xl px-3 py-2 text-sm ${
                uidBlocked
                  ? 'border border-red-200 bg-red-50 text-red-800'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {uidBlocked ? (
                <>
                  <strong>Already taken.</strong> Owned by {uidStatus.owner?.fullName || 'another customer'}
                  {uidStatus.owner?.email ? ` (${uidStatus.owner.email})` : ''}. Choose a different card.
                </>
              ) : uidStatus.owner?.id === selected.id ? (
                <>This UID is already linked to <strong>{selected.full_name}</strong>. You can re-confirm or load money.</>
              ) : (
                <><strong>Available.</strong> {uidStatus.message || 'Ready to sell this card UID.'}</>
              )}
            </div>
          )}
          <label className="block text-sm font-medium">
            Starting balance (RWF)
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0 if they will add money later"
              className="mt-1 w-full rounded-xl border px-3 py-2"
            />
          </label>
          <button
            disabled={loading || uidBlocked || !cardUid.trim()}
            className="rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Selling…' : uidBlocked ? 'Card already taken' : 'Sell card'}
          </button>
        </form>
      )}
      {result && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          Card <span className="font-mono font-bold">{result.card?.card_uid}</span> sold to {result.customer?.full_name}.
          New balance: {formatRwf(result.newBalance)}.
        </div>
      )}
    </div>
  );
}

export function CashierDeposits() {
  const { socket } = useAuth();
  const [selected, setSelected] = useState(null);
  const [cardUid, setCardUid] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingTap, setWaitingTap] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;
    const onRead = (payload) => {
      const uid = payload?.cardUid || payload?.card?.cardUid;
      if (!uid) return;
      setCardUid(uid);
      setWaitingTap(false);
      if (payload?.customer) setSelected(payload.customer);
    };
    socket.on('rfid:card-read', onRead);
    return () => socket.off('rfid:card-read', onRead);
  }, [socket]);

  const deposit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selected && !cardUid) {
      setError('Search a customer or tap/enter a card UID');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/cards/deposit', {
        customerId: selected?.id,
        cardUid: cardUid || undefined,
        amount: Number(amount),
      });
      setResult(data.data);
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Add money to card</h2>
        <p className="text-sm text-slate-500">Cashiers can deposit cash onto a card. Money is never deducted here.</p>
      </div>
      <CustomerSearch selected={selected} onSelect={setSelected} />
      <form onSubmit={deposit} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold">{selected ? `Deposit to ${selected.full_name}` : 'Deposit by card UID'}</h3>
        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-medium">
          Card UID (optional if a customer is selected)
          <div className="mt-1 flex gap-2">
            <input
              value={cardUid}
              onChange={(e) => setCardUid(e.target.value)}
              placeholder="Tap or type RFID UID"
              className="w-full rounded-xl border px-3 py-2"
            />
            <button
              type="button"
              onClick={() => { setWaitingTap(true); setCardUid(''); }}
              className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              {waitingTap ? 'Waiting…' : 'Tap card'}
            </button>
          </div>
        </label>
        {waitingTap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Tap the customer card on the reader. UID and customer details will appear here.
          </div>
        )}
        <label className="block text-sm font-medium">
          Amount (RWF)
          <input
            required
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>
        <button disabled={loading} className="rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          {loading ? 'Depositing…' : 'Confirm deposit'}
        </button>
      </form>
      {result && (
        <div className="rounded-2xl bg-green-50 p-5 text-green-900">
          Previous: {formatRwf(result.previousBalance)} · Deposit: {formatRwf(result.deposit)} · New:{' '}
          {formatRwf(result.newBalance)}
        </div>
      )}
    </div>
  );
}

export function CashierCustomers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/cards/customers?limit=200&q=${encodeURIComponent(q)}`);
        if (!cancelled) setRows(data.data || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q ? 280 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">All customers</h2>
            <p className="text-sm text-slate-500">Live search refreshes as you type — name, email, phone, or card UID.</p>
          </div>
          <div className="ss-search max-w-md">
            <Search className="ss-search-icon h-4 w-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auto search customers…" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Card UID</th>
                <th className="center">Balance</th>
                <th className="center">Card</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="center text-slate-400">Searching…</td></tr>
              )}
              {!loading && rows.map((u) => {
                const card = u.customer_cards?.[0];
                const hasCard = Boolean(card?.card_uid);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="ss-avatar">{(u.full_name || '?')[0]}</span>
                        <div>
                          <div className="font-semibold">{u.full_name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{hasCard ? <span className="ss-uid">{card.card_uid}</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="center font-semibold text-teal-800">{formatRwf(card?.balance || 0)}</td>
                    <td className="center">
                      <span className={`ss-badge ${hasCard ? 'ss-badge-ok' : 'ss-badge-warn'}`}>
                        {hasCard ? 'Issued' : 'Needs card'}
                      </span>
                    </td>
                    <td className="center">
                      <span className="ss-badge ss-badge-muted">{u.account_status}</span>
                    </td>
                  </tr>
                );
              })}
              {!loading && !rows.length && (
                <tr><td colSpan={5} className="center text-slate-400">No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CashierHelp() {
  const [selected, setSelected] = useState(null);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-teal-100 bg-teal-50 p-5">
        <h2 className="font-display text-xl font-bold text-teal-950">Help a customer at the desk</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-teal-900">
          <li>If they have no physical card, sell them one and load money.</li>
          <li>If the card already exists, add money with a deposit — never deduct here.</li>
          <li>Ask them to start shopping by scanning the supermarket entrance QR.</li>
          <li>Payment is completed only after they enter their PIN on their phone.</li>
        </ul>
      </div>
      <CustomerSearch selected={selected} onSelect={setSelected} hint="Look up the shopper, then choose the next step." />
      {selected && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="font-display text-lg font-bold">{selected.full_name}</div>
          <p className="text-sm text-slate-500">{selected.email} · {selected.phone || 'No phone'}</p>
          <p className="mt-2 text-sm">
            Card {selected.customer_cards?.[0]?.card_uid || 'not issued'} · Balance{' '}
            {formatRwf(selected.customer_cards?.[0]?.balance || 0)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/cashier/sell-card" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Sell / replace card
            </Link>
            <Link to="/cashier/deposits" className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
              Add money
            </Link>
            <Link to="/cashier/rfid" className="rounded-xl border px-4 py-2 text-sm font-semibold">
              Read RFID
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function CashierRfid() {
  const { socket } = useAuth();
  const [uid, setUid] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;

    const handleCardRead = (payload) => {
      const cardUid = payload?.cardUid || payload?.card?.cardUid;
      if (!cardUid) return;
      setUid(cardUid);
      setError('');
      setWaiting(false);
      setData({
        customer: payload.customer || null,
        card: {
          cardUid,
          balance: payload.cardBalance ?? payload.card?.balance ?? 0,
          status: payload.status || payload.card?.status || 'ACTIVE',
        },
        activeSession: payload.activeSession || null,
        amountDue: payload.amountDue || 0,
        authorizationId: payload.authorizationId || null,
      });
    };

    socket.on('rfid:card-read', handleCardRead);
    return () => socket.off('rfid:card-read', handleCardRead);
  }, [socket]);

  const startTapRead = () => {
    setError('');
    setData(null);
    setWaiting(true);
    setUid('');
  };

  const lookupManual = async (e) => {
    e?.preventDefault();
    if (!uid.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.post('/rfid/read-staff', { cardUid: uid.trim() });
      const payload = res.data;
      setData({
        customer: payload.customer || null,
        card: {
          cardUid: payload.card?.cardUid || uid,
          balance: payload.cardBalance ?? payload.card?.balance ?? 0,
          status: payload.card?.status || 'ACTIVE',
        },
        activeSession: payload.activeSession || null,
        amountDue: payload.amountDue || 0,
        authorizationId: payload.authorizationId || null,
      });
      setWaiting(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Card lookup failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-display text-xl font-bold">RFID card lookup</h3>
        <p className="mt-1 text-sm text-slate-500">
          Tap a card on the SMARTSCAN reader — this page updates live. You can also type a UID and look it up.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <button
          type="button"
          onClick={startTapRead}
          className="w-full rounded-xl bg-slate-900 py-2.5 font-semibold text-white disabled:opacity-60"
          disabled={waiting}
        >
          {waiting ? 'Listening for card tap…' : 'Start listening for tap'}
        </button>
        <form onSubmit={lookupManual} className="flex gap-2">
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="Or type card UID"
            className="w-full rounded-xl border px-3 py-2"
          />
          <button type="submit" disabled={loading} className="rounded-xl bg-teal-600 px-4 py-2 font-semibold text-white">
            {loading ? '…' : 'Lookup'}
          </button>
        </form>
      </div>

      {waiting && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Tap a card now</div>
          <div className="mt-1">Keep this page open. When the ESP reader sends the UID over MQTT, customer details appear here.</div>
          {uid && <div className="mt-2 rounded-xl bg-white px-3 py-2 font-mono text-xs">Current card ID: {uid}</div>}
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-2 text-sm">
          <div className="font-display text-xl font-bold">CARD DETECTED</div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs">Card ID: {data.card?.cardUid || uid}</div>
          <div>Customer: {data.customer?.full_name || 'Customer record loaded'}</div>
          <div>Card balance: {formatRwf(data.card?.balance)}</div>
          <div>Active session: {data.activeSession?.session_code || 'None'}</div>
          <div>Amount due: {formatRwf(data.amountDue)}</div>
          <div>Status: {data.card?.status || 'ACTIVE'}</div>
          <p className="pt-2 text-xs text-amber-700">
            Money is deducted only after the customer enters their approved payment PIN on their phone.
          </p>
        </div>
      )}
    </div>
  );
}
