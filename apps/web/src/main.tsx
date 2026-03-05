import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { Layout } from './components/layout';
import { LoginPage } from './pages/login';
import { CallsPage } from './pages/calls';
import { DashboardPage } from './pages/dashboard';
import { AdminUsersPage } from './pages/admin-users';
import { AdminCategoriesPage } from './pages/admin-categories';
import { hasPermission } from '@ligare/shared';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !hasPermission(user.role, permission as any)) {
    return <Navigate to="/calls" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/calls" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/calls" replace />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="dashboard" element={<PermissionRoute permission="dashboard:view"><DashboardPage /></PermissionRoute>} />
        <Route path="admin/users" element={<PermissionRoute permission="users:manage"><AdminUsersPage /></PermissionRoute>} />
        <Route path="admin/categories" element={<PermissionRoute permission="categories:manage"><AdminCategoriesPage /></PermissionRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
