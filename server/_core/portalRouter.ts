/**
 * Portal do Cliente — Router Express
 * Rotas públicas (sem autenticação de admin) para o portal self-service do cliente.
 *
 * Rotas:
 *   POST /api/portal/ativar     — Primeiro acesso via token de convite (email + CPF)
 *   POST /api/portal/login      — Login recorrente (email + CPF)
 *   POST /api/portal/logout     — Encerra sessão do portal
 *   GET  /api/portal/me         — Dados do cliente autenticado
 *   PUT  /api/portal/meus-dados — Atualiza dados cadastrais
 *   POST /api/portal/lgpd       — Registra aceite do termo LGPD
 *   GET  /api/portal/lgpd       — Verifica se já aceitou
 */

import type { Express, Request, Response, NextFunction } from "express";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as db from "../db";

const PORTAL_COOKIE = "client_portal_session";

/** Parse cookie header manually (no cookie-parser dependency needed) */
function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers.cookie || "";
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function getPortalCookie(req: Request): string | undefined {
  // Support both cookie-parser (req.cookies) and manual parsing
  return (req as any).cookies?.[PORTAL_COOKIE] ?? parseCookies(req)[PORTAL_COOKIE];
}

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown"
  );
}

/** Resolve o DB do tenant baseado no header X-Tenant-Slug ou subdomínio */
async function resolveTenantDb(req: Request): Promise<{
  tenantDb: ReturnType<typeof drizzle> | null;
  tenantId: number | null;
}> {
  const slugFromHeader = req.headers["x-tenant-slug"] as string | undefined;
  const hostname = req.hostname;

  // Subdomínio: tenant.domain.com
  const domainParts = hostname.split(".");
  const slugFromHostname = domainParts.length >= 3 ? domainParts[0] : null;
  const tenantSlug = slugFromHeader || slugFromHostname;

  if (!tenantSlug || tenantSlug === "www" || tenantSlug === "localhost") {
    return { tenantDb: null, tenantId: null };
  }

  try {
    const tenant = await db.getTenantBySlug(tenantSlug);
    if (!tenant?.id) return { tenantDb: null, tenantId: null };

    // Conectar ao banco do tenant se tiver credenciais próprias
    if (tenant.dbHost && tenant.dbName && tenant.dbUser) {
      const { decryptSecret } = await import("../config/crypto.util");
      const dbPassword = tenant.dbPasswordEncrypted
        ? decryptSecret(tenant.dbPasswordEncrypted)
        : "";
      const connStr = `postgresql://${tenant.dbUser}:${dbPassword}@${tenant.dbHost}:${tenant.dbPort ?? 5432}/${tenant.dbName}`;
      const client = postgres(connStr, { max: 2, idle_timeout: 30 });
      const tenantDb = drizzle(client);
      return { tenantDb, tenantId: tenant.id };
    }

    return { tenantDb: null, tenantId: tenant.id };
  } catch {
    return { tenantDb: null, tenantId: null };
  }
}

/** Middleware: exige sessão de portal válida */
async function requirePortalSession(
  req: Request & { portalClient?: any; portalTenantId?: number | null; portalDb?: ReturnType<typeof drizzle> | null },
  res: Response,
  next: NextFunction
) {
  const sessionToken = getPortalCookie(req);
  if (!sessionToken) {
    return res.status(401).json({ error: "Sessão não encontrada. Faça login no portal." });
  }

  const { tenantDb, tenantId } = await resolveTenantDb(req);
  const activeDb = tenantDb || await db.getDb();
  if (!activeDb) return res.status(503).json({ error: "Banco de dados indisponível." });

  const session = await db.getPortalSession(activeDb, sessionToken);
  if (!session) {
    res.clearCookie(PORTAL_COOKIE);
    return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }

  // Buscar dados do cliente
  const { sql } = await import("drizzle-orm");
  const clientRows = await activeDb.execute(
    sql`SELECT * FROM "clients" WHERE "id" = ${session.clientId} LIMIT 1`
  );
  const clientData = Array.isArray(clientRows) ? clientRows[0] : (clientRows as any).rows?.[0];
  if (!clientData) {
    return res.status(401).json({ error: "Cliente não encontrado." });
  }

  req.portalClient = clientData;
  req.portalTenantId = tenantId;
  req.portalDb = activeDb;
  next();
}

