import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { HeroCard } from '../../src/components/common/HeroCard';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { EMERGENCY_NUMBER } from '../../src/constants/domain';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, radius, spacing } from '../../src/theme';

const TIPS = [
  { title: 'safety.tip1Title', body: 'safety.tip1Body' },
  { title: 'safety.tip2Title', body: 'safety.tip2Body' },
  { title: 'safety.tip3Title', body: 'safety.tip3Body' },
];

/** Safety advice for human-elephant conflict (design note 9). */
export default function SafetyScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <ScreenContainer>
      <AppHeader title={t('safety.title')} subtitle={t('safety.subtitle')} />

      <HeroCard
        title={t('safety.heroTitle')}
        body={t('safety.heroBody')}
        caption={t('safety.heroCaption')}
        action={
          <AppButton
            compact
            variant="accent"
            title={t('safety.call', { number: EMERGENCY_NUMBER })}
            onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)}
            testID="safety-call"
          />
        }
      />

      <View style={styles.tips}>
        {TIPS.map((tip, index) => (
          <Card key={tip.title} style={styles.tip}>
            <View style={styles.number}>
              <AppText variant="bodyStrong">{index + 1}</AppText>
            </View>
            <View style={styles.tipText}>
              <AppText variant="cardTitle">{t(tip.title)}</AppText>
              <AppText variant="caption" color="textMuted">
                {t(tip.body)}
              </AppText>
            </View>
          </Card>
        ))}
      </View>

      <AppButton
        compact
        variant="danger"
        icon={<LogOut size={18} color={colors.textOnPrimary} />}
        title={t('profile.signOut')}
        onPress={() => setConfirmVisible(true)}
        style={styles.signOut}
        testID="villager-sign-out"
      />

      <ConfirmDialog
        visible={confirmVisible}
        title={t('confirm.signOutTitle')}
        message={t('confirm.signOutMessage')}
        confirmText={t('confirm.signOutConfirm')}
        cancelText={t('confirm.cancel')}
        variant="danger"
        onConfirm={() => {
          setConfirmVisible(false);
          signOut();
        }}
        onCancel={() => setConfirmVisible(false)}
        testIDPrefix="confirm-dialog"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tips: { gap: spacing.md, marginTop: spacing.xl },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 88 },
  number: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, gap: spacing.xxs },
  signOut: { marginTop: spacing.xxl },
});
