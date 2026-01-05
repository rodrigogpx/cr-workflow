import type { Request, Response } from "express";
import { Router } from "express";
import postgres from "postgres";
import { z } from "zod";
import {
  createTenant,
  getPlatformSettings,
  getTenantBySlug,
  getUserByEmail,
  isPlatformInstalled,
  saveEmailSettings,
  setPlatformSetting,
  updateTenant,
  upsertUser,
} from "../db";
import { hashPassword } from "../_core/auth";
import { sendTestEmailWithSettings } from "../emailService";
import { invalidateTenantCache } from "../config/tenant.config";

const installRouter = Router();

const dbConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  name: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  useSsl: z.boolean().optional(),
});

const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().email(),
  testEmail: z.string().email().optional(),
  useSecure: z.boolean().optional(),
});

const completeSchema = z.object({
  admin: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  }),
  tenant: z.object({
    slug: z.string().regex(/^[a-z0-9-]{3,50}$/),
    name: z.string().min(2),
    dbMode: z.enum(["single", "custom"]).default("single"),
    db: dbConfigSchema.optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
  }),
  smtp: smtpConfigSchema,
  domain: z
    .object({
      rootDomain: z.string().min(1),
      defaultSubdomain: z.string().min(1),
      acmeEmail: z.string().email().optional(),
    })
    .optional(),
});

type DbConfigInput = z.infer<typeof dbConfigSchema>;

async function testDatabaseConnection(config: DbConfigInput) {
  const connectionString = `postgres://${encodeURIComponent(config.user)}:${encodeURIComponent(
    config.password,
  )}@${config.host}:${config.port}/${config.name}`;

  const client = postgres(connectionString, {
    ssl: config.useSsl ? { rejectUnauthorized: false } : undefined,
    idle_timeout: 5,
    connect_timeout: 5,
  });

  try {
    await client`SELECT 1`;
  } finally {
    await client.end();
  }
}

installRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const installed = await isPlatformInstalled();
    const settings = await getPlatformSettings([
      "install.admin.email",
      "install.defaultTenant.slug",
      "install.domain.root",
      "install.completedAt",
    ]);

    res.json({
      installed,
      settings,
      envDefaults: {
        adminEmail: process.env.ADMIN_EMAIL || null,
        tenantSlug: process.env.TENANT_SLUG || null,
        domain: process.env.DOMAIN || null,
      },
    });
  } catch (error) {
    console.error("[InstallRouter] status error", error);
    res.status(500).json({ error: "Falha ao verificar status da instalação" });
  }
});

installRouter.post("/test-db", async (req: Request, res: Response) => {
  try {
    const payload = dbConfigSchema.parse(req.body);
    await testDatabaseConnection(payload);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[InstallRouter] test-db error", error);
    const message = error?.message ?? "Falha ao testar conexão com o banco";
    res.status(400).json({ success: false, error: message });
  }
});

installRouter.post("/test-smtp", async (req: Request, res: Response) => {
  try {
    const payload = smtpConfigSchema.parse(req.body);
    const result = await sendTestEmailWithSettings({
      host: payload.host,
      port: payload.port,
      user: payload.user,
      pass: payload.pass,
      secure: payload.useSecure ?? payload.port === 465,
      from: payload.from,
      toEmail: payload.testEmail || payload.from,
      subject: "Teste de SMTP - CAC 360",
      body: "Se você recebeu este email, as configurações SMTP estão corretas.",
      useGateway: false,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[InstallRouter] test-smtp error", error);
    const message = error?.message ?? "Falha ao testar SMTP";
    res.status(400).json({ success: false, error: message });
  }
});

installRouter.post("/complete", async (req: Request, res: Response) => {
  try {
    if (await isPlatformInstalled()) {
      return res.status(409).json({ error: "A plataforma já foi instalada." });
    }

    const payload = completeSchema.parse(req.body);

    let tenantDbConfig: DbConfigInput;
    if (payload.tenant.dbMode === "single") {
      const platformDbUrl = process.env.DATABASE_URL;
      if (!platformDbUrl) {
        return res.status(400).json({
          error: "DATABASE_URL não está configurado no servidor para o modo single-db.",
        });
      }
      const url = new URL(platformDbUrl);
      tenantDbConfig = {
        host: url.hostname,
        port: Number(url.port || 5432),
        name: (url.pathname || "").replace(/^\//, ""),
        user: decodeURIComponent(url.username || ""),
        password: decodeURIComponent(url.password || ""),
        useSsl: url.searchParams.get("sslmode") === "require",
      };
    } else if (!payload.tenant.db) {
      return res.status(400).json({
        error: "Informe as credenciais de banco para o modo custom.",
      });
    } else {
      tenantDbConfig = payload.tenant.db;
      await testDatabaseConnection(tenantDbConfig);
    }

    const hashedPassword = await hashPassword(payload.admin.password);
    const existingAdmin = await getUserByEmail(payload.admin.email);
    await upsertUser({
      id: existingAdmin?.id,
      tenantId: null,
      name: payload.admin.name,
      email: payload.admin.email,
      hashedPassword,
      role: "admin",
      perfil: "admin",
    });

    const tenantPayload = {
      slug: payload.tenant.slug,
      name: payload.tenant.name,
      dbHost: tenantDbConfig.host,
      dbPort: tenantDbConfig.port,
      dbName: tenantDbConfig.name,
      dbUser: tenantDbConfig.user,
      dbPassword: tenantDbConfig.password,
      primaryColor: payload.tenant.primaryColor || "#1a5c00",
      secondaryColor: payload.tenant.secondaryColor || "#4d9702",
      featureWorkflowCR: true,
      featureApostilamento: true,
      featureRenovacao: true,
      featureInsumos: true,
      plan: "enterprise" as const,
      subscriptionStatus: "active" as const,
      maxUsers: 100,
      maxClients: 5000,
      maxStorageGB: 500,
      isActive: true,
    };

    const existingTenant = await getTenantBySlug(payload.tenant.slug);
    if (existingTenant) {
      await updateTenant(existingTenant.id, tenantPayload);
    } else {
      await createTenant(tenantPayload as any);
    }
    await invalidateTenantCache(payload.tenant.slug);

    await saveEmailSettings({
      smtpHost: payload.smtp.host,
      smtpPort: payload.smtp.port,
      smtpUser: payload.smtp.user,
      smtpPass: payload.smtp.pass,
      smtpFrom: payload.smtp.from,
      useSecure: payload.smtp.useSecure ?? payload.smtp.port === 465,
    });

    await Promise.all([
      setPlatformSetting("install.admin.email", payload.admin.email),
      setPlatformSetting("install.admin.name", payload.admin.name),
      setPlatformSetting("install.defaultTenant.slug", payload.tenant.slug),
      setPlatformSetting("install.db.mode", payload.tenant.dbMode),
      setPlatformSetting("install.domain.root", payload.domain?.rootDomain ?? ""),
      setPlatformSetting("install.domain.defaultSubdomain", payload.domain?.defaultSubdomain ?? ""),
      setPlatformSetting("install.domain.acmeEmail", payload.domain?.acmeEmail ?? ""),
      setPlatformSetting("install.completed", "true"),
      setPlatformSetting("install.completedAt", new Date().toISOString()),
    ]);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[InstallRouter] complete error", error);
    const message = error?.message ?? "Falha ao concluir instalação";
    res.status(400).json({ error: message });
  }
});

export { installRouter };
