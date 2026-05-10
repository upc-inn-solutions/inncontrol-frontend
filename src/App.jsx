import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Inventory from './pages/Inventory';
import Tasks from './pages/Tasks';
import Employees from './pages/Employees';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';

const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

export default function App() {
  const dark = useThemeStore((s) => s.dark);

  return (
    <div className={dark ? 'dark-app' : 'light-app'} style={{
      minHeight: '100vh',
      background: dark ? '#0a0f1a' : '#f0fdf4',
      color: dark ? '#f1f5f9' : '#0f172a',
      transition: 'background 0.3s, color 0.3s',
    }}>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/rooms" element={<Layout><Rooms /></Layout>} />
            <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
            <Route path="/tasks" element={<Layout><Tasks /></Layout>} />
            <Route path="/employees" element={<Layout><Employees /></Layout>} />
            <Route path="/messages" element={<Layout><Messages /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
