import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireManager } from './auth/RequireManager';
import { AppShell } from './components/AppShell';
import { ROUTES } from './constants';
import LoginPage from './pages/LoginPage';

// The dashboard pages carry the map and chart libraries; loading them lazily keeps sign-in fast.
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SavedReportsPage = lazy(() => import('./pages/SavedReportsPage'));

function Dashboard({ children }) {
  const { t } = useTranslation();
  return (
    <RequireManager>
      <AppShell>
        <Suspense
          fallback={
            <p className="page-message" role="status">
              {t('common.loading')}
            </p>
          }
        >
          {children}
        </Suspense>
      </AppShell>
    </RequireManager>
  );
}

/** Routes of the Park Manager web dashboard. */
export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route
        path={ROUTES.reports}
        element={
          <Dashboard>
            <AnalyticsPage />
          </Dashboard>
        }
      />
      <Route
        path={ROUTES.saved}
        element={
          <Dashboard>
            <SavedReportsPage />
          </Dashboard>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.reports} replace />} />
    </Routes>
  );
}
