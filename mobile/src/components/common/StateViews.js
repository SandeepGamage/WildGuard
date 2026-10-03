import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../../theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

/** Centered spinner with an optional message. */
export function LoadingState({ message }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="progressbar" testID="loading-state">
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText variant="body" color="textMuted" style={styles.message}>
        {message ?? t('common.loading')}
      </AppText>
    </View>
  );
}

/** Friendly error with a retry action. Never receives raw backend messages. */
export function ErrorState({ message, onRetry }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} testID="error-state">
      <AppText variant="heading" style={styles.message}>
        {t('common.somethingWrong')}
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? (
        <AppButton compact title={t('common.retry')} onPress={onRetry} style={styles.retry} />
      ) : null}
    </View>
  );
}

/** Empty list placeholder such as "No pending reports." */
export function EmptyState({ message, icon = null }) {
  return (
    <View style={styles.center} testID="empty-state">
      {icon}
      <AppText variant="body" color="textMuted" style={styles.message}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    paddingHorizontal: spacing.xxl,
  },
  message: { textAlign: 'center', marginTop: spacing.md },
  retry: { marginTop: spacing.lg, minWidth: 160 },
});
