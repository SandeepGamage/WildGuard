import { MapPin } from 'lucide-react-native';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { LoadingState } from '../../src/components/common/StateViews';
import { SyncStatusCard } from '../../src/components/patrol/SyncStatusCard';
import { config } from '../../src/constants/config';
import { PATROL_ERRORS } from '../../src/constants/patrol';
import { ROUTES } from '../../src/constants/routes';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePatrol } from '../../src/contexts/PatrolContext';
import { colors, spacing } from '../../src/theme';

/** R1 – Start patrol: the assigned park and sector, the device check, and the Start button. */
export default function StartPatrolScreen() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const patrol = usePatrol();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  if (!patrol.ready) return <LoadingState />;
  if (patrol.session) return <Redirect href={ROUTES.ranger.active} />;

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      await patrol.startPatrol();
      router.replace(ROUTES.ranger.active);
    } catch (e) {
      setError(
        e.code === PATROL_ERRORS.PERMISSION ? t('patrol.start.permissionDenied') : t('patrol.start.failed'),
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <ScreenContainer
      footer={
        <AppButton
          title={t('patrol.start.button')}
          onPress={start}
          loading={starting}
          testID="start-patrol"
        />
      }
    >
      <AppHeader title={t('patrol.start.title')} subtitle={t('patrol.start.subtitle', { name: profile.fullName })} />

      <Card tone="tint" style={styles.card}>
        <View style={styles.row}>
          <MapPin size={24} color={colors.primary} />
          <View style={styles.grow}>
            <AppText variant="cardTitle" testID="assigned-park">
              {patrol.assignment.parkName}
            </AppText>
            <AppText variant="body" color="textMuted" testID="assigned-sector">
              {patrol.assignment.sectorName}
            </AppText>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="bodyStrong">{t('patrol.start.deviceCheck')}</AppText>
        <AppText variant="caption" color="textMuted" style={styles.note}>
          {t('patrol.start.interval', { seconds: patrol.assignment.intervalMs / 1000 })}
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.note}>
          {t('patrol.start.foregroundNote')}
        </AppText>
      </Card>

      {config.demoMode ? (
        <Card tone="notice" style={styles.card}>
          <View style={styles.row}>
            <AppText variant="bodyStrong" style={styles.grow}>
              {t('patrol.start.simulate')}
            </AppText>
            <Switch
              value={patrol.simulateGps}
              onValueChange={patrol.setSimulateGps}
              accessibilityLabel={t('patrol.start.simulate')}
              testID="simulate-gps"
            />
          </View>
        </Card>
      ) : null}

      <SyncStatusCard
        syncState={patrol.syncState}
        pendingCount={patrol.stats.pendingCount}
        retryDelayMs={patrol.retryDelayMs}
        onRetry={patrol.retryNow}
      />

      {error ? (
        <AppText variant="caption" color="dangerText" style={styles.error} accessibilityLiveRegion="polite" testID="start-error">
          {error}
        </AppText>
      ) : null}

      <AppButton variant="secondary" title={t('profile.signOut')} onPress={signOut} style={styles.signOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  note: { marginTop: spacing.xs },
  error: { marginTop: spacing.md },
  signOut: { marginTop: spacing.xl },
});
