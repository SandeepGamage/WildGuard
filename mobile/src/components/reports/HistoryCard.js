import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VERIFICATION_DECISIONS } from '../../constants/domain';
import { INCIDENT_TYPE_META } from '../../constants/incidentTypes';
import { spacing } from '../../theme';
import { formatDayAndTime } from '../../utils/time';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';

/** One audit-trail row: tracking code, category, decision pill and when it was decided. */
export function HistoryCard({ item, onPress }) {
  const { t } = useTranslation();
  const verified = item.decision === VERIFICATION_DECISIONS.VERIFIED;
  const meta = INCIDENT_TYPE_META[item.incidentType];

  let tone = 'danger';
  let outcome = t('history.rejected');
  if (verified) {
    tone = item.fieldActionRequired ? 'warning' : 'success';
    outcome = item.fieldActionRequired ? t('history.verifiedAction') : t('history.verifiedNoAction');
  }

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${item.trackingCode} ${t(meta.labelKey)}`}
      testID={`history-item-${item.trackingCode}`}
    >
      <View style={styles.top}>
        <View style={styles.text}>
          <AppText variant="captionStrong" color="textMuted">
            {item.trackingCode}
          </AppText>
          <AppText variant="cardTitle">{t(meta.labelKey)}</AppText>
        </View>
        <StatusBadge
          label={verified ? t('history.badgeVerified') : t('history.badgeRejected')}
          tone={tone}
          uppercase
        />
      </View>
      <View style={styles.bottom}>
        <AppText variant="caption" color="textMuted">
          {outcome}
        </AppText>
        <AppText variant="caption" color="textSubtle">
          {formatDayAndTime(item.verifiedAt, t)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
});
