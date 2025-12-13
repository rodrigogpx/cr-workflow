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
  tenant: TenantConfig | null;
  tenantSlug: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // Fallback de desenvolvimento: se não houver sessão válida, usar o admin
  if (!user && !ENV.isProduction) {
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

  // 1) Tentar obter o slug a partir do header enviado pelo frontend
  const headerSlug = opts.req.headers["x-tenant-slug"];
  if (typeof headerSlug === "string" && headerSlug.trim() !== "") {
    tenantSlug = headerSlug.trim();
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
      console.warn(`[TenantContext] Tenant "${tenantSlug}" not found, using default config`);
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
    tenant,
    tenantSlug,
  };
}
