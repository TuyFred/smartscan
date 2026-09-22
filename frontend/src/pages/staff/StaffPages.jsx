import { useEffect, useMemo, useState } from 'react';
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
  Scale,
  Search,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Modal, Pagination, pickCard, usePagination, useToast } from '../../lib/ui';
import { ReportWorkspace } from '../shared/ReportWorkspace';

export {
  CashierShell,
  CashierDashboard,
  CashierSellCard,
  CashierDeposits,
  CashierCustomers,
  CashierHelp,
  CashierRfid,
} from './CashierPages';

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
  const { socket } = useAuth();

  const loadDashboard = () => {
    api.get('/admin/stats').then((r) => setStats(r.data.data)).catch(() => {});
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

  const statusCards = [
    { label: 'Active sessions', value: stats?.activeSessions || 0, tone: 'border-sky-200 bg-sky-50 text-sky-900' },
    { label: 'Products', value: stats?.products || 0, tone: 'border-teal-200 bg-teal-50 text-teal-900' },
    { label: 'Store customers', value: stats?.customers || 0, tone: 'border-indigo-200 bg-indigo-50 text-indigo-900' },
    { label: 'Sales total', value: formatRwf(stats?.salesTotal || 0), tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Payments', value: stats?.paymentsCount || 0, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900 p-5 text-white sm:p-6">
        <h2 className="font-display text-2xl font-bold">Store status</h2>
        <p className="mt-1 text-sm text-slate-300">Live supermarket counts only. Full reports are in Reports.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statusCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-4 shadow-sm ${card.tone}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</div>
            <div className="mt-1 font-display text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>
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

function SessionsTable({ rows, paginate = false }) {
  const { page, setPage, pages, total, slice } = usePagination(rows || []);
  const display = paginate ? slice : rows || [];

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b px-4 py-3 font-semibold">Active shopping sessions</div>
      <div className="table-wrap">
        <table className="ss-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Customer</th>
              <th>Branch</th>
              <th className="center">Items</th>
              <th className="center">Total</th>
              <th className="center">Status</th>
            </tr>
          </thead>
          <tbody>
            {display.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link className="font-medium text-teal-700" to={`/manager/sessions/${s.id}`}>
                    {s.session_code}
                  </Link>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {s.users?.profile_image ? (
                      <img src={s.users.profile_image} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="ss-avatar">{s.users?.full_name?.[0] || '?'}</span>
                    )}
                    {s.users?.full_name}
                  </div>
                </td>
                <td>{s.branches?.name}</td>
                <td className="center">{s.cart_items?.length || 0}</td>
                <td className="center font-semibold">{formatRwf(s.total_amount)}</td>
                <td className="center">{s.status}</td>
              </tr>
            ))}
            {!display.length && (
              <tr>
                <td colSpan={6} className="center text-slate-400">
                  No active sessions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paginate && <Pagination page={page} pages={pages} total={total} onChange={setPage} label="sessions" />}
    </div>
  );
}

export function ManagerSessions() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/sessions').then((r) => setRows(r.data.data || []));
  }, []);
  return <SessionsTable rows={rows} paginate />;
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
          <div className="mt-2 text-sm">
            Status: {session.status} · Payment: {session.payment_status}
          </div>
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
                <td className="px-4 py-3">
                  {i.weight}
                  {i.unit}
                </td>
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

const emptyProductForm = {
  name: '',
  price: '',
  weight: '',
  unit: 'kg',
  quantityAvailable: '50',
  category: 'Grocery',
  description: '',
};

