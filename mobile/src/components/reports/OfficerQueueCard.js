import { FileText, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { INCIDENT_STATUS, URGENCY } from '../../constants/domain';
import { INCIDENT_TYPE_META } from '../../constants/incidentTypes';
import { colors, radius, spacing } from '../../theme';
import { formatTimeAgo } from '../../utils/time';
import { villageName } from '../../utils/villageName';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';

/** Pill for a queue row: urgent > call back > grouped count > in review > pending. */
export function queuePill(item, t) {
  if (item.urgency === URGENCY.URGENT) return { label: t('queue.pill.urgent'), tone: 'urgent' };
  if (item.callBackRequired) return { label: t('queue.pill.callBack'), tone: 'earth' };
  if (item.groupedCount > 1)
    return { label: t('queue.pill.reports', { count: item.groupedCount }), tone: 'warning' };
  if (item.status === INCIDENT_STATUS.UNDER_REVIEW)
    return { label: t('queue.pill.inReview'), tone: 'neutral' };
  return { label: t('queue.pill.pending'), tone: 'neutral' };
}

/**
 * Verification-queue row (Figma "Verification queue"). Duplicates are shown as a
 * single grouped card with a count rather than cluttering the list.
 */
export function OfficerQueueCard({ item, onOpen }) {
  const { t, i18n } = useTranslation();
  const urgent = item.urgency === URGENCY.URGENT;
  const pill = queuePill(item, t);
  const meta = INCIDENT_TYPE_META[item.incidentType];
  const Icon = urgent ? TriangleAlert : FileText;

  let note = null;
  if (item.groupedCount > 1) note = t('queue.groupedNote');
  else if (item.callBackRequired) note = t('queue.callBackNote');

  return (
    <Card
      onPress={() => onOpen(item)}
      accessibilityLabel={`${t(meta.labelKey)} ${item.trackingCode}`}
      testID={`queue-item-${item.trackingCode}`}
    >
      <View style={styles.row}>
        <View style={[styles.tile, { backgroundColor: urgent ? colors.dangerTint : colors.surfaceTint }]}>
          <Icon size={22} color={urgent ? colors.dangerText : colors.primary} />
        </View>
        <View style={styles.text}>
          <AppText variant="cardTitle">{t(meta.labelKey)}</AppText>
          <AppText variant="caption" color="textMuted">
            {villageName(item.village, i18n.language)} · {formatTimeAgo(item.createdAt, t)}
          </AppText>
          {note ? (
            <AppText variant="caption" color="earthText" style={styles.note}>
              {note}
            </AppText>
          ) : null}
        </View>
        <StatusBadge label={pill.label} tone={pill.tone} uppercase />
      </View>
      <AppText variant="bodyStrong" style={styles.open}>
        {t('queue.openReport')}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  note: { marginTop: spacing.xs },
  open: { alignSelf: 'flex-end', marginTop: spacing.sm },
});
