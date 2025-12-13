import { QueryClient } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './trpc';
import { extractTenantSlugFromPath } from '@/_core/hooks/useTenantSlug';

export const queryClient = new QueryClient();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
      headers() {
        const slug = typeof window !== 'undefined'
          ? extractTenantSlugFromPath(window.location.pathname)
          : null;

        return {
          'x-trpc-source': 'client',
          ...(slug ? { 'x-tenant-slug': slug } : {}),
        };
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
});
