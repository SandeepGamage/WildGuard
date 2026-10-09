import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rejectIncident, startReview, verifyIncident } from '../api/officer.api';
import { queryKeys } from '../constants/queryKeys';

/** After any decision the queue, map, history and the incident itself are stale. */
function useRefreshOfficerData() {
  const queryClient = useQueryClient();
  return (id) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.queue }),
      queryClient.invalidateQueries({ queryKey: queryKeys.officerMap }),
      queryClient.invalidateQueries({ queryKey: ['officer', 'history'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.officerIncident(id) }),
    ]);
}

export function useVerifyIncident(id) {
  const refresh = useRefreshOfficerData();
  return useMutation({
    mutationFn: (values) => verifyIncident(id, values),
    // A 409 means another officer decided first: refresh so the screen shows their decision.
    onSettled: () => refresh(id),
  });
}

export function useRejectIncident(id) {
  const refresh = useRefreshOfficerData();
  return useMutation({
    mutationFn: (values) => rejectIncident(id, values),
    onSettled: () => refresh(id),
  });
}

/** Marks the report group as "being checked" when an officer opens it. */
export function useStartReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => startReview(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.queue }),
  });
}
