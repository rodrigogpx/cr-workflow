/**
 * Tenant Resolution Middleware for CAC 360
 * 
 * Este middleware resolve o tenant atual baseado no hostname da requisição
 * e adiciona a configuração do tenant ao contexto da requisição.
 */

import { Context, Next } from 'hono';
import { 
  resolveTenantSlug, 
  getTenantConfig, 
  isTenantActive, 
  TenantConfig,
  defaultTenantConfig 
} from '../config/tenant.config';

// Extender o tipo de contexto do Hono para incluir o tenant
declare module 'hono' {
  interface ContextVariableMap {
    tenant: TenantConfig | null;
    tenantSlug: string | null;
  }
}

/**
 * Middleware que resolve e valida o tenant
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const hostname = c.req.header('host') || 'localhost';
  
  // Resolver slug do tenant pelo hostname
  const slug = resolveTenantSlug(hostname);
  c.set('tenantSlug', slug);

  if (!slug) {
    // Se não tem slug, pode ser a página de super admin
    // ou um acesso direto sem subdomínio
    c.set('tenant', null);
    return next();
  }

  // Buscar configuração do tenant
  const tenant = await getTenantConfig(slug);

  if (!tenant) {
    // Tenant não encontrado
    // Em produção, retornar erro 404
    // Em dev, usar tenant padrão
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Tenant] Tenant "${slug}" not found, using default config`);
      c.set('tenant', defaultTenantConfig as TenantConfig);
      return next();
    }
    
    return c.json({ error: 'Tenant not found' }, 404);
  }

  // Verificar se tenant está ativo
  if (!isTenantActive(tenant)) {
    return c.json({ 
      error: 'Tenant suspended or expired',
      status: tenant.subscriptionStatus 
    }, 403);
  }

  // Adicionar tenant ao contexto
  c.set('tenant', tenant);

  // Adicionar headers de resposta com info do tenant (opcional, para debugging)
  if (process.env.NODE_ENV === 'development') {
    c.header('X-Tenant-Slug', tenant.slug);
    c.header('X-Tenant-Name', tenant.name);
  }

  return next();
}

/**
 * Middleware que requer um tenant válido
 * Use após tenantMiddleware para rotas que precisam de tenant
 */
export async function requireTenant(c: Context, next: Next) {
  const tenant = c.get('tenant');

  if (!tenant) {
    return c.json({ error: 'Tenant required' }, 400);
  }

  return next();
}

/**
 * Helper para obter o tenant do contexto
 */
export function getTenantFromContext(c: Context): TenantConfig | null {
  return c.get('tenant') || null;
}

/**
 * Helper para verificar se é o super admin (sem tenant)
 */
export function isSuperAdminContext(c: Context): boolean {
  const hostname = c.req.header('host') || '';
  return hostname.startsWith('admin.') || hostname.startsWith('platform-admin.');
}

/**
 * Middleware específico para super admin
 * Bloqueia acesso se não estiver no domínio correto
 */
export async function superAdminMiddleware(c: Context, next: Next) {
  if (!isSuperAdminContext(c)) {
    return c.json({ error: 'Access denied' }, 403);
  }
  
  return next();
}
