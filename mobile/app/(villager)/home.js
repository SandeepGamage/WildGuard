import { TriangleAlert } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppText } from '../../src/components/common/AppText';
import { Card } from '../../src/components/common/Card';
import { HeroCard } from '../../src/components/common/HeroCard';
import { LanguageSwitcher } from '../../src/components/common/LanguageSwitcher';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { ErrorState, LoadingState } from '../../src/components/common/StateViews';
import { PendingReportCard } from '../../src/components/reports/PendingReportCard';
import { ReportCard } from '../../src/components/reports/ReportCard';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { EMERGENCY_NUMBER } from '../../src/constants/domain';
import { ROUTES } from '../../src/constants/routes';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMyReports } from '../../src/hooks/useMyReports';
import { usePendingReports } from '../../src/hooks/usePendingReports';
import { reportSync } from '../../src/services/reportSync';
import { colors, spacing } from '../../src/theme';
import { friendlyError } from '../../src/utils/errors';
import { greetingKey } from '../../src/utils/time';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../src/constants/queryKeys';
import { apiRequest } from '../../src/api/client';

/** Villager home: greeting, "Report now", injury advice, early-warning collar alerts, and recent reports. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const reports = useMyReports();
  const pending = usePendingReports(profile.id);

  const activeAlertsQuery = useQuery({
    queryKey: ['activeCollarAlerts'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/collar/alerts/active', { auth: false });
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    refetchInterval: 5000,
  });

  const firstName = profile.fullName ? profile.fullName.split(' ')[0] : 'Villager';
  const latest = reports.data?.[0];
  const waiting = pending.data ?? [];
  const activeAlert = activeAlertsQuery.data?.[0];

  const discard = async (clientRequestId) => {
    await reportSync.discard(clientRequestId);
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingReports(profile.id) });
  };

  const handleRefresh = () => {
    reports.refetch();
    activeAlertsQuery.refetch();
  };

  return (
    <ScreenContainer refresh={{ refreshing: reports.isRefetching || activeAlertsQuery.isRefetching, onRefresh: handleRefresh }}>
      <View style={styles.header}>
        <View>
          <AppText variant="body" color="textMuted">
            {t(greetingKey())}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {firstName}
          </AppText>
        </View>
        <LanguageSwitcher />
      </View>

      {activeAlert ? (
        <Card tone="danger" style={styles.alertCard} testID="early-warning-alert-card">
          <View style={styles.alertHeader}>
            <View style={styles.alertHeaderTitle}>
              <TriangleAlert size={22} color={colors.dangerText} />
              <AppText variant="cardTitle" color="dangerText">
                🚨 EARLY WARNING BROADCAST
              </AppText>
            </View>
            <StatusBadge label="CRITICAL" tone="danger" uppercase />
          </View>

          <AppText variant="bodyStrong" style={styles.alertBody}>
            WILDGUARD ALERT: Wild animal {activeAlert.animal_label || 'Elephant E-402 (Rambo)'} detected near {activeAlert.zone_name || 'Palatupana Farmland & Paddy Perimeter'}. Please stay vigilant and avoid the perimeter.
          </AppText>

          <View style={styles.alertFooter}>
            <AppText variant="caption" color="dangerText">
              📍 Perimeter Breach: {activeAlert.zone_name || 'Palatupana Farmland & Paddy Perimeter'}
            </AppText>
            <AppText variant="caption" color="textMuted">
              📱 Dispatched via GSM SMS to {profile.fullName} ({profile.phoneNumber || '0728412012'})
            </AppText>
            <AppText variant="caption" color="textMuted">
              DWC Operations Command Gateway • Live Early Warning
            </AppText>
          </View>
        </Card>
      ) : null}

      <HeroCard
        title={t('home.heroTitle')}
        body={t('home.heroBody')}
        caption={t('home.heroCaption')}
        action={
          <AppButton
            compact
            variant="accent"
            title={t('home.reportNow')}
            onPress={() => router.navigate(ROUTES.villager.report)}
            testID="report-now"
          />
        }
      />

      <Card tone="notice" style={styles.injured} testID="injured-notice">
        <TriangleAlert size={24} color={colors.noticeText} />
        <View style={styles.injuredText}>
          <AppText variant="cardTitle" color="noticeText">
            {t('home.injuredTitle')}
          </AppText>
          <AppText variant="caption" color="noticeText">
            {t('home.injuredBody', { number: EMERGENCY_NUMBER })}
          </AppText>
        </View>
      </Card>

      <AppText variant="heading" style={styles.section}>
        {t('home.recent')}
      </AppText>

      {waiting.map((item) => (
        <View key={item.clientRequestId} style={styles.gap}>
          <PendingReportCard item={item} onDiscard={discard} />
        </View>
      ))}

      {reports.isLoading ? <LoadingState /> : null}
      {reports.isError ? (
        <ErrorState message={friendlyError(reports.error, t)} onRetry={() => reports.refetch()} />
      ) : null}
      {latest ? (
        <ReportCard
          report={latest}
          withTime
          actionLabel={t('home.viewStatus')}
          onPress={() => router.push(ROUTES.villager.reportDetail(latest.id))}
        />
      ) : null}
      {!latest && !reports.isLoading && !reports.isError && waiting.length === 0 ? (
        <AppText variant="body" color="textMuted">
          {t('home.noReports')}
        </AppText>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  alertCard: {
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  alertHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  alertBody: {
    color: colors.textBody,
    lineHeight: 20,
  },
  alertFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dangerBorder,
    paddingTop: spacing.xs,
    gap: 2,
  },
  injured: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  injuredText: { flex: 1, gap: spacing.xxs },
  section: { marginTop: spacing.xxl, marginBottom: spacing.md },
  gap: { marginBottom: spacing.md },
});
