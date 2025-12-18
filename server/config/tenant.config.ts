/**
 * Multi-Tenant Configuration for CAC 360
 * 
 * Este arquivo gerencia a configuração e resolução de tenants (clubes)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "./crypto.util";

// Tenant interface que espelha a tabela no banco
export interface TenantConfig {
  id: number;
  slug: string;
  name: string;
  // Database
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  // Branding
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string;
  // Features
  featureWorkflowCR: boolean;
  featureApostilamento: boolean;
  featureRenovacao: boolean;
  featureInsumos: boolean;
  // SMTP
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  // Storage
  storageBucket: string | null;
  backupSchedule: string;
  // Limits
  maxUsers: number;
  maxClients: number;
  maxStorageGB: number;
  // Subscription
  plan: "starter" | "professional" | "enterprise";
  subscriptionStatus: "active" | "suspended" | "trial" | "cancelled";
  subscriptionExpiresAt: Date | null;
  // Metadata
  isActive: boolean;
}

// Cache de conexões de banco por tenant
const tenantDbConnections: Map<string, ReturnType<typeof drizzle>> = new Map();

// Cache de configurações de tenant
const tenantConfigCache: Map<string, { config: TenantConfig; cachedAt: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Resolve o tenant baseado no slug (subdomínio)
 * Exemplo: tiroesp.cac360.com.br → slug = "tiroesp"
 */
export function resolveTenantSlug(hostname: string): string | null {
  // Desenvolvimento local
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
    // Em dev, usar variável de ambiente ou default
    return process.env.DEV_TENANT_SLUG || 'default';
  }

  // Extrair subdomínio
  // Ex: tiroesp.cac360.com.br → tiroesp
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Ignorar subdomínios especiais
    if (['www', 'api', 'admin', 'platform-admin'].includes(subdomain)) {
      return null;
    }
    return subdomain;
  }

  return null;
}

/**
 * Busca configuração do tenant no banco de dados da plataforma
 */
export async function getTenantConfig(slug: string): Promise<TenantConfig | null> {
  // Verificar cache
  const cached = tenantConfigCache.get(slug);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.config;
  }

  // Buscar no banco da plataforma
  const platformDbUrl = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;
  if (!platformDbUrl) {
    console.error('[Tenant] Platform database URL not configured');
    return null;
  }

  try {
    const client = postgres(platformDbUrl);
    const db = drizzle(client);

    // Query direta para evitar dependência circular
    const result = await client`
      SELECT * FROM tenants WHERE slug = ${slug} AND "isActive" = true LIMIT 1
    `;

    await client.end();

    if (result.length === 0) {
      return null;
    }

    const tenant = result[0] as unknown as TenantConfig;

    // Descriptografar segredos sensíveis
    if (tenant.dbPassword) {
      tenant.dbPassword = decryptSecret(tenant.dbPassword);
    }
    if (tenant.smtpPassword) {
      tenant.smtpPassword = decryptSecret(tenant.smtpPassword);
    }

    // Cachear resultado
    tenantConfigCache.set(slug, { config: tenant, cachedAt: Date.now() });

    return tenant;
  } catch (error) {
    console.error('[Tenant] Error fetching tenant config:', error);
    return null;
  }
}

/**
 * Obtem conexão de banco de dados para um tenant específico
 */
export async function getTenantDb(tenant: TenantConfig): Promise<ReturnType<typeof drizzle> | null> {
  const isSingleDbMode = process.env.TENANT_DB_MODE === 'single';
  const cacheKey = isSingleDbMode ? 'single_db' : `${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}`;

  // Verificar cache de conexões
  if (tenantDbConnections.has(cacheKey)) {
    return tenantDbConnections.get(cacheKey)!;
  }

  try {
    const platformDbUrl = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;
    const connectionString = isSingleDbMode
      ? (platformDbUrl ?? '')
      : `postgres://${tenant.dbUser}:${tenant.dbPassword}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}`;

    if (!connectionString) {
      console.error('[Tenant] Platform database URL not configured');
      return null;
    }
    const client = postgres(connectionString, {
      max: Number(process.env.TENANT_DB_POOL_MAX ?? 5),
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
    const db = drizzle(client);

    // Healthcheck rápida para validar credenciais/conectividade
    await client`SELECT 1`;

    // Cachear conexão
    tenantDbConnections.set(cacheKey, db);

    console.log(`[Tenant] Connected to database for tenant: ${tenant.slug}`);
    return db;
  } catch (error) {
    console.error(`[Tenant] Error connecting to database for tenant ${tenant.slug}:`, error);
    tenantDbConnections.delete(cacheKey);
    return null;
  }
}

/**
 * Limpa cache de configuração de tenant
 */
export function invalidateTenantCache(slug?: string): void {
  if (slug) {
    tenantConfigCache.delete(slug);
  } else {
    tenantConfigCache.clear();
  }
}

/**
 * Verifica se o tenant está ativo e com assinatura válida
 */
export function isTenantActive(tenant: TenantConfig): boolean {
  if (!tenant.isActive) {
    return false;
  }

  if (tenant.subscriptionStatus === 'cancelled' || tenant.subscriptionStatus === 'suspended') {
    return false;
  }

  if (tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt) < new Date()) {
    return false;
  }

  return true;
}

/**
 * Retorna as features habilitadas para o tenant
 */
export function getTenantFeatures(tenant: TenantConfig): string[] {
  const features: string[] = [];

  if (tenant.featureWorkflowCR) features.push('workflow-cr');
  if (tenant.featureApostilamento) features.push('apostilamento');
  if (tenant.featureRenovacao) features.push('renovacao');
  if (tenant.featureInsumos) features.push('insumos');

  return features;
}

/**
 * Tenant padrão para desenvolvimento/fallback
 */
export const defaultTenantConfig: Partial<TenantConfig> = {
  slug: 'default',
  name: 'CAC 360 - Demo',
  primaryColor: '#1a5c00',
  secondaryColor: '#4d9702',
  featureWorkflowCR: true,
  featureApostilamento: false,
  featureRenovacao: false,
  featureInsumos: false,
  plan: 'starter',
  subscriptionStatus: 'trial',
  maxUsers: 5,
  maxClients: 100,
  maxStorageGB: 10,
};
