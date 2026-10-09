import { useQuery } from '@tanstack/react-query';
import { listVillages } from '../api/villages.api';
import { queryKeys } from '../constants/queryKeys';

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Village gazetteer, cached for an hour (it changes rarely). */
export function useVillages() {
  return useQuery({
    queryKey: queryKeys.villages,
    queryFn: listVillages,
    staleTime: ONE_HOUR_MS,
  });
}
