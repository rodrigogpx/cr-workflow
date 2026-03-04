import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const RESERVED_PREFIXES = [
  "login",
  "register",
  "pending-approval",
  "super-admin",
  "platform-admin",
  "admin",
  "api",
  "files",
  "health",
  "dashboard",
  "cr-workflow",
  "client",
  "iat",
  "hml",
  "app",
  "dev",
  "staging"
];

export function extractTenantSlugFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  // Exigir pelo menos dois segmentos (ex: /:tenantSlug/dashboard)
  if (segments.length < 2) return null;
  const first = segments[0];
  if (RESERVED_PREFIXES.includes(first)) return null;
  return first;
}

export function useTenantSlug(): string | null {
  const [location] = useLocation();
  return extractTenantSlugFromPath(location);
}

export function buildTenantPath(tenantSlug: string | null, subPath: string): string {
  const normalized = subPath.startsWith("/") ? subPath : `/${subPath}`;
  if (!tenantSlug) return normalized;
  return `/${tenantSlug}${normalized}`;
}

/**
 * Retorna o slug do tenant de forma efetiva:
 * 1. Da URL (/:tenantSlug/...) se disponível
 * 2. Da sessão do usuário (tenantSlug gravado no JWT) como fallback
 *
 * Resolve o problema de rotas sem slug na URL (ex: /admin, /dashboard)
 * que perdem o contexto do tenant ao navegar.
 */
export function useEffectiveTenantSlug(): string | null {
  const slugFromUrl = useTenantSlug();
  const { data: me } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: slugFromUrl === null,
  });
  return slugFromUrl ?? (me as any)?.tenantSlug ?? null;
}
