import { CloudOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { INCIDENT_TYPE_META } from '../../constants/incidentTypes';
import { PENDING_STATUS } from '../../services/pendingReports.repository';
import { colors, spacing } from '../../theme';
import { formatTimeAgo } from '../../utils/time';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';

/**
 * A report that is saved on this phone and not yet delivered. It is shown
 * with the same prominence as sent reports so the reporter never wonders
 * where it went.
 */
export function PendingReportCard({ item, onDiscard }) {
  const { t } = useTranslation();
  const failed = item.status === PENDING_STATUS.FAILED;
  const meta = INCIDENT_TYPE_META[item.payload.incidentType];

  return (
    <Card tone={failed ? 'danger' : 'warning'} testID={`pending-${item.clientRequestId}`}>
      <View style={styles.row}>
        <CloudOff size={20} color={failed ? colors.dangerText : colors.warningText} />
        <View style={styles.text}>
          <AppText variant="cardTitle">{t(meta.labelKey)}</AppText>
          <AppText variant="caption" color="textMuted">
            {formatTimeAgo(item.createdAt, t)}
          </AppText>
        </View>
        <StatusBadge
          label={failed ? t('pending.failed') : t('pending.waiting')}
          tone={failed ? 'danger' : 'warning'}
        />
      </View>
      <AppText variant="caption" color={failed ? 'dangerText' : 'warningText'} style={styles.note}>
        {failed ? t('pending.failedNote') : t('pending.savedNote')}
      </AppText>
      {failed ? (
        <AppButton
          compact
          variant="secondary"
          title={t('pending.remove')}
          onPress={() => onDiscard(item.clientRequestId)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
  note: { marginTop: spacing.sm, marginBottom: spacing.xs },
});
