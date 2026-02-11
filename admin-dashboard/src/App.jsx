import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DriversPage from './pages/DriversPage';
import RidersPage from './pages/RidersPage';
import RidesPage from './pages/RidesPage';
import RevenuePage from './pages/RevenuePage';
import PhotosPage from './pages/PhotosPage';

function ProtectedRoute({ children }) {
  var { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  var { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="riders" element={<RidersPage />} />
        <Route path="rides" element={<RidesPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="photos" element={<PhotosPage />} />
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
