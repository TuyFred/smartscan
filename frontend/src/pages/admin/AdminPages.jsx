import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';
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
    ['Users', stats?.users],
    ['Pending approvals', stats?.pendingApprovals],
    ['Pending PIN approvals', stats?.pendingPinApprovals],
    ['Supermarkets', stats?.supermarkets],
    ['Products', stats?.products],
    ['Sessions', stats?.shopping_sessions],
    ['Payments', stats?.payments],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="text-xs uppercase text-slate-400">{label}</div>
          <div className="mt-1 font-display text-3xl font-bold">{value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

export function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: 'Password123!',
    role: 'CASHIER',
    supermarketId: '',
    branchId: '',
  });

  const load = () => api.get('/admin/users').then((r) => setRows(r.data.data || []));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await api.patch(`/admin/users/${id}/status`, { status });
    load();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
        supermarketId: form.supermarketId || undefined,
        branchId: form.branchId || undefined,
      };
      await api.post('/admin/staff', payload);
      setOpen(false);
      setForm({
        fullName: '',
        email: '',
        phone: '',
        password: 'Password123!',
        role: 'CASHIER',
        supermarketId: '',
        branchId: '',
      });
      setMessage('User created successfully');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="font-display text-xl font-bold">User management</h2>
          <p className="text-sm text-slate-500">Create staff users and approve customer accounts.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
        >
          + Add user
        </button>
      </div>

      {message && (
        <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-center">{u.role}</td>
                <td className="px-4 py-3 text-center">{u.email_verified ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-center">{u.account_status}</td>
                <td className="px-4 py-3 text-center space-x-2">
                  <button type="button" className="text-teal-700" onClick={() => setStatus(u.id, 'APPROVED')}>Approve</button>
                  <button type="button" className="text-amber-700" onClick={() => setStatus(u.id, 'SUSPENDED')}>Suspend</button>
                  <button type="button" className="text-red-600" onClick={() => setStatus(u.id, 'REJECTED')}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold">Add new user</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Close</button>
            </div>

            <form className="space-y-4" onSubmit={createUser}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium md:col-span-2">
                  Full name
                  <input
                    required
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    placeholder="John Doe"
                  />
                </label>

                <label className="block text-sm font-medium md:col-span-2">
                  Email
                  <input
                    required
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    placeholder="user@example.com"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Phone
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    placeholder="0788 000 000"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Role
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  >
                    <option value="CASHIER">Cashier</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>

                <label className="block text-sm font-medium md:col-span-2">
                  Password
                  <input
                    required
                    type="text"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Supermarket ID (optional)
                  <input
                    name="supermarketId"
                    value={form.supermarketId}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    placeholder="UUID if needed"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Branch ID (optional)
                  <input
                    name="branchId"
                    value={form.branchId}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    placeholder="UUID if needed"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60">
                  {saving ? 'Creating...' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
                <td className="px-4 py-3 text-center space-x-3">
                  <button type="button" className="font-semibold text-teal-700" onClick={() => review(r.id, 'APPROVED')}>
                    Approve
                  </button>
                  <button type="button" className="font-semibold text-red-600" onClick={() => review(r.id, 'REJECTED')}>
                    Reject
                  </button>
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
