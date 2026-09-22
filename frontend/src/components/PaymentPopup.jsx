import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import api, { formatRwf } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function PaymentPopup() {
  const { paymentRequest, setPaymentRequest } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const shortfall = Math.max(0, Number(paymentRequest?.amountToPay || 0) - Number(paymentRequest?.cardBalance || 0));
  const canUseCard = shortfall === 0;

  useEffect(() => {
    // Auto-submit once PIN is complete (hooks always run — never after an early return)
    if (!paymentRequest?.authorizationId || pin.length < 4 || loading || error || success || !canUseCard) {
      return undefined;
    }
    const timer = setTimeout(() => {
      void authorizeWithPin(pin);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRequest?.authorizationId, pin, canUseCard]);

  useEffect(() => {
    if (!paymentRequest?.authorizationId) return;
    setPin('');
    setError('');
    setLoading(false);
  }, [paymentRequest?.authorizationId]);

  async function authorizeWithPin(nextPin) {
    if (!paymentRequest?.authorizationId || loading || !canUseCard) return;
    const pinValue = String(nextPin || pin);
    if (pinValue.length < 4) return;

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/payments/authorize', {
        authorizationId: paymentRequest.authorizationId,
        pin: pinValue,
      });
      // Confirm money left the card before showing success
      const paid = Number(data.data?.amountPaid || 0);
      const remaining = Number(data.data?.remainingBalance ?? NaN);
      const previous = Number(data.data?.previousBalance ?? NaN);
      if (!paid || Number.isNaN(remaining) || Number.isNaN(previous)) {
        throw new Error('Payment response incomplete — money status unknown. Check your card balance.');
      }
      if (moneyClose(previous - paid, remaining) === false) {
        throw new Error('Balance mismatch after payment. Contact support with your receipt.');
      }
      setSuccess(data.data);
      setPaymentRequest(null);
      setPin('');
      window.dispatchEvent(new CustomEvent('smartscan:payment-success', { detail: data.data }));
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Payment failed';
      const code = err.response?.data?.code || '';
      setError(message);
      if (code === 'INSUFFICIENT_BALANCE') setPin('');
    } finally {
      setLoading(false);
    }
  }

  function moneyClose(a, b) {
    return Math.abs(Number(a) - Number(b)) < 0.02;
  }

  if (!paymentRequest && !success) return null;

  const performAuthorize = async (e) => {
    if (e) e.preventDefault();
    await authorizeWithPin(pin);
  };

  const cancel = async () => {
    if (paymentRequest?.authorizationId) {
      try {
        await api.post(`/payments/cancel/${paymentRequest.authorizationId}`);
      } catch {
        /* ignore */
      }
    }
    setPaymentRequest(null);
    setPin('');
    setError('');
  };

  if (success) {
    const paid = Number(success.amountPaid ?? success.payment?.amount ?? 0);
    const prev = Number(success.previousBalance ?? 0);
    const remaining = Number(
      success.remainingBalance ?? success.card?.balance ?? Math.max(0, prev - paid)
    );
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h3 className="font-display text-2xl font-bold text-slate-900">Payment successful</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <div className="rounded-full bg-teal-50 px-2 py-1.5 text-teal-700">1. PIN</div>
            <div className="rounded-full bg-teal-50 px-2 py-1.5 text-teal-700">2. Card</div>
            <div className="rounded-full bg-green-100 px-2 py-1.5 text-green-700">3. Paid</div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>
              Amount paid: <strong className="text-teal-700">{formatRwf(paid)}</strong>
            </p>
            <p>RFID payment completed — money was removed from your card.</p>
            <p>Previous balance: {formatRwf(prev)}</p>
            <p>
              Remaining balance: <strong>{formatRwf(remaining)}</strong>
            </p>
            <p>Session: {success.sessionCode || success.session?.session_code}</p>
            <p>Receipt: {success.receipt?.receipt_number}</p>
          </div>
          {success.receipt?.qrDataUrl && (
            <img src={success.receipt.qrDataUrl} alt="Receipt QR" className="mx-auto mt-4 h-40 w-40" />
          )}
          <p className="mt-2 text-center text-xs text-slate-500">Scan this receipt QR at the exit gate.</p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="mt-5 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-fade-up">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          <CreditCard className="h-3.5 w-3.5" /> RFID CARD DETECTED
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <div className="rounded-full bg-teal-50 px-2 py-1.5 text-teal-700">1. Card</div>
          <div className="rounded-full bg-amber-50 px-2 py-1.5 text-amber-700">2. PIN</div>
          <div className="rounded-full bg-slate-100 px-2 py-1.5">3. Paid</div>
        </div>
        <h3 className="font-display text-2xl font-bold">Authorize payment</h3>
        <p className="mt-1 text-sm text-slate-500">
          Card was tapped. Enter your payment PIN to remove {formatRwf(paymentRequest.amountToPay)} from your card.
        </p>

        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span>Customer</span>
            <strong>{paymentRequest.customer?.full_name}</strong>
          </div>
          <div className="flex justify-between">
            <span>Session</span>
            <strong>{paymentRequest.session?.session_code}</strong>
          </div>
          <div className="flex justify-between">
            <span>Amount to pay</span>
            <strong className="text-teal-700">{formatRwf(paymentRequest.amountToPay)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Card balance</span>
            <strong>{formatRwf(paymentRequest.cardBalance)}</strong>
          </div>
        </div>

        {!canUseCard && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">Card balance is not enough</div>
                <div className="mt-1">
                  Available: {formatRwf(paymentRequest.cardBalance)} · Needed: {formatRwf(shortfall)}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentRequest(null);
                  setPin('');
                  setError('');
                }}
                className="rounded-xl border border-amber-200 bg-white py-2.5 font-semibold text-amber-900"
              >
                Cash / cashier
              </button>
              <button type="button" onClick={() => setPin('')} className="rounded-xl bg-amber-500 py-2.5 font-semibold text-white">
                Try another card
              </button>
            </div>
          </div>
        )}

        {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={performAuthorize} className="mt-4 space-y-3">
          <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Payment PIN</div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-xl border-2 border-teal-300 bg-white px-3 py-4 text-center text-2xl font-bold tracking-[0.45em] text-slate-900 outline-none focus:border-teal-500"
              placeholder="••••••"
              aria-label="Payment PIN"
            />
            <div className="mt-2 text-center text-[11px] font-medium text-teal-800">Type your 4–6 digit PIN here</div>
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-800">
            Money is deducted from your card only after a correct PIN. Another person&apos;s card cannot pay.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={cancel} className="rounded-xl border border-slate-200 py-3 font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || pin.length < 4 || !canUseCard}
              className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-semibold text-white disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Pay & remove money
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
