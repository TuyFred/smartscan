import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Download,
  Eye,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import api, { formatRwf } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/ui';

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  if (!rows?.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
}

function toDateInputValue(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function periodDefaults(period) {
  const now = new Date();
  const to = toDateInputValue(now);
  if (period === 'daily') return { from: to, to };
  if (period === 'weekly') {
    const from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { from: toDateInputValue(from), to };
  }
  if (period === 'yearly') {
    return { from: `${now.getFullYear()}-01-01`, to };
  }
  // monthly
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to,
  };
}

export function ReportWorkspace({ roleLabel }) {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const initial = periodDefaults('monthly');
  const [period, setPeriod] = useState('monthly');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [supermarketId, setSupermarketId] = useState('');
  const [markets, setMarkets] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewed, setPreviewed] = useState(false);

  useEffect(() => {
    if (!isAdmin) return undefined;
    api
      .get('/supermarkets')
      .then((r) => setMarkets(r.data.data || []))
      .catch(() => setMarkets([]));
    return undefined;
  }, [isAdmin]);

  const applyPeriod = (next) => {
    setPeriod(next);
    const d = periodDefaults(next);
    setFrom(d.from);
    setTo(d.to);
  };

  const load = async ({ silent = false } = {}) => {
    setLoading(true);
    try {
      const params = { from, to, period };
      if (isAdmin && supermarketId) params.supermarketId = supermarketId;
      const { data } = await api.get('/admin/reports/system', { params });
      setReport(data.data);
      setPreviewed(true);
      if (!silent) toast.success('Report generated — review below, then download');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load report');
      setReport(null);
      setPreviewed(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ silent: true });
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaryCards = useMemo(() => {
    if (!report?.summary) return [];
    const s = report.summary;
    if (report.scope === 'SYSTEM') {
      return [
        ['Users', s.users],
        ['Pending users', s.pendingUsers],
        ['Supermarkets', s.supermarkets],
        ['Products (catalog)', s.products],
        ['Products added (range)', s.productsAddedInRange],
        ['Sessions (range)', s.sessions],
        ['Active sessions', s.activeSessions],
        ['Payments (range)', s.payments],
        ['Receipts (range)', s.receipts],
        ['Sales total', formatRwf(s.salesTotal)],
      ];
    }
    return [
      ['Products', s.products],
      ['Customers', s.customers],
      ['Sessions (range)', s.sessions],
      ['Active sessions', s.activeSessions],
      ['Payments (range)', s.payments],
      ['Receipts (range)', s.receipts],
      ['Sales total', formatRwf(s.salesTotal)],
    ];
  }, [report]);

  const generatePdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(16);
    doc.text(report.title || 'SMARTSCAN Report', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, y);
    y += 6;
    doc.text(`Range: ${report.range?.label || `${from} → ${to}`}`, 14, y);
    y += 6;
    doc.text(`Scope: ${report.scope}${report.supermarket?.name ? ` · ${report.supermarket.name}` : ''}`, 14, y);
    y += 10;
    doc.setFontSize(12);
    doc.text('Summary', 14, y);
    y += 7;
    doc.setFontSize(10);
    summaryCards.forEach(([label, value]) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${label}: ${value}`, 14, y);
      y += 6;
    });

    const payments = report.recentPayments || [];
    if (payments.length) {
      y += 6;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.text('Payments in range', 14, y);
      y += 7;
      doc.setFontSize(9);
      payments.slice(0, 40).forEach((p) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        const line = `${p.payment_code || p.id} · ${p.users?.full_name || 'Customer'} · ${formatRwf(p.amount)} · ${
          p.paid_at ? new Date(p.paid_at).toLocaleString() : ''
        }`;
        doc.text(line.substring(0, 95), 14, y);
        y += 5;
      });
    }

    const sessions = report.recentSessions || [];
    if (sessions.length) {
      y += 8;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.text('Sessions in range', 14, y);
      y += 7;
      doc.setFontSize(9);
      sessions.slice(0, 40).forEach((s) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        const line = `${s.session_code} · ${s.users?.full_name || '—'} · ${formatRwf(s.total_amount)} · ${
          s.started_at ? new Date(s.started_at).toLocaleString() : ''
        }`;
        doc.text(line.substring(0, 95), 14, y);
        y += 5;
      });
    }

    const file =
      report.scope === 'SYSTEM'
        ? `smartscan-system-report-${Date.now()}.pdf`
        : `smartscan-store-report-${Date.now()}.pdf`;
    doc.save(file);
    toast.success('PDF downloaded');
  };

  const generateCsv = () => {
    if (!report) return;
    const payments = (report.recentPayments || []).map((p) => ({
      payment_code: p.payment_code || '',
      customer: p.users?.full_name || '',
      email: p.users?.email || '',
      amount: p.amount || 0,
      status: p.status || '',
      paid_at: p.paid_at ? new Date(p.paid_at).toLocaleString() : '',
      store: p.shopping_sessions?.supermarkets?.name || p.supermarkets?.name || '',
      session: p.shopping_sessions?.session_code || '',
    }));
    const sessions = (report.recentSessions || []).map((s) => ({
      session_code: s.session_code || '',
      customer: s.users?.full_name || '',
      email: s.users?.email || '',
      store: s.supermarkets?.name || '',
      branch: s.branches?.name || '',
      total: s.total_amount || 0,
      status: s.status || '',
      payment_status: s.payment_status || '',
      started_at: s.started_at ? new Date(s.started_at).toLocaleString() : '',
    }));
    const summaryRows = summaryCards.map(([metric, value]) => ({ metric, value }));
    const csv = [
      `TITLE,${report.title || ''}`,
      `RANGE,${report.range?.label || ''}`,
      `GENERATED,${new Date(report.generatedAt).toLocaleString()}`,
      '',
      'SUMMARY',
      toCsv(summaryRows),
      '',
      'PAYMENTS',
      toCsv(payments),
      '',
      'SESSIONS',
      toCsv(sessions),
    ].join('\n');
    downloadTextFile(
      report.scope === 'SYSTEM' ? `smartscan-system-report-${Date.now()}.csv` : `smartscan-store-report-${Date.now()}.csv`,
      csv
    );
    toast.success('CSV downloaded');
  };

  const periods = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900 p-5 text-white sm:p-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-200">
          <FileText className="h-3.5 w-3.5" /> {roleLabel} reports
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold">{report?.title || 'SMARTSCAN reports'}</h2>
        <p className="mt-1 text-sm text-slate-300">
          Select a date range, generate a live preview, then download PDF or CSV.
        </p>
        {report?.generatedAt && (
          <p className="mt-2 text-xs text-slate-400">
            Last generated: {new Date(report.generatedAt).toLocaleString()}
            {report.range?.label ? ` · ${report.range.label}` : ''}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <CalendarRange className="h-4 w-4 text-teal-600" /> Report period
        </div>
        <div className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPeriod(p.id)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                period === p.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              period === 'custom' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Custom
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            From
            <input
              type="date"
              className="field-input mt-1"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPeriod('custom');
              }}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input
              type="date"
              className="field-input mt-1"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPeriod('custom');
              }}
            />
          </label>
          {isAdmin && (
            <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">
              Supermarket
              <select
                className="field-input mt-1"
                value={supermarketId}
                onChange={(e) => setSupermarketId(e.target.value)}
              >
                <option value="">All supermarkets</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button type="button" disabled={loading || !from || !to} onClick={() => load()} className="ss-btn ss-btn-primary w-full">
              <Eye className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? 'Generating…' : 'Generate preview'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => load({ silent: true })} disabled={loading} className="ss-btn ss-btn-ghost">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" disabled={!previewed || !report || loading} onClick={generatePdf} className="ss-btn ss-btn-primary">
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button
            type="button"
            disabled={!previewed || !report || loading}
            onClick={generateCsv}
            className="ss-btn ss-btn-dark"
          >
            <Download className="h-4 w-4" /> Download CSV
          </button>
        </div>
      </div>

      {loading && !report ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">Loading report…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {summaryCards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                <div className="mt-1 font-display text-xl font-bold text-slate-900">{value ?? '—'}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold">
              Payments in range
              <span className="ml-2 text-xs font-normal text-slate-400">
                {(report?.recentPayments || []).length} row(s)
              </span>
            </div>
            <div className="table-wrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th>Store</th>
                    <th className="center">Amount</th>
                    <th className="center">Date & time</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.recentPayments || []).map((p) => (
                    <tr key={p.id || p.payment_code}>
                      <td className="font-mono text-xs">{p.payment_code}</td>
                      <td>
                        <div className="font-medium">{p.users?.full_name || '—'}</div>
                        <div className="text-xs text-slate-400">{p.users?.email}</div>
                      </td>
                      <td className="text-sm text-slate-600">
                        {p.shopping_sessions?.supermarkets?.name || report?.supermarket?.name || '—'}
                      </td>
                      <td className="center font-semibold text-teal-800">{formatRwf(p.amount)}</td>
                      <td className="center text-xs text-slate-500">
                        {p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {!report?.recentPayments?.length && (
                    <tr>
                      <td colSpan={5} className="center text-slate-400">
                        No payments in this date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold">
              Sessions in range
              <span className="ml-2 text-xs font-normal text-slate-400">
                {(report?.recentSessions || []).length} row(s)
              </span>
            </div>
            <div className="table-wrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Customer</th>
                    <th>Store / branch</th>
                    <th className="center">Total</th>
                    <th className="center">Status</th>
                    <th className="center">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.recentSessions || []).map((s) => (
                    <tr key={s.id || s.session_code}>
                      <td className="font-mono text-xs">{s.session_code}</td>
                      <td>
                        <div className="font-medium">{s.users?.full_name || '—'}</div>
                        <div className="text-xs text-slate-400">{s.users?.email}</div>
                      </td>
                      <td className="text-sm text-slate-600">
                        {s.supermarkets?.name || report?.supermarket?.name || '—'}
                        {s.branches?.name ? ` · ${s.branches.name}` : ''}
                      </td>
                      <td className="center font-semibold">{formatRwf(s.total_amount)}</td>
                      <td className="center">
                        <span className="ss-badge ss-badge-info">{s.status}</span>
                      </td>
                      <td className="center text-xs text-slate-500">
                        {s.started_at ? new Date(s.started_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {!report?.recentSessions?.length && (
                    <tr>
                      <td colSpan={6} className="center text-slate-400">
                        No sessions in this date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
