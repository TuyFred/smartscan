import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/ui';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import {
  CustomerShell,
  CustomerDashboard,
  StartShopping,
  CurrentSession,
  ScanProductPage,
  CartPage,
  CardPage,
  HistoryPage,
  ReceiptsPage,
  ReceiptDetail,
  ProfilePage,
} from './pages/customer/CustomerPages';
import {
  ManagerShell,
  ManagerDashboard,
  ManagerSessions,
  ManagerSessionDetail,
  ManagerProducts,
  ManagerCustomers,
  ManagerPayments,
  ManagerSupermarket,
  ManagerReports,
  ManagerDevices,
  CashierShell,
  CashierDashboard,
  CashierDeposits,
  CashierSellCard,
  CashierCustomers,
  CashierHelp,
  CashierRfid,
} from './pages/staff/StaffPages';
import {
  AdminShell,
  AdminDashboard,
  AdminReports,
  AdminUsers,
  AdminPinRequests,
  AdminSupermarkets,
  AdminProducts,
  AdminSessions,
  AdminPayments,
  AdminReceipts,
  AdminDevices,
  AdminAudit,
  AdminSettings,
} from './pages/admin/AdminPages';

export default function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
            <Route path="/customer" element={<CustomerShell />}>
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="start-shopping" element={<StartShopping />} />
              <Route path="session" element={<CurrentSession />} />
              <Route path="session/:sessionId" element={<CurrentSession />} />
              <Route path="scan-product" element={<ScanProductPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CartPage />} />
              <Route path="card" element={<CardPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="receipts" element={<ReceiptsPage />} />
              <Route path="receipt/:id" element={<ReceiptDetail />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['MANAGER']} />}>
            <Route path="/manager" element={<ManagerShell />}>
              <Route path="dashboard" element={<ManagerDashboard />} />
              <Route path="sessions" element={<ManagerSessions />} />
              <Route path="sessions/:id" element={<ManagerSessionDetail />} />
              <Route path="products" element={<ManagerProducts />} />
              <Route path="customers" element={<ManagerCustomers />} />
              <Route path="payments" element={<ManagerPayments />} />
              <Route path="supermarket" element={<ManagerSupermarket />} />
              <Route path="devices" element={<ManagerDevices />} />
              <Route path="reports" element={<ManagerReports />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['CASHIER']} />}>
            <Route path="/cashier" element={<CashierShell />}>
              <Route path="dashboard" element={<CashierDashboard />} />
              <Route path="sell-card" element={<CashierSellCard />} />
              <Route path="deposits" element={<CashierDeposits />} />
              <Route path="customers" element={<CashierCustomers />} />
              <Route path="help" element={<CashierHelp />} />
              <Route path="rfid" element={<CashierRfid />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminShell />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="pin-requests" element={<AdminPinRequests />} />
              <Route path="supermarkets" element={<AdminSupermarkets />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="receipts" element={<AdminReceipts />} />
              <Route path="devices" element={<AdminDevices />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  );
}
