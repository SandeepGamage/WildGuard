import { QueryClient } from '@tanstack/react-query';

const STALE_TIME_MS = 30 * 1000;
const MAX_RETRIES = 1;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      retry: MAX_RETRIES,
      refetchOnReconnect: true,
    },
  },
});
