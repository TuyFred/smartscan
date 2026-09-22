import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ScanLine, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import PaymentPopup from './PaymentPopup';

const VARIANTS = {
  admin: {
    aside: 'bg-slate-950',
    brandIcon: 'bg-teal-500',
    activeNav: 'bg-teal-500/20 text-teal-200',
    roleTone: 'text-slate-400',
    badge: 'ADMIN',
  },
  manager: {
    aside: 'bg-slate-950',
    brandIcon: 'bg-teal-500',
    activeNav: 'bg-teal-500/20 text-teal-200',
    roleTone: 'text-teal-300',
    badge: 'MANAGER',
  },
  cashier: {
    aside: 'bg-slate-950',
    brandIcon: 'bg-teal-500',
    activeNav: 'bg-teal-500/20 text-teal-200',
    roleTone: 'text-slate-400',
    badge: 'CASHIER',
  },
  customer: {
    aside: 'bg-slate-950',
    brandIcon: 'bg-teal-500',
    activeNav: 'bg-teal-500/20 text-teal-200',
    roleTone: 'text-slate-400',
    badge: 'CUSTOMER',
  },
};

export default function DashboardLayout({ title, links, variant = 'customer' }) {
  const { user, logout, paymentRequest } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const theme = VARIANTS[variant] || VARIANTS.customer;

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const onLogout = () => {
    logout();
    navigate('/');
  };

  const RoleIcon = ScanLine;

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,88vw)] flex-col text-white transition lg:static lg:w-72 lg:translate-x-0 ${theme.aside} ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.brandIcon}`}>
              <RoleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-bold tracking-wide sm:text-lg">SMARTSCAN</div>
              <div className={`truncate text-[11px] uppercase tracking-wider ${theme.roleTone}`}>
                {user?.role || theme.badge}
              </div>
            </div>
          </div>
          <button type="button" className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {variant === 'manager' && (
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Your store</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-teal-200">
              {user?.supermarketName || 'No active supermarket'}
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 pb-24">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? theme.activeNav : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {link.icon}
              <span className="truncate">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display truncate text-base font-bold text-slate-900 sm:text-lg">{title}</h1>
              <p className="truncate text-[11px] text-slate-500 sm:text-xs">
                {user?.fullName}
                <span className="hidden sm:inline"> · {user?.email}</span>
                {variant === 'manager' && user?.supermarketName ? (
                  <span className="hidden sm:inline"> · {user.supermarketName}</span>
                ) : null}
              </p>
            </div>
          </div>
          {user?.profileImage ? (
            <img src={user.profileImage} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10" />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800 sm:h-10 sm:w-10"
            >
              {user?.fullName?.charAt(0) || 'U'}
            </div>
          )}
        </header>

        {paymentRequest && (
          <div className="border-b border-amber-200 bg-amber-100 px-3 py-2 text-center text-sm font-semibold text-amber-900 sm:px-4">
            Payment requested:{' '}
            {paymentRequest.amountToPay ? `${paymentRequest.amountToPay.toLocaleString()} RWF` : 'Review now'}
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <PaymentPopup />
    </div>
  );
}
