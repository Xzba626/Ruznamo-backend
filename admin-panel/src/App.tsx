import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { LicensesPage } from './pages/LicensesPage';
import { DevicesPage } from './pages/DevicesPage';
import { OrdersPage } from './pages/OrdersPage';
import { TelegramPage } from './pages/TelegramPage';
import { AuditPage } from './pages/AuditPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PlansPage } from './pages/PlansPage';
import { SystemPage } from './pages/SystemPage';
import { ProfilePage } from './pages/ProfilePage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="licenses" element={<LicensesPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="telegram" element={<TelegramPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
