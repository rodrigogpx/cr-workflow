import { QueryClient } from '@tanstack/react-query';
import { httpLink, TRPCClientError } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './trpc';
import { extractTenantSlugFromPath } from '@/_core/hooks/useTenantSlug';
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { getLoginUrl } from '../const';

function redirectToLoginIfUnauthorized(error: unknown) {
  if (typeof window === 'undefined') return;
  if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) {
    window.location.href = getLoginUrl();
  }
}

export const queryClient = new QueryClient();

queryClient.getQueryCache().subscribe(event => {
  if (event.type === 'updated' && event.action.type === 'error') {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error('[API Query Error]', error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === 'updated' && event.action.type === 'error') {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error('[API Mutation Error]', error);
  }
});

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
    httpLink({
      url: '/api/trpc',
      transformer: superjson,
      headers: getTrpcHeaders,
      fetch: trpcFetch,
    }),
  ],
});
