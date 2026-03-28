import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { FieldLabel, PageCard, PrimaryButton, TextInput } from '../components/ui';
import { useAuth } from '../contexts/auth-context';

export function RegisterPage() {
  const { register, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6">
      <PageCard className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-slate-900">注册账号</h1>
        <p className="mt-2 text-sm text-slate-500">注册完成后将自动登录，并进入问卷管理后台。</p>
        <form
          className="mt-8 space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            clearError();
            setSubmitting(true);
            try {
              await register(username, password);
              navigate('/dashboard', { replace: true });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div>
            <FieldLabel>用户名</FieldLabel>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="至少 3 位" autoComplete="username" />
          </div>
          <div>
            <FieldLabel>密码</FieldLabel>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" autoComplete="new-password" />
          </div>
          {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {submitting ? '注册中…' : '注册并登录'}
          </PrimaryButton>
        </form>
        <p className="mt-6 text-sm text-slate-500">
          已有账号？ <Link to="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">返回登录</Link>
        </p>
      </PageCard>
    </div>
  );
}
