import { Link, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context';
import { AppNavLink } from '../components/ui';

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-lg font-semibold text-slate-900">
              问卷管理台
            </Link>
            <nav className="flex items-center gap-2">
              <AppNavLink to="/dashboard">我的问卷</AppNavLink>
              <AppNavLink to="/question-bank">题库管理</AppNavLink>
              <AppNavLink to="/editor/new">新建问卷</AppNavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-800">
            <span>{user?.username}</span>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
