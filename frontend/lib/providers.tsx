'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Apps Script round trips are slow (seconds, not ms) - lean on
            // the cache so navigating between already-visited pages is
            // instant (served from cache, revalidated quietly in the
            // background) instead of re-fetching and re-showing a spinner
            // every time. Mutations still explicitly invalidateQueries()
            // for the exact keys they affect, so acted-on data never goes
            // stale from this.
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
