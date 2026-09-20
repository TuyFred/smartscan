import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  QrCode,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Store,
} from 'lucide-react';
import LoginModal from '../components/LoginModal';
import { useAuth } from '../lib/auth';

const HERO_SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=2400&q=90',
    alt: 'Modern supermarket aisle',
    label: 'Supermarket aisles',
  },
  {
    src: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=2400&q=90',
    alt: 'Fresh grocery shopping',
    label: 'Fresh shopping',
  },
  {
    src: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=2400&q=90',
    alt: 'Mall shopping cart',
    label: 'Mall carts',
  },
  {
    src: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=2400&q=90',
    alt: 'Retail checkout experience',
    label: 'Smart checkout',
  },
];

export default function HomePage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const { isAuthenticated, user } = useAuth();

  const dash =
    user?.role === 'ADMIN'
      ? '/admin/dashboard'
      : user?.role === 'MANAGER'
        ? '/manager/dashboard'
        : user?.role === 'CASHIER'
          ? '/cashier/dashboard'
          : '/customer/dashboard';

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goPrev = () => setSlide((current) => (current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  const goNext = () => setSlide((current) => (current + 1) % HERO_SLIDES.length);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="relative min-h-screen overflow-hidden">
        {/* HD mall shopping slider */}
        <div className="absolute inset-0">
          {HERO_SLIDES.map((item, index) => (
            <img
              key={item.src}
              src={item.src}
              alt={item.alt}
              loading={index === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1200ms] ease-out ${
                index === slide ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
              }`}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/55 to-slate-950" />
        <div className="absolute inset-0 ss-grid opacity-30" />

        <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-4 sm:px-4 sm:py-5 md:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-400 text-slate-950 animate-pulse-ring sm:h-10 sm:w-10">
              <ScanLine className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span className="font-display truncate text-base font-extrabold tracking-[0.14em] text-white sm:text-lg sm:tracking-[0.18em] md:text-xl">
              SMARTSCAN
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAuthenticated ? (
              <Link
                to={dash}
                className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 sm:px-4 sm:text-sm"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 sm:inline-block sm:px-4"
                >
                  Create account
                </Link>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="rounded-xl bg-teal-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-300 sm:px-4 sm:text-sm"
                >
                  Login
                </button>
              </>
            )}
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center px-4 pb-24 pt-8 md:px-6">
          <div className="animate-fade-up max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-teal-300 md:text-sm">
              IoT mall shopping & billing
            </p>

            <p className="max-w-xl text-base leading-relaxed text-slate-200/95 text-justify md:text-lg">
              Scan, shop, and pay with your RFID card — then exit with a verified digital receipt.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-400 px-6 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-teal-300 hover:scale-[1.02]"
              >
                Start shopping <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Create account
              </Link>
            </div>
          </div>

          <div
            className="mt-14 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300 animate-fade-up"
            style={{ animationDelay: '180ms' }}
          >
            <span className="inline-flex items-center gap-2">
              <QrCode className="h-4 w-4 text-teal-300" /> Branch QR entry
            </span>
            <span className="inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-teal-300" /> RFID payment
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-300" /> Exit verification
            </span>
          </div>
        </div>

        {/* Slider controls */}
        <div className="absolute bottom-6 left-0 right-0 z-20 sm:bottom-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 sm:px-4 md:px-6">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-white/70 sm:text-xs sm:tracking-[0.2em]">
              {HERO_SLIDES[slide].label}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous image"
                className="rounded-full border border-white/20 bg-black/30 p-2 backdrop-blur hover:bg-black/50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                {HERO_SLIDES.map((item, index) => (
                  <button
                    key={item.src}
                    type="button"
                    aria-label={`Go to slide ${index + 1}`}
                    onClick={() => setSlide(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === slide ? 'w-8 bg-teal-400' : 'w-2.5 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next image"
                className="rounded-full border border-white/20 bg-black/30 p-2 backdrop-blur hover:bg-black/50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-slate-950 py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Built for real mall shopping
          </h2>
          <p className="mt-3 max-w-3xl text-slate-300 text-justify leading-relaxed">
            SMARTSCAN connects customers, cashiers, managers, and IoT devices in one flow — from branch QR
            to product scan, RFID authorization, and gated exit — so every purchase is tracked and paid
            correctly before you leave the store.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Store,
                title: 'Choose any shop',
                text: 'Start shopping only after scanning that supermarket branch QR. You pick the store you enter, and the session stays locked to that branch.',
              },
              {
                icon: RadioTower,
                title: 'IoT RFID + exit',
                text: 'Tap your RFID card to identify yourself, confirm payment with your PIN, then scan your receipt QR so the exit gate can open safely.',
              },
              {
                icon: ShieldCheck,
                title: 'Role-ready access',
                text: 'Admin, manager, cashier, and customer each get a professional dashboard with the exact tools and permissions their role needs.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="animate-fade-up border-t border-teal-400/40 pt-5"
                style={{ animationDelay: `${120 + i * 80}ms` }}
              >
                <item.icon className="mb-3 h-6 w-6 text-teal-300" />
                <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 text-justify">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
