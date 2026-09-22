import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  QrCode,
  Download,
  KeyRound,
  Building2,
  Pencil,
  Trash2,
  Pause,
  Play,
  CheckCircle2,
  Ban,
  Scale,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Modal, Pagination, usePagination, useToast } from '../../lib/ui';
import { ReportWorkspace } from '../shared/ReportWorkspace';

const links = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/admin/reports', label: 'System Reports', icon: <FileText className="h-4 w-4" /> },
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

  const statusCards = [
    { label: 'Users', value: stats?.users, tone: 'border-sky-200 bg-sky-50 text-sky-900' },
    { label: 'Pending approvals', value: stats?.pendingApprovals, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Pending PIN', value: stats?.pendingPinApprovals, tone: 'border-orange-200 bg-orange-50 text-orange-900' },
    { label: 'Supermarkets', value: stats?.supermarkets, tone: 'border-teal-200 bg-teal-50 text-teal-900' },
    { label: 'Products', value: stats?.products, tone: 'border-indigo-200 bg-indigo-50 text-indigo-900' },
    { label: 'Sessions', value: stats?.shopping_sessions, tone: 'border-slate-200 bg-slate-50 text-slate-900' },
    { label: 'Payments', value: stats?.payments, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Receipts', value: stats?.receipts, tone: 'border-cyan-200 bg-cyan-50 text-cyan-900' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900 p-5 text-white sm:p-6">
        <h2 className="font-display text-2xl font-bold">System status</h2>
        <p className="mt-1 text-sm text-slate-300">Live platform counts. Full reports are in System Reports.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statusCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-4 shadow-sm ${card.tone}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</div>
            <div className="mt-1 font-display text-3xl font-bold">{card.value ?? '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminReports() {
  return <ReportWorkspace roleLabel="Admin" />;
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
                    <div className="ss-actions">
                      <button
                        type="button"
                        title="Edit"
                        aria-label="Edit"
                        className="ss-icon-btn ss-icon-edit"
                        onClick={() => openEdit(u)}
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        title="Approve / Activate"
                        aria-label="Approve"
                        className="ss-icon-btn ss-icon-ok"
                        onClick={() => setStatus(u.id, 'APPROVED')}
                      >
                        <CheckCircle2 />
                      </button>
                      {u.account_status === 'SUSPENDED' ? (
                        <button
                          type="button"
                          title="Unsuspend"
                          aria-label="Unsuspend"
                          className="ss-icon-btn ss-icon-play"
                          onClick={() => setStatus(u.id, 'APPROVED')}
                        >
                          <Play />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Suspend"
                          aria-label="Suspend"
                          className="ss-icon-btn ss-icon-pause"
                          onClick={() => setStatus(u.id, 'SUSPENDED')}
                        >
                          <Pause />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Reject"
                        aria-label="Reject"
                        className="ss-icon-btn ss-icon-muted"
                        onClick={() => setStatus(u.id, 'REJECTED')}
                      >
                        <Ban />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        aria-label="Delete"
                        className="ss-icon-btn ss-icon-danger"
                        onClick={() => deleteUser(u.id)}
                      >
                        <Trash2 />
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
  const toast = useToast();
  const [markets, setMarkets] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [createdManager, setCreatedManager] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    branchName: '',
    managerFullName: '',
    managerEmail: '',
    managerPassword: '',
    managerPhone: '',
  });
  const { page, setPage, pages, total, slice } = usePagination(markets);

  const load = () => api.get('/supermarkets').then((r) => setMarkets(r.data.data || [])).catch(() => setMarkets([]));
  useEffect(() => {
    load();
  }, []);

  const resetForm = () =>
    setForm({
      name: '',
      description: '',
      address: '',
      phone: '',
      branchName: '',
      managerFullName: '',
      managerEmail: '',
      managerPassword: '',
      managerPhone: '',
    });

  const create = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/supermarkets', form);
      setCreatedManager({
        ...data.data?.manager,
        supermarketName: data.data?.supermarket?.name,
        loginHint: data.message,
      });
      if (data.data?.branchQr) {
        setQrModal({
          supermarket: data.data.supermarket,
          branch: data.data.branch,
          branchQr: data.data.branchQr,
          qrPayload: data.data.qrPayload,
        });
      }
      resetForm();
      setFormOpen(false);
      toast.success(data.message || 'Supermarket created');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create supermarket');
    } finally {
      setLoading(false);
    }
  };

  const showBranchQr = async (branchId, marketName) => {
    try {
      const { data } = await api.get(`/supermarkets/branches/${branchId}/qrcode`);
      setQrModal({
        supermarket: { name: marketName || data.data.branch?.supermarkets?.name },
        branch: data.data.branch,
        branchQr: data.data.qrDataUrl,
        qrPayload: data.data.qrPayload,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load QR');
    }
  };

  const downloadQr = () => {
    if (!qrModal?.branchQr) return;
    const a = document.createElement('a');
    a.href = qrModal.branchQr;
    a.download = `${qrModal.branch?.code || 'branch'}-qr.png`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-900 p-6 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-200">
              <Building2 className="h-3.5 w-3.5" /> Platform administration
            </div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Supermarkets</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Create a store and issue a manager login in one step. The manager uses their email and password to sign in and run that supermarket only.
            </p>
          </div>
          <button type="button" onClick={() => setFormOpen(true)} className="ss-btn ss-btn-primary shrink-0">
            + Create supermarket
          </button>
        </div>
      </div>

      {createdManager?.email && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-900">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <div className="font-semibold">Manager account ready</div>
              <p className="mt-1">
                <strong>{createdManager.fullName}</strong> can log in at the SMARTSCAN login page with{' '}
                <span className="font-mono">{createdManager.email}</span>
                {createdManager.supermarketName ? (
                  <>
                    {' '}
                    to manage <strong>{createdManager.supermarketName}</strong>
                  </>
                ) : null}
                .
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">All registered supermarkets</div>
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Supermarket</th>
                <th>Manager login</th>
                <th>Branches</th>
                <th className="center">Status</th>
                <th className="center">Entrance QR</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.address || 'No address'}</div>
                    {m.phone && <div className="text-xs text-slate-400">{m.phone}</div>}
                  </td>
                  <td>
                    {m.manager ? (
                      <div>
                        <div className="font-medium">{m.manager.full_name}</div>
                        <div className="font-mono text-xs text-teal-700">{m.manager.email}</div>
                        {m.manager.phone && <div className="text-xs text-slate-400">{m.manager.phone}</div>}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td>
                    <div className="space-y-1">
                      {(m.branches || []).map((b) => (
                        <div key={b.id} className="text-sm">
                          <span className="font-medium">{b.name}</span>
                          <span className="ml-2 text-xs text-slate-400">{b.code}</span>
                        </div>
                      ))}
                      {!m.branches?.length && <span className="text-slate-400">None</span>}
                    </div>
                  </td>
                  <td className="center">
                    <span className={`ss-badge ${m.status === 'ACTIVE' ? 'ss-badge-ok' : 'ss-badge-warn'}`}>{m.status}</span>
                  </td>
                  <td className="center">
                    {(m.branches || []).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="ss-btn ss-btn-ghost"
                        onClick={() => showBranchQr(b.id, m.name)}
                      >
                        <QrCode className="h-4 w-4" /> QR
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
              {!markets.length && (
                <tr>
                  <td colSpan={5} className="center text-slate-400">
                    No supermarkets yet. Create one and assign a manager login.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={setPage} label="supermarkets" />
      </div>

      <Modal open={formOpen} title="Create supermarket + manager" onClose={() => setFormOpen(false)} wide>
        <form onSubmit={create} className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Store details</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
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
              <label className="text-sm font-medium text-slate-700">
                Store phone
                <input
                  className="field-input mt-1"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+250 7…"
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
            </div>
          </div>

          <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
              <KeyRound className="h-4 w-4" /> Manager login (required)
            </div>
            <p className="mt-1 text-xs text-teal-800/80">
              This account will sign in as MANAGER and only manage this supermarket.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Manager full name
                <input
                  required
                  className="field-input mt-1"
                  value={form.managerFullName}
                  onChange={(e) => setForm({ ...form, managerFullName: e.target.value })}
                  placeholder="Jane Uwase"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Manager email
                <input
                  required
                  type="email"
                  className="field-input mt-1"
                  value={form.managerEmail}
                  onChange={(e) => setForm({ ...form, managerEmail: e.target.value })}
                  placeholder="manager@store.com"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Manager password
                <input
                  required
                  type="password"
                  minLength={6}
                  className="field-input mt-1"
                  value={form.managerPassword}
                  onChange={(e) => setForm({ ...form, managerPassword: e.target.value })}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Manager phone
                <input
                  className="field-input mt-1"
                  value={form.managerPhone}
                  onChange={(e) => setForm({ ...form, managerPhone: e.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="ss-btn ss-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="ss-btn ss-btn-primary disabled:opacity-60">
              {loading ? 'Creating…' : 'Create store & manager'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(qrModal?.branchQr)} title="Branch entrance QR" onClose={() => setQrModal(null)}>
        {qrModal?.branchQr && (
          <div className="space-y-4">
            <div>
              <h4 className="font-display text-lg font-bold">
                {qrModal.supermarket?.name || 'Supermarket'} · {qrModal.branch?.name}
              </h4>
              <p className="text-sm text-slate-600">Customers must scan this QR to start shopping at this store.</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">{qrModal.qrPayload}</p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
              <img
                src={qrModal.branchQr}
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

export function AdminProducts() {
  const toast = useToast();
  const [markets, setMarkets] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterMarket, setFilterMarket] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState(null);
  const [form, setForm] = useState({
    supermarketId: '',
    name: '',
    category: 'Grocery',
    description: '',
    price: '',
    weight: '',
    unit: 'kg',
    quantityAvailable: '50',
    status: 'ACTIVE',
  });
  const { page, setPage, pages, total, slice } = usePagination(products);

  const loadMarkets = () => api.get('/supermarkets').then((r) => setMarkets(r.data.data || [])).catch(() => setMarkets([]));
  const loadProducts = () => {
    const params = filterMarket ? { supermarketId: filterMarket } : {};
    return api.get('/products', { params }).then((r) => setProducts(r.data.data || [])).catch(() => setProducts([]));
  };

  useEffect(() => {
    loadMarkets();
  }, []);
  useEffect(() => {
    loadProducts();
  }, [filterMarket]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      supermarketId: filterMarket || '',
      name: '',
      category: 'Grocery',
      description: '',
      price: '',
      weight: '',
      unit: 'kg',
      quantityAvailable: '50',
      status: 'ACTIVE',
    });
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      supermarketId: p.supermarket_id || '',
      name: p.name || '',
      category: p.category || 'Grocery',
      description: p.description || '',
      price: String(p.price ?? ''),
      weight: String(p.weight ?? ''),
      unit: p.unit || 'kg',
      quantityAvailable: String(p.quantity_available ?? 0),
      status: p.status || 'ACTIVE',
    });
    setFormOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.supermarketId) {
      toast.error('Select which supermarket this product belongs to');
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, {
          name: form.name,
          category: form.category,
          description: form.description,
          price: Number(form.price || 0),
          weight: Number(form.weight || 0),
          unit: form.unit,
          quantityAvailable: Number(form.quantityAvailable || 0),
          status: form.status,
        });
        toast.success(`“${form.name}” updated`);
      } else {
        const { data } = await api.post('/products', {
          name: form.name,
          category: form.category,
          description: form.description,
          price: Number(form.price || 0),
          weight: Number(form.weight || 0),
          unit: form.unit,
          quantityAvailable: Number(form.quantityAvailable || 0),
          supermarketId: form.supermarketId,
        });
        setQr(data.data);
        toast.success(`Product created for selected supermarket`);
      }
      setFormOpen(false);
      setEditing(null);
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save product');
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async (p) => {
    try {
      await api.delete(`/products/${p.id}`);
      toast.success(`“${p.name}” deactivated`);
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not deactivate');
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

  const marketName = (id) => markets.find((m) => m.id === id)?.name || '—';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-6 w-6 text-teal-600" />
          <div>
            <h2 className="font-display text-xl font-bold">Products</h2>
            <p className="mt-1 text-sm text-slate-500">
              Every product must belong to a supermarket. Choose the store before creating or filtering.
            </p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="ss-btn ss-btn-primary">
          + Add product
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Filter by supermarket
          <select
            className="field-input mt-1 max-w-md"
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
          >
            <option value="">All supermarkets</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Supermarket</th>
                <th className="center">Price</th>
                <th className="center">Stock</th>
                <th className="center">Status</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.product_code}</div>
                  </td>
                  <td className="text-sm text-slate-600">{p.supermarkets?.name || marketName(p.supermarket_id)}</td>
                  <td className="center">{formatRwf(p.price)}</td>
                  <td className="center">{p.quantity_available}</td>
                  <td className="center">
                    <span className={`ss-badge ${p.status === 'ACTIVE' ? 'ss-badge-ok' : 'ss-badge-warn'}`}>{p.status}</span>
                  </td>
                  <td className="center">
                    <div className="ss-actions">
                      <button type="button" title="Edit" className="ss-icon-btn ss-icon-edit" onClick={() => openEdit(p)}>
                        <Pencil />
                      </button>
                      <button type="button" title="QR code" className="ss-icon-btn ss-icon-muted" onClick={() => showQr(p.id)}>
                        <QrCode />
                      </button>
                      {p.status === 'ACTIVE' && (
                        <button type="button" title="Deactivate" className="ss-icon-btn ss-icon-danger" onClick={() => deactivate(p)}>
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td colSpan={6} className="center text-slate-400">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={setPage} label="products" />
      </div>

      <Modal open={formOpen} title={editing ? 'Update product' : 'Add product'} onClose={() => setFormOpen(false)} wide>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Supermarket <span className="text-red-500">*</span>
            <select
              required
              disabled={Boolean(editing)}
              className="field-input mt-1"
              value={form.supermarketId}
              onChange={(e) => setForm({ ...form, supermarketId: e.target.value })}
            >
              <option value="">Select supermarket…</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">Required — product will only appear in this store&apos;s catalog.</span>
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Product name
            <input
              required
              className="field-input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Category
            <input className="field-input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Price (RWF)
            <input
              required
              type="number"
              min="0"
              className="field-input mt-1"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
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
            />
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
            <input
              type="number"
              min="0"
              className="field-input mt-1"
              value={form.quantityAvailable}
              onChange={(e) => setForm({ ...form, quantityAvailable: e.target.value })}
            />
          </label>
          {editing && (
            <label className="text-sm font-medium text-slate-700">
              Status
              <select className="field-input mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          )}
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Description
            <input
              className="field-input mt-1"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="ss-btn ss-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="ss-btn ss-btn-primary disabled:opacity-60">
              {loading ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
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
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
              <img src={qr.qrDataUrl} alt="Product QR" className="h-48 w-48 rounded-2xl border border-slate-200 bg-white p-3" />
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
