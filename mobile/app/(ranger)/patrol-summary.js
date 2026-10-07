import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { StatTile } from '../../src/components/patrol/StatTile';
import { SyncStatusCard } from '../../src/components/patrol/SyncStatusCard';
import { ROUTES } from '../../src/constants/routes';
import { usePatrol } from '../../src/contexts/PatrolContext';
import { spacing } from '../../src/theme';
import { formatDistance, formatDuration } from '../../src/utils/patrolFormat';

/** R4 – Patrol summary, plus the live upload status and the Retry now action. */
export default function PatrolSummaryScreen() {
  const { t } = useTranslation();
  const patrol = usePatrol();
  const { lastSummary } = patrol;

  if (patrol.session) return <Redirect href={ROUTES.ranger.active} />;
  if (!lastSummary) return <Redirect href={ROUTES.ranger.start} />;

  return (
    <ScreenContainer
      footer={
        <AppButton title={t('patrol.summary.done')} onPress={() => router.replace(ROUTES.ranger.start)} testID="summary-done" />
      }
    >
      <AppHeader
        title={t('patrol.summary.title')}
        subtitle={t('patrol.summary.subtitle', {
          park: lastSummary.session.parkName,
          sector: lastSummary.session.sectorName,
        })}
      />

      <View style={styles.grid}>
        <StatTile label={t('patrol.active.duration')} value={formatDuration(lastSummary.durationMs)} testID="summary-duration" />
        <StatTile label={t('patrol.active.distance')} value={formatDistance(lastSummary.distanceMeters)} testID="summary-distance" />
        <StatTile label={t('patrol.active.points')} value={String(lastSummary.trackPointCount)} />
        <StatTile label={t('patrol.active.incidents')} value={String(lastSummary.incidentCount)} testID="summary-incidents" />
      </View>

      <SyncStatusCard
        syncState={patrol.syncState}
        pendingCount={patrol.stats.pendingCount}
        retryDelayMs={patrol.retryDelayMs}
        onRetry={patrol.retryNow}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
});
