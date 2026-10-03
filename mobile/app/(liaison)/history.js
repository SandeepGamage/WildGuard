import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../src/components/common/AppHeader';
import { FilterTabs } from '../../src/components/common/FilterTabs';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/common/StateViews';
import { HistoryCard } from '../../src/components/reports/HistoryCard';
import { VERIFICATION_DECISIONS } from '../../src/constants/domain';
import { ROUTES } from '../../src/constants/routes';
import { useOfficerHistory } from '../../src/hooks/useOfficerData';
import { spacing } from '../../src/theme';
import { friendlyError } from '../../src/utils/errors';

const ALL = 'all';

/** Audit trail of the officer's own decisions, filterable by verified / rejected. */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  // The queue's "Verified" tab opens this screen pre-filtered. A choice made here wins until the
  // screen is opened with a different pre-filter.
  const [chosen, setChosen] = useState(null);
  const preset = params.filter === VERIFICATION_DECISIONS.VERIFIED ? params.filter : ALL;
  const filter = chosen?.preset === preset ? chosen.value : preset;
  const history = useOfficerHistory(filter === ALL ? undefined : filter);

  const tabs = [
    { value: ALL, label: t('history.all') },
    { value: VERIFICATION_DECISIONS.VERIFIED, label: t('history.verified') },
    { value: VERIFICATION_DECISIONS.REJECTED, label: t('history.rejected') },
  ];
  const items = history.data ?? [];

  return (
    <ScreenContainer refresh={{ refreshing: history.isRefetching, onRefresh: () => history.refetch() }}>
      <AppHeader title={t('history.title')} subtitle={t('history.subtitle')} />
      <FilterTabs tabs={tabs} value={filter} onChange={(value) => setChosen({ value, preset })} />

      {history.isLoading ? <LoadingState /> : null}
      {history.isError ? (
        <ErrorState message={friendlyError(history.error, t)} onRetry={() => history.refetch()} />
      ) : null}
      {history.isSuccess && items.length === 0 ? <EmptyState message={t('history.empty')} /> : null}

      <View style={styles.list}>
        {items.map((item) => (
          <HistoryCard
            key={item.incidentId}
            item={item}
            onPress={() => router.push(ROUTES.liaison.incident(item.incidentId))}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
