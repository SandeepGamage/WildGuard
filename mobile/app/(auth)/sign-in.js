import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { FormTextField } from '../../src/components/forms/FormTextField';
import { config } from '../../src/constants/config';
import { ROUTES } from '../../src/constants/routes';
import { AUTH_ERRORS, useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing } from '../../src/theme';
import { friendlyError } from '../../src/utils/errors';
import { signInSchema } from '../../src/validators/auth.schemas';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [formError, setFormError] = useState(null);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { account: '', password: '' },
  });

  const onSubmit = async ({ account, password }) => {
    setFormError(null);
    try {
      await signIn(account, password);
    } catch (error) {
      if (error.code === AUTH_ERRORS.NOT_CONFIGURED) setFormError(t('signIn.notConfigured'));
      else if (error.code === AUTH_ERRORS.INVALID_CREDENTIALS) setFormError(t('signIn.invalidCredentials'));
      else setFormError(friendlyError(error, t));
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title={t('signIn.title')} subtitle={t('signIn.subtitle')} />

      <FormTextField
        control={control}
        name="account"
        label={t('signIn.account')}
        placeholder={t('signIn.accountPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
      />
      <FormTextField
        control={control}
        name="password"
        label={t('signIn.password')}
        placeholder={t('signIn.passwordPlaceholder')}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => Alert.alert(t('signIn.forgotTitle'), t('signIn.forgotBody'))}
        style={styles.forgot}
      >
        <AppText variant="bodyStrong">{t('signIn.forgot')}</AppText>
      </Pressable>

      {formError ? (
        <AppText
          variant="caption"
          color="dangerText"
          style={styles.formError}
          accessibilityLiveRegion="polite"
          testID="sign-in-error"
        >
          {formError}
        </AppText>
      ) : null}

      <AppButton
        title={t('signIn.submit')}
        onPress={handleSubmit(onSubmit)}
        loading={formState.isSubmitting}
        testID="sign-in-submit"
      />

      <Card tone="tint" style={styles.roleCard}>
        <ShieldCheck size={24} color={colors.primary} />
        <View style={styles.roleText}>
          <AppText variant="bodyStrong">{t('signIn.roleTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('signIn.roleBody')}
          </AppText>
        </View>
      </Card>

      <View style={styles.footer}>
        <AppText variant="body" color="textMuted">
          {t('signIn.newMember')}{' '}
          <AppText
            variant="bodyStrong"
            onPress={() => router.push(ROUTES.createAccount)}
            accessibilityRole="link"
            testID="go-create-account"
          >
            {t('signIn.createAccount')}
          </AppText>
        </AppText>
        <AppText variant="caption" color="textSubtle" style={styles.staff}>
          {t('signIn.staffNote')}
        </AppText>
        {config.demoMode ? (
          <AppText
            variant="captionStrong"
            style={styles.demo}
            onPress={() => router.push(ROUTES.demo.smsSimulator)}
            accessibilityRole="link"
          >
            {t('welcome.smsSimulator')}
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  forgot: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  formError: { marginBottom: spacing.md },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  roleText: { flex: 1, gap: spacing.xxs },
  footer: { alignItems: 'center', marginTop: spacing.xxxl, gap: spacing.md },
  staff: { textAlign: 'center' },
  demo: { textDecorationLine: 'underline', paddingVertical: spacing.sm },
});
