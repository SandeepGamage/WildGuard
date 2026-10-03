import { Check, CloudOff } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '../../../src/components/common/AppButton';
import { AppText } from '../../../src/components/common/AppText';
import { Card } from '../../../src/components/common/Card';
import { LanguageSwitcher } from '../../../src/components/common/LanguageSwitcher';
import { ScreenContainer } from '../../../src/components/common/ScreenContainer';
import { ConfirmationTracker } from '../../../src/components/reports/ConfirmationTracker';
import { REPORT_PROGRESS } from '../../../src/constants/domain';
import { ROUTES } from '../../../src/constants/routes';
import { colors, radius, spacing } from '../../../src/theme';

/**
 * Flow 3: honest confirmation. A sent report shows its reference and the
 * Received -> Being checked -> Outcome tracker. A report that is only saved on the
 * phone says so and promises an automatic retry; nothing claims that an officer
 * or ranger has been dispatched.
 */
export default function ConfirmationScreen() {
  const { t } = useTranslation();
  const { code, queued } = useLocalSearchParams();
  const isQueued = queued === '1';

  return (
    <ScreenContainer
      footer={
        <View style={styles.actions}>
          <AppButton
            variant="secondary"
            title={t('confirmation.viewReports')}
            onPress={() => router.replace(ROUTES.villager.myReports)}
            testID="view-my-reports"
          />
          <AppButton
            title={t('confirmation.reportElse')}
            onPress={() => router.navigate(ROUTES.villager.report)}
            testID="report-something-else"
          />
        </View>
      }
    >
      <View style={styles.language}>
        <LanguageSwitcher />
      </View>

      <View style={styles.hero}>
        <View style={styles.halo}>
          <View style={styles.badge}>
            {isQueued ? (
              <CloudOff size={36} color={colors.textOnPrimary} />
            ) : (
              <Check size={36} color={colors.textOnPrimary} />
            )}
          </View>
        </View>
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {isQueued ? t('confirmation.queuedTitle') : t('confirmation.title')}
        </AppText>
        {!isQueued && code ? (
          <AppText variant="cardTitle" color="textMuted" testID="tracking-code">
            {t('confirmation.reference', { code })}
          </AppText>
        ) : null}
        {isQueued ? (
          <AppText variant="body" color="textMuted" style={styles.center}>
            {t('confirmation.queuedBody')}
          </AppText>
        ) : null}
      </View>

      {isQueued ? (
        <Card tone="warning">
          <AppText variant="body" color="warningText">
            {t('confirmation.queuedNote')}
          </AppText>
        </Card>
      ) : (
        <>
          <ConfirmationTracker current={REPORT_PROGRESS.RECEIVED} />
          <Card tone="tint" style={styles.note}>
            <AppText variant="bodyStrong">{t('confirmation.officerNote')}</AppText>
            <AppText variant="caption" color="textMuted">
              {t('confirmation.officerNoteBody')}
            </AppText>
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  language: { alignItems: 'flex-end' },
  hero: { alignItems: 'center', marginBottom: spacing.xxl, gap: spacing.sm },
  halo: {
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  center: { textAlign: 'center' },
  note: { marginTop: spacing.xl, gap: spacing.xs },
  actions: { gap: spacing.md },
});
