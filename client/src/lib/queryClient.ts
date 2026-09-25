import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth/permission/validation/not-found errors — retrying
        // those just delays the empty/forbidden state the user needs to see.
        if (error instanceof ApiError && [401, 403, 404, 422].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
