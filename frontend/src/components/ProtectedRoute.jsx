import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading SMARTSCAN…
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) {
    const dash =
      user.role === 'ADMIN'
        ? '/admin/dashboard'
        : user.role === 'MANAGER'
          ? '/manager/dashboard'
          : user.role === 'CASHIER'
            ? '/cashier/dashboard'
            : '/customer/dashboard';
    return <Navigate to={dash} replace />;
  }
  return <Outlet />;
}
