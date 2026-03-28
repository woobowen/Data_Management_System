import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { FieldLabel, PageCard, PrimaryButton, TextInput } from '../components/ui';
import { useAuth } from '../contexts/auth-context';

export function LoginPage() {
  const { login, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6">
      <PageCard className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-slate-900">登录账号</h1>
        <p className="mt-2 text-sm text-slate-500">登录后即可创建问卷、管理问卷并查看统计结果。</p>
        <form
          className="mt-8 space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            clearError();
            setSubmitting(true);
            try {
              await login(username, password);
              const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';
              navigate(redirectTo, { replace: true });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div>
            <FieldLabel>用户名</FieldLabel>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" autoComplete="username" />
          </div>
          <div>
            <FieldLabel>密码</FieldLabel>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" autoComplete="current-password" />
          </div>
          {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {submitting ? '登录中…' : '登录'}
          </PrimaryButton>
        </form>
        <p className="mt-6 text-sm text-slate-500">
          还没有账号？ <Link to="/register" className="font-medium text-slate-900 underline-offset-4 hover:underline">注册</Link>
        </p>
      </PageCard>
    </div>
  );
}
