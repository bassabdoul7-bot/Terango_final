import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PartnerRegisterPage from './pages/PartnerRegisterPage';
import DashboardPage from './pages/DashboardPage';
import DriversPage from './pages/DriversPage';
import RidersPage from './pages/RidersPage';
import RidesPage from './pages/RidesPage';
import RevenuePage from './pages/RevenuePage';
import PhotosPage from './pages/PhotosPage';
import PartnersPage from './pages/PartnersPage';
import PartnerDashboardPage from './pages/PartnerDashboardPage';
import PartnerDriversPage from './pages/PartnerDriversPage';
import PartnerEarningsPage from './pages/PartnerEarningsPage';

function ProtectedRoute({ children }) {
  var { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  var { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" />;
  return children;
}

function RoleBasedDashboard() {
  var { isAdmin, isPartner } = useAuth();
  if (isPartner) return <PartnerDashboardPage />;
  return <DashboardPage />;
}

function AppRoutes() {
  var { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <PartnerRegisterPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<RoleBasedDashboard />} />
        {/* Admin routes */}
        <Route path="drivers" element={<AdminRoute><DriversPage /></AdminRoute>} />
        <Route path="riders" element={<AdminRoute><RidersPage /></AdminRoute>} />
        <Route path="rides" element={<AdminRoute><RidesPage /></AdminRoute>} />
        <Route path="revenue" element={<AdminRoute><RevenuePage /></AdminRoute>} />
        <Route path="photos" element={<AdminRoute><PhotosPage /></AdminRoute>} />
        <Route path="partners" element={<AdminRoute><PartnersPage /></AdminRoute>} />
        {/* Partner routes */}
        <Route path="my-drivers" element={<PartnerDriversPage />} />
        <Route path="my-earnings" element={<PartnerEarningsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
