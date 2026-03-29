/**
 * Tenant Limits Enforcement
 *
 * Funções de verificação de limites de uso por tenant.
 * Chamadas nos endpoints de criação de users, clients e upload de documentos.
 */
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { users, clients } from "../../drizzle/schema";
import { getTenantStorageUsage } from "../fileStorage";
import type { TenantConfig } from "./tenant.config";
import { getDb } from "../db";

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  max: number;
  percentUsed: number;
}

export interface StorageLimitCheckResult {
  allowed: boolean;
  currentGB: number;
  maxGB: number;
  percentUsed: number;
}

/**
 * Verifica se o tenant pode criar mais usuários.
 * Conta usuários ativos (com role definida) no banco do tenant.
 */
export async function checkUserLimit(
  tenantDb: any,
  tenantId: number,
  maxUsers: number
): Promise<LimitCheckResult> {
  // Contar usuários com role definida (ativos/aprovados) para este tenant
  const result = await tenantDb
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        isNotNull(users.role)
      )
    );

  const current = result.length;
  const percentUsed = maxUsers > 0 ? Math.round((current / maxUsers) * 100) : 0;

  return {
    allowed: current < maxUsers,
    current,
    max: maxUsers,
    percentUsed,
  };
}

/**
 * Verifica se o tenant pode criar mais clientes.
 */
export async function checkClientLimit(
  tenantDb: any,
  tenantId: number,
  maxClients: number
): Promise<LimitCheckResult> {
  const result = await tenantDb
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.tenantId, tenantId));

  const current = result.length;
  const percentUsed = maxClients > 0 ? Math.round((current / maxClients) * 100) : 0;

  return {
    allowed: current < maxClients,
    current,
    max: maxClients,
    percentUsed,
  };
}

/**
 * Verifica se o tenant pode fazer mais uploads (limite de armazenamento).
 */
export async function checkStorageLimit(
  tenantId: number,
  maxStorageGB: number
): Promise<StorageLimitCheckResult> {
  const usageBytes = await getTenantStorageUsage(tenantId);
  const fileGB = usageBytes / (1024 * 1024 * 1024);

  // Incluir tamanho do banco de dados do último snapshot
  let dbSizeGB = 0;
  try {
    const platformDb = await getDb();
    if (platformDb) {
      const snap = await platformDb.execute(
        sql`SELECT "dbSizeMB" FROM "usageSnapshots" WHERE "tenantId" = ${tenantId} ORDER BY "snapshotDate" DESC LIMIT 1`
      );
      const rows = (snap as any)?.rows ?? snap;
      const row = Array.isArray(rows) ? rows[0] : null;
      const dbMB = Number(row?.dbSizeMB ?? 0);
      dbSizeGB = dbMB / 1024;
    }
  } catch { /* ignora erro */ }

  const currentGB = fileGB + dbSizeGB;
  const percentUsed = maxStorageGB > 0 ? Math.round((currentGB / maxStorageGB) * 100) : 0;

  return {
    allowed: currentGB < maxStorageGB,
    currentGB: Math.round(currentGB * 1000) / 1000,
    maxGB: maxStorageGB,
    percentUsed,
  };
}

/**
 * Retorna os limites efetivos do tenant (considerando overrides de subscription).
 * Se o tenant tem subscription com overrides, usa os overrides; senão usa os do plano/tenant.
 */
export function getEffectiveLimits(tenant: TenantConfig): {
  maxUsers: number;
  maxClients: number;
  maxStorageGB: number;
} {
  return {
    maxUsers: tenant.maxUsers ?? 10,
    maxClients: tenant.maxClients ?? 500,
    maxStorageGB: tenant.maxStorageGB ?? 50,
  };
}

/**
 * Verifica se uma feature está habilitada para o tenant.
 */
export type TenantFeatureFlag =
  | "featureWorkflowCR"
  | "featureApostilamento"
  | "featureRenovacao"
  | "featureInsumos"
  | "featureIAT";

export function isFeatureEnabled(tenant: TenantConfig, feature: TenantFeatureFlag): boolean {
  return !!tenant[feature];
}
