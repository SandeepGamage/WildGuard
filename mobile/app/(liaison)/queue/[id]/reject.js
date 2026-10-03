import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { AppButton } from '../../../../src/components/common/AppButton';
import { AppHeader } from '../../../../src/components/common/AppHeader';
import { AppText } from '../../../../src/components/common/AppText';
import { Card } from '../../../../src/components/common/Card';
import { ScreenContainer } from '../../../../src/components/common/ScreenContainer';
import { SectionLabel } from '../../../../src/components/common/SectionLabel';
import { AppTextInput } from '../../../../src/components/forms/AppTextInput';
import { RadioCard } from '../../../../src/components/reports/RadioCard';
import { REJECTION_REASONS } from '../../../../src/constants/domain';
import { useRejectIncident } from '../../../../src/hooks/useOfficerActions';
import { colors, radius, spacing } from '../../../../src/theme';
import { friendlyError } from '../../../../src/utils/errors';
import { rejectSchema } from '../../../../src/validators/officer.schemas';

/** Rejecting needs a reason: it is the audit trail. The report stays in History. */
export default function RejectScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const reject = useRejectIncident(id);
  const [conflict, setConflict] = useState(null);
  const [formError, setFormError] = useState(null);

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: undefined, notes: '' },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await reject.mutateAsync(values);
      Alert.alert(t('reject.title'), t('reject.done'), [
        { text: t('common.ok'), onPress: () => router.dismissAll() },
      ]);
    } catch (error) {
      if (error.code === 'INCIDENT_ALREADY_REVIEWED') setConflict(error.details);
      else setFormError(friendlyError(error, t));
    }
  };

  if (conflict) {
    const status =
      conflict.status === 'VERIFIED' ? t('incident.statusVerified') : t('incident.statusRejected');
    return (
      <ScreenContainer
        footer={
          <AppButton title={t('common.back')} onPress={() => router.dismissAll()} testID="conflict-back" />
        }
      >
        <AppHeader title={t('reject.title')} subtitle={t('errors.alreadyReviewed')} />
        <Card tone="warning" testID="conflict-card">
          <AppText variant="cardTitle" color="warningText">
            {t('incident.reviewedTitle')}
          </AppText>
          <AppText variant="body" color="warningText">
            {t(conflict.reviewedByName ? 'incident.reviewedBy' : 'incident.reviewedByUnknown', {
              name: conflict.reviewedByName,
              status,
            })}
          </AppText>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      footer={
        <View style={styles.footer}>
          {formError ? (
            <AppText variant="caption" color="dangerText" accessibilityLiveRegion="polite">
              {formError}
            </AppText>
          ) : null}
          <AppButton
            variant="danger"
            title={t('reject.submit')}
            loading={reject.isPending}
            onPress={handleSubmit(onSubmit)}
            testID="submit-reject"
          />
        </View>
      }
    >
      <AppHeader title={t('reject.title')} subtitle={t('reject.subtitle')} onBack={() => router.back()} />

      <Card tone="danger" style={styles.warning}>
        <View style={styles.xTile}>
          <X size={24} color={colors.textOnPrimary} />
        </View>
        <AppText variant="caption" color="dangerText" style={styles.warningText}>
          {t('reject.warning')}
        </AppText>
      </Card>

      <SectionLabel style={styles.label}>{t('reject.reason')}</SectionLabel>
      <Controller
        control={control}
        name="reason"
        render={({ field, fieldState }) => (
          <View style={styles.reasons}>
            {Object.values(REJECTION_REASONS).map((reason) => (
              <RadioCard
                key={reason}
                label={t(`reject.reasons.${reason}`)}
                selected={field.value === reason}
                onPress={() => field.onChange(reason)}
                testID={`reason-${reason}`}
              />
            ))}
            {fieldState.error ? (
              <AppText
                variant="caption"
                color="dangerText"
                accessibilityLiveRegion="polite"
                testID="reason-error"
              >
                {t('validation.reasonRequired')}
              </AppText>
            ) : null}
          </View>
        )}
      />

      <SectionLabel style={styles.label}>{t('reject.optionalNote')}</SectionLabel>
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <AppTextInput
            multiline
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('reject.notePlaceholder')}
            maxLength={1000}
            testID="reject-notes"
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  warningText: { flex: 1 },
  xTile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: spacing.xl },
  reasons: { gap: spacing.sm },
});
