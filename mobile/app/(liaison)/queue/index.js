import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../src/components/common/AppHeader';
import { FilterTabs } from '../../../src/components/common/FilterTabs';
import { ScreenContainer } from '../../../src/components/common/ScreenContainer';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/common/StateViews';
import { OfficerQueueCard } from '../../../src/components/reports/OfficerQueueCard';
import { URGENCY, VERIFICATION_DECISIONS } from '../../../src/constants/domain';
import { ROUTES } from '../../../src/constants/routes';
import { useOfficerQueue } from '../../../src/hooks/useOfficerData';
import { spacing } from '../../../src/theme';
import { friendlyError } from '../../../src/utils/errors';

const TAB = { PENDING: 'pending', URGENT: 'urgent', VERIFIED: 'verified' };

/** Flow 5: pending reports for the officer's divisions, urgent first, duplicates grouped. */
export default function QueueScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(TAB.PENDING);
  const queue = useOfficerQueue();

  const counts = queue.data?.counts ?? { pending: 0, urgent: 0, verified: 0 };
  const items = queue.data?.items ?? [];
  const visible = tab === TAB.URGENT ? items.filter((item) => item.urgency === URGENCY.URGENT) : items;

  const tabs = [
    { value: TAB.PENDING, label: t('queue.tabPending', { count: counts.pending }) },
    { value: TAB.URGENT, label: t('queue.tabUrgent', { count: counts.urgent }) },
    { value: TAB.VERIFIED, label: t('queue.tabVerified', { count: counts.verified }) },
  ];

  const changeTab = (next) => {
    if (next === TAB.VERIFIED) {
      router.navigate({
        pathname: ROUTES.liaison.history,
        params: { filter: VERIFICATION_DECISIONS.VERIFIED },
      });
      return;
    }
    setTab(next);
  };

  return (
    <ScreenContainer refresh={{ refreshing: queue.isRefetching, onRefresh: () => queue.refetch() }}>
      <AppHeader title={t('queue.title')} subtitle={t('queue.subtitle')} />
      <FilterTabs tabs={tabs} value={tab} onChange={changeTab} />

      {queue.isLoading ? <LoadingState /> : null}
      {queue.isError ? (
        <ErrorState message={friendlyError(queue.error, t)} onRetry={() => queue.refetch()} />
      ) : null}
      {queue.isSuccess && visible.length === 0 ? (
        <EmptyState message={tab === TAB.URGENT ? t('queue.emptyUrgent') : t('queue.empty')} />
      ) : null}

      <View style={styles.list}>
        {visible.map((item) => (
          <OfficerQueueCard
            key={item.id}
            item={item}
            onOpen={() => router.push(ROUTES.liaison.incident(item.id))}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
