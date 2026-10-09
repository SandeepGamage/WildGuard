import { Route } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/common/StateViews';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { PatrolDetailModal } from '../../src/components/patrol/PatrolDetailModal';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePatrol } from '../../src/contexts/PatrolContext';
import { patrolEngine } from '../../src/services/patrol';
import { colors, spacing } from '../../src/theme';
import { formatDistance, formatDuration, formatPatrolDate } from '../../src/utils/patrolFormat';

/** Past patrols of this ranger, newest first, read from the phone so offline patrols show too. */
export default function PatrolHistoryScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { stats } = usePatrol();
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState(null);

  const openDetail = async (sessionId) => {
    try {
      setDetail(await patrolEngine.getDetail(sessionId));
    } catch {
      setFailed(true);
    }
  };

  const load = useCallback(async () => {
    try {
      setHistory(await patrolEngine.listHistory(profile.id));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [profile.id]);

  // Reload when the tab is opened and whenever uploads change what is still waiting.
  const pendingCount = stats.pendingCount;
  useFocusEffect(
    useCallback(() => {
      load();
      // pendingCount is a deliberate trigger: uploads change each patrol's status.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, pendingCount]),
  );

  let content;
  if (failed) content = <ErrorState message={t('patrolHistory.failed')} onRetry={load} />;
  else if (!history) content = <LoadingState />;
  else if (history.length === 0) {
    content = <EmptyState message={t('patrolHistory.empty')} icon={<Route size={32} color={colors.textMuted} />} />;
  } else {
    content = history.map((item) => (
      <Card
        key={item.session.id}
        style={styles.card}
        onPress={() => openDetail(item.session.id)}
        accessibilityLabel={formatPatrolDate(item.session.startedAt)}
        testID={`patrol-${item.session.id}`}
      >
        <View style={styles.top}>
          <View style={styles.grow}>
            <AppText variant="cardTitle">{formatPatrolDate(item.session.startedAt)}</AppText>
            <AppText variant="caption" color="textMuted">
              {item.session.parkName} · {item.session.sectorName}
            </AppText>
          </View>
          <StatusBadge
            label={item.pendingCount > 0 ? t('patrolHistory.waiting', { count: item.pendingCount }) : t('patrolHistory.uploaded')}
            tone={item.pendingCount > 0 ? 'warning' : 'success'}
            testID="patrol-upload-badge"
          />
        </View>
        <View style={styles.stats}>
          <Stat label={t('patrol.active.duration')} value={formatDuration(item.durationMs)} />
          <Stat label={t('patrol.active.distance')} value={formatDistance(item.distanceMeters)} />
          <Stat label={t('patrol.active.incidents')} value={String(item.incidentCount)} />
        </View>
      </Card>
    ));
  }

  return (
    <ScreenContainer>
      <AppHeader title={t('patrolHistory.title')} subtitle={t('patrolHistory.subtitle')} />
      {content}
      <PatrolDetailModal detail={detail} onClose={() => setDetail(null)} />
    </ScreenContainer>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <AppText variant="bodyStrong">{value}</AppText>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  grow: { flex: 1 },
  stats: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
  stat: { flex: 1 },
});
