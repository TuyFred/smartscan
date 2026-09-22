import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingBag,
  CreditCard,
  Receipt,
  RadioTower,
  FileText,
  Settings,
  Search,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Modal, Pagination, usePagination, useToast } from '../../lib/ui';
import { ManagerProducts, ManagerSupermarket } from '../staff/StaffPages';

const links = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/admin/users', label: 'Users / Approvals', icon: <Users className="h-4 w-4" /> },
  { to: '/admin/pin-requests', label: 'PIN Approvals', icon: <CreditCard className="h-4 w-4" /> },
  { to: '/admin/supermarkets', label: 'Supermarkets', icon: <Store className="h-4 w-4" /> },
  { to: '/admin/products', label: 'Products', icon: <Package className="h-4 w-4" /> },
  { to: '/admin/sessions', label: 'Sessions', icon: <ShoppingBag className="h-4 w-4" /> },
  { to: '/admin/payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
  { to: '/admin/receipts', label: 'Receipts', icon: <Receipt className="h-4 w-4" /> },
  { to: '/admin/devices', label: 'Exit Devices', icon: <RadioTower className="h-4 w-4" /> },
  { to: '/admin/audit', label: 'Audit Logs', icon: <FileText className="h-4 w-4" /> },
  { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

export function AdminShell() {
  return <DashboardLayout title="Admin" links={links} />;
}

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const { socket } = useAuth();

  const loadStats = () => {
    api.get('/admin/stats').then((r) => setStats(r.data.data)).catch(() => {});
  };

  const exportPdfReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('SMARTSCAN Admin Report', 14, 18);
    doc.setFontSize(11);
    const rows = [
      ['Users', String(stats?.users ?? 0)],
      ['Pending approvals', String(stats?.pendingApprovals ?? 0)],
      ['Pending PIN approvals', String(stats?.pendingPinApprovals ?? 0)],
      ['Supermarkets', String(stats?.supermarkets ?? 0)],
      ['Products', String(stats?.products ?? 0)],
      ['Sessions', String(stats?.shopping_sessions ?? 0)],
      ['Payments', String(stats?.payments ?? 0)],
    ];
    rows.forEach(([label, value], index) => {
      doc.text(`${label}: ${value}`, 14, 38 + index * 8);
    });
    doc.save('smartscan-admin-report.pdf');
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const handlers = ['payment:success', 'session:paid', 'card:updated'];
    const onRefresh = () => loadStats();
    handlers.forEach((eventName) => socket.on(eventName, onRefresh));
    return () => {
      handlers.forEach((eventName) => socket.off(eventName, onRefresh));
    };
  }, [socket]);

  const cards = [
    { label: 'Users', value: stats?.users, to: '/admin/users', tone: 'bg-sky-600' },
    { label: 'Pending approvals', value: stats?.pendingApprovals, to: '/admin/users', tone: 'bg-amber-500' },
    { label: 'Pending PIN approvals', value: stats?.pendingPinApprovals, to: '/admin/pin-requests', tone: 'bg-orange-600' },
    { label: 'Supermarkets', value: stats?.supermarkets, to: '/admin/supermarkets', tone: 'bg-teal-600' },
    { label: 'Products', value: stats?.products, to: '/admin/products', tone: 'bg-indigo-600' },
    { label: 'Sessions', value: stats?.shopping_sessions, to: '/admin/sessions', tone: 'bg-slate-800' },
    { label: 'Payments', value: stats?.payments, to: '/admin/payments', tone: 'bg-emerald-600' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-900 p-5 text-white">
        <div>
          <h2 className="font-display text-2xl font-bold">Admin management</h2>
          <p className="mt-1 text-sm text-slate-300">Color-coded actions — click any card to open that workspace.</p>
        </div>
        <button type="button" onClick={exportPdfReport} className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-100">
          Export PDF report
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className={`rounded-2xl p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
          >
            <div className="text-xs uppercase tracking-wide text-white/80">{card.label}</div>
            <div className="mt-1 font-display text-3xl font-bold">{card.value ?? '—'}</div>
            <div className="mt-3 text-xs font-bold uppercase tracking-wide text-white/90">Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const emptyUserForm = {
  fullName: '',
  email: '',
  phone: '',
  password: 'Password123!',
  role: 'CASHIER',
  supermarketId: '',
};

export function AdminUsers() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyUserForm);

  const load = () => api.get('/admin/users').then((r) => setRows(r.data.data || []));
  useEffect(() => {
    load();
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = !needle
    ? rows
    : rows.filter((u) =>
        `${u.full_name || ''} ${u.email || ''} ${u.phone || ''} ${u.role || ''} ${u.account_status || ''}`
          .toLowerCase()
          .includes(needle)
      );

  const { page, setPage, pages, total, slice } = usePagination(filtered);
  const needsMarket = form.role === 'MANAGER' || form.role === 'CASHIER';

  const statusBadge = (status) => {
    if (status === 'APPROVED') return 'ss-badge-ok';
    if (status === 'PENDING') return 'ss-badge-warn';
    if (status === 'SUSPENDED' || status === 'REJECTED') return 'ss-badge-danger';
    return 'ss-badge-muted';
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      toast.success(`User ${status.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyUserForm);
    setOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      fullName: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: user.role || 'CASHIER',
      supermarketId: user.supermarket_id || '',
    });
    setOpen(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        role: form.role,
        supermarketId: needsMarket ? form.supermarketId || undefined : undefined,
      };
      if (!editingUser && form.password) payload.password = form.password;
      if (editingUser) {
        await api.patch(`/admin/users/${editingUser.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/admin/staff', {
          ...payload,
          password: form.password,
        });
        toast.success('User created');
      }
      setOpen(false);
      setForm(emptyUserForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save user');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('User deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete user');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">User management</h2>
          <p className="text-sm text-slate-500">Create, edit, approve, and manage accounts. Search updates live.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="ss-search min-w-[16rem]">
            <Search className="ss-search-icon h-4 w-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" />
          </div>
          <button type="button" onClick={openCreate} className="ss-btn ss-btn-primary">
            + Add user
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
          Showing <strong className="text-slate-800">{filtered.length}</strong> of {rows.length} users
          {q ? <> for “{q}”</> : null}
        </div>
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>User</th>
                <th className="center">Role</th>
                <th className="center">Verified</th>
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="ss-avatar">{(u.full_name || '?')[0]}</span>
                      <div>
                        <div className="font-semibold">{u.full_name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                        <div className="text-xs text-slate-400">{u.phone || 'No phone'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="center">
                    <span className="ss-badge ss-badge-info">{u.role}</span>
                  </td>
                  <td className="center">
                    <span className={`ss-badge ${u.email_verified ? 'ss-badge-ok' : 'ss-badge-warn'}`}>
                      {u.email_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  <td className="center">
                    <span className={`ss-badge ${statusBadge(u.account_status)}`}>{u.account_status}</span>
                  </td>
                  <td className="center">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button type="button" className="ss-btn ss-btn-ghost" onClick={() => openEdit(u)}>
                        Edit
                      </button>
                      <button type="button" className="ss-btn ss-btn-primary" onClick={() => setStatus(u.id, 'APPROVED')}>
                        Approve
                      </button>
                      <button type="button" className="ss-btn ss-btn-ghost" onClick={() => setStatus(u.id, 'SUSPENDED')}>
                        Suspend
                      </button>
                      <button type="button" className="ss-btn ss-btn-ghost" onClick={() => setStatus(u.id, 'REJECTED')}>
                        Reject
                      </button>
                      <button type="button" className="ss-btn ss-btn-dark" onClick={() => deleteUser(u.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!slice.length && (
                <tr>
                  <td colSpan={5} className="center text-slate-400">
                    No users match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={setPage} label="users" />
      </div>

      <Modal open={open} title={editingUser ? 'Edit user' : 'Add new user'} onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={saveUser}>
          <label className="block text-sm font-medium text-slate-700">
            Full name
            <input
              required
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              className="field-input mt-1"
              placeholder="John Doe"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              required
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="field-input mt-1"
              placeholder="user@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="field-input mt-1"
              placeholder="0788 000 000"
            />
          </label>
          {!editingUser && (
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                required
                type="text"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="field-input mt-1"
                placeholder="Password123!"
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Role
            <select name="role" value={form.role} onChange={handleChange} className="field-input mt-1">
              <option value="CASHIER">Cashier</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          {needsMarket && (
            <label className="block text-sm font-medium text-slate-700">
              Supermarket ID
              <input
                name="supermarketId"
                value={form.supermarketId}
                onChange={handleChange}
                className="field-input mt-1"
                placeholder="UUID"
              />
            </label>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className="ss-btn ss-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="ss-btn ss-btn-dark disabled:opacity-60">
              {saving ? 'Saving…' : editingUser ? 'Update user' : 'Create user'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function AdminPinRequests() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const load = () =>
    api.get('/admin/pin-requests?status=PENDING_APPROVAL').then((r) => setRows(r.data.data || []));
  useEffect(() => {
    load();
  }, []);

  const review = async (id, decision) => {
    setMsg('');
    try {
      const { data } = await api.patch(`/admin/pin-requests/${id}`, { decision });
      setMsg(data.message);
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Review failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold">Payment PIN approvals</h2>
        <p className="mt-1 text-sm text-slate-500">
          Customers create or reset a PIN, verify email OTP, then you approve before the PIN can authorize payments.
        </p>
        {msg && <p className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</p>}
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">OTP verified</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.users?.full_name}</div>
                  <div className="text-xs text-slate-400">{r.users?.email}</div>
                </td>
                <td className="px-4 py-3 text-center">{r.request_type}</td>
                <td className="px-4 py-3 text-center">
                  {r.otp_verified_at ? new Date(r.otp_verified_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-center">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500" onClick={() => review(r.id, 'APPROVED')}>
                      Approve PIN
                    </button>
                    <button type="button" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500" onClick={() => review(r.id, 'REJECTED')}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No PIN requests waiting for approval
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSupermarkets() {
  return <ManagerSupermarket />;
}

export function AdminProducts() {
  return <ManagerProducts />;
}

export function AdminSessions() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/sessions').then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Session</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-3 font-medium">{s.session_code}</td>
              <td className="px-4 py-3 text-center">{s.users?.full_name}</td>
              <td className="px-4 py-3 text-center">{formatRwf(s.total_amount)}</td>
              <td className="px-4 py-3 text-center">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPayments() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/payments').then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Code</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-4 py-3">{p.payment_code}</td>
              <td className="px-4 py-3 text-center">{formatRwf(p.amount)}</td>
              <td className="px-4 py-3 text-center">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminReceipts() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/receipts').then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Receipt</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-4 py-3">{r.receipt_number}</td>
              <td className="px-4 py-3 text-center">{formatRwf(r.total_amount)}</td>
              <td className="px-4 py-3 text-center">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDevices() {
  const [form, setForm] = useState({ name: '', type: 'EXIT_SCANNER' });
  const [created, setCreated] = useState(null);
  const [devices, setDevices] = useState([]);
  const [systemStatus, setSystemStatus] = useState('checking');

  const load = async () => {
    const [deviceRes, healthRes] = await Promise.all([
      api.get('/admin/devices'),
      api.get('/health'),
    ]);
    setDevices(deviceRes.data.data || []);
    setSystemStatus(healthRes?.data?.success ? 'online' : 'offline');
  };

  useEffect(() => {
    load().catch(() => setSystemStatus('offline'));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const { data } = await api.post('/admin/devices', form);
    setCreated(data.data);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Device health</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${systemStatus === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {systemStatus === 'online' ? 'System online' : systemStatus === 'checking' ? 'Checking...' : 'Offline'}
          </span>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm space-y-3 max-w-lg">
        <h3 className="font-semibold">Register IoT device</h3>
        <input className="w-full rounded-xl border px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="w-full rounded-xl border px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="EXIT_SCANNER">Exit scanner</option>
          <option value="RFID_READER">RFID reader</option>
        </select>
        <button className="rounded-xl bg-teal-600 px-4 py-2 font-semibold text-white">Create</button>
      </form>

      {created && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm">
          Device {created.device_code} · API key: <code>{created.api_key}</code>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Registered devices</h3>
        <div className="mt-3 space-y-3">
          {devices.map((device) => (
            <div key={device.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{device.name}</div>
                  <div className="text-xs text-slate-500">{device.device_code} · {device.type}</div>
                </div>
                <span className={device.connected ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700' : 'rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700'}>
                  {device.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never'}
              </div>
              <div className="mt-1 text-xs text-slate-500">API key: <code>{device.api_key}</code></div>
            </div>
          ))}
          {!devices.length && <p className="text-sm text-slate-500">No devices registered yet.</p>}
        </div>
      </div>
    </div>
  );
}

export function AdminAudit() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/admin/audit-logs').then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Action</th>
            <th className="px-4 py-3">Entity</th>
            <th className="px-4 py-3">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-4 py-3">{r.action}</td>
              <td className="px-4 py-3 text-center">{r.entity_type}</td>
              <td className="px-4 py-3 text-center">{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSettings() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="font-display text-xl font-bold">Platform settings</h3>
      <p className="mt-2 text-sm text-slate-500">Configure Supabase, SMTP, and IoT keys in backend `.env`.</p>
    </div>
  );
}
