import { useLocation } from "wouter";

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
