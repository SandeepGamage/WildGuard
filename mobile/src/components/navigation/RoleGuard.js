import { Redirect } from 'expo-router';
import { AUTH_STATUS, useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants/routes';
import { homeRouteForRole } from '../../utils/roleRoute';
import { LoadingState } from '../common/StateViews';

/**
 * Navigation-layer role protection. Signed-out users go to the entry route and
 * users of another role are sent to their own interface. This is a UX guard
 * only: the backend independently enforces roles on every request.
 *
 * @param {{ role: string, children: import('react').ReactNode }} props
 */
export function RoleGuard({ role, children }) {
  const { status, profile } = useAuth();

  if (status === AUTH_STATUS.LOADING) return <LoadingState />;
  if (status !== AUTH_STATUS.SIGNED_IN) return <Redirect href="/" />;
  if (profile.role !== role) {
    return <Redirect href={homeRouteForRole(profile.role) ?? ROUTES.signIn} />;
  }
  return children;
}
