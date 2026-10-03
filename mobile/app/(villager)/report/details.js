import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '../../../src/components/common/AppButton';
import { AppHeader } from '../../../src/components/common/AppHeader';
import { AppText } from '../../../src/components/common/AppText';
import { ChipGroup } from '../../../src/components/common/ChipGroup';
import { ScreenContainer } from '../../../src/components/common/ScreenContainer';
import { SectionLabel } from '../../../src/components/common/SectionLabel';
import { ErrorState } from '../../../src/components/common/StateViews';
import { LocationCard } from '../../../src/components/forms/LocationCard';
import { PhotoPicker } from '../../../src/components/forms/PhotoPicker';
import { VillageSelect } from '../../../src/components/forms/VillageSelect';
import { SafetyBanner } from '../../../src/components/reports/SafetyBanner';
import { ELEPHANT_COUNT_BANDS, INCIDENT_TYPES, OCCURRED_WHEN } from '../../../src/constants/domain';
import { INCIDENT_TYPE_META, asksElephantCount } from '../../../src/constants/incidentTypes';
import { ROUTES } from '../../../src/constants/routes';
import { usePhotoPicker } from '../../../src/hooks/usePhotoPicker';
import { useReportLocation } from '../../../src/hooks/useReportLocation';
import { useSubmitReport } from '../../../src/hooks/useSubmitReport';
import { useVillages } from '../../../src/hooks/useVillages';
import { LOCATION_MODE, MANUAL_REASON } from '../../../src/services/reportLocation';
import { SUBMIT_STATE } from '../../../src/services/reportSync.core';
import { spacing } from '../../../src/theme';
import { friendlyError } from '../../../src/utils/errors';
import { villageName } from '../../../src/utils/villageName';
import { reportDraftSchema } from '../../../src/validators/report.schema';

const LOCATION_MESSAGE_KEYS = {
  [MANUAL_REASON.OUTSIDE_COVERAGE]: 'details.locationOutside',
  [MANUAL_REASON.DENIED]: 'details.locationDenied',
  [MANUAL_REASON.UNAVAILABLE]: 'details.locationDenied',
};

/** Leave the report form (so "Report" opens at the categories again) and show the confirmation. */
function showConfirmation(params) {
  router.dismissAll();
  router.navigate({ pathname: ROUTES.villager.confirmation, params });
}

/**
 * Flow 2: location (GPS or village list), how many, when, optional photo, Send.
 * For "Person injured" the "Call 1990 first" advice is shown prominently at the top.
 */