export function registerPortalRoutes(app: Express) {
  // Rate limiter específico para o portal (5 tentativas por 15 min)
  const portalRateLimitStore = new Map<string, { count: number; resetAt: number }>();

  function portalRateLimit(req: Request, res: Response, next: NextFunction) {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = portalRateLimitStore.get(ip);
    if (!entry || entry.resetAt <= now) {
      portalRateLimitStore.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return next();
    }
    entry.count++;
    if (entry.count > 5) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter.toString());
      return res.status(429).json({ error: "Muitas tentativas. Aguarde 15 minutos." });
    }
    return next();
  }

  // Cleanup periódico
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of portalRateLimitStore) {
      if (v.resetAt <= now) portalRateLimitStore.delete(k);
    }
  }, 30 * 60 * 1000).unref();

  /**
   * POST /api/portal/ativar
   * Primeiro acesso: valida token de convite + email + CPF → cria sessão
   */
  app.post("/api/portal/ativar", portalRateLimit, async (req: Request, res: Response) => {
    try {
      const { token, email, cpf } = req.body ?? {};
      if (!token || !email || !cpf) {
        return res.status(400).json({ error: "Token, email e CPF são obrigatórios." });
      }

      const { tenantDb, tenantId } = await resolveTenantDb(req);
      const activeDb = tenantDb || await db.getDb();
      if (!activeDb) return res.status(503).json({ error: "Banco de dados indisponível." });

      // Verificar token de convite
      const inviteToken = await db.getClientInviteToken(activeDb, token);
      if (!inviteToken) {
        return res.status(400).json({ error: "Link de convite inválido." });
      }
      if (new Date(inviteToken.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Link de convite expirado. Solicite um novo link ao clube." });
      }

      // Verificar email + CPF
      const client = await db.getClientByEmailAndCpf(activeDb, email, cpf, tenantId);
      if (!client || client.id !== inviteToken.clientId) {
        return res.status(401).json({ error: "Email ou CPF incorretos. Verifique seus dados." });
      }

      // Marcar token como ativado
      await db.activateInviteToken(activeDb, token);

      // Criar sessão
      const sessionToken = await db.createPortalSession(
        activeDb,
        client.id,
        tenantId,
        getClientIp(req),
        req.headers["user-agent"]
      );

      // Registrar atividade
      await db.logPortalActivity(activeDb, client.id, tenantId, "ACTIVATE_INVITE", {}, getClientIp(req));

      res.cookie(PORTAL_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.protocol === "https",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return res.json({
        success: true,
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          cpf: client.cpf,
        },
      });
    } catch (err) {
      console.error("[Portal] Erro ao ativar convite:", err);
      return res.status(500).json({ error: "Erro interno ao ativar convite." });
    }
  });

  /**
   * POST /api/portal/login
   * Login recorrente: email + CPF → cria nova sessão
   */
  app.post("/api/portal/login", portalRateLimit, async (req: Request, res: Response) => {
    try {
      const { email, cpf } = req.body ?? {};
      if (!email || !cpf) {
        return res.status(400).json({ error: "Email e CPF são obrigatórios." });
      }

      const { tenantDb, tenantId } = await resolveTenantDb(req);
      const activeDb = tenantDb || await db.getDb();
      if (!activeDb) return res.status(503).json({ error: "Banco de dados indisponível." });

      const client = await db.getClientByEmailAndCpf(activeDb, email, cpf, tenantId);
      if (!client) {
        return res.status(401).json({ error: "Email ou CPF incorretos." });
      }

      const sessionToken = await db.createPortalSession(
        activeDb,
        client.id,
        tenantId,
        getClientIp(req),
        req.headers["user-agent"]
      );

      await db.logPortalActivity(activeDb, client.id, tenantId, "LOGIN", {}, getClientIp(req));

      res.cookie(PORTAL_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.protocol === "https",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return res.json({
        success: true,
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          cpf: client.cpf,
        },
      });
    } catch (err) {
      console.error("[Portal] Erro no login:", err);
      return res.status(500).json({ error: "Erro interno no login." });
    }
  });

  /**
   * POST /api/portal/logout
   * Encerra sessão do portal
   */
  app.post("/api/portal/logout", async (req: Request, res: Response) => {
    const sessionToken = getPortalCookie(req);
    if (sessionToken) {
      const { tenantDb } = await resolveTenantDb(req);
      const activeDb = tenantDb || await db.getDb();
      if (activeDb) await db.deletePortalSession(activeDb, sessionToken);
    }
    res.clearCookie(PORTAL_COOKIE, { path: "/" });
    return res.json({ success: true });
  });

  /**
   * GET /api/portal/me
   * Dados completos do cliente autenticado
   */
  app.get("/api/portal/me", requirePortalSession as any, async (req: any, res: Response) => {
    try {
      const client = req.portalClient;
      const activeDb = req.portalDb;

      const lgpdConsent = await db.getLgpdConsent(activeDb, client.id);

      return res.json({
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          cpf: client.cpf,
          phone: client.phone,
          phone2: client.phone2,
          identityNumber: client.identityNumber,
          identityIssueDate: client.identityIssueDate,
          identityIssuer: client.identityIssuer,
          identityUf: client.identityUf,
          birthDate: client.birthDate,
          gender: client.gender,
          motherName: client.motherName,
          fatherName: client.fatherName,
          maritalStatus: client.maritalStatus,
          profession: client.profession,
          cep: client.cep,
          address: client.address,
          addressNumber: client.addressNumber,
          complement: client.complement,
          neighborhood: client.neighborhood,
          city: client.city,
          residenceUf: client.residenceUf,
        },
        lgpdAccepted: !!lgpdConsent,
        lgpdAcceptedAt: lgpdConsent?.acceptedAt ?? null,
      });
    } catch (err) {
      console.error("[Portal] Erro ao buscar dados:", err);
      return res.status(500).json({ error: "Erro ao buscar dados." });
    }
  });

  /**
   * PUT /api/portal/meus-dados
   * Atualiza dados cadastrais do cliente
   */
  app.put("/api/portal/meus-dados", requirePortalSession as any, async (req: any, res: Response) => {
    try {
      const client = req.portalClient;
      const activeDb = req.portalDb;
      const tenantId = req.portalTenantId;

      // Verificar LGPD aceito
      const lgpdConsent = await db.getLgpdConsent(activeDb, client.id);
      if (!lgpdConsent) {
        return res.status(403).json({ error: "É necessário aceitar o termo LGPD antes de atualizar os dados." });
      }

      const allowed = [
        "name", "phone", "phone2", "identityNumber", "identityIssueDate",
        "identityIssuer", "identityUf", "birthDate", "gender",
        "motherName", "fatherName", "maritalStatus", "profession",
        "cep", "address", "addressNumber", "complement",
        "neighborhood", "city", "residenceUf",
      ];

      const data: Record<string, string> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      }

      await db.updateClientFromPortal(activeDb, client.id, tenantId, data);
      await db.logPortalActivity(activeDb, client.id, tenantId, "UPDATE_DATA", { fields: Object.keys(data) }, getClientIp(req));

      return res.json({ success: true, message: "Dados atualizados com sucesso." });
    } catch (err) {
      console.error("[Portal] Erro ao atualizar dados:", err);
      return res.status(500).json({ error: "Erro ao atualizar dados." });
    }
  });

  /**
   * POST /api/portal/lgpd
   * Registra aceite do termo LGPD
   */
  app.post("/api/portal/lgpd", requirePortalSession as any, async (req: any, res: Response) => {
    try {
      const client = req.portalClient;
      const activeDb = req.portalDb;
      const tenantId = req.portalTenantId;

      const existing = await db.getLgpdConsent(activeDb, client.id);
      if (existing) {
        return res.json({ success: true, alreadyAccepted: true });
      }

      await db.recordLgpdConsent(
        activeDb,
        client.id,
        tenantId,
        getClientIp(req),
        req.headers["user-agent"],
        req.body?.version ?? "1.0"
      );

      await db.logPortalActivity(activeDb, client.id, tenantId, "ACCEPT_LGPD", { version: req.body?.version ?? "1.0" }, getClientIp(req));

      return res.json({ success: true });
    } catch (err) {
      console.error("[Portal] Erro ao registrar LGPD:", err);
      return res.status(500).json({ error: "Erro ao registrar consentimento." });
    }
  });

  /**
   * GET /api/portal/lgpd
   * Verifica status do consentimento LGPD
   */
  app.get("/api/portal/lgpd", requirePortalSession as any, async (req: any, res: Response) => {
    try {
      const client = req.portalClient;
      const activeDb = req.portalDb;
      const consent = await db.getLgpdConsent(activeDb, client.id);
      return res.json({
        accepted: !!consent,
        acceptedAt: consent?.acceptedAt ?? null,
        version: consent?.version ?? null,
      });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao verificar consentimento." });
    }
  });
}
