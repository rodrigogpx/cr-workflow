import { QueryClient } from '@tanstack/react-query';
import { httpBatchLink, httpLink, splitLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './trpc';
import { extractTenantSlugFromPath } from '@/_core/hooks/useTenantSlug';

export const queryClient = new QueryClient();

function getTrpcHeaders() {
  const slug = typeof window !== 'undefined'
    ? extractTenantSlugFromPath(window.location.pathname)
    : null;

  return {
    'x-trpc-source': 'client',
    ...(slug ? { 'x-tenant-slug': slug } : {}),
  };
}

function trpcFetch(url: URL | RequestInfo, options?: RequestInit) {
  return fetch(url, {
    ...options,
    credentials: 'include',
  });
}

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === 'mutation',
      true: httpLink({
        url: '/api/trpc',
        transformer: superjson,
        headers: getTrpcHeaders,
        fetch: trpcFetch,
      }),
      false: httpBatchLink({
        url: '/api/trpc',
        transformer: superjson,
        headers: getTrpcHeaders,
        fetch: trpcFetch,
      }),
    }),
  ],
});
