import { CloudOff, CloudUpload, RefreshCw, CircleCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SYNC_STATE } from '../../contexts/PatrolContext';
import { colors, spacing } from '../../theme';
import { formatWait } from '../../utils/patrolFormat';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';

/**
 * "Saved on phone" status: how many items are waiting, whether the phone is uploading,
 * offline, or retrying after a failure (with a Retry now button).
 */
export function SyncStatusCard({ syncState, pendingCount, retryDelayMs, onRetry }) {
  const { t } = useTranslation();

  const view = {
    [SYNC_STATE.OFFLINE]: { Icon: CloudOff, tone: 'notice', text: t('patrol.sync.offline') },
    [SYNC_STATE.SYNCING]: { Icon: CloudUpload, tone: 'tint', text: t('patrol.sync.syncing') },
    [SYNC_STATE.RETRYING]: {
      Icon: RefreshCw,
      tone: 'warning',
      text: t('patrol.sync.retrying', { time: formatWait(retryDelayMs ?? 0) }),
    },
    [SYNC_STATE.IDLE]: {
      Icon: pendingCount > 0 ? CloudUpload : CircleCheck,
      tone: 'tint',
      text: pendingCount > 0 ? t('patrol.sync.waiting') : t('patrol.sync.allUploaded'),
    },
  }[syncState];

  return (
    <Card tone={view.tone} testID="sync-status">
      <View style={styles.row}>
        <view.Icon size={22} color={colors.primary} />
        <View style={styles.text}>
          <AppText variant="bodyStrong">{view.text}</AppText>
          <AppText variant="caption" color="textMuted" testID="pending-count">
            {t('patrol.sync.pending', { count: pendingCount })}
          </AppText>
        </View>
      </View>
      {syncState === SYNC_STATE.RETRYING || (syncState === SYNC_STATE.IDLE && pendingCount > 0) ? (
        <AppButton
          compact
          variant="secondary"
          title={t('patrol.sync.retryNow')}
          onPress={onRetry}
          style={styles.retry}
          testID="retry-now"
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  retry: { marginTop: spacing.md },
});
