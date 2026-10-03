import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../src/components/common/AppHeader';
import { AppText } from '../../../src/components/common/AppText';
import { Card } from '../../../src/components/common/Card';
import { ScreenContainer } from '../../../src/components/common/ScreenContainer';
import { ErrorState, LoadingState } from '../../../src/components/common/StateViews';
import { StatusBadge } from '../../../src/components/common/StatusBadge';
import { ConfirmationTracker } from '../../../src/components/reports/ConfirmationTracker';
import { progressBadge } from '../../../src/components/reports/progressBadge';
import { INCIDENT_STATUS, REPORT_PROGRESS } from '../../../src/constants/domain';
import { INCIDENT_TYPE_META } from '../../../src/constants/incidentTypes';
import { useMyReport } from '../../../src/hooks/useMyReports';
import { radius, spacing } from '../../../src/theme';
import { friendlyError } from '../../../src/utils/errors';
import { formatDayAndTime } from '../../../src/utils/time';
import { villageName } from '../../../src/utils/villageName';

/** One report: status tracker and, once decided, the outcome. Officer notes are never shown. */
export default function MyReportDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams();
  const query = useMyReport(id);
  const report = query.data;

  if (query.isLoading) return <LoadingState />;
  if (query.isError) {
    return (
      <ScreenContainer>
        <AppHeader title={t('reports.detailTitle')} onBack={() => router.back()} />
        <ErrorState message={friendlyError(query.error, t)} onRetry={() => query.refetch()} />
      </ScreenContainer>
    );
  }

  const meta = INCIDENT_TYPE_META[report.incidentType];
  const badge = progressBadge(report, t);
  const decided = report.progress === REPORT_PROGRESS.OUTCOME;
  const verified = report.outcome?.decision === INCIDENT_STATUS.VERIFIED;

  return (
    <ScreenContainer refresh={{ refreshing: query.isRefetching, onRefresh: () => query.refetch() }}>
      <AppHeader
        title={report.trackingCode}
        subtitle={`${t(meta.labelKey)} · ${villageName(report.village, i18n.language)}`}
        onBack={() => router.back()}
      />

      <View style={styles.stack}>
        <StatusBadge label={badge.label} tone={badge.tone} />
        <ConfirmationTracker current={report.progress} />

        {decided ? (
          <Card tone={verified ? 'tint' : 'default'} testID="outcome-card">
            <AppText variant="body">
              {verified ? t('reports.outcomeVerified') : t('reports.outcomeRejected')}
            </AppText>
            {verified && report.outcome.fieldActionRequired ? (
              <AppText variant="bodyStrong" style={styles.fieldAction}>
                {t('reports.outcomeFieldAction')}
              </AppText>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <AppText variant="caption" color="textMuted">
            {t('incident.reported')}
          </AppText>
          <AppText variant="bodyStrong">{formatDayAndTime(report.occurredAt, t)}</AppText>
          {report.photoUrl ? (
            <Image
              source={{ uri: report.photoUrl }}
              style={styles.photo}
              accessibilityLabel={t('reports.photo')}
            />
          ) : null}
        </Card>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  fieldAction: { marginTop: spacing.sm },
  photo: { height: 180, borderRadius: radius.card, marginTop: spacing.md },
});
