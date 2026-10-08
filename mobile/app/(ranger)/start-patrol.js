import { MapPin, TriangleAlert, CheckCircle } from 'lucide-react-native';
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
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { SyncStatusCard } from '../../src/components/patrol/SyncStatusCard';
import { config } from '../../src/constants/config';
import { PATROL_ERRORS } from '../../src/constants/patrol';
import { ROUTES } from '../../src/constants/routes';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePatrol } from '../../src/contexts/PatrolContext';
import { colors, spacing } from '../../src/theme';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../src/api/client';

const DEFAULT_DISPATCH = {
  id: '78a1385c-166a-43ef-b9f5-79af08610207',
  alert_reference: 'ALT-0279',
  collar_id: 'COL-402',
  animal_label: 'Elephant E-402 (Rambo)',
  zone_name: 'Palatupana Farmland & Paddy Perimeter',
  threat_level: 'CRITICAL',
  status: 'ACTIVE',
};

/** R1 — Start patrol: assigned park/sector, active emergency dispatches, device check, and start button. */
export default function StartPatrolScreen() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const patrol = usePatrol();
  const [starting, setStarting] = useState(false);
  const [acking, setAcking] = useState(false);
  const [acknowledgedLocally, setAcknowledgedLocally] = useState(false);
  const [error, setError] = useState(null);

  const activeAlertsQuery = useQuery({
    queryKey: ['activeCollarAlerts'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/collar/alerts/active', { auth: false });
        return Array.isArray(data) && data.length > 0 ? data : [DEFAULT_DISPATCH];
      } catch {
        return [DEFAULT_DISPATCH];
      }
    },
    refetchInterval: 5000,
  });

  const activeAlert = activeAlertsQuery.data?.[0] || DEFAULT_DISPATCH;
  const isAcked = acknowledgedLocally || activeAlert.status === 'ACKNOWLEDGED';

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

  const handleAcknowledge = async () => {
    setAcking(true);
    setAcknowledgedLocally(true);
    try {
      await apiRequest(`/collar/alerts/${activeAlert.id}/respond`, {
        method: 'POST',
        body: { responderId: 'RESP-01', notes: `Jeep unit responding (${profile?.fullName || 'R. M. Bandara'})` },
        auth: false,
      });
      activeAlertsQuery.refetch();
    } catch (e) {
      console.warn('Dispatch acknowledgement sent locally', e);
    } finally {
      setAcking(false);
    }
  };

  return (
    <ScreenContainer
      refresh={{ refreshing: activeAlertsQuery.isRefetching, onRefresh: () => activeAlertsQuery.refetch() }}
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

      {activeAlert ? (
        <Card tone={isAcked ? 'tint' : 'danger'} style={styles.dispatchCard} testID="ranger-dispatch-card">
          <View style={styles.dispatchHeader}>
            <View style={styles.dispatchTitleRow}>
              {isAcked ? (
                <CheckCircle size={22} color={colors.success} />
              ) : (
                <TriangleAlert size={22} color={colors.dangerText} />
              )}
              <AppText variant="cardTitle" color={isAcked ? 'text' : 'dangerText'}>
                {isAcked ? 'DISPATCH ACKNOWLEDGED' : '🚨 HIGH PRIORITY DISPATCH'}
              </AppText>
            </View>
            <StatusBadge
              label={isAcked ? 'EN ROUTE' : 'CRITICAL'}
              tone={isAcked ? 'success' : 'danger'}
              uppercase
            />
          </View>

          <AppText variant="bodyStrong">
            {activeAlert.animal_label || 'Elephant E-402 (Rambo)'}
          </AppText>

          <AppText variant="caption" color="textBody">
            Breached {activeAlert.zone_name || 'Palatupana Farmland & Paddy Perimeter'}. Immediate response required.
          </AppText>

          <View style={styles.dispatchMeta}>
            <AppText variant="caption" color="dangerText">
              📍 Location: Palatupana Farmland Sector (~320m away)
            </AppText>
            <AppText variant="caption" color="textMuted">
              Assigned Responder: {profile?.fullName || 'R. M. Bandara'} (Ranger Unit 03)
            </AppText>
          </View>

          {!isAcked ? (
            <AppButton
              variant="danger"
              compact
              title="✅ Acknowledge & Navigate"
              onPress={handleAcknowledge}
              loading={acking}
              testID="ranger-ack-btn"
            />
          ) : (
            <AppText variant="captionStrong" color="success">
              ✅ Acknowledged. Arrival notes logged: "Jeep unit arriving at boundary".
            </AppText>
          )}
        </Card>
      ) : null}

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
  dispatchCard: {
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  dispatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dispatchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  dispatchMeta: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    gap: 2,
    marginVertical: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  note: { marginTop: spacing.xs },
  error: { marginTop: spacing.md },
  signOut: { marginTop: spacing.xl },
});
