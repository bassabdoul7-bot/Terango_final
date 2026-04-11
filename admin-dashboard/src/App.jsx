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
import ServiceProvidersPage from './pages/ServiceProvidersPage';
import ServiceRequestsPage from './pages/ServiceRequestsPage';
import MonitoringPage from './pages/MonitoringPage';
import OperationsPage from './pages/OperationsPage';

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

function AdminOrModRoute({ children }) {
  var { isAdmin, isModerator } = useAuth();
  if (!isAdmin && !isModerator) return <Navigate to="/" />;
  return children;
}

function RoleBasedDashboard() {
  var { isAdmin, isModerator, isPartner } = useAuth();
  if (isPartner) return <PartnerDashboardPage />;
  if (isModerator) return <Navigate to="/drivers" />;
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
        {/* Admin + Moderator routes */}
        <Route path="drivers" element={<AdminOrModRoute><DriversPage /></AdminOrModRoute>} />
        <Route path="rides" element={<AdminOrModRoute><RidesPage /></AdminOrModRoute>} />
        <Route path="photos" element={<AdminOrModRoute><PhotosPage /></AdminOrModRoute>} />
        <Route path="operations" element={<AdminOrModRoute><OperationsPage /></AdminOrModRoute>} />
        <Route path="monitoring" element={<AdminOrModRoute><MonitoringPage /></AdminOrModRoute>} />
        <Route path="riders" element={<AdminOrModRoute><RidersPage /></AdminOrModRoute>} />
        {/* Admin only routes */}
        <Route path="revenue" element={<AdminRoute><RevenuePage /></AdminRoute>} />
        <Route path="partners" element={<AdminRoute><PartnersPage /></AdminRoute>} />
        <Route path="services" element={<AdminRoute><ServiceProvidersPage /></AdminRoute>} />
        <Route path="service-requests" element={<AdminRoute><ServiceRequestsPage /></AdminRoute>} />
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
