import { useQuery } from '@tanstack/react-query';
import { getMyIncident, listMyIncidents } from '../api/incidents.api';
import { queryKeys } from '../constants/queryKeys';

export function useMyReports() {
  return useQuery({ queryKey: queryKeys.myReports, queryFn: listMyIncidents });
}

export function useMyReport(id) {
  return useQuery({
    queryKey: queryKeys.myReport(id),
    queryFn: () => getMyIncident(id),
    enabled: Boolean(id),
  });
}
