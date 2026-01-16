/**
 * Tenant Resolution Middleware for CAC 360
 * 
 * NOTA: Este arquivo está temporariamente desativado para evitar dependência do Hono em runtime.
 * O sistema utiliza tRPC para a maioria das operações, onde o tenant é resolvido no contexto do tRPC.
 */

/*
import { Context, Next } from 'hono';
import { 
  resolveTenantSlug, 
  getTenantConfig, 
  isTenantActive, 
  TenantConfig,
  defaultTenantConfig 
} from '../config/tenant.config';

declare module 'hono' {
  interface ContextVariableMap {
    tenant: TenantConfig | null;
    tenantSlug: string | null;
  }
}

export async function tenantMiddleware(c: Context, next: Next) {
  const hostname = c.req.header('host') || 'localhost';
  const slug = resolveTenantSlug(hostname);
  c.set('tenantSlug', slug);

  if (!slug) {
    c.set('tenant', null);
    return next();
  }

  const tenant = await getTenantConfig(slug);

  if (!tenant) {
    if (process.env.NODE_ENV === 'development') {
      c.set('tenant', defaultTenantConfig as TenantConfig);
      return next();
    }
    return c.json({ error: 'Tenant not found' }, 404);
  }

  if (!isTenantActive(tenant)) {
    return c.json({ 
      error: 'Tenant suspended or expired',
      status: tenant.subscriptionStatus 
    }, 403);
  }

  c.set('tenant', tenant);
  return next();
}
*/
