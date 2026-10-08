import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';
import { CirclePlus, SignalLow, Smartphone } from 'lucide-react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { LoadingState } from '../../src/components/common/StateViews';
import { HoldToConfirmButton } from '../../src/components/patrol/HoldToConfirmButton';
import { StatTile } from '../../src/components/patrol/StatTile';
import { SyncStatusCard } from '../../src/components/patrol/SyncStatusCard';
import { config } from '../../src/constants/config';
import { PATROL_RULES } from '../../src/constants/patrol';
import { ROUTES } from '../../src/constants/routes';
import { usePatrol } from '../../src/contexts/PatrolContext';
import { colors, spacing } from '../../src/theme';
import { formatDistance, formatDuration } from '../../src/utils/patrolFormat';

/** R2 – Active patrol: live timer, distance, "saved on phone" badge, and the incident / end actions. */
export default function ActivePatrolScreen() {
  const { t } = useTranslation();
  const patrol = usePatrol();
  const { session } = patrol;
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!patrol.ready) return <LoadingState />;
  if (!session) return ending ? null : <Redirect href={ROUTES.ranger.start} />;

  const end = async () => {
    setEnding(true);
    await patrol.endPatrol();
    router.replace(ROUTES.ranger.summary);
  };

  return (
    <ScreenContainer
      footer={
        <HoldToConfirmButton
          title={t('patrol.active.endHold')}
          hint={t('patrol.active.endHint')}
          holdMs={PATROL_RULES.END_HOLD_MS}
          onConfirm={end}
          testID="end-patrol"
        />
      }
    >
      <AppHeader
        title={t('patrol.active.title')}
        subtitle={t('patrol.active.subtitle', { park: session.parkName, sector: session.sectorName })}
      />

      <View style={styles.badge} testID="saved-on-phone">
        <Smartphone size={16} color={colors.primary} />
        <AppText variant="captionStrong">
          {t('patrol.active.savedOnPhone')} · {t('patrol.sync.pending', { count: patrol.stats.pendingCount })}
        </AppText>
      </View>

      <View style={styles.grid}>
        <StatTile
          label={t('patrol.active.duration')}
          value={formatDuration(now - new Date(session.startedAt).getTime())}
          testID="stat-duration"
        />
        <StatTile
          label={t('patrol.active.distance')}
          value={formatDistance(patrol.stats.distanceMeters)}
          testID="stat-distance"
        />
        <StatTile label={t('patrol.active.points')} value={String(patrol.stats.trackPointCount)} testID="stat-points" />
        <StatTile
          label={t('patrol.active.incidents')}
          value={String(patrol.stats.incidentCount)}
          testID="stat-incidents"
        />
      </View>

      {patrol.gpsWeak ? (
        <Card tone="warning" style={styles.gap} testID="gps-weak">
          <View style={styles.row}>
            <SignalLow size={22} color={colors.warningText} />
            <AppText variant="bodyStrong" color="warningText" style={styles.grow}>
              {t('patrol.active.gpsWeak')}
            </AppText>
          </View>
        </Card>
      ) : null}

      <SyncStatusCard
        syncState={patrol.syncState}
        pendingCount={patrol.stats.pendingCount}
        retryDelayMs={patrol.retryDelayMs}
        onRetry={patrol.retryNow}
      />

      {config.demoMode && patrol.simulateGps ? (
        <Card tone="notice" style={styles.gap}>
          <SimulationSwitch
            label={t('patrol.active.simWeak')}
            value={patrol.simulation.weakGps}
            onChange={(value) => patrol.setSimulationFlag('weakGps', value)}
            testID="sim-weak"
          />
          <SimulationSwitch
            label={t('patrol.active.simNoGps')}
            value={patrol.simulation.noGps}
            onChange={(value) => patrol.setSimulationFlag('noGps', value)}
            testID="sim-nogps"
          />
        </Card>
      ) : null}

      <AppButton
        title={t('patrol.active.logIncident')}
        icon={<CirclePlus size={20} color={colors.textOnPrimary} />}
        onPress={() => router.push(ROUTES.ranger.logIncident)}
        style={styles.gap}
        testID="log-incident"
      />
    </ScreenContainer>
  );
}

function SimulationSwitch({ label, value, onChange, testID }) {
  return (
    <View style={styles.row}>
      <AppText variant="bodyStrong" style={styles.grow}>
        {label}
      </AppText>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.successTint,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  gap: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
});
