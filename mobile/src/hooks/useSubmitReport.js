import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../constants/queryKeys';
import { useAuth } from '../contexts/AuthContext';
import { reportSync } from '../services/reportSync';

/**
 * Submit a report through the durable queue: it is saved on the phone first,
 * so a dropped connection never loses it.
 * Resolves to { state: 'SENT' | 'QUEUED' | 'FAILED', report? }.
 */
export function useSubmitReport() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draft, photo }) => reportSync.submit({ userId: profile.id, draft, photo }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingReports(profile.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myReports });
    },
  });
}
