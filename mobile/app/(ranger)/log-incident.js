import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { AppTextInput } from '../../src/components/forms/AppTextInput';
import { PhotoPicker } from '../../src/components/forms/PhotoPicker';
import { PATROL_ERRORS, PATROL_INCIDENT_META, PATROL_RULES } from '../../src/constants/patrol';
import { ROUTES } from '../../src/constants/routes';
import { useToast } from '../../src/contexts/ToastContext';
import { usePatrol } from '../../src/contexts/PatrolContext';
import { usePhotoPicker } from '../../src/hooks/usePhotoPicker';
import { colors, radius, spacing } from '../../src/theme';

/** R3 – Log incident: type, optional photo and note. Saved on the phone as PENDING. */
export default function LogIncidentScreen() {
  const { t } = useTranslation();
  const { showSuccess, showWarning } = useToast();
  const patrol = usePatrol();
  const { photo, error: photoError, pick, remove } = usePhotoPicker();
  const [incidentType, setIncidentType] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!patrol.session) return <Redirect href={ROUTES.ranger.start} />;

  const save = async () => {
    if (!incidentType) {
      setError(t('patrol.log.chooseType'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await patrol.logIncident({ incidentType, note, photo });
      showSuccess(
        t('patrol.log.savedBody', { count: result.pendingCount }),
        t('patrol.log.saved'),
      );
      if (result.locationWarning) showWarning(t('patrol.log.locationWarning'));
      if (result.storageWarning) showWarning(t('patrol.log.storageWarning'));
      router.back();
    } catch (e) {
      setError(e.code === PATROL_ERRORS.NO_LOCATION ? t('patrol.log.noLocation') : t('patrol.log.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer
      footer={<AppButton title={t('patrol.log.save')} onPress={save} loading={saving} testID="save-incident" />}
    >
      <AppHeader title={t('patrol.log.title')} subtitle={t('patrol.log.subtitle')} onBack={() => router.back()} />

      <AppText variant="label" color="textMuted" style={styles.label}>
        {t('patrol.log.type')}
      </AppText>
      <View style={styles.types} accessibilityRole="radiogroup">
        {PATROL_INCIDENT_META.map(({ type, labelKey, Icon }) => {
          const selected = type === incidentType;
          return (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(labelKey)}
              onPress={() => setIncidentType(type)}
              style={[styles.type, selected && styles.typeSelected]}
              testID={`type-${type}`}
            >
              <Icon size={24} color={colors.primary} />
              <AppText variant="bodyStrong" style={styles.typeLabel}>
                {t(labelKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppTextInput
        label={t('patrol.log.note')}
        placeholder={t('patrol.log.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={PATROL_RULES.MAX_NOTE_LENGTH}
        testID="incident-note"
      />

      <PhotoPicker photo={photo} error={photoError} onPick={pick} onRemove={remove} />

      {error ? (
        <AppText variant="caption" color="dangerText" style={styles.error} accessibilityLiveRegion="polite" testID="log-error">
          {error}
        </AppText>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  type: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  typeSelected: { backgroundColor: colors.surfaceTint, borderColor: colors.borderStrong },
  typeLabel: { flex: 1 },
  error: { marginTop: spacing.lg },
});
