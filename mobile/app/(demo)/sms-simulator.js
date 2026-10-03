import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { simulateSms } from '../../src/api/sms.api';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { SectionLabel } from '../../src/components/common/SectionLabel';
import { FormTextField } from '../../src/components/forms/FormTextField';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { colors, radius, spacing } from '../../src/theme';
import { friendlyError } from '../../src/utils/errors';
import { smsSimulatorSchema } from '../../src/validators/sms.schema';

const EXAMPLES = [
  { labelKey: 'sms.exampleValid', message: 'ALIYA PALATUPANA' },
  { labelKey: 'sms.exampleInvalid', message: 'HELLO' },
  { labelKey: 'sms.exampleUnknown', message: 'ALIYA NOWHEREVILLE' },
];

/**
 * Flow 4 (demo only): simulates a villager texting the short code. Shows the
 * acknowledgement with a tracking code for a valid SMS, and the three-language
 * format help for an invalid one.
 */
export default function SmsSimulatorScreen() {
  const { t } = useTranslation();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { control, handleSubmit, setValue, formState } = useForm({
    resolver: zodResolver(smsSimulatorSchema),
    defaultValues: { phone: '0701112233', message: '' },
  });

  const onSubmit = async (values) => {
    setError(null);
    setResult(null);
    try {
      setResult(await simulateSms(values));
    } catch (failure) {
      setError(failure.status === 404 ? t('sms.disabled') : friendlyError(failure, t));
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title={t('sms.title')} subtitle={t('sms.subtitle')} onBack={() => router.back()} />

      <FormTextField control={control} name="phone" label={t('sms.phone')} keyboardType="phone-pad" />
      <FormTextField
        control={control}
        name="message"
        label={t('sms.message')}
        placeholder={t('sms.messagePlaceholder')}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <SectionLabel>{t('sms.examples')}</SectionLabel>
      <Controller
        control={control}
        name="message"
        render={() => (
          <View style={styles.examples}>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example.message}
                accessibilityRole="button"
                onPress={() => setValue('message', example.message, { shouldValidate: true })}
                style={styles.example}
                testID={`example-${example.message}`}
              >
                <AppText variant="captionStrong">{t(example.labelKey)}</AppText>
                <AppText variant="caption" color="textMuted">
                  {example.message}
                </AppText>
              </Pressable>
            ))}
          </View>
        )}
      />

      <AppButton
        title={t('sms.send')}
        onPress={handleSubmit(onSubmit)}
        loading={formState.isSubmitting}
        style={styles.send}
        testID="send-sms"
      />

      {error ? (
        <AppText variant="caption" color="dangerText" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {result ? (
        <View style={styles.result} testID="sms-result">
          <StatusBadge
            label={result.accepted ? t('sms.accepted') : t('sms.notAccepted')}
            tone={result.accepted ? 'success' : 'warning'}
          />
          <SectionLabel>{t('sms.reply')}</SectionLabel>
          <Card tone="tint">
            <AppText variant="body" testID="sms-reply">
              {result.reply}
            </AppText>
          </Card>
          {result.trackingCode ? (
            <AppText variant="bodyStrong">
              {t('sms.tracking')}: {result.trackingCode}
            </AppText>
          ) : null}
          {result.duplicate ? <AppText variant="caption">{t('sms.duplicate')}</AppText> : null}
          {result.callBackRequired ? <AppText variant="caption">{t('sms.callBack')}</AppText> : null}
          {result.queued ? <AppText variant="caption">{t('sms.queued')}</AppText> : null}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  examples: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg },
  example: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  send: { marginTop: spacing.sm },
  error: { marginTop: spacing.md },
  result: { marginTop: spacing.xl, gap: spacing.sm },
});
