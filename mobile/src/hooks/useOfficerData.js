import { useQuery } from '@tanstack/react-query';
import { getOfficerHistory, getOfficerIncident, getOfficerMap, getQueue } from '../api/officer.api';
import { queryKeys } from '../constants/queryKeys';

const LIVE_REFRESH_MS = 30 * 1000;

/** Verification queue, refreshed every 30 s while the screen is open. */
export function useOfficerQueue() {
  return useQuery({
    queryKey: queryKeys.queue,
    queryFn: getQueue,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useOfficerIncident(id) {
  return useQuery({
    queryKey: queryKeys.officerIncident(id),
    queryFn: () => getOfficerIncident(id),
    enabled: Boolean(id),
  });
}

export function useOfficerMap() {
  return useQuery({
    queryKey: queryKeys.officerMap,
    queryFn: getOfficerMap,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

/** @param {'VERIFIED'|'REJECTED'|undefined} decision */
export function useOfficerHistory(decision) {
  return useQuery({
    queryKey: queryKeys.officerHistory(decision),
    queryFn: () => getOfficerHistory({ decision }),
  });
}
