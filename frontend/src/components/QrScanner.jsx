import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

export default function QrScanner({ onScan, onClose, title = 'Scan QR Code' }) {
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const scannerRef = useRef(null);
  const handled = useRef(false);
  const elementId = 'smartscan-qr-reader';

  useEffect(() => {
    let scanner;
    let mounted = true;

    const start = async () => {
      try {
        scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decoded) => {
            if (handled.current) return;
            handled.current = true;
            try {
              await scanner.stop();
            } catch {
              /* ignore */
            }
            onScan(decoded);
          },
          () => {}
        );
        if (mounted) setReady(true);
      } catch (err) {
        if (mounted) setError(err?.message || 'Camera access failed. Allow camera permissions.');
      }
    };

    start();

    return () => {
      mounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Camera className="h-5 w-5 text-teal-600" />
            {title}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-slate-900 p-3">
          <div id={elementId} className="overflow-hidden rounded-xl" />
          {!ready && !error && (
            <p className="py-8 text-center text-sm text-slate-300">Starting camera…</p>
          )}
          {error && <p className="py-6 text-center text-sm text-red-300">{error}</p>}
        </div>
        <p className="px-4 py-3 text-center text-xs text-slate-500">
          Align the QR code inside the frame. Scanning happens automatically.
        </p>
      </div>
    </div>
  );
}
