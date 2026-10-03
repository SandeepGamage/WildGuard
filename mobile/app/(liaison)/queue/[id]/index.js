import { Phone, RadioTower } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../../../../src/components/common/AppButton';
import { AppHeader } from '../../../../src/components/common/AppHeader';
import { AppText } from '../../../../src/components/common/AppText';
import { Card } from '../../../../src/components/common/Card';
import { ScreenContainer } from '../../../../src/components/common/ScreenContainer';
import { ErrorState, LoadingState } from '../../../../src/components/common/StateViews';
import { IncidentMap } from '../../../../src/components/maps/IncidentMap';
import { MethodSelector } from '../../../../src/components/reports/MethodSelector';
import {
  INCIDENT_STATUS,
  MARKER_STATES,
  VERIFICATION_DECISIONS,
  VERIFICATION_METHODS,
} from '../../../../src/constants/domain';
import { INCIDENT_TYPE_META } from '../../../../src/constants/incidentTypes';
import { ROUTES } from '../../../../src/constants/routes';
import { useStartReview } from '../../../../src/hooks/useOfficerActions';
import { useOfficerIncident } from '../../../../src/hooks/useOfficerData';
import { colors, radius, spacing } from '../../../../src/theme';
import { friendlyError } from '../../../../src/utils/errors';
import { formatDayAndTime } from '../../../../src/utils/time';
import { villageName } from '../../../../src/utils/villageName';

const Row = ({ label, value, onPress, accessibilityLabel }) => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={accessibilityLabel}
    disabled={!onPress}
    onPress={onPress}
    style={styles.row}
  >
    <AppText variant="caption" color="textMuted" style={styles.rowLabel}>
      {label}
    </AppText>
    <View style={styles.rowValue}>
      <AppText variant="bodyStrong" style={styles.rowText}>
        {value}
      </AppText>
      {onPress ? <Phone size={16} color={colors.primary} /> : null}
    </View>
  </Pressable>
);

/** Flow 5/6: everything the officer needs to check a report, then Verify or Reject. */
export default function IncidentDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams();
  const query = useOfficerIncident(id);
  const startReview = useStartReview();
  const [method, setMethod] = useState(VERIFICATION_METHODS.CALL_REPORTER);
  const incident = query.data;
  const status = incident?.status;

  // Opening a pending report tells the reporter it is now "Being checked".
  useEffect(() => {
    if (status === INCIDENT_STATUS.PENDING) startReview.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, id]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) {
    return (
      <ScreenContainer>
        <AppHeader title={t('tabs.queue')} onBack={() => router.back()} />
        <ErrorState message={friendlyError(query.error, t)} onRetry={() => query.refetch()} />
      </ScreenContainer>
    );
  }

  const meta = INCIDENT_TYPE_META[incident.incidentType];
  const place = villageName(incident.village, i18n.language);
  const decided = status === INCIDENT_STATUS.VERIFIED || status === INCIDENT_STATUS.REJECTED;
  const collar = incident.nearbyCollars[0];
  const reporterLabel = [incident.reporter.name, incident.reporter.phoneMasked].filter(Boolean).join(' · ');

  return (
    <ScreenContainer
      footer={
        decided ? null : (
          <View style={styles.actions}>
            <AppButton
              style={styles.action}
              title={t('incident.verify')}
              onPress={() => router.push({ pathname: ROUTES.liaison.verify(id), params: { method } })}
              testID="open-verify"
            />
            <AppButton
              style={styles.action}
              variant="secondary"
              title={t('incident.reject')}
              onPress={() => router.push(ROUTES.liaison.reject(id))}
              testID="open-reject"
            />
          </View>
        )
      }
    >
      <AppHeader
        title={incident.trackingCode}
        subtitle={`${t(meta.labelKey)} · ${place}`}
        onBack={() => router.back()}
      />

      <View style={styles.mapCard}>
        <IncidentMap
          interactive={false}
          style={styles.map}
          markers={[
            {
              id: incident.id,
              latitude: incident.latitude,
              longitude: incident.longitude,
              markerState: MARKER_STATES.UNVERIFIED,
              groupedCount: incident.groupedCount,
            },
          ]}
        />
        <AppText variant="pill" color="textMuted" style={styles.mapPlace}>
          {place.toUpperCase()}
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.mapCaption}>
          {incident.groupedCount > 1
            ? t('incident.groupedMap', { count: incident.groupedCount })
            : t('incident.singleMap')}
        </AppText>
      </View>

      {incident.callBackRequired ? (
        <Card tone="warning" style={styles.gap}>
          <AppText variant="caption" color="warningText">
            {t('incident.callBack')}
          </AppText>
        </Card>
      ) : null}

      <Card style={styles.gap}>
        <Row label={t('incident.reported')} value={formatDayAndTime(incident.occurredAt, t)} />
        <Row
          label={t('incident.reporter')}
          value={reporterLabel}
          onPress={
            incident.reporter.phone ? () => Linking.openURL(`tel:${incident.reporter.phone}`) : undefined
          }
          accessibilityLabel={t('incident.callReporter')}
        />
        <Row
          label={t('incident.photo')}
          value={incident.photoUrl ? t('incident.photoAttached') : t('incident.photoNone')}
        />
        {incident.photoUrl ? (
          <Image
            source={{ uri: incident.photoUrl }}
            style={styles.photo}
            accessibilityLabel={t('incident.photo')}
          />
        ) : null}

        <View style={styles.divider} />
        <View style={styles.collar}>
          <RadioTower size={22} color={colors.primary} />
          <View style={styles.collarText}>
            <AppText variant="bodyStrong">{t('incident.collarTitle')}</AppText>
            <AppText variant="caption" color="textMuted">
              {collar
                ? t('incident.collarLine', { code: collar.code, distance: collar.distanceM })
                : t('incident.collarNone')}
            </AppText>
          </View>
        </View>
      </Card>

      {incident.related.length > 0 ? (
        <Card style={styles.gap}>
          <AppText variant="bodyStrong" style={styles.relatedTitle}>
            {t('incident.related')}
          </AppText>
          {incident.related.map((item) => (
            <AppText key={item.id} variant="caption" color="textMuted">
              {item.trackingCode} · {item.reporterName ?? '—'} · {formatDayAndTime(item.createdAt, t)}
            </AppText>
          ))}
        </Card>
      ) : null}

      {decided ? (
        <Card tone="tint" style={styles.gap} testID="already-reviewed">
          <AppText variant="bodyStrong">{t('incident.reviewedTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t(incident.verification?.officerName ? 'incident.reviewedBy' : 'incident.reviewedByUnknown', {
              name: incident.verification?.officerName,
              status:
                status === VERIFICATION_DECISIONS.VERIFIED
                  ? t('incident.statusVerified')
                  : t('incident.statusRejected'),
            })}
          </AppText>
        </Card>
      ) : (
        <View style={styles.gap}>
          <MethodSelector value={method} onChange={setMethod} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapCard: { height: 168, borderRadius: radius.hero, overflow: 'hidden', marginBottom: spacing.lg },
  map: { flex: 1, borderRadius: radius.hero },
  mapPlace: { position: 'absolute', top: spacing.lg, left: spacing.lg },
  mapCaption: { position: 'absolute', bottom: spacing.lg, left: spacing.lg },
  gap: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  rowLabel: { width: 90 },
  rowValue: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flexShrink: 1 },
  photo: { height: 160, borderRadius: radius.md, marginVertical: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  collar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  collarText: { flex: 1, gap: spacing.xxs },
  relatedTitle: { marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
