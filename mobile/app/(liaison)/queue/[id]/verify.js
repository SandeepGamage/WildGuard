import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { AppButton } from '../../../../src/components/common/AppButton';
import { AppHeader } from '../../../../src/components/common/AppHeader';
import { AppText } from '../../../../src/components/common/AppText';
import { Card } from '../../../../src/components/common/Card';
import { ScreenContainer } from '../../../../src/components/common/ScreenContainer';
import { SectionLabel } from '../../../../src/components/common/SectionLabel';
import { AppTextInput } from '../../../../src/components/forms/AppTextInput';
import { IncidentMarker } from '../../../../src/components/maps/IncidentMarker';
import { MARKER_STATES, VERIFICATION_METHODS } from '../../../../src/constants/domain';
import { useVerifyIncident } from '../../../../src/hooks/useOfficerActions';
import { useOfficerIncident } from '../../../../src/hooks/useOfficerData';
import { colors, radius, spacing } from '../../../../src/theme';
import { friendlyError } from '../../../../src/utils/errors';
import { verifySchema } from '../../../../src/validators/officer.schemas';

/** Flow 6: record the decision, notes and whether field action is needed. */
export default function VerifyScreen() {
  const { t } = useTranslation();
  const { id, method: methodParam } = useLocalSearchParams();
  const method = Object.values(VERIFICATION_METHODS).includes(methodParam)
    ? methodParam
    : VERIFICATION_METHODS.CALL_REPORTER;

  const incident = useOfficerIncident(id).data;
  const verify = useVerifyIncident(id);
  const [conflict, setConflict] = useState(null);
  const [formError, setFormError] = useState(null);

  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(verifySchema),
    defaultValues: { method, notes: '', fieldActionRequired: false },
  });
  const fieldAction = useWatch({ control, name: 'fieldActionRequired' });

  const sector = incident?.sectorName
    ? t('verify.notifyRangers', { sector: incident.sectorName })
    : t('verify.notifyRangersGeneric');

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const result = await verify.mutateAsync(values);
      let message = t('verify.done');
      if (result.fieldActionRequired) {
        message = result.fieldTeamNotified ? t('verify.doneField') : t('verify.doneFieldFailed');
      }
      Alert.alert(t('verify.verified'), message, [
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
        <AppHeader title={t('verify.title')} subtitle={t('errors.alreadyReviewed')} />
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

  const markerState = fieldAction ? MARKER_STATES.ACTION_NEEDED : MARKER_STATES.VERIFIED;

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
            title={fieldAction ? t('verify.save') : t('verify.saveNoAction')}
            loading={verify.isPending}
            onPress={handleSubmit(onSubmit)}
            testID="save-verification"
          />
        </View>
      }
    >
      <AppHeader title={t('verify.title')} subtitle={t('verify.subtitle')} onBack={() => router.back()} />

      <Card tone="tint" style={styles.decision}>
        <View style={styles.checkTile}>
          <Check size={24} color={colors.textOnPrimary} />
        </View>
        <View style={styles.decisionText}>
          <AppText variant="cardTitle" color="success">
            {t('verify.verified')}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {t('verify.verifiedBody')}
          </AppText>
        </View>
      </Card>

      <SectionLabel style={styles.label}>{t('verify.notes')}</SectionLabel>
      <Controller
        control={control}
        name="notes"
        render={({ field, fieldState }) => (
          <AppTextInput
            multiline
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('verify.notesPlaceholder')}
            maxLength={1000}
            error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
            testID="verify-notes"
          />
        )}
      />

      <Card tone="warning" style={styles.fieldAction} testID="field-action-card">
        <View style={styles.fieldHeader}>
          <AppText variant="cardTitle" color="warningText" style={styles.fieldTitle}>
            {t('verify.fieldAction')}
          </AppText>
          <Controller
            control={control}
            name="fieldActionRequired"
            render={({ field }) => (
              <Switch
                value={field.value}
                onValueChange={field.onChange}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
                accessibilityLabel={t('verify.fieldAction')}
                testID="field-action-switch"
              />
            )}
          />
        </View>
        <AppText variant="bodyStrong">{sector}</AppText>
        <AppText variant="caption" color="textMuted">
          {t('verify.rangersBody')}
        </AppText>
      </Card>

      <Card style={styles.marker} testID="marker-preview">
        <IncidentMarker markerState={markerState} size={40} />
        <View style={styles.decisionText}>
          <AppText variant="cardTitle">
            {fieldAction ? t('verify.markerOrange') : t('verify.markerGreen')}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {fieldAction ? t('verify.markerOrangeBody') : t('verify.markerGreenBody')}
          </AppText>
        </View>
      </Card>

      {formState.errors.method ? (
        <AppText variant="caption" color="dangerText">
          {t('errors.validation')}
        </AppText>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  decision: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  decisionText: { flex: 1, gap: spacing.xxs },
  checkTile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: spacing.xl },
  fieldAction: { marginTop: spacing.sm, gap: spacing.xs },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldTitle: { flex: 1 },
  marker: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
});
