import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';
import { formatDistance, formatDuration, formatPatrolDate } from '../../utils/patrolFormat';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { StatusBadge } from '../common/StatusBadge';
import { StatTile } from './StatTile';

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color="textMuted" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );
}

function IncidentRow({ incident, t }) {
  const warnings = [
    incident.locationWarning ? t('patrolHistory.detail.lastKnownLocation') : null,
    incident.storageWarning ? t('patrolHistory.detail.photoCompressed') : null,
  ].filter(Boolean);

  return (
    <View style={styles.incident} testID={`detail-incident-${incident.id}`}>
      <View style={styles.incidentTop}>
        <AppText variant="cardTitle" style={styles.grow}>
          {t(`patrol.types.${incident.incidentType}`)}
        </AppText>
        <StatusBadge
          label={incident.syncStatus === 'SYNCED' ? t('patrolHistory.uploaded') : t('patrolHistory.notUploaded')}
          tone={incident.syncStatus === 'SYNCED' ? 'success' : 'warning'}
        />
      </View>
      <AppText variant="caption" color="textMuted">
        {formatPatrolDate(incident.occurredAt)}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
      </AppText>
      {incident.note ? <AppText variant="body">{incident.note}</AppText> : null}
      {warnings.map((warning) => (
        <AppText key={warning} variant="caption" color="warningText">
          {warning}
        </AppText>
      ))}
      {incident.photo?.uri ? (
        <Image
          source={{ uri: incident.photo.uri }}
          style={styles.photo}
          accessibilityLabel={t('details.photoAttached')}
        />
      ) : null}
    </View>
  );
}

/** Full-screen popup with everything recorded during one past patrol. */
export function PatrolDetailModal({ detail, onClose }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = detail?.session;

  return (
    <Modal visible={Boolean(detail)} animationType="slide" onRequestClose={onClose} transparent={false}>
      {detail ? (
        <View style={[styles.root, { paddingTop: insets.top + spacing.md }]} testID="patrol-detail">
          <View style={styles.header}>
            <View style={styles.grow}>
              <AppText variant="title" accessibilityRole="header">
                {t('patrolHistory.detail.title')}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {session.parkName} · {session.sectorName}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              style={styles.close}
              testID="patrol-detail-close"
            >
              <X size={22} color={colors.primary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <StatusBadge
              label={
                detail.pendingCount > 0
                  ? t('patrolHistory.waiting', { count: detail.pendingCount })
                  : t('patrolHistory.uploaded')
              }
              tone={detail.pendingCount > 0 ? 'warning' : 'success'}
            />

            <View style={styles.card}>
              <Row label={t('patrolHistory.detail.started')} value={formatPatrolDate(session.startedAt)} />
              <Row
                label={t('patrolHistory.detail.ended')}
                value={session.endedAt ? formatPatrolDate(session.endedAt) : '-'}
              />
            </View>

            <View style={styles.grid}>
              <StatTile label={t('patrol.active.duration')} value={formatDuration(detail.durationMs)} />
              <StatTile label={t('patrol.active.distance')} value={formatDistance(detail.distanceMeters)} />
              <StatTile label={t('patrol.active.points')} value={String(detail.trackPointCount)} />
              <StatTile label={t('patrol.active.incidents')} value={String(detail.incidentCount)} />
            </View>

            <AppText variant="heading" style={styles.sectionTitle}>
              {t('patrolHistory.detail.incidents')}
            </AppText>
            {detail.incidents.length === 0 ? (
              <AppText variant="body" color="textMuted">
                {t('patrolHistory.detail.noIncidents')}
              </AppText>
            ) : (
              detail.incidents.map((incident) => <IncidentRow key={incident.id} incident={incident} t={t} />)
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <AppButton title={t('common.close')} variant="secondary" onPress={onClose} />
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.md,
  },
  grow: { flex: 1 },
  close: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { flexShrink: 0 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sectionTitle: { marginTop: spacing.sm },
  incident: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  incidentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: '100%', height: 160, borderRadius: radius.card, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.md, backgroundColor: colors.background },
});
