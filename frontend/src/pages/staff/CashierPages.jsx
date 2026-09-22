import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  LayoutDashboard,
  Users,
  Shield,
  Wallet,
  LifeBuoy,
  Banknote,
  Search,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Modal, Pagination, pickCard, usePagination, useToast } from '../../lib/ui';

const cashierLinks = [
  { to: '/cashier/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/cashier/sell-card', label: 'Sell Card', icon: <CreditCard className="h-4 w-4" /> },
  { to: '/cashier/deposits', label: 'Add Money', icon: <Wallet className="h-4 w-4" /> },
  { to: '/cashier/customers', label: 'Customers', icon: <Users className="h-4 w-4" /> },
  { to: '/cashier/help', label: 'Help Customer', icon: <LifeBuoy className="h-4 w-4" /> },
  { to: '/cashier/rfid', label: 'RFID Read', icon: <Shield className="h-4 w-4" /> },
];

export function CashierShell() {
  return <DashboardLayout title="Cashier" links={cashierLinks} variant="cashier" />;
}

export function CashierDashboard() {
  const actions = [
    { to: '/cashier/sell-card', title: 'Sell RFID card', text: 'Issue one UID to one customer', icon: CreditCard, tone: 'bg-teal-600 hover:bg-teal-500' },
    { to: '/cashier/deposits', title: 'Add money', text: 'Deposit cash onto a card', icon: Banknote, tone: 'bg-emerald-600 hover:bg-emerald-500' },
    { to: '/cashier/customers', title: 'Customers', text: 'Browse every shopper', icon: Users, tone: 'bg-sky-600 hover:bg-sky-500' },
    { to: '/cashier/help', title: 'Help customer', text: 'Guide shopping & balance', icon: LifeBuoy, tone: 'bg-amber-600 hover:bg-amber-500' },
    { to: '/cashier/rfid', title: 'Read RFID', text: 'Tap card to look up UID', icon: Shield, tone: 'bg-indigo-600 hover:bg-indigo-500' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-slate-900 p-6 text-white">
        <h2 className="font-display text-2xl font-bold">Cashier desk</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Sell cards, add money, and help shoppers. Pick an action below.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col gap-2 rounded-2xl px-4 py-4 text-white shadow-sm transition ${item.tone}`}
          >
            <item.icon className="h-5 w-5 opacity-90" />
            <div className="font-display text-base font-bold">{item.title}</div>
            <p className="text-xs text-white/80">{item.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CustomerSearch({ selected, onSelect, hint, actionLabel = 'Select' }) {
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { page, setPage, pages, total, slice } = usePagination(customers);

  useEffect(() => {
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
  }, [q]);

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
        <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{hint || 'Results refresh as you type'}</span>
          <span>{loading ? 'Searching…' : `${customers.length} result${customers.length === 1 ? '' : 's'}`}</span>
        </div>
      </div>
      {error && !customers.length && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="table-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Card</th>
                <th className="center">Balance</th>
                <th className="center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="center text-slate-400">
                    Searching…
                  </td>
                </tr>
              )}
              {!loading &&
                slice.map((c) => {
                  const card = pickCard(c);
                  const hasCard = Boolean(card?.card_uid);
                  return (
                    <tr key={c.id} className={selected?.id === c.id ? 'bg-teal-50' : ''}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="ss-avatar">{(c.full_name || '?')[0]}</span>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">{c.full_name}</div>
                            <div className="truncate text-xs text-slate-500">{c.email}</div>
                            <div className="text-xs text-slate-400">{c.phone || 'No phone'}</div>
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
                      <td className="center">
                        <button
                          type="button"
                          onClick={() => onSelect(c)}
                          className={`ss-btn ${selected?.id === c.id ? 'ss-btn-primary' : 'ss-btn-dark'}`}
                        >
                          {selected?.id === c.id ? 'Selected' : actionLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {!loading && !slice.length && (
                <tr>
                  <td colSpan={4} className="center text-slate-400">
                    No customers found
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

export function CashierSellCard() {
  const { socket } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [cardUid, setCardUid] = useState('');
  const [amount, setAmount] = useState('');
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
    if (!socket || !waitingTap) return undefined;
    const onRead = (payload) => {
      const uid = payload?.cardUid || payload?.card?.cardUid;
      if (!uid) return;
      setCardUid(uid);
      setWaitingTap(false);
      checkUid(uid);
    };
    socket.on('rfid:card-read', onRead);
    return () => socket.off('rfid:card-read', onRead);
  }, [socket, waitingTap]);

  useEffect(() => {
    const t = setTimeout(() => checkUid(cardUid), 350);
    return () => clearTimeout(t);
  }, [cardUid]);

  const openSell = (customer) => {
    setSelected(customer);
    setCardUid('');
    setAmount('');
    setUidStatus(null);
    setWaitingTap(false);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setWaitingTap(false);
  };

  const sell = async (e) => {
    e.preventDefault();
    if (uidStatus?.taken && uidStatus?.owner?.id !== selected?.id) {
      toast.error(uidStatus.message || 'This card UID is already taken');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/cards/sell', {
        customerId: selected.id,
        cardUid,
        initialBalance: Number(amount || 0),
      });
      toast.success(
        `Card ${data.data?.card?.card_uid || cardUid} sold to ${data.data?.customer?.full_name || selected.full_name}`
      );
      setOpen(false);
      setSelected(null);
      setCardUid('');
      setAmount('');
      setUidStatus(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not sell card');
    } finally {
      setLoading(false);
    }
  };

  const uidBlocked = Boolean(uidStatus?.taken && uidStatus?.owner?.id !== selected?.id);
  const existingCard = pickCard(selected);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900 p-5 text-white">
        <h2 className="font-display text-xl font-bold">Sell RFID card</h2>
        <p className="mt-1 text-sm text-slate-300">Choose a customer, then sell a card via the form.</p>
      </div>
      <CustomerSearch selected={selected} onSelect={openSell} actionLabel="Sell" hint="Click Sell to open the card form." />

      <Modal open={open} title={`Sell card — ${selected?.full_name || ''}`} onClose={closeModal}>
        <form onSubmit={sell} className="space-y-3">
          {existingCard?.card_uid && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              Current card: <span className="ss-uid">{existingCard.card_uid}</span>
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            RFID card UID
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                required
                value={cardUid}
                onChange={(e) => setCardUid(e.target.value)}
                placeholder="Tap card or type UID"
                className={`field-input flex-1 ${
                  uidBlocked ? 'border-red-400 bg-red-50' : uidStatus?.available ? 'border-emerald-400 bg-emerald-50' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  setWaitingTap(true);
                  setCardUid('');
                  setUidStatus(null);
                }}
                className="ss-btn ss-btn-dark shrink-0"
              >
                {waitingTap ? 'Waiting…' : 'Tap card'}
              </button>
            </div>
          </label>
          {waitingTap && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Tap card now
            </div>
          )}
          {checkingUid && <p className="text-xs text-slate-500">Checking UID…</p>}
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
                  Already taken by {uidStatus.owner?.fullName || 'another customer'}
                  {uidStatus.owner?.email ? ` (${uidStatus.owner.email})` : ''}.
                </>
              ) : uidStatus.owner?.id === selected?.id ? (
                <>This UID is already linked to {selected.full_name}.</>
              ) : (
                <>Available. {uidStatus.message || 'Ready to sell.'}</>
              )}
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Starting balance (RWF)
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="field-input mt-1"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeModal} className="ss-btn ss-btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uidBlocked || !cardUid.trim()}
              className="ss-btn ss-btn-primary disabled:opacity-50"
            >
              {loading ? 'Selling…' : uidBlocked ? 'Card taken' : 'Confirm sell'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function CashierDeposits() {
  const { socket } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [cardUid, setCardUid] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingTap, setWaitingTap] = useState(false);

  useEffect(() => {
    if (!socket || !waitingTap) return undefined;
    const onRead = (payload) => {
      const uid = payload?.cardUid || payload?.card?.cardUid;
      if (!uid) return;
      setCardUid(uid);
      setWaitingTap(false);
      if (payload?.customer) setSelected(payload.customer);
    };
    socket.on('rfid:card-read', onRead);
    return () => socket.off('rfid:card-read', onRead);
  }, [socket, waitingTap]);

  const openDeposit = (customer) => {
    const card = pickCard(customer);
    setSelected(customer);
    setCardUid(card?.card_uid || '');
    setAmount('');
    setWaitingTap(false);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setWaitingTap(false);
  };

  const deposit = async (e) => {
    e.preventDefault();
    if (!selected && !cardUid) {
      toast.error('Select a customer or enter a card UID');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/cards/deposit', {
        customerId: selected?.id,
        cardUid: cardUid || undefined,
        amount: Number(amount),
      });
      toast.success(
        `Deposited ${formatRwf(data.data?.deposit || amount)}. New balance: ${formatRwf(data.data?.newBalance || 0)}`
      );
      setOpen(false);
      setAmount('');
      setWaitingTap(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const card = pickCard(selected);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900 p-5 text-white">
        <h2 className="font-display text-xl font-bold">Add money</h2>
        <p className="mt-1 text-sm text-slate-300">Deposit cash onto a customer card.</p>
      </div>
      <CustomerSearch selected={selected} onSelect={openDeposit} actionLabel="Deposit" hint="Click Deposit to open the amount form." />

      <Modal open={open} title={`Deposit — ${selected?.full_name || 'Card'}`} onClose={closeModal}>
        <form onSubmit={deposit} className="space-y-3">
          {card?.card_uid && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              Card <span className="ss-uid">{card.card_uid}</span> · Balance {formatRwf(card.balance || 0)}
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Card UID
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                value={cardUid}
                onChange={(e) => setCardUid(e.target.value)}
                placeholder="Tap or type RFID UID"
                className="field-input flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  setWaitingTap(true);
                  setCardUid('');
                }}
                className="ss-btn ss-btn-dark shrink-0"
              >
                {waitingTap ? 'Waiting…' : 'Tap card'}
              </button>
            </div>
          </label>
          {waitingTap && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Tap card now
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Amount (RWF)
            <input
              required
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              className="field-input mt-1"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeModal} className="ss-btn ss-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="ss-btn ss-btn-primary disabled:opacity-60">
              {loading ? 'Depositing…' : 'Confirm deposit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function CashierCustomers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const { page, setPage, pages, total, slice } = usePagination(rows);

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
            <p className="text-sm text-slate-500">Live search — name, email, phone, or card UID.</p>
          </div>
          <div className="ss-search max-w-md">
            <Search className="ss-search-icon h-4 w-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" />
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
                <tr>
                  <td colSpan={5} className="center text-slate-400">
                    Searching…
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
                          </div>
                        </div>
                      </td>
                      <td>
                        {hasCard ? <span className="ss-uid">{card.card_uid}</span> : <span className="text-slate-400">—</span>}
                      </td>
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
              {!loading && !slice.length && (
                <tr>
                  <td colSpan={5} className="center text-slate-400">
                    No customers found
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

export function CashierHelp() {
  const [selected, setSelected] = useState(null);
  const card = pickCard(selected);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-teal-100 bg-teal-50 p-5">
        <h2 className="font-display text-xl font-bold text-teal-950">Help a customer</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-teal-900">
          <li>No card → sell one and load money.</li>
          <li>Has card → deposit cash (never deduct here).</li>
          <li>Shopping starts via the supermarket entrance QR.</li>
          <li>Payment completes after the customer enters their PIN.</li>
        </ul>
      </div>
      <CustomerSearch selected={selected} onSelect={setSelected} hint="Look up the shopper, then choose the next step." />
      {selected && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="font-display text-lg font-bold">{selected.full_name}</div>
          <p className="text-sm text-slate-500">
            {selected.email} · {selected.phone || 'No phone'}
          </p>
          <p className="mt-2 text-sm">
            Card {card?.card_uid || 'not issued'} · Balance {formatRwf(card?.balance || 0)}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link to="/cashier/sell-card" className="ss-btn ss-btn-dark text-center">
              Sell / replace card
            </Link>
            <Link to="/cashier/deposits" className="ss-btn ss-btn-primary text-center">
              Add money
            </Link>
            <Link to="/cashier/rfid" className="ss-btn ss-btn-ghost text-center">
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
  const [waiting, setWaiting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket || !waiting) return undefined;

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
      });
    };

    socket.on('rfid:card-read', handleCardRead);
    return () => socket.off('rfid:card-read', handleCardRead);
  }, [socket, waiting]);

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
    setWaiting(false);
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
      });
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
        <p className="mt-1 text-sm text-slate-500">Click Read card, then tap. Or type a UID and look it up.</p>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <button type="button" onClick={startTapRead} className="ss-btn ss-btn-dark w-full justify-center">
          {waiting ? 'Waiting for tap…' : 'Read card'}
        </button>
        <form onSubmit={lookupManual} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="Or type card UID"
            className="field-input flex-1"
          />
          <button type="submit" disabled={loading} className="ss-btn ss-btn-primary">
            {loading ? '…' : 'Lookup'}
          </button>
        </form>
      </div>

      {waiting && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Tap card now</div>
        </div>
      )}

      {uid && !waiting && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Card UID</div>
          <div className="mt-1 break-all font-mono text-lg font-bold text-slate-900">{uid}</div>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <div className="font-display text-xl font-bold">Card detected</div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm font-bold">{data.card?.cardUid || uid}</div>
          <div>Customer: {data.customer?.full_name || '—'}</div>
          <div>Balance: {formatRwf(data.card?.balance)}</div>
          <div>Session: {data.activeSession?.session_code || 'None'}</div>
          <div>Amount due: {formatRwf(data.amountDue)}</div>
          <div>Status: {data.card?.status || 'ACTIVE'}</div>
        </div>
      )}
    </div>
  );
}
