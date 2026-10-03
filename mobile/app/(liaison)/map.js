import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../src/components/common/AppHeader';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/common/StateViews';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { IncidentMap } from '../../src/components/maps/IncidentMap';
import { MapLegend } from '../../src/components/maps/MapLegend';
import { MARKER_STATES } from '../../src/constants/domain';
import { INCIDENT_TYPE_META } from '../../src/constants/incidentTypes';
import { ROUTES } from '../../src/constants/routes';
import { useOfficerMap } from '../../src/hooks/useOfficerData';
import { spacing } from '../../src/theme';
import { friendlyError } from '../../src/utils/errors';
import { formatTimeAgo } from '../../src/utils/time';
import { villageName } from '../../src/utils/villageName';

const BADGE = {
  [MARKER_STATES.UNVERIFIED]: { labelKey: 'map.statusUnverified', tone: 'neutral' },
  [MARKER_STATES.ACTION_NEEDED]: { labelKey: 'map.statusAction', tone: 'warning' },
  [MARKER_STATES.VERIFIED]: { labelKey: 'map.statusVerified', tone: 'success' },
};

/**
 * Live map of active reports in the officer's divisions: grey = unverified,
 * amber = verified with field action, green = verified without action.
 * Rejected reports are not shown (they stay in History).
 */
export default function MapScreen() {
  const { t, i18n } = useTranslation();
  const map = useOfficerMap();
  const markers = useMemo(() => map.data ?? [], [map.data]);
  const [chosenId, setChosenId] = useState(null);
  // Until the officer taps a marker, the first report is shown in the card.
  const selected = markers.find((marker) => marker.id === chosenId) ?? markers[0];
  const meta = selected ? INCIDENT_TYPE_META[selected.incidentType] : null;
  const badge = selected ? BADGE[selected.markerState] : null;

  return (
    <ScreenContainer scroll={false}>
      <AppHeader title={t('map.title')} subtitle={t('map.subtitle')} />
      <MapLegend />

      <View style={styles.mapWrap}>
        {map.isLoading ? <LoadingState /> : null}
        {map.isError ? (
          <ErrorState message={friendlyError(map.error, t)} onRetry={() => map.refetch()} />
        ) : null}
        {map.isSuccess && markers.length === 0 ? <EmptyState message={t('map.empty')} /> : null}
        {map.isSuccess && markers.length > 0 ? (
          <IncidentMap
            style={styles.map}
            markers={markers}
            selectedId={selected?.id ?? null}
            onSelect={setChosenId}
          />
        ) : null}

        {selected ? (
          <Card style={styles.selected} testID="selected-marker">
            <View style={styles.selectedTop}>
              <AppText variant="cardTitle" style={styles.selectedTitle}>
                {selected.trackingCode} · {t(meta.labelKey)}
              </AppText>
              <StatusBadge label={t(badge.labelKey)} tone={badge.tone} uppercase />
            </View>
            <AppText variant="caption" color="textMuted">
              {selected.markerState === MARKER_STATES.UNVERIFIED
                ? t('map.pendingAgo', {
                    village: villageName(selected.village, i18n.language),
                    time: formatTimeAgo(selected.createdAt, t),
                  })
                : t('map.verifiedAgo', {
                    village: villageName(selected.village, i18n.language),
                    time: formatTimeAgo(selected.verifiedAt ?? selected.createdAt, t),
                  })}
            </AppText>
            <AppText
              variant="bodyStrong"
              style={styles.openLink}
              onPress={() => router.push(ROUTES.liaison.incident(selected.id))}
              accessibilityRole="link"
              testID="open-incident"
            >
              {t('map.openIncident')}
            </AppText>
          </Card>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, marginTop: spacing.lg },
  map: { flex: 1 },
  selected: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.xs,
  },
  selectedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectedTitle: { flex: 1 },
  openLink: { marginTop: spacing.sm },
});
