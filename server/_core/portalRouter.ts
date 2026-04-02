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

function parsePortalActivities(value: unknown): Array<'atirador' | 'cacador' | 'colecionador'> {
  if (Array.isArray(value)) {
    return value.filter((v): v is 'atirador' | 'cacador' | 'colecionador' =>
      ['atirador', 'cacador', 'colecionador'].includes(String(v))
    );
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is 'atirador' | 'cacador' | 'colecionador' =>
          ['atirador', 'cacador', 'colecionador'].includes(String(v))
        );
      }
    } catch {
      // ignore
    }
  }
  return [];
}

const DISPENSADO_PREFIX = '[DISPENSADO] ';

function buildPortalRequiredDocuments(
  activities: Array<'atirador' | 'cacador' | 'colecionador'>,
  hasSecondCollectionAddress: boolean,
): string[] {
  const docs = new Set<string>([
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Certidão de Antecedente Criminal Justiça Federal',
    'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
    'Documento de Identificação Pessoal',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
    'Comprovante de Residência Fixa',
    'Comprovante de Ocupação Lícita',
    'Certidão de Antecedente Criminal Justiça Estadual',
    'Declaração de Segurança do Acervo',
    'Certidão de Antecedente Criminal Justiça Militar',
    'Certidão de Antecedente Criminal Justiça Eleitoral',
  ]);

  if (activities.includes('atirador')) {
    docs.add('Declaração com compromisso de comprovar a habitualidade na forma da norma vigente');
    docs.add('Comprovante de filiação a entidade de tiro desportivo');
  }
  if (activities.includes('cacador')) {
    docs.add('Comprovante de filiação a entidade de caça');
    docs.add('Comprovante da necessidade de abate de fauna invasora expedido pelo Ibama');
  }
  if (hasSecondCollectionAddress) {
    docs.add('Comprovante de Segundo Endereço');
  }

  return Array.from(docs);
}

function stripDispensadoPrefix(label: string): string {
  return label.startsWith(DISPENSADO_PREFIX) ? label.slice(DISPENSADO_PREFIX.length) : label;
}

