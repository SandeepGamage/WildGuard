import { User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { LanguageSheet } from '../../src/components/common/LanguageSwitcher';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { EMERGENCY_NUMBER, LANGUAGE_OPTIONS } from '../../src/constants/domain';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, radius, spacing } from '../../src/theme';

function SettingRow({ label, value, onPress }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.setting}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </Card>
    </Pressable>
  );
}

/** Officer profile: assigned GN divisions, language, and sign out. */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const language = LANGUAGE_OPTIONS.find((option) => option.code === i18n.language) ?? LANGUAGE_OPTIONS[0];
  const divisionNames = profile.divisions?.map((division) => division.name).join(' · ');

  return (
    <ScreenContainer>
      <AppHeader title={t('profile.title')} subtitle={t('profile.role')} />

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <User size={44} color={colors.textOnPrimary} />
        </View>
        <View style={styles.identityText}>
          <AppText variant="heading">{profile.fullName}</AppText>
          <AppText variant="body" color="textMuted">
            {t('profile.role')}
          </AppText>
        </View>
      </View>

      <Card tone="tint" style={styles.area} testID="assigned-area">
        <AppText variant="caption" color="textMuted">
          {t('profile.assignedArea')}
        </AppText>
        <AppText variant="cardTitle">{divisionNames}</AppText>
        <AppText variant="caption" color="textMuted">
          {t('profile.divisions', { count: profile.divisionIds.length })}
        </AppText>
      </Card>

      <View style={styles.settings}>
        <SettingRow
          label={t('profile.language')}
          value={language.nativeName}
          onPress={() => setLanguageOpen(true)}
        />
        <SettingRow label={t('profile.notifications')} value={t('profile.on')} />
        <SettingRow label={t('profile.offlineCache')} value={t('profile.available')} />
        <SettingRow
          label={t('profile.help')}
          value={t('profile.open')}
          onPress={() =>
            Alert.alert(t('profile.helpTitle'), t('profile.helpBody', { number: EMERGENCY_NUMBER }))
          }
        />
      </View>

      <AppButton
        variant="danger"
        title={t('profile.signOut')}
        onPress={() => setConfirmOpen(true)}
        style={styles.signOut}
        testID="sign-out"
      />
      <ConfirmDialog
        visible={confirmOpen}
        title={t('confirm.signOutTitle')}
        message={t('confirm.signOutMessage')}
        confirmText={t('confirm.signOutConfirm')}
        cancelText={t('confirm.cancel')}
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          signOut();
        }}
        onCancel={() => setConfirmOpen(false)}
        testIDPrefix="confirm-dialog"
      />
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginBottom: spacing.xl },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: spacing.xxs },
  area: { gap: spacing.xs },
  settings: { gap: spacing.md, marginTop: spacing.xl },
  setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 64 },
  pressed: { opacity: 0.85 },
  signOut: { marginTop: spacing.xxl },
});
