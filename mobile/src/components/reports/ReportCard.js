import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { INCIDENT_TYPE_META } from '../../constants/incidentTypes';
import { colors, spacing } from '../../theme';
import { formatDayAndTime } from '../../utils/time';
import { villageName } from '../../utils/villageName';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';
import { progressBadge } from './progressBadge';

/**
 * Villager report row: title, honest progress pill, village + time, reference
 * and the "View status / View details" action.
 *
 * @param {{ report: object, actionLabel: string, withTime?: boolean, onPress: () => void }} props
 */
export function ReportCard({ report, actionLabel, withTime = false, onPress }) {
  const { t, i18n } = useTranslation();
  const badge = progressBadge(report, t);
  const meta = INCIDENT_TYPE_META[report.incidentType];

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${t(meta.labelKey)} ${report.trackingCode}`}
      testID={`report-card-${report.trackingCode}`}
    >
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <AppText variant="cardTitle">{t(meta.labelKey)}</AppText>
          <AppText variant="caption" color="textMuted">
            {villageName(report.village, i18n.language)} ·{' '}
            {formatDayAndTime(report.occurredAt, t, { withTime })}
          </AppText>
        </View>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </View>
      <View style={styles.divider} />
      <View style={styles.bottom}>
        <AppText variant="caption" color="textMuted">
          {t('reports.reference', { code: report.trackingCode })}
        </AppText>
        <AppText variant="bodyStrong">{actionLabel}</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  titleBlock: { flex: 1, gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
