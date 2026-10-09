import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppButton } from '../src/components/common/AppButton';
import { AppText } from '../src/components/common/AppText';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { ErrorState, LoadingState } from '../src/components/common/StateViews';
import { USER_ROLES } from '../src/constants/domain';
import { ROUTES } from '../src/constants/routes';
import { AUTH_STATUS, useAuth } from '../src/contexts/AuthContext';
import { isOnboarded } from '../src/services/onboarding';
import { spacing } from '../src/theme';
import { friendlyError } from '../src/utils/errors';
import { homeRouteForRole } from '../src/utils/roleRoute';

/**
 * Entry route: decides where the user belongs.
 * signed out -> welcome (first run) or sign-in; signed in -> the role's own interface.
 */
export default function Index() {
  const { t } = useTranslation();
  const { status, profile, error, reload, signOut } = useAuth();
  const [onboarded, setOnboarded] = useState(null);

  useEffect(() => {
    isOnboarded().then(setOnboarded);
  }, []);

  if (status === AUTH_STATUS.LOADING || onboarded === null) return <LoadingState />;

  if (status === AUTH_STATUS.ERROR) {
    return (
      <ScreenContainer scroll={false}>
        <ErrorState message={friendlyError(error, t)} onRetry={reload} />
        <View style={{ paddingHorizontal: spacing.xxl }}>
          <AppButton variant="secondary" title={t('profile.signOut')} onPress={signOut} />
        </View>
      </ScreenContainer>
    );
  }

  if (status === AUTH_STATUS.SIGNED_IN) {
    const route = homeRouteForRole(profile.role);
    if (route) return <Redirect href={route} />;
    return (
      <ScreenContainer scroll={false}>
        <ErrorState
          message={t(
            profile.role === USER_ROLES.PARK_MANAGER ? 'errors.useWebDashboard' : 'errors.forbidden',
          )}
        />
        <View style={{ paddingHorizontal: spacing.xxl }}>
          <AppText
            variant="caption"
            color="textMuted"
            style={{ textAlign: 'center', marginBottom: spacing.lg }}
          >
            {t('common.appName')}
          </AppText>
          <AppButton variant="secondary" title={t('profile.signOut')} onPress={signOut} />
        </View>
      </ScreenContainer>
    );
  }

  return <Redirect href={onboarded ? ROUTES.signIn : ROUTES.welcome} />;
}