async function syncPortalJuntadaSubTasks(activeDb: any, clientId: number, requiredDocuments: string[]) {
  const { sql } = await import('drizzle-orm');
  const stepRows = await activeDb.execute(
    sql`SELECT id FROM "workflowSteps" WHERE "clientId" = ${clientId} AND "stepId" = 'juntada-documento' LIMIT 1`
  );
  const steps = Array.isArray(stepRows) ? stepRows : (stepRows as any).rows || [];
  if (steps.length === 0) return;

  const workflowStepId = steps[0].id;
  const subTaskRows = await activeDb.execute(
    sql`SELECT id, label FROM "subTasks" WHERE "workflowStepId" = ${workflowStepId} ORDER BY id ASC`
  );
  const subTasks = Array.isArray(subTaskRows) ? subTaskRows : (subTaskRows as any).rows || [];
  const requiredSet = new Set(requiredDocuments);

  const existing = new Set<string>();
  for (const st of subTasks) {
    const baseLabel = stripDispensadoPrefix(String(st.label ?? ''));
    existing.add(baseLabel);
    const shouldBeRequired = requiredSet.has(baseLabel);
    const isDispensed = String(st.label ?? '').startsWith(DISPENSADO_PREFIX);

    if (shouldBeRequired && isDispensed) {
      await activeDb.execute(sql`UPDATE "subTasks" SET label = ${baseLabel} WHERE id = ${st.id}`);
    } else if (!shouldBeRequired && !isDispensed) {
      await activeDb.execute(sql`UPDATE "subTasks" SET label = ${DISPENSADO_PREFIX + baseLabel} WHERE id = ${st.id}`);
    }
  }

  let idx = subTasks.length + 1;
  for (const doc of requiredDocuments) {
    if (existing.has(doc)) continue;
    await db.upsertSubTaskToDb(activeDb, {
      workflowStepId,
      subTaskId: `doc-${String(idx).padStart(2, '0')}`,
      label: doc,
      completed: false,
    });
    idx++;
  }
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

      // Verificar se a etapa "cadastro" está marcada como concluída
      const { sql } = await import("drizzle-orm");
      const cadastroRows = await activeDb.execute(
        sql`SELECT completed FROM "workflowSteps" WHERE "clientId" = ${client.id} AND "stepId" = 'cadastro' LIMIT 1`
      );
      const cadastroArr = Array.isArray(cadastroRows) ? cadastroRows : (cadastroRows as any).rows || [];
      const cadastroCompleto = cadastroArr.length > 0 && !!cadastroArr[0].completed;

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
          apostilamentoActivities: parsePortalActivities(client.apostilamentoActivities),
          hasSecondCollectionAddress: !!client.hasSecondCollectionAddress,
          acervoCep: client.acervoCep,
          acervoAddress: client.acervoAddress,
          acervoAddressNumber: client.acervoAddressNumber,
          acervoNeighborhood: client.acervoNeighborhood,
          acervoCity: client.acervoCity,
          acervoUf: client.acervoUf,
          acervoComplement: client.acervoComplement,
        },
        lgpdAccepted: !!lgpdConsent,
        lgpdAcceptedAt: lgpdConsent?.acceptedAt ?? null,
        cadastroCompleto,
        canEditApostilamentoInPortal: !cadastroCompleto,
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

      // Restringir edição das opções de apostilamento após conclusão do primeiro cadastro.
      const { sql } = await import("drizzle-orm");
      const cadastroRows = await activeDb.execute(
        sql`SELECT completed FROM "workflowSteps" WHERE "clientId" = ${client.id} AND "stepId" = 'cadastro' LIMIT 1`
      );
      const cadastroArr = Array.isArray(cadastroRows) ? cadastroRows : (cadastroRows as any).rows || [];
      const cadastroCompleto = cadastroArr.length > 0 && !!cadastroArr[0].completed;

      if (!cadastroCompleto) {
        allowed.push(
          "apostilamentoActivities",
          "hasSecondCollectionAddress",
          "acervoCep",
          "acervoAddress",
          "acervoAddressNumber",
          "acervoNeighborhood",
          "acervoCity",
          "acervoUf",
          "acervoComplement",
        );
      }

      const data: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          if (key === "apostilamentoActivities") {
            data[key] = JSON.stringify(parsePortalActivities(req.body[key]));
          } else if (key === "hasSecondCollectionAddress") {
            data[key] = Boolean(req.body[key]);
          } else {
            data[key] = req.body[key];
          }
        }
      }

      await db.updateClientFromPortal(activeDb, client.id, tenantId, data);

      if (data.apostilamentoActivities !== undefined || data.hasSecondCollectionAddress !== undefined) {
        const activities = data.apostilamentoActivities !== undefined
          ? parsePortalActivities(data.apostilamentoActivities)
          : parsePortalActivities((client as any).apostilamentoActivities);
        const hasSecondCollectionAddress = data.hasSecondCollectionAddress !== undefined
          ? Boolean(data.hasSecondCollectionAddress)
          : Boolean((client as any).hasSecondCollectionAddress);
        const requiredDocuments = buildPortalRequiredDocuments(activities, hasSecondCollectionAddress);
        await syncPortalJuntadaSubTasks(activeDb, client.id, requiredDocuments);
      }

      await db.logPortalActivity(activeDb, client.id, tenantId, "UPDATE_DATA", { fields: Object.keys(data) }, getClientIp(req));

      // Notificar operador que cliente preencheu dados
      try {
        // Buscar email do operador responsável pelo cliente
        const opRows = await activeDb.execute(
          (await import("drizzle-orm")).sql`
            SELECT u.email, u.name FROM "users" u
            INNER JOIN "clients" c ON c."operatorId" = u.id
            WHERE c."id" = ${client.id}
            LIMIT 1
          `
        );
        const opArr = Array.isArray(opRows) ? opRows : (opRows as any).rows || [];
        if (opArr.length > 0 && opArr[0].email) {
          const { sendEmail } = await import("../emailService");
          await sendEmail({
            to: opArr[0].email,
            subject: `[Portal] ${client.name} preencheu os dados cadastrais`,
            html: `
              <div style="font-family:sans-serif;max-width:600px">
                <h3 style="color:#7c3aed">Novo preenchimento no Portal</h3>
                <p>O cliente <strong>${client.name}</strong> (${client.email}) acabou de preencher seus dados cadastrais no Portal do Associado.</p>
                <p>Acesse o sistema para revisar as informações:</p>
                <ul style="color:#555">
                  <li>CPF: ${client.cpf}</li>
                  <li>Email: ${client.email}</li>
                </ul>
                <p style="color:#888;font-size:12px">Esta é uma notificação automática do CAC 360.</p>
              </div>
            `,
            tenantDb: activeDb,
            tenantId: tenantId ?? undefined,
          });
        }
      } catch (notifErr) {
        console.warn("[Portal] Falha ao notificar operador:", notifErr);
      }

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

  /**
   * GET /api/portal/lgpd/documento
   * Retorna o Termo de Consentimento LGPD como página HTML formatada para visualização/impressão.
   * Rota pública (sem autenticação) — apenas exibe o texto do termo.
   */
  app.get("/api/portal/lgpd/documento", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Termo de Consentimento — LGPD</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #222; background: #fff; padding: 48px 60px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    h2 { font-size: 13px; font-weight: 600; color: #333; margin-top: 20px; margin-bottom: 6px; }
    p { margin-bottom: 10px; }
    ul { padding-left: 20px; margin-bottom: 10px; }
    ul li { margin-bottom: 4px; }
    .header { border-bottom: 2px solid #123A63; padding-bottom: 16px; margin-bottom: 24px; }
    .header .subtitle { color: #555; font-size: 12px; margin-top: 2px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
    @media print {
      body { padding: 20px 30px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#123A63;color:#fff;padding:10px 16px;margin:-48px -60px 32px;font-size:12px;display:flex;align-items:center;gap:12px;">
    <span>📄 Termo de Consentimento LGPD — CAC 360</span>
    <button onclick="window.print()" style="margin-left:auto;background:#F37321;color:#fff;border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px;">Imprimir / Salvar como PDF</button>
  </div>

  <div class="header">
    <h1>Termo de Consentimento para Tratamento de Dados Pessoais</h1>
    <p class="subtitle">Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD) · Versão 1.0 · Vigente a partir de 2026</p>
  </div>

  <p>Ao utilizar este portal, você concorda com o tratamento dos seus dados pessoais pela entidade responsável
  (doravante denominada "Clube" ou "Controlador"), nos termos descritos abaixo.</p>

  <h2>1. Dados Coletados</h2>
  <p>Nome completo, CPF, RG, data de nascimento, endereço residencial, telefone, email, profissão, e
  documentos relacionados ao processo de obtenção do Certificado de Registro (CR) junto ao Exército Brasileiro.</p>

  <h2>2. Finalidade do Tratamento</h2>
  <p>Os dados coletados serão utilizados exclusivamente para:</p>
  <ul>
    <li>Gestão do processo de obtenção do CR CAC (Certificado de Registro para Caçadores, Atiradores e Colecionadores);</li>
    <li>Comunicação sobre o andamento do processo;</li>
    <li>Cumprimento de obrigações legais perante o Exército Brasileiro e demais órgãos;</li>
    <li>Emissão de documentos e certidões relacionadas ao processo.</li>
  </ul>

  <h2>3. Base Legal</h2>
  <p>O tratamento dos dados se fundamenta no art. 7º, incisos II (execução de contrato) e V
  (execução de políticas públicas), da Lei nº 13.709/2018 (LGPD).</p>

  <h2>4. Compartilhamento de Dados</h2>
  <p>Seus dados poderão ser compartilhados com:</p>
  <ul>
    <li>Exército Brasileiro (para fins de registro e controle);</li>
    <li>Polícia Federal (verificação de antecedentes);</li>
    <li>Órgãos estaduais e federais competentes, conforme exigência legal.</li>
  </ul>
  <p>Não compartilhamos seus dados com terceiros para fins comerciais.</p>

  <h2>5. Prazo de Retenção</h2>
  <p>Seus dados serão mantidos pelo período necessário ao cumprimento das finalidades acima e das obrigações
  legais, podendo ser retidos por até 5 (cinco) anos após o encerramento do processo, conforme determinação legal.</p>

  <h2>6. Seus Direitos (Art. 18 da LGPD)</h2>
  <p>Você tem direito a:</p>
  <ul>
    <li>Confirmar a existência de tratamento;</li>
    <li>Acessar seus dados;</li>
    <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
    <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
    <li>Revogar este consentimento a qualquer momento, mediante solicitação ao clube.</li>
  </ul>

  <h2>7. Contato do Controlador</h2>
  <p>Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato
  diretamente com a secretaria do clube.</p>

  <div class="footer">
    Versão 1.0 — Vigente a partir de 2026. Este documento foi gerado automaticamente pelo sistema CAC 360.
  </div>
</body>
</html>`);
  });

  /**
   * GET /api/portal/meu-processo
   * Retorna os workflow steps do cliente com sub-tarefas
   */
  app.get("/api/portal/meu-processo", requirePortalSession as any, async (req: any, res: Response) => {
    try {
      const client = req.portalClient;
      const activeDb = req.portalDb;

      // Buscar workflow steps do cliente
      const steps = await activeDb.execute(
        (await import("drizzle-orm")).sql`
          SELECT ws.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', st.id,
                  'subTaskId', st."subTaskId",
                  'label', st.label,
                  'completed', st.completed,
                  'completedAt', st."completedAt"
                ) ORDER BY st.id
              ) FILTER (WHERE st.id IS NOT NULL),
              '[]'
            ) as "subTasks"
          FROM "workflowSteps" ws
          LEFT JOIN "subTasks" st ON st."workflowStepId" = ws.id
          WHERE ws."clientId" = ${client.id}
          GROUP BY ws.id
          ORDER BY ws.id
        `
      );

      const stepsArr = Array.isArray(steps) ? steps : (steps as any).rows || [];

      return res.json({ steps: stepsArr });
    } catch (err) {
      console.error("[Portal] Erro ao buscar processo:", err);
      return res.status(500).json({ error: "Erro ao buscar processo." });
    }
  });

  /**
   * GET /api/portal/mensagens
   * Feed unificado de mensagens do cliente (rejeições documentais + comentários SINARM)
   */
  app.get("/api/portal/mensagens", requirePortalSession as any, async (req: any, res: Response) => {
    try {
      const client = req.portalClient;
      const activeDb = req.portalDb;
      const tenantId: number | null = (req.portalTenantId as number | null) ?? (client.tenantId as number | null) ?? null;
      const { sql } = await import("drizzle-orm");

      const rejectedRowsRaw = await activeDb.execute(sql`
        SELECT
          pd.id,
          pd."fileName",
          pd."rejectionReason",
          COALESCE(pd."reviewedAt", pd."uploadedAt", pd."createdAt") AS "createdAt"
        FROM "clientPendingDocuments" pd
        WHERE pd."clientId" = ${client.id}
          AND pd.status = 'rejected'
          AND COALESCE(NULLIF(TRIM(pd."rejectionReason"), ''), NULL) IS NOT NULL
          ${tenantId != null ? sql`AND (pd."tenantId" = ${tenantId} OR pd."tenantId" IS NULL)` : sql``}
        ORDER BY COALESCE(pd."reviewedAt", pd."uploadedAt", pd."createdAt") DESC
        LIMIT 100
      `);
      const rejectedRows = Array.isArray(rejectedRowsRaw) ? rejectedRowsRaw : (rejectedRowsRaw as any).rows || [];

      const sinarmStepRaw = await activeDb.execute(sql`
        SELECT ws.id
        FROM "workflowSteps" ws
        WHERE ws."clientId" = ${client.id}
          AND (
            ws."stepId" = 'acompanhamento-sinarm'
            OR ws."stepId" = 'acompanhamento-sinarm-cac'
            OR LOWER(COALESCE(ws."stepTitle", '')) LIKE '%sinarm%'
          )
        ORDER BY ws.id DESC
        LIMIT 1
      `);
      const sinarmStepArr = Array.isArray(sinarmStepRaw) ? sinarmStepRaw : (sinarmStepRaw as any).rows || [];
      const sinarmStepId: number | null = sinarmStepArr[0]?.id ?? null;

      const sinarmComments = sinarmStepId
        ? await db.getSinarmCommentsByWorkflowStepIdFromDb(activeDb, sinarmStepId, tenantId ?? undefined)
        : [];

      const rejectedMessages = rejectedRows.map((row: any) => ({
        id: `doc-${row.id}`,
        type: 'document_rejection' as const,
        title: 'Documento rejeitado na triagem',
        body: String(row.rejectionReason || ''),
        createdAt: row.createdAt,
        meta: {
          fileName: row.fileName,
        },
      }));

      const sinarmMessages = (sinarmComments || []).map((row: any) => ({
        id: `sinarm-${row.id}`,
        type: 'sinarm_comment' as const,
        title: 'Atualização do acompanhamento SINARM-CAC',
        body: String(row.comment || ''),
        createdAt: row.createdAt,
        meta: {
          sinarmStatus: row.newStatus,
          authorName: row.createdByName,
        },
      }));

      const messages = [...rejectedMessages, ...sinarmMessages]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({ messages });
    } catch (err) {
      console.error("[Portal] Erro ao buscar mensagens:", err);
      return res.status(500).json({ error: "Erro ao buscar mensagens." });
    }
  });

  /**
   * GET /api/portal/documentos
   * Retorna a lista de subtarefas de juntada de documentos com status dos docs enviados
   */
  app.get("/api/portal/documentos", requirePortalSession as any, async (req: any, res: Response) => {
    try {
      const client = req.portalClient;
      const activeDb = req.portalDb;

      // Buscar a etapa "juntada-documento" do cliente
      const juntadaRows = await activeDb.execute(
        (await import("drizzle-orm")).sql`
          SELECT id FROM "workflowSteps"
          WHERE "clientId" = ${client.id} AND "stepId" = 'juntada-documento'
          LIMIT 1
        `
      );
      const juntadaArr = Array.isArray(juntadaRows) ? juntadaRows : (juntadaRows as any).rows || [];

      if (juntadaArr.length === 0) {
        return res.json({ documents: [] });
      }

      const juntadaStepId = juntadaArr[0].id;

      // Buscar subtarefas com documentos associados
      const docs = await activeDb.execute(
        (await import("drizzle-orm")).sql`
          SELECT
            st.id,
            st."subTaskId",
            st.label,
            st.completed,
            d.id as "docId",
            d."fileName",
            d."fileUrl",
            d."mimeType",
            d."fileSize",
            d."createdAt" as "uploadedAt"
          FROM "subTasks" st
          LEFT JOIN "documents" d ON d."subTaskId" = st.id AND d."clientId" = ${client.id}
          WHERE st."workflowStepId" = ${juntadaStepId}
          ORDER BY st.id, d."createdAt" DESC
        `
      );

      const docsArr = Array.isArray(docs) ? docs : (docs as any).rows || [];

      // Agrupar por subtarefa
      const grouped: Record<number, any> = {};
      for (const row of docsArr) {
        if (!grouped[row.id]) {
          grouped[row.id] = {
            id: row.id,
            subTaskId: row.subTaskId,
            label: row.label,
            completed: row.completed,
            documents: [],
          };
        }
        if (row.docId) {
          grouped[row.id].documents.push({
            id: row.docId,
            fileName: row.fileName,
            fileUrl: row.fileUrl,
            mimeType: row.mimeType,
            fileSize: row.fileSize,
            uploadedAt: row.uploadedAt,
          });
        }
      }

      return res.json({ documents: Object.values(grouped) });
    } catch (err) {
      console.error("[Portal] Erro ao buscar documentos:", err);
      return res.status(500).json({ error: "Erro ao buscar documentos." });
    }
  });

  // ─── Upload de documento pelo cliente ───────────────────────────────────────
  // POST /api/portal/documentos/upload
  app.post("/api/portal/documentos/upload", requirePortalSession as any, async (req: any, res: Response) => {
    const client   = req.portalClient;
    const activeDb = req.portalDb;
    // Usar tenantId do hostname quando disponível; caso contrário usar o tenantId do próprio cliente
    // (necessário quando o portal é acessado pelo domínio principal, ex: hml.cac360.com.br,
    //  onde o subdomain 'hml' é excluído da resolução de tenant)
    const tenantId: number | null = (req.portalTenantId as number | null) ?? (client.tenantId as number | null) ?? null;
    try {
      const { fileName, fileData, mimeType, fileSize } = req.body ?? {};
      if (!fileName || !fileData) {
        return res.status(400).json({ error: "fileName e fileData são obrigatórios." });
      }

      const ALLOWED_MIMES = [
        "application/pdf", "image/jpeg", "image/png", "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (mimeType && !ALLOWED_MIMES.includes(mimeType)) {
        return res.status(400).json({ error: "Tipo de arquivo não permitido." });
      }
      if (fileSize && fileSize > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Arquivo muito grande. Máximo: 10 MB." });
      }

      // Decodificar base64 (aceita data URL ou base64 puro)
      const base64 = String(fileData).includes(",") ? String(fileData).split(",")[1] : String(fileData);
      const buffer = Buffer.from(base64, "base64");

      // Reutiliza saveClientDocumentFile com validação de path traversal
      const { saveClientDocumentFile } = await import("../fileStorage");
      const stored = await saveClientDocumentFile({
        clientId: client.id,
        tenantId: tenantId ?? undefined,
        fileName,
        buffer,
      });

      const pendingDocId = await db.createPendingDocument(activeDb, {
        clientId: client.id,
        tenantId: tenantId ?? null,
        fileName: stored.key.split("/").pop() ?? fileName,
        fileUrl: stored.publicPath,
        mimeType: mimeType ?? null,
        fileSize: stored.size,
      });

      await db.logPortalActivity(activeDb, client.id, tenantId, "document_upload", { fileName }, getClientIp(req));

      // Notificar operador (fire-and-forget)
      notifyOperatorOfUpload(activeDb, client.id, tenantId ?? null, fileName).catch(() => {});

      return res.json({ success: true, pendingDocId, fileUrl: stored.publicPath });
    } catch (err) {
      console.error("[Portal] Erro no upload:", err);
      return res.status(500).json({ error: "Erro ao salvar documento." });
    }
  });

  // GET /api/portal/documentos/fila — documentos enviados pelo cliente com status de triagem
  app.get("/api/portal/documentos/fila", requirePortalSession as any, async (req: any, res: Response) => {
    const client   = req.portalClient;
    const activeDb = req.portalDb;
    const tenantId = req.portalTenantId as number | null;
    try {
      const docs = await db.getPendingDocumentsByClient(activeDb, client.id, tenantId);
      return res.json({ documents: docs });
    } catch (err) {
      console.error("[Portal] Erro ao listar fila:", err);
      return res.status(500).json({ error: "Erro ao buscar documentos." });
    }
  });
}

// ─── Notificação ao operador quando cliente envia documento ──────────────────
async function notifyOperatorOfUpload(
  tenantDb: any,
  clientId: number,
  tenantId: number | null,
  fileName: string
): Promise<void> {
  try {
    const { sql } = await import("drizzle-orm");
    const opRows = await tenantDb.execute(sql`
      SELECT u.email, u.name AS "operatorName", c.name AS "clientName", c.email AS "clientEmail"
      FROM "users" u
      INNER JOIN "clients" c ON c."operatorId" = u.id
      WHERE c.id = ${clientId}
      LIMIT 1
    `);
    const arr = Array.isArray(opRows) ? opRows : (opRows as any).rows ?? [];
    if (!arr[0]?.email) return;
    const { email, operatorName, clientName } = arr[0];
    const { sendEmail } = await import("../emailService");
    await sendEmail({
      to: email,
      subject: `[CAC 360] Novo documento enviado pelo cliente`,
      html: `<div style="font-family:sans-serif;max-width:600px">
        <h3 style="color:#7c3aed">Novo documento para triagem</h3>
        <p>Olá <strong>${operatorName ?? ""}</strong>,</p>
        <p>O cliente <strong>${clientName}</strong> enviou o arquivo
           <strong>${fileName}</strong> pelo portal e aguarda triagem.</p>
        <p><a href="/client/${clientId}"
           style="background:#7c3aed;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none">
           Abrir workflow
        </a></p>
        <p style="color:#888;font-size:12px">CAC 360 — notificação automática</p>
      </div>`,
    } as any).catch((e: any) => console.error("[Portal] Email op upload:", e));
  } catch (e) {
    console.error("[Portal] notifyOperatorOfUpload:", e);
  }
}
