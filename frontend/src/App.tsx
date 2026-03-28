import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { DeskScene } from './components/desk-scene';
import { AuthProvider, useAuth } from './contexts/auth-context';
import { AppShell } from './pages/app-shell';
import { DashboardPage } from './pages/dashboard-page';
import { EditorPage } from './pages/editor-page';
import { LoginPage } from './pages/login-page';
import { RegisterPage } from './pages/register-page';
import { StatsPage } from './pages/stats-page';
import { SurveyFillPage } from './pages/survey-fill-page';

function RequireAuth() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] text-slate-500">加载中…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/survey/:surveyId"
            element={
              <SurveyFillPage>
                <DeskScene />
              </SurveyFillPage>
            }
          />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/editor/new" element={<EditorPage mode="create" />} />
              <Route path="/editor/:surveyId" element={<EditorPage mode="edit" />} />
              <Route path="/stats/:surveyId" element={<StatsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