export default function ReportDetailsScreen() {
  const { t, i18n } = useTranslation();
  const { type } = useLocalSearchParams();
  const incidentType = Object.values(INCIDENT_TYPES).includes(type) ? type : INCIDENT_TYPES.OTHER_ANIMAL;
  const urgent = incidentType === INCIDENT_TYPES.PERSON_INJURED;

  const villages = useVillages();
  const location = useReportLocation(villages.data);
  const photoPicker = usePhotoPicker();
  const submit = useSubmitReport();

  const [countBand, setCountBand] = useState(null);
  const [when, setWhen] = useState(OCCURRED_WHEN.NOW);
  const [chosenVillageId, setChosenVillageId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formError, setFormError] = useState(null);

  const gps = location.result?.mode === LOCATION_MODE.GPS ? location.result : null;
  const chosenVillage = villages.data?.find((village) => village.id === chosenVillageId) ?? null;
  const shownVillage = chosenVillage ?? gps?.village ?? null;
  const source = chosenVillage ? LOCATION_MODE.MANUAL : gps ? LOCATION_MODE.GPS : null;
  const locationMessage =
    !shownVillage && location.result ? t(LOCATION_MESSAGE_KEYS[location.result.reason]) : undefined;

  const send = async () => {
    setFormError(null);
    const draft = {
      incidentType,
      elephantCountBand: countBand ?? undefined,
      occurredWhen: when,
      villageId: chosenVillageId ?? undefined,
      coordinates: chosenVillageId ? undefined : gps?.coordinates,
    };

    const parsed = reportDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError(t(parsed.error.issues[0].message));
      return;
    }

    try {
      const result = await submit.mutateAsync({ draft: parsed.data, photo: photoPicker.photo });
      if (result.state === SUBMIT_STATE.SENT) {
        showConfirmation({ code: result.report.trackingCode, id: result.report.id });
      } else if (result.state === SUBMIT_STATE.QUEUED) {
        showConfirmation({ queued: '1' });
      } else {
        setFormError(friendlyError({ code: result.code }, t));
      }
    } catch (error) {
      setFormError(friendlyError(error, t));
    }
  };

  const countOptions = [
    { value: ELEPHANT_COUNT_BANDS.ONE, label: t('details.count1') },
    { value: ELEPHANT_COUNT_BANDS.TWO_TO_FIVE, label: t('details.count2_5') },
    { value: ELEPHANT_COUNT_BANDS.SIX_PLUS, label: t('details.count6') },
  ];
  const whenOptions = [
    { value: OCCURRED_WHEN.NOW, label: t('details.now') },
    { value: OCCURRED_WHEN.EARLIER_TODAY, label: t('details.earlierToday') },
  ];

  return (
    <ScreenContainer
      footer={
        <View style={styles.footer}>
          {formError ? (
            <AppText
              variant="caption"
              color="dangerText"
              accessibilityLiveRegion="polite"
              testID="form-error"
            >
              {formError}
            </AppText>
          ) : null}
          <AppButton
            title={submit.isPending ? t('details.sending') : t('details.send')}
            loading={submit.isPending}
            onPress={send}
            testID="send-report"
          />
        </View>
      }
    >
      <AppHeader
        title={t('details.title')}
        subtitle={t(INCIDENT_TYPE_META[incidentType].labelKey)}
        onBack={() => router.back()}
      />

      {urgent ? <SafetyBanner variant="urgent" /> : null}

      {villages.isError ? (
        <ErrorState message={friendlyError(villages.error, t)} onRetry={() => villages.refetch()} />
      ) : (
        <>
          <View style={urgent ? styles.sectionAfterBanner : undefined}>
            <LocationCard
              villageName={villageName(shownVillage, i18n.language) || null}
              source={source}
              isLocating={villages.isLoading || location.isLocating}
              message={locationMessage}
              onChange={() => setPickerOpen(true)}
            />
            {!shownVillage && location.result ? (
              <AppText
                variant="captionStrong"
                style={styles.retryGps}
                onPress={location.retry}
                accessibilityRole="button"
                testID="retry-gps"
              >
                {t('details.tryGpsAgain')}
              </AppText>
            ) : null}
          </View>

          {asksElephantCount(incidentType) ? (
            <>
              <SectionLabel style={styles.label}>{t('details.howMany')}</SectionLabel>
              <ChipGroup
                options={countOptions}
                value={countBand}
                onChange={setCountBand}
                testIDPrefix="count"
              />
            </>
          ) : null}

          <SectionLabel style={styles.label}>{t('details.when')}</SectionLabel>
          <ChipGroup
            options={whenOptions}
            value={when}
            onChange={setWhen}
            variant="soft"
            testIDPrefix="when"
          />

          <View style={styles.photo}>
            <PhotoPicker
              photo={photoPicker.photo}
              error={photoPicker.error}
              onPick={photoPicker.pick}
              onRemove={photoPicker.remove}
            />
          </View>

          <SafetyBanner variant="distance" />
        </>
      )}

      <VillageSelect
        value={chosenVillageId ?? shownVillage?.id ?? null}
        onChange={setChosenVillageId}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  sectionAfterBanner: { marginTop: spacing.lg },
  retryGps: { marginTop: spacing.sm, minHeight: 36, textAlign: 'left', textDecorationLine: 'underline' },
  label: { marginTop: spacing.xl },
  photo: { marginVertical: spacing.xl },
});
