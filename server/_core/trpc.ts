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

export const protectedProcedure = t.procedure
  .use(requireUser)
  .use(requireTenantIfPresent);

export const adminProcedure = t.procedure
  .use(requireUser)
  .use(requireTenantIfPresent)
  .use(requireAdmin);
