import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import api, { formatRwf } from '../../lib/api';
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

export function useSystemReport() {
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/reports/system');
      setReport(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { report, loading, reload: load, toast };
}

export function ReportWorkspace({ roleLabel }) {
  const { report, loading, reload, toast } = useSystemReport();

  const summaryCards = useMemo(() => {
    if (!report?.summary) return [];
    const s = report.summary;
    if (report.scope === 'SYSTEM') {
      return [
        ['Users', s.users],
        ['Pending users', s.pendingUsers],
        ['Supermarkets', s.supermarkets],
        ['Products', s.products],
        ['Sessions', s.sessions],
        ['Active sessions', s.activeSessions],
        ['Payments', s.payments],
        ['Receipts', s.receipts],
        ['RFID cards', s.cards],
        ['Devices', s.devices],
        ['Sales total', formatRwf(s.salesTotal)],
        ['Deposits total', formatRwf(s.depositTotal)],
      ];
    }
    return [
      ['Products', s.products],
      ['Customers', s.customers],
      ['Sessions', s.sessions],
      ['Active sessions', s.activeSessions],
      ['Payments', s.payments],
      ['Receipts', s.receipts],
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
      doc.text('Recent completed payments', 14, y);
      y += 7;
      doc.setFontSize(9);
      payments.slice(0, 25).forEach((p) => {
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

    const file =
      report.scope === 'SYSTEM'
        ? `smartscan-system-report-${Date.now()}.pdf`
        : `smartscan-store-report-${Date.now()}.pdf`;
    doc.save(file);
    toast.success('PDF report downloaded');
  };

  const generateCsv = () => {
    if (!report) return;
    const payments = (report.recentPayments || []).map((p) => ({
      payment_code: p.payment_code || '',
      customer: p.users?.full_name || '',
      email: p.users?.email || '',
      amount: p.amount || 0,
      status: p.status || '',
      paid_at: p.paid_at || '',
      session: p.shopping_sessions?.session_code || '',
    }));
    const summaryRows = summaryCards.map(([metric, value]) => ({ metric, value }));
    const csv = [
      'SUMMARY',
      toCsv(summaryRows),
      '',
      'RECENT_PAYMENTS',
      toCsv(payments),
    ].join('\n');
    downloadTextFile(
      report.scope === 'SYSTEM' ? `smartscan-system-report-${Date.now()}.csv` : `smartscan-store-report-${Date.now()}.csv`,
      csv
    );
    toast.success('CSV report downloaded');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900 p-5 text-white sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-200">
              <FileText className="h-3.5 w-3.5" /> {roleLabel} reports
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold">{report?.title || 'System reports'}</h2>
            <p className="mt-1 text-sm text-slate-300">
              Live data from SMARTSCAN. Generate and download PDF or CSV anytime.
            </p>
            {report?.generatedAt && (
              <p className="mt-2 text-xs text-slate-400">Last generated: {new Date(report.generatedAt).toLocaleString()}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reload} className="ss-btn ss-btn-ghost bg-white/10 text-white hover:bg-white/20">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button type="button" disabled={!report || loading} onClick={generatePdf} className="ss-btn ss-btn-primary">
              <Download className="h-4 w-4" /> PDF
            </button>
            <button type="button" disabled={!report || loading} onClick={generateCsv} className="ss-btn ss-btn-dark bg-white text-slate-900 hover:bg-slate-100">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
      </div>

      {loading && !report ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">Loading report…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summaryCards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                <div className="mt-1 font-display text-2xl font-bold text-slate-900">{value ?? '—'}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold">Recent completed payments</div>
            <div className="table-wrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th className="center">Amount</th>
                    <th className="center">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.recentPayments || []).slice(0, 10).map((p) => (
                    <tr key={p.id || p.payment_code}>
                      <td className="font-mono text-xs">{p.payment_code}</td>
                      <td>
                        <div className="font-medium">{p.users?.full_name || '—'}</div>
                        <div className="text-xs text-slate-400">{p.users?.email}</div>
                      </td>
                      <td className="center font-semibold text-teal-800">{formatRwf(p.amount)}</td>
                      <td className="center text-xs text-slate-500">
                        {p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {!report?.recentPayments?.length && (
                    <tr>
                      <td colSpan={4} className="center text-slate-400">
                        No payments yet
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
