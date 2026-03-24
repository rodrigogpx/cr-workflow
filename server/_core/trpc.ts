import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { isTenantActive } from "../config/tenant.config";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Bloquear usuários sem perfil (aguardando aprovação)
  if (!ctx.user.role) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Aguardando aprova\u00e7\u00e3o do administrador" 
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Middleware opcional de tenant: valida tenant se presente, mas não bloqueia se ausente
const requireTenantIfPresent = t.middleware(async opts => {
  const { ctx, next } = opts;

  // Sem slug de tenant (ex: admin.cac360.com.br ou Railway preview) → não aplica regra de tenant
  if (!ctx.tenantSlug) {
    return next({ ctx });
  }

  // Se slug existe mas tenant não foi encontrado, apenas logar e continuar
  // As procedures individuais decidem se tenant é obrigatório
  if (!ctx.tenant) {
    console.warn(`[TenantMiddleware] Tenant slug "${ctx.tenantSlug}" provided but tenant not found`);
    return next({ ctx });
  }

  if (!isTenantActive(ctx.tenant)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tenant suspenso ou expirado" });
  }

  return next({
    ctx: {
      ...ctx,
      tenant: ctx.tenant,
      tenantSlug: ctx.tenantSlug,
    },
  });
});

const requireAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const requirePlatformAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.platformAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso restrito à administração da plataforma" });
  }

  return next({
    ctx: {
      ...ctx,
      platformAdmin: ctx.platformAdmin,
    },
  });
});

// Exige role superadmin — CRUD de platform admins, delete de tenants
const requireSuperAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.platformAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso restrito à administração da plataforma" });
  }

  if (ctx.platformAdmin.role !== 'superadmin') {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta operação requer role superadmin" });
  }

  return next({
    ctx: {
      ...ctx,
      platformAdmin: ctx.platformAdmin,
    },
  });
});

// Exige role superadmin ou admin — criação/edição de tenants, configs de email
const requireAdminOrSuper = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.platformAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso restrito à administração da plataforma" });
  }

  if (ctx.platformAdmin.role !== 'superadmin' && ctx.platformAdmin.role !== 'admin') {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta operação requer role admin ou superadmin" });
  }

  return next({
    ctx: {
      ...ctx,
      platformAdmin: ctx.platformAdmin,
    },
  });
});

// Middleware OBRIGATÓRIO de tenant: bloqueia se tenant não estiver presente e ativo
const requireTenant = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.tenantSlug) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Tenant não identificado. Acesse através do domínio correto." 
    });
  }

  if (!ctx.tenant) {
    throw new TRPCError({ 
      code: "NOT_FOUND", 
      message: `Tenant "${ctx.tenantSlug}" não encontrado ou inativo.` 
    });
  }

  if (!isTenantActive(ctx.tenant)) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Tenant suspenso ou com assinatura expirada. Entre em contato com o suporte." 
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenant: ctx.tenant,
      tenantSlug: ctx.tenantSlug,
    },
  });
});

// Middleware RIGOROSO de tenant: exige tenant E injeta tenantDb no contexto
const requireStrictTenant = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.tenant?.id) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Operação requer contexto de tenant válido" 
    });
  }

  if (!isTenantActive(ctx.tenant)) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Tenant suspenso ou com assinatura expirada" 
    });
  }

  // Importar getTenantDb dinamicamente para evitar dependência circular
  const { getTenantDb } = await import("../config/tenant.config");
  const tenantDb = await getTenantDb(ctx.tenant);
  
  if (!tenantDb) {
    throw new TRPCError({ 
      code: "INTERNAL_SERVER_ERROR", 
      message: "Banco de dados do tenant indisponível" 
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenant: ctx.tenant,
      tenantSlug: ctx.tenantSlug,
      tenantDb, // Injetar tenantDb no contexto
    },
  });
});

export const protectedProcedure = t.procedure
  .use(requireUser)
  .use(requireTenantIfPresent);

export const adminProcedure = t.procedure
  .use(requireUser)
  .use(requireTenantIfPresent)
  .use(requireAdmin);

// Procedure que EXIGE tenant válido e ativo (para operações sensíveis)
export const tenantProcedure = t.procedure
  .use(requireUser)
  .use(requireTenant);

// Procedure admin que EXIGE tenant válido
export const tenantAdminProcedure = t.procedure
  .use(requireUser)
  .use(requireTenant)
  .use(requireAdmin);

// Qualquer platform admin autenticado (superadmin, admin, support) — leitura e stats
export const platformAdminProcedure = t.procedure
  .use(requirePlatformAdmin);

// Apenas superadmin — CRUD de platform admins, delete/hardDelete de tenants
export const platformSuperAdminProcedure = t.procedure
  .use(requireSuperAdmin);

// superadmin ou admin — criação/edição de tenants, impersonar, configs de email
export const platformAdminOrSuperProcedure = t.procedure
  .use(requireAdminOrSuper);

// Procedure RIGOROSO que exige tenant válido E injeta tenantDb
export const strictTenantProcedure = t.procedure
  .use(requireUser)
  .use(requireStrictTenant);

// Procedure admin RIGOROSO que exige tenant válido E injeta tenantDb
export const strictTenantAdminProcedure = t.procedure
  .use(requireUser)
  .use(requireStrictTenant)
  .use(requireAdmin);
