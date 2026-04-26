import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

export type PlatformAdminRole = "superadmin" | "admin" | "support";

type UsePlatformAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function usePlatformAuth(options?: UsePlatformAuthOptions) {
  const {
    redirectOnUnauthenticated = false,
    redirectPath = "/platform-admin/login",
  } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.platformMe.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0, // Sempre re-valida ao montar — evita cache stale de sessões antigas
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.platformMe.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: any) {
      if (error?.data?.code === "UNAUTHORIZED") {
        return;
      }
      throw error;
    } finally {
      utils.auth.platformMe.setData(undefined, null);
      await utils.auth.platformMe.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    const admin = meQuery.data ?? null;
    const role = ((admin as any)?.role as PlatformAdminRole | null) ?? null;
    // isPending = sem dado em cache (mais conservador que isLoading no TanStack Query v5)
    // isLoading = isPending && isFetching — pode ser false antes do fetch começar
    return {
      admin,
      role,
      isSuperAdmin: role === "superadmin",
      isAdminOrSuper: role === "superadmin" || role === "admin",
      loading: meQuery.isPending || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(admin),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isPending,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isPending || logoutMutation.isPending) return;
    if (state.admin) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.replace(redirectPath); // replace evita histórico de navegação sujo
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isPending,
    state.admin,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
