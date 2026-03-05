import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { hasPermission, type Permission } from '@ligare/shared';

const navItems: { label: string; path: string; permission?: Permission }[] = [
  { label: '📞 Calls', path: '/calls', permission: 'calls:read' },
  { label: '📊 Dashboard', path: '/dashboard', permission: 'dashboard:view' },
  { label: '👥 Users', path: '/admin/users', permission: 'users:manage' },
  { label: '🏷️ Categories', path: '/admin/categories', permission: 'categories:manage' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const visibleNav = navItems.filter(
    (item) => !item.permission || hasPermission(user!.role, item.permission)
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top navbar */}
      <nav className="bg-brand-900 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold tracking-tight">
                Ligare <span className="text-brand-200">Call Center</span>
              </Link>
              <div className="hidden sm:flex gap-1">
                {visibleNav.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname.startsWith(item.path)
                        ? 'bg-brand-700 text-white'
                        : 'text-brand-200 hover:bg-brand-700 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-brand-200">{user?.name}</span>
                <span className="ml-2 rounded bg-brand-700 px-2 py-0.5 text-xs">{user?.role}</span>
              </div>
              <button
                onClick={logout}
                className="rounded-md bg-brand-700 px-3 py-1.5 text-sm hover:bg-brand-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
