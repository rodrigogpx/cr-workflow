import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";
import {
  type TenantConfig,
  resolveTenantSlug,
  getTenantConfig,
  defaultTenantConfig,
} from "../config/tenant.config";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  platformAdmin: any | null;
  tenant: TenantConfig | null;
  tenantSlug: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let platformAdmin: any | null = null;
  let sessionTenantSlug: string | null = null;

  try {
    const auth = await sdk.authenticatePlatformAdminRequest(opts.req);
    platformAdmin = auth.platformAdmin;
    sessionTenantSlug = auth.tenantSlug;
  } catch {
    platformAdmin = null;
  }

  try {
    const auth = await sdk.authenticateRequestWithTenant(opts.req);
    user = auth.user;
    if (!sessionTenantSlug) {
      sessionTenantSlug = auth.tenantSlug;
    }
  } catch {
    user = null;
  }

  // Fallback de desenvolvimento: se não houver sessão válida, usar o admin
  // SECURITY: Requires ALL THREE conditions: NODE_ENV=development, !isProduction, DEV_AUTO_LOGIN=true
  // Never enabled in production builds regardless of env vars
  if (
    !user &&
    process.env.NODE_ENV === "development" &&
    !ENV.isProduction &&
    process.env.DEV_AUTO_LOGIN === "true"
  ) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const admin = await db.getUserByEmail(adminEmail);
      if (admin) {
        user = admin as User;
      }
    }
  }

  // ==========================
  // Resolver tenant (URI primeiro, hostname como fallback)
  // ==========================
  const host = opts.req.headers.host ?? "localhost";
  let tenantSlug: string | null = null;
  let tenant: TenantConfig | null = null;

  // Se a sessão já tem tenantSlug, ela é a fonte de verdade.
  // Isso evita que um usuário logado em um tenant seja "movido" de tenant só alterando a URL.
  if (sessionTenantSlug) {
    tenantSlug = sessionTenantSlug;
  }

  // 1) Tentar obter o slug a partir do header enviado pelo frontend
  // SECURITY: Only accept x-tenant-slug if there's NO authenticated session with a tenantSlug.
  // This prevents an attacker from injecting a different tenant via header manipulation.
  if (!tenantSlug && !sessionTenantSlug) {
    const headerSlug = opts.req.headers["x-tenant-slug"];
    if (typeof headerSlug === "string" && headerSlug.trim() !== "") {
      tenantSlug = headerSlug.trim();
    }
  }

  // 2) Fallback: resolução antiga por hostname/subdomínio
  if (!tenantSlug) {
    const isLocalHost = host === "localhost" || host.startsWith("127.0.0.1");
    const appDomain = process.env.DOMAIN;
    const isAppDomain = appDomain ? host.endsWith(appDomain) : false;

    // Só tenta resolver tenant em localhost (dev) ou quando estiver no domínio oficial da aplicação.
    if (isLocalHost || isAppDomain) {
      tenantSlug = resolveTenantSlug(host);
    }
  }

  if (tenantSlug) {
    tenant = await getTenantConfig(tenantSlug);

    // Em desenvolvimento, se o tenant não existir, usar configuração default como fallback.
    if (!tenant && !ENV.isProduction) {
      console.warn(
        `[TenantContext] Tenant "${tenantSlug}" not found, using default config`
      );
      tenant = {
        ...(defaultTenantConfig as TenantConfig),
        slug: tenantSlug,
        name: (defaultTenantConfig.name ?? "CAC 360 - Demo") as string,
      };
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    platformAdmin,
    tenant,
    tenantSlug,
  };
}
