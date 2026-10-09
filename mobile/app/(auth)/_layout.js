import { Redirect, Stack } from 'expo-router';
import { AUTH_STATUS, useAuth } from '../../src/contexts/AuthContext';
import { colors } from '../../src/theme';
import { homeRouteForRole } from '../../src/utils/roleRoute';

/** Unauthenticated flow: welcome, language, sign in, create account. */
export default function AuthLayout() {
  const { status, profile } = useAuth();

  if (status === AUTH_STATUS.SIGNED_IN) {
    // Roles without a mobile interface go to the entry route, which explains where to sign in instead.
    return <Redirect href={homeRouteForRole(profile.role) ?? '/'} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
