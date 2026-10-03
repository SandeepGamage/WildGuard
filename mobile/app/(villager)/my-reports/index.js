import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../src/components/common/AppHeader';
import { ScreenContainer } from '../../../src/components/common/ScreenContainer';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/common/StateViews';
import { PendingReportCard } from '../../../src/components/reports/PendingReportCard';
import { ReportCard } from '../../../src/components/reports/ReportCard';
import { queryKeys } from '../../../src/constants/queryKeys';
import { ROUTES } from '../../../src/constants/routes';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useMyReports } from '../../../src/hooks/useMyReports';
import { usePendingReports } from '../../../src/hooks/usePendingReports';
import { reportSync } from '../../../src/services/reportSync';
import { spacing } from '../../../src/theme';
import { friendlyError } from '../../../src/utils/errors';

/** The villager's own reports only: pending-on-phone first, then sent reports with honest status. */
export default function MyReportsScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const reports = useMyReports();
  const pending = usePendingReports(profile.id);
  const waiting = pending.data ?? [];

  const discard = async (clientRequestId) => {
    await reportSync.discard(clientRequestId);
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingReports(profile.id) });
  };

  const isEmpty =
    !reports.isLoading && !reports.isError && reports.data?.length === 0 && waiting.length === 0;

  return (
    <ScreenContainer refresh={{ refreshing: reports.isRefetching, onRefresh: () => reports.refetch() }}>
      <AppHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <View style={styles.list}>
        {waiting.map((item) => (
          <PendingReportCard key={item.clientRequestId} item={item} onDiscard={discard} />
        ))}
        {reports.data?.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            actionLabel={t('reports.viewDetails')}
            onPress={() => router.push(ROUTES.villager.reportDetail(report.id))}
          />
        ))}
      </View>

      {reports.isLoading ? <LoadingState /> : null}
      {reports.isError ? (
        <ErrorState message={friendlyError(reports.error, t)} onRetry={() => reports.refetch()} />
      ) : null}
      {isEmpty ? <EmptyState message={t('reports.empty')} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
