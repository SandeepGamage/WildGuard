import NetInfo from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { queryKeys } from '../constants/queryKeys';
import { reportSync } from '../services/reportSync';

const RETRY_INTERVAL_MS = 60 * 1000;

/** Reports saved on this phone that have not reached the server yet. */
export function usePendingReports(userId) {
  return useQuery({
    queryKey: queryKeys.pendingReports(userId),
    queryFn: () => reportSync.listPending(userId),
    enabled: Boolean(userId),
    staleTime: 0,
  });
}

/**
 * Keeps retrying queued reports: on mount, when the connection returns, when
 * the app comes to the foreground, and once a minute as a fallback.
 */
export function usePendingReportsSync(userId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return undefined;
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        const delivered = await reportSync.flush(userId);
        await queryClient.invalidateQueries({ queryKey: queryKeys.pendingReports(userId) });
        if (delivered > 0) await queryClient.invalidateQueries({ queryKey: queryKeys.myReports });
      } finally {
        running = false;
      }
    };

    run();
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) run();
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    const timer = setInterval(run, RETRY_INTERVAL_MS);

    return () => {
      unsubscribeNet();
      appState.remove();
      clearInterval(timer);
    };
  }, [userId, queryClient]);
}
