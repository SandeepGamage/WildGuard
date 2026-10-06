import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants';
import { AUTH_STATUS, useAuth } from './AuthContext';

/** Route guard: signed-out visitors go to the login page and come back afterwards. */
export function RequireManager({ children }) {
  const { status } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (status === AUTH_STATUS.LOADING) {
    return (
      <p className="page-message" role="status">
        {t('common.loading')}
      </p>
    );
  }
  if (status !== AUTH_STATUS.SIGNED_IN) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}
