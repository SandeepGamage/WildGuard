import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { FormTextField } from '../../src/components/forms/FormTextField';
import { VillageSelect } from '../../src/components/forms/VillageSelect';
import { ROUTES } from '../../src/constants/routes';
import { AUTH_ERRORS, useAuth } from '../../src/contexts/AuthContext';
import { colors, radius, spacing } from '../../src/theme';
import { friendlyError } from '../../src/utils/errors';
import { createAccountSchema } from '../../src/validators/auth.schemas';

/** Public sign-up is always a community reporter (VILLAGER); staff accounts are assigned. */
export default function CreateAccountScreen() {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [formError, setFormError] = useState(null);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { fullName: '', phone: '', villageId: '', password: '', consent: false },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await signUp(values);
    } catch (error) {
      setFormError(
        error.code === AUTH_ERRORS.NOT_CONFIGURED ? t('signIn.notConfigured') : friendlyError(error, t),
      );
    }
  };

  return (
    <ScreenContainer>
      <AppHeader
        title={t('createAccount.title')}
        subtitle={t('createAccount.subtitle')}
        showLanguage={false}
        onBack={() => router.back()}
      />

      <FormTextField
        control={control}
        name="fullName"
        label={t('createAccount.fullName')}
        placeholder={t('createAccount.fullNamePlaceholder')}
        autoCapitalize="words"
        textContentType="name"
      />
      <FormTextField
        control={control}
        name="phone"
        label={t('createAccount.mobile')}
        placeholder={t('createAccount.mobilePlaceholder')}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />
      <Controller
        control={control}
        name="villageId"
        render={({ field, fieldState }) => (
          <VillageSelect
            label={t('createAccount.village')}
            value={field.value || null}
            onChange={field.onChange}
            error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          />
        )}
      />
      <FormTextField
        control={control}
        name="password"
        label={t('createAccount.password')}
        placeholder={t('createAccount.passwordPlaceholder')}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
      />

      <Controller
        control={control}
        name="consent"
        render={({ field, fieldState }) => (
          <View>
            <Card
              onPress={() => field.onChange(!field.value)}
              accessibilityLabel={t('createAccount.consent')}
              style={styles.consent}
              testID="consent"
            >
              <View
                style={[styles.checkbox, field.value && styles.checkboxOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: field.value }}
              >
                {field.value ? <Check size={14} color={colors.textOnPrimary} /> : null}
              </View>
              <AppText variant="caption" color="textMuted" style={styles.consentText}>
                {t('createAccount.consent')}
              </AppText>
            </Card>
            {fieldState.error?.message ? (
              <AppText variant="caption" color="dangerText" style={styles.fieldError}>
                {t(fieldState.error.message)}
              </AppText>
            ) : null}
          </View>
        )}
      />

      {formError ? (
        <AppText
          variant="caption"
          color="dangerText"
          style={styles.fieldError}
          accessibilityLiveRegion="polite"
        >
          {formError}
        </AppText>
      ) : null}

      <AppButton
        title={t('createAccount.submit')}
        onPress={handleSubmit(onSubmit)}
        loading={formState.isSubmitting}
        style={styles.submit}
        testID="create-account-submit"
      />

      <Pressable
        accessibilityRole="link"
        onPress={() => router.replace(ROUTES.signIn)}
        style={styles.already}
      >
        <AppText variant="bodyStrong">{t('createAccount.already')}</AppText>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  consent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm / 2,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1 },
  fieldError: { marginTop: spacing.xs },
  submit: { marginTop: spacing.xl },
  already: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: spacing.md },
});