export function ManagerProducts() {
  const { user } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyProductForm);
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);
  const { page, setPage, pages, total, slice } = usePagination(products);

  const load = () => api.get('/products').then((r) => setProducts(r.data.data || []));
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/products', {
        ...form,
        weight: Number(form.weight || 0),
        supermarketId: user.supermarketId,
      });
      setQr(data.data);
      setForm(emptyProductForm);
      setFormOpen(false);
      toast.success(`Product “${data.data?.product?.name || form.name}” created`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create product');
    } finally {
      setLoading(false);
    }
  };

  const showQr = async (id) => {
    try {
      const { data } = await api.get(`/products/${id}/qrcode`);
      setQr(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load QR');
    }
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
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-6 w-6 text-teal-600" />
          <div>
            <h2 className="font-display text-xl font-bold">Products</h2>
            <p className="mt-1 text-sm text-slate-500">Manage stock and product QR labels.</p>
          </div>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="ss-btn ss-btn-primary">
          + Add product
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">Product list</div>
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="center">Weight</th>
                <th className="center">Price</th>
                <th className="center">Stock</th>
                <th className="center">QR</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.product_code}</div>
                  </td>
                  <td className="center">
                    {p.weight} {p.unit}
                  </td>
                  <td className="center">{formatRwf(p.price)}</td>
                  <td className="center">{p.quantity_available}</td>
                  <td className="center">
                    <button type="button" className="ss-btn ss-btn-ghost" onClick={() => showQr(p.id)}>
                      <QrCode className="h-4 w-4" /> View QR
                    </button>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td colSpan={5} className="center text-slate-400">
                    No products yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={setPage} label="products" />
      </div>

      <Modal open={formOpen} title="Add product" onClose={() => setFormOpen(false)} wide>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Product name
            <input
              required
              className="field-input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sugar"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Category
            <input
              className="field-input mt-1"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Price (RWF)
            <input
              required
              type="number"
              min="0"
              step="1"
              className="field-input mt-1"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="1500"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Weight
            <input
              required
              type="number"
              min="0"
              step="0.001"
              className="field-input mt-1"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="1"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Unit
            <select
              className="field-input mt-1"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Quantity available
            <input
              type="number"
              min="0"
              className="field-input mt-1"
              value={form.quantityAvailable}
              onChange={(e) => setForm({ ...form, quantityAvailable: e.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Description
            <input
              className="field-input mt-1"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="ss-btn ss-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="ss-btn ss-btn-primary disabled:opacity-60">
              {loading ? 'Creating…' : 'Create product'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(qr)} title="Product QR" onClose={() => setQr(null)}>
        {qr && (
          <div className="space-y-4">
            <div>
              <h4 className="font-display text-lg font-bold">{qr.product?.name}</h4>
              <p className="text-sm text-slate-600">
                Weight: {qr.product?.weight} {qr.product?.unit} · Price: {formatRwf(qr.product?.price)}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">{qr.qrPayload}</p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
              <img
                src={qr.qrDataUrl}
                alt="Product QR"
                className="h-48 w-48 rounded-2xl border border-slate-200 bg-white p-3"
              />
              <button type="button" onClick={downloadQr} className="ss-btn ss-btn-dark">
                <Download className="h-4 w-4" /> Download PNG
              </button>
            </div>
          </div>
        )}
      </Modal>
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
    return () => {
      cancelled = true;
    };
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((u) => {
      const card = pickCard(u);
      const blob = `${u.full_name || ''} ${u.email || ''} ${u.phone || ''} ${card?.card_uid || ''}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, needle]);

  const { page, setPage, pages, total, slice } = usePagination(filtered);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Store customers</h2>
            <p className="text-sm text-slate-500">Shoppers who bought in your supermarket. Live filter as you type.</p>
          </div>
          <div className="ss-search max-w-md">
            <Search className="ss-search-icon h-4 w-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter name, email, phone, UID…"
            />
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
              {loading && (
                <tr>
                  <td colSpan={6} className="center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                slice.map((u) => {
                  const card = pickCard(u);
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
                            <div>
                              <span className="ss-badge ss-badge-ok">Has card</span>
                            </div>
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
              {!loading && !slice.length && (
                <tr>
                  <td colSpan={6} className="center text-slate-400">
                    No customers match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={setPage} label="customers" />
      </div>
    </div>
  );
}

export function ManagerPayments() {
  const [rows, setRows] = useState([]);
  const { page, setPage, pages, total, slice } = usePagination(rows);

  useEffect(() => {
    api.get('/payments').then((r) => setRows(r.data.data || []));
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="table-wrap">
        <table className="ss-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th className="center">Customer</th>
              <th className="center">Amount</th>
              <th className="center">When</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.payment_code}</td>
                <td className="center">{p.users?.full_name}</td>
                <td className="center font-semibold">{formatRwf(p.amount)}</td>
                <td className="center">{new Date(p.paid_at).toLocaleString()}</td>
              </tr>
            ))}
            {!slice.length && (
              <tr>
                <td colSpan={4} className="center text-slate-400">
                  No payments yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} onChange={setPage} label="payments" />
    </div>
  );
}

const emptyMarketForm = { name: '', description: '', address: '', branchName: '' };

export function ManagerSupermarket() {
  const toast = useToast();
  const [markets, setMarkets] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyMarketForm);
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const { page, setPage, pages, total, slice } = usePagination(markets);

  const load = () => api.get('/supermarkets').then((r) => setMarkets(r.data.data || []));
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/supermarkets', form);
      setCreated(data.data);
      if (data.data?.token) {
        localStorage.setItem('smartscan_token', data.data.token);
      }
      setForm(emptyMarketForm);
      setFormOpen(false);
      toast.success(`Supermarket “${data.data?.supermarket?.name || form.name}” created`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create supermarket');
    } finally {
      setLoading(false);
    }
  };

  const showBranchQr = async (branchId) => {
    try {
      const { data } = await api.get(`/supermarkets/branches/${branchId}/qrcode`);
      setCreated({
        supermarket: { name: data.data.branch?.supermarkets?.name },
        branch: data.data.branch,
        branchQr: data.data.qrDataUrl,
        qrPayload: data.data.qrPayload,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load QR');
    }
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
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">My supermarket</h2>
          <p className="mt-1 text-sm text-slate-500">Branches and entrance QR codes.</p>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="ss-btn ss-btn-primary">
          + Create supermarket
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">Your markets</div>
        <div className="divide-y divide-slate-100">
          {slice.map((m) => (
            <div key={m.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display text-lg font-bold">{m.name}</div>
                    <div className="text-sm text-slate-500">{m.address || 'No address'}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">Status: {m.status}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Branches</p>
                {(m.branches || []).map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      <span className="font-medium">{b.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{b.code}</span>
                    </span>
                    <button type="button" onClick={() => showBranchQr(b.id)} className="ss-btn ss-btn-ghost">
                      <QrCode className="h-4 w-4" /> View QR
                    </button>
                  </div>
                ))}
                {!m.branches?.length && <p className="text-sm text-slate-400">No branches yet</p>}
              </div>
            </div>
          ))}
          {!markets.length && (
            <div className="p-8 text-center text-slate-400">No supermarket yet. Create one to get an entrance QR.</div>
          )}
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={setPage} label="markets" />
      </div>

      <Modal open={formOpen} title="Create supermarket" onClose={() => setFormOpen(false)} wide>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Supermarket name
            <input
              required
              className="field-input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ABC Supermarket"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Main branch name
            <input
              className="field-input mt-1"
              value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              placeholder="Kigali Main Branch"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Address
            <input
              className="field-input mt-1"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Description
            <textarea
              className="field-input mt-1"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="ss-btn ss-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="ss-btn ss-btn-primary disabled:opacity-60">
              {loading ? 'Creating…' : 'Create supermarket'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(created?.branchQr)} title="Branch entrance QR" onClose={() => setCreated(null)}>
        {created?.branchQr && (
          <div className="space-y-4">
            <div>
              <h4 className="font-display text-lg font-bold">
                {created.supermarket?.name || 'Supermarket'} · {created.branch?.name}
              </h4>
              <p className="text-sm text-slate-600">Place this QR at the branch entrance.</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">{created.qrPayload}</p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
              <img
                src={created.branchQr}
                alt="Branch QR"
                className="h-52 w-52 rounded-2xl border border-slate-200 bg-white p-3"
              />
              <button type="button" onClick={downloadQr} className="ss-btn ss-btn-dark">
                <Download className="h-4 w-4" /> Download PNG
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ManagerReports() {
  return <ReportWorkspace roleLabel="Manager" />;
}
