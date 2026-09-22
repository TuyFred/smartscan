import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export const PAGE_SIZE = 5;

export function pickCard(userOrCards) {
  const raw = userOrCards?.customer_cards ?? userOrCards;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] || null;
  if (typeof raw === 'object') return raw;
  return null;
}

export function usePagination(items, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = items?.length || 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(p, pages));
  }, [pages]);

  const slice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (items || []).slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, pages, total, slice, pageSize };
}

export function Pagination({ page, pages, total, onChange, label = 'items' }) {
  if (total <= PAGE_SIZE && pages <= 1) {
    return (
      <div className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-500">
        {total} {label}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-slate-500">
        Page <strong className="text-slate-800">{page}</strong> of {pages} · {total} {label}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="ss-btn ss-btn-ghost disabled:opacity-40"
        >
          Prev
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`ss-btn ${n === page ? 'ss-btn-primary' : 'ss-btn-ghost'}`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="ss-btn ss-btn-ghost disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="ss-btn ss-btn-ghost rounded-full p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
              t.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : t.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-950'
                  : 'border-sky-200 bg-sky-50 text-sky-950'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1 font-medium">{t.message}</span>
            <button type="button" className="opacity-60 hover:opacity-100" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return {
      success: (m) => console.log(m),
      error: (m) => console.error(m),
      info: (m) => console.log(m),
    };
  }
  return ctx;
}
