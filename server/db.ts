import { eq, and, or, isNull, desc, sql, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  InsertUser, 
  users, 
  clients, 
  InsertClient,
  workflowSteps,
  InsertWorkflowStep,
  subTasks,
  InsertSubTask,
  documents,
  InsertDocument,
  emailTemplates,
  InsertEmailTemplate,
  emailLogs,
  InsertEmailLog,
  tenants,
  InsertTenant,
  tenantActivityLogs,
  InsertTenantActivityLog,
  auditLogs,
  InsertAuditLog,
  AuditLog,
  emailTriggers,
  InsertEmailTrigger,
  emailTriggerTemplates,
  InsertEmailTriggerTemplate,
  emailScheduled,
  InsertEmailScheduled,
  platformSettings,
  PlatformSetting,
  platformAdmins,
  sinarmCommentsHistory,
  InsertSinarmCommentHistory,
  planDefinitions,
  InsertPlanDefinition,
  subscriptions,
  InsertSubscription,
  invoices,
  InsertInvoice,
  usageSnapshots,
  InsertUsageSnapshot,
  clientInviteTokens,
  InsertClientInviteToken,
  clientPortalSessions,
  InsertClientPortalSession,
  lgpdConsents,
  InsertLgpdConsent,
  clientPortalActivityLog,
  clientPendingDocuments,
  leads,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { encryptSecret } from "./config/crypto.util";
import bcrypt from "bcryptjs";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
const _schemaCheckedDbs = new Set<string>();

/** Safely extract rows from db.execute() — handles both array and { rows: [] } formats */
function extractRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result?.rows && Array.isArray(result.rows)) return result.rows;
  // postgres.js RowList is array-like but not Array.isArray
  if (result && typeof result.length === 'number' && result.length > 0 && result[0]) {
    return Array.from(result);
  }
  console.warn('[extractRows] unexpected result shape:', typeof result, JSON.stringify(result)?.slice(0, 200));
  return [];
}

export async function ensureSchemaColumns(db: ReturnType<typeof drizzle>, dbKey: string = 'main') {
  if (_schemaCheckedDbs.has(dbKey)) return;
  _schemaCheckedDbs.add(dbKey);

  // ── CREATE core tables if they don't exist ──
  const createStatements = [
    sql`CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenantId" integer,
      "name" text,
      "email" varchar(320) NOT NULL,
      "hashedPassword" text NOT NULL,
      "role" varchar(20),
      "approved" boolean DEFAULT true,
      "openId" varchar(255),
      "loginMethod" varchar(50),
      "perfil" varchar(50),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      "lastSignedIn" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "clients" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenantId" integer,
      "name" varchar(255) NOT NULL,
      "cpf" varchar(14) NOT NULL,
      "phone" varchar(20) NOT NULL,
      "email" varchar(320) NOT NULL,
      "operatorId" integer NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "workflowSteps" (
      "id" serial PRIMARY KEY NOT NULL,
      "clientId" integer NOT NULL,
      "stepId" varchar(100) NOT NULL,
      "stepTitle" varchar(255) NOT NULL,
      "completed" boolean DEFAULT false NOT NULL,
      "completedAt" timestamp,
      "scheduledDate" timestamp,
      "examinerName" varchar(255),
      "sinarmStatus" varchar(50),
      "sinarmOpenDate" timestamp,
      "protocolNumber" varchar(100),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "subTasks" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenantId" integer,
      "workflowStepId" integer NOT NULL,
      "subTaskId" varchar(100) NOT NULL,
      "label" varchar(255) NOT NULL,
      "completed" boolean DEFAULT false NOT NULL,
      "completedAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "documents" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenantId" integer,
      "clientId" integer NOT NULL,
      "workflowStepId" integer,
      "subTaskId" integer,
      "fileName" varchar(255) NOT NULL,
      "fileKey" varchar(500) NOT NULL,
      "fileUrl" text NOT NULL,
      "mimeType" varchar(100),
      "fileSize" integer,
      "uploadedBy" integer NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "sinarmCommentsHistory" (
      "id" serial PRIMARY KEY NOT NULL,
      "workflowStepId" integer NOT NULL,
      "oldStatus" varchar(50),
      "newStatus" varchar(50) NOT NULL,
      "comment" text NOT NULL,
      "createdBy" integer NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "auditLogs" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenantId" integer NOT NULL,
      "userId" integer,
      "action" varchar(50) NOT NULL,
      "entity" varchar(50) NOT NULL,
      "entityId" integer,
      "details" text,
      "ipAddress" varchar(45),
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`,
  ];
  for (const stmt of createStatements) {
    try {
      await db.execute(stmt);
    } catch (error: any) {
      console.warn('[Schema] CREATE TABLE skipped:', error?.message || error);
    }
  }

  // ── CREATE billing/licensing tables (only in main/platform DB) ──
  if (dbKey === 'main') {
    const billingStatements = [
      sql`CREATE TABLE IF NOT EXISTS "planDefinitions" (
        "id" serial PRIMARY KEY NOT NULL,
        "slug" varchar(30) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "description" text,
        "maxUsers" integer NOT NULL DEFAULT 5,
        "maxClients" integer NOT NULL DEFAULT 100,
        "maxStorageGB" integer NOT NULL DEFAULT 10,
        "featureWorkflowCR" boolean NOT NULL DEFAULT true,
        "featureApostilamento" boolean NOT NULL DEFAULT false,
        "featureRenovacao" boolean NOT NULL DEFAULT false,
        "featureInsumos" boolean NOT NULL DEFAULT false,
        "featureIAT" boolean NOT NULL DEFAULT false,
        "priceMonthlyBRL" integer NOT NULL DEFAULT 0,
        "priceYearlyBRL" integer NOT NULL DEFAULT 0,
        "setupFeeBRL" integer NOT NULL DEFAULT 0,
        "trialDays" integer NOT NULL DEFAULT 14,
        "displayOrder" integer NOT NULL DEFAULT 0,
        "isPublic" boolean NOT NULL DEFAULT true,
        "isActive" boolean NOT NULL DEFAULT true,
        "highlightLabel" varchar(50),
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      sql`CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "planId" integer NOT NULL,
        "startDate" timestamp with time zone NOT NULL,
        "endDate" timestamp with time zone,
        "billingCycle" varchar(20) NOT NULL DEFAULT 'monthly',
        "priceBRL" integer NOT NULL,
        "discountBRL" integer NOT NULL DEFAULT 0,
        "overrideMaxUsers" integer,
        "overrideMaxClients" integer,
        "overrideMaxStorageGB" integer,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "cancelledAt" timestamp with time zone,
        "cancelReason" text,
        "paymentGateway" varchar(30),
        "externalId" varchar(255),
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        "createdBy" integer
      )`,
      sql`CREATE TABLE IF NOT EXISTS "invoices" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "subscriptionId" integer,
        "periodStart" timestamp with time zone NOT NULL,
        "periodEnd" timestamp with time zone NOT NULL,
        "subtotalBRL" integer NOT NULL,
        "discountBRL" integer NOT NULL DEFAULT 0,
        "totalBRL" integer NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "dueDate" timestamp with time zone NOT NULL,
        "paidAt" timestamp with time zone,
        "paymentMethod" varchar(30),
        "paymentReference" varchar(255),
        "notes" text,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      sql`CREATE TABLE IF NOT EXISTS "usageSnapshots" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "snapshotDate" timestamp with time zone NOT NULL,
        "usersCount" integer NOT NULL DEFAULT 0,
        "clientsCount" integer NOT NULL DEFAULT 0,
        "storageUsedGB" numeric(10,3) NOT NULL DEFAULT 0,
        "dbSizeMB" numeric(10,1) NOT NULL DEFAULT 0,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        UNIQUE("tenantId", "snapshotDate")
      )`,
    ];
    for (const stmt of billingStatements) {
      try {
        await db.execute(stmt);
      } catch (error: any) {
        console.warn('[Schema] Billing CREATE TABLE skipped:', error?.message || error);
      }
    }
    await seedDefaultPlans(db);
  }

  // ── CREATE Portal do Cliente tables (all tenant DBs) ──
  const portalStatements = [
    sql`CREATE TABLE IF NOT EXISTS "clientInviteTokens" (
      "id" serial PRIMARY KEY NOT NULL,
      "clientId" integer NOT NULL,
      "tenantId" integer,
      "token" varchar(64) NOT NULL UNIQUE,
      "activatedAt" timestamp,
      "expiresAt" timestamp NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "clientPortalSessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "clientId" integer NOT NULL,
      "tenantId" integer,
      "sessionToken" varchar(64) NOT NULL UNIQUE,
      "ipAddress" varchar(45),
      "userAgent" text,
      "lastSeenAt" timestamp DEFAULT now(),
      "expiresAt" timestamp NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "lgpdConsents" (
      "id" serial PRIMARY KEY NOT NULL,
      "clientId" integer NOT NULL,
      "tenantId" integer,
      "version" varchar(10) NOT NULL DEFAULT '1.0',
      "acceptedAt" timestamp NOT NULL,
      "ipAddress" varchar(45),
      "userAgent" text,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "clientPortalActivityLog" (
      "id" serial PRIMARY KEY NOT NULL,
      "clientId" integer NOT NULL,
      "tenantId" integer,
      "action" varchar(100) NOT NULL,
      "details" text,
      "ipAddress" varchar(45),
      "createdAt" timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS "clientPendingDocuments" (
      "id" serial PRIMARY KEY NOT NULL,
      "clientId" integer NOT NULL,
      "tenantId" integer,
      "fileName" varchar(255) NOT NULL,
      "fileUrl" text NOT NULL,
      "mimeType" varchar(100),
      "fileSize" integer,
      "status" varchar(20) NOT NULL DEFAULT 'pending',
      "linkedSubTaskId" integer,
      "rejectionReason" text,
      "uploadedAt" timestamp NOT NULL DEFAULT now(),
      "reviewedAt" timestamp,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )`,
  ];
  for (const stmt of portalStatements) {
    try {
      await db.execute(stmt);
    } catch (error: any) {
      console.warn('[Schema] Portal CREATE TABLE skipped:', error?.message || error);
    }
  }

  // ── ADD missing columns to existing tables ──
  const alterations = [
    sql`ALTER TABLE "subTasks" ADD COLUMN IF NOT EXISTS "tenantId" integer`,
    sql`ALTER TABLE "subTasks" ADD COLUMN IF NOT EXISTS "subTaskId" varchar(100)`,
    sql`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tenantId" integer`,
    sql`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "subTaskId" integer`,
    sql`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mimeType" varchar(100)`,
    sql`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "fileSize" integer`,
    sql`ALTER TABLE "workflowSteps" ADD COLUMN IF NOT EXISTS "scheduledDate" timestamp`,
    sql`ALTER TABLE "workflowSteps" ADD COLUMN IF NOT EXISTS "examinerName" varchar(255)`,
    sql`ALTER TABLE "workflowSteps" ADD COLUMN IF NOT EXISTS "sinarmStatus" varchar(50)`,
    sql`ALTER TABLE "workflowSteps" ADD COLUMN IF NOT EXISTS "sinarmOpenDate" timestamp`,
    sql`ALTER TABLE "workflowSteps" ADD COLUMN IF NOT EXISTS "protocolNumber" varchar(100)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tenantId" integer`,
    // Dados pessoais adicionais
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "identityNumber" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "identityIssueDate" varchar(10)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "identityIssuer" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "identityUf" varchar(2)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "birthDate" varchar(10)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "birthCountry" varchar(100)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "birthUf" varchar(2)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "birthPlace" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "gender" varchar(1)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "profession" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "otherProfession" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "registrationNumber" varchar(100)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "currentActivities" text`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "apostilamentoActivities" text`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "hasSecondCollectionAddress" boolean DEFAULT false`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "phone2" varchar(20)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "motherName" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "fatherName" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "maritalStatus" varchar(20)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "requestType" varchar(20)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cacNumber" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cacCategory" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "previousCrNumber" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "psychReportValidity" varchar(10)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "techReportValidity" varchar(10)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "residenceUf" varchar(2)`,
    // Endereço
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cep" varchar(10)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "address" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "addressNumber" varchar(20)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "neighborhood" varchar(100)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "city" varchar(100)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "complement" varchar(255)`,
    // Geolocalização / Segundo Endereço do Acervo
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "latitude" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "longitude" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoCep" varchar(10)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoAddress" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoAddressNumber" varchar(20)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoNeighborhood" varchar(100)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoCity" varchar(100)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoUf" varchar(2)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoComplement" varchar(255)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoLatitude" varchar(50)`,
    sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "acervoLongitude" varchar(50)`,
    sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenantId" integer`,
    sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approved" boolean DEFAULT true`,
    // sinarmCommentsHistory — tenantId necessário para filtro de segurança multi-tenant
    sql`ALTER TABLE "sinarmCommentsHistory" ADD COLUMN IF NOT EXISTS "tenantId" integer`,
    sql`ALTER TABLE "planDefinitions" ALTER COLUMN "maxStorageGB" TYPE numeric(10,2)`,
    sql`ALTER TABLE "tenants" ALTER COLUMN "maxStorageGB" TYPE numeric(10,2)`,
  ];
  let ok = 0, skipped = 0;
  for (const alter of alterations) {
    try {
      await db.execute(alter);
      ok++;
    } catch (error: any) {
      skipped++;
      console.warn('[Schema] column alter skipped:', error?.message || error);
    }
  }

  // Backfill defensivo: inferir hasSecondCollectionAddress pelos campos já existentes.
  try {
    await db.execute(sql`
      UPDATE "clients"
      SET "hasSecondCollectionAddress" = true
      WHERE COALESCE("hasSecondCollectionAddress", false) = false
        AND COALESCE(NULLIF(TRIM("acervoAddress"), ''), NULLIF(TRIM("acervoCep"), '')) IS NOT NULL
    `);
  } catch (error: any) {
    console.warn('[Schema] hasSecondCollectionAddress backfill skipped:', error?.message || error);
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
      await ensureSchemaColumns(_db, 'main');
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getPlatformSetting(key: string): Promise<PlatformSetting | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getPlatformSettings(keys?: string[]): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};

  const query = db.select().from(platformSettings);
  const rows = keys && keys.length > 0
    ? await query.where(inArray(platformSettings.key, keys))
    : await query;

  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function setPlatformSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(platformSettings)
    .values({
      key,
      value,
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    });
}

export async function deletePlatformSetting(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(platformSettings).where(eq(platformSettings.key, key));
}

export async function isPlatformInstalled(): Promise<boolean> {
  const status = await getPlatformSetting("install.completed");
  if (status?.value === "true") {
    return true;
  }

  const db = await getDb();
  if (!db) return false;

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenants)
    .limit(1);

  return Number(result?.count ?? 0) > 0;
}

export async function upsertUser(user: InsertUser & { id?: number }): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  if (user.id) {
    await db.update(users).set(user).where(eq(users.id, user.id));
    return user.id;
  } else {
    const [inserted] = await db
      .insert(users)
      .values(user)
      .returning({ id: users.id });
    return inserted.id;
  }
}

export async function saveEmailTemplateToDb(
  tenantDb: ReturnType<typeof drizzle>,
  template: InsertEmailTemplate & { module?: string },
  tenantId?: number
) {
  const moduleValue = template.module || 'workflow-cr';
  const existing = await getEmailTemplateFromDb(tenantDb, template.templateKey, moduleValue, tenantId);

  if (existing) {
    await tenantDb
      .update(emailTemplates)
      .set({
        templateTitle: template.templateTitle || null,
        subject: template.subject,
        content: template.content,
        attachments: template.attachments || null,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, existing.id));
    return existing.id;
  }

  const [inserted] = await tenantDb
    .insert(emailTemplates)
    .values({ ...template, module: moduleValue, tenantId })
    .returning({ id: emailTemplates.id });
  return inserted.id;
}

export async function upsertWorkflowStepToDb(
  tenantDb: ReturnType<typeof drizzle>,
  step: InsertWorkflowStep & { id?: number }
) {
  if (step.id) {
    await tenantDb.update(workflowSteps).set(step).where(eq(workflowSteps.id, step.id));
    return step.id;
  }

  const result = await tenantDb.execute(
    sql`INSERT INTO "workflowSteps" ("clientId", "stepId", "stepTitle", "completed")
        VALUES (${step.clientId ?? null}, ${step.stepId ?? null}, ${step.stepTitle ?? null}, ${step.completed ?? false})
        RETURNING "id"`
  );
  const rows = extractRows(result);
  if (rows.length === 0) throw new Error('workflowSteps INSERT returned no rows');
  return rows[0].id as number;
}

export async function insertSinarmComment(data: InsertSinarmCommentHistory): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inserted] = await db
    .insert(sinarmCommentsHistory)
    .values(data)
    .returning({ id: sinarmCommentsHistory.id });

  return inserted.id;
}

export async function insertSinarmCommentToDb(
  tenantDb: ReturnType<typeof drizzle>,
  data: InsertSinarmCommentHistory
): Promise<number> {
  const [inserted] = await tenantDb
    .insert(sinarmCommentsHistory)
    .values(data)
    .returning({ id: sinarmCommentsHistory.id });

  return inserted.id;
}

export async function getSinarmCommentsByWorkflowStepId(workflowStepId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: sinarmCommentsHistory.id,
      workflowStepId: sinarmCommentsHistory.workflowStepId,
      oldStatus: sinarmCommentsHistory.oldStatus,
      newStatus: sinarmCommentsHistory.newStatus,
      comment: sinarmCommentsHistory.comment,
      createdBy: sinarmCommentsHistory.createdBy,
      createdAt: sinarmCommentsHistory.createdAt,
      createdByName: users.name,
      createdByEmail: users.email,
    })
    .from(sinarmCommentsHistory)
    .leftJoin(users, eq(users.id, sinarmCommentsHistory.createdBy))
    .where(eq(sinarmCommentsHistory.workflowStepId, workflowStepId))
    .orderBy(desc(sinarmCommentsHistory.createdAt));

  return result;
}

export async function getSinarmCommentsByWorkflowStepIdFromDb(
  tenantDb: ReturnType<typeof drizzle>,
  workflowStepId: number,
  tenantId?: number
) {
  // SECURITY: When tenantId is provided, restrict to records belonging to that tenant.
  // Allow NULL tenantId records to pass through (legacy rows not yet backfilled).
  const tenantFilter = tenantId
    ? or(isNull(sinarmCommentsHistory.tenantId), eq(sinarmCommentsHistory.tenantId, tenantId))!
    : undefined;
  const where = tenantFilter
    ? and(eq(sinarmCommentsHistory.workflowStepId, workflowStepId), tenantFilter)
    : eq(sinarmCommentsHistory.workflowStepId, workflowStepId);

  const result = await tenantDb
    .select({
      id: sinarmCommentsHistory.id,
      workflowStepId: sinarmCommentsHistory.workflowStepId,
      oldStatus: sinarmCommentsHistory.oldStatus,
      newStatus: sinarmCommentsHistory.newStatus,
      comment: sinarmCommentsHistory.comment,
      createdBy: sinarmCommentsHistory.createdBy,
      createdAt: sinarmCommentsHistory.createdAt,
      createdByName: users.name,
      createdByEmail: users.email,
    })
    .from(sinarmCommentsHistory)
    .leftJoin(users, eq(users.id, sinarmCommentsHistory.createdBy))
    .where(where)
    .orderBy(desc(sinarmCommentsHistory.createdAt));

  return result;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getEmailTemplateFromDb(
  tenantDb: ReturnType<typeof drizzle>,
  templateKey: string,
  module?: string,
  tenantId?: number
) {
  let conditions = [eq(emailTemplates.templateKey, templateKey)];
  if (module) {
    conditions.push(eq(emailTemplates.module, module));
  }
  if (tenantId) {
    const { isNull, or } = await import('drizzle-orm');
    conditions.push(or(eq(emailTemplates.tenantId, tenantId), isNull(emailTemplates.tenantId))!);
  }

  const result = await tenantDb
    .select()
    .from(emailTemplates)
    .where(and(...conditions))
    .orderBy(emailTemplates.tenantId)
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByIdFromDb(tenantDb: ReturnType<typeof drizzle>, id: number, tenantId?: number) {
  const conditions = [eq(users.id, id)];
  if (tenantId) conditions.push(eq(users.tenantId, tenantId));
  const result = await tenantDb.select().from(users).where(and(...conditions)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmailFromDb(tenantDb: ReturnType<typeof drizzle>, email: string) {
  const result = await tenantDb.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmailAndTenant(email: string, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.email, email), eq(users.tenantId, tenantId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserToDb(
  tenantDb: ReturnType<typeof drizzle>,
  user: InsertUser & { id?: number }
): Promise<number> {
  if (user.id) {
    await tenantDb.update(users).set(user).where(eq(users.id, user.id));
    return user.id;
  }

  const [inserted] = await tenantDb
    .insert(users)
    .values(user)
    .returning({ id: users.id });
  return inserted.id;
}

async function insertClientRaw(dbInstance: ReturnType<typeof drizzle>, client: InsertClient) {
  try {
    const apostilamentoActivities = Array.isArray((client as any).apostilamentoActivities)
      ? JSON.stringify((client as any).apostilamentoActivities)
      : ((client as any).apostilamentoActivities ?? '[]');

    const result = await dbInstance.execute(
      sql`INSERT INTO "clients" ("tenantId", "name", "cpf", "phone", "email", "operatorId", "apostilamentoActivities", "hasSecondCollectionAddress")
          VALUES (${client.tenantId ?? null}, ${client.name}, ${client.cpf}, ${client.phone}, ${client.email}, ${client.operatorId}, ${apostilamentoActivities}, ${(client as any).hasSecondCollectionAddress ?? false})
          RETURNING "id"`
    );
    const rows = extractRows(result);
    if (rows.length === 0) throw new Error('clients INSERT returned no rows');
    return rows[0].id as number;
  } catch (err: any) {
    // Drizzle wraps postgres errors in DrizzleError with the real PG error in .cause
    const pgErr = err?.cause || err;
    console.error('[insertClientRaw] Database error:', pgErr?.message || err?.message);
    // Re-throw the actual PG error so callers can check .code
    throw pgErr;
  }
}

export async function createClientToDb(tenantDb: ReturnType<typeof drizzle>, client: InsertClient) {
  try {
    return await insertClientRaw(tenantDb, client);
  } catch (err: any) {
    // 42P01 = relation does not exist, 42703 = column does not exist
    if (err?.code === '42P01' || err?.code === '42703') {
      console.warn('[createClientToDb] Schema missing, forcing ensureSchemaColumns and retrying:', err.message);
      Array.from(_schemaCheckedDbs).filter(k => k.startsWith('tenant_')).forEach(k => _schemaCheckedDbs.delete(k));
      await ensureSchemaColumns(tenantDb, `tenant_retry_${Date.now()}`);
      return await insertClientRaw(tenantDb, client);
    }
    throw err;
  }
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Client operations
export async function createClient(client: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    return await insertClientRaw(db, client);
  } catch (err: any) {
    // 42P01 = relation does not exist, 42703 = column does not exist
    if (err?.code === '42P01' || err?.code === '42703') {
      console.warn('[createClient] Schema missing, forcing ensureSchemaColumns and retrying:', err.message);
      _schemaCheckedDbs.delete('main');
      await ensureSchemaColumns(db, `main_retry_${Date.now()}`);
      return await insertClientRaw(db, client);
    }
    throw err;
  }
}

export async function getClientsByOperator(operatorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(clients).where(eq(clients.operatorId, operatorId)).orderBy(desc(clients.createdAt));
}

export async function getClientsByOperatorFromDb(tenantDb: ReturnType<typeof drizzle>, operatorId: number, tenantId?: number) {
  if (tenantId) {
    return await tenantDb
      .select()
      .from(clients)
      .where(and(eq(clients.operatorId, operatorId), eq(clients.tenantId, tenantId)))
      .orderBy(desc(clients.createdAt));
  }
  return await tenantDb
    .select()
    .from(clients)
    .where(eq(clients.operatorId, operatorId))
    .orderBy(desc(clients.createdAt));
}

export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getAllClientsFromDb(tenantDb: ReturnType<typeof drizzle>, tenantId: number) {
  return await tenantDb.select().from(clients).where(eq(clients.tenantId, tenantId)).orderBy(desc(clients.createdAt));
}

export async function getClientById(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getClientByIdFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number, tenantId?: number) {
  const conditions = [eq(clients.id, clientId)];
  // SECURITY: sempre filtrar por tenantId quando disponível (obrigatório em single-db mode)
  if (tenantId) conditions.push(eq(clients.tenantId, tenantId));
  else if (process.env.TENANT_DB_MODE === 'single' || process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] getClientByIdFromDb chamado sem tenantId em single-db mode — clientId:', clientId);
  }
  const result = await tenantDb.select().from(clients).where(and(...conditions)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateClient(clientId: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(clients).set(data).where(eq(clients.id, clientId));
}

export async function updateClientToDb(
  tenantDb: ReturnType<typeof drizzle>,
  clientId: number,
  data: Partial<InsertClient>,
  tenantId?: number
) {
  const conditions = [eq(clients.id, clientId)];
  if (tenantId) conditions.push(eq(clients.tenantId, tenantId));
  await tenantDb.update(clients).set(data).where(and(...conditions));
}

export async function deleteClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(documents).where(eq(documents.clientId, clientId));
  const clientWorkflowSteps = await db.select().from(workflowSteps).where(eq(workflowSteps.clientId, clientId));
  for (const step of clientWorkflowSteps) {
    await db.delete(subTasks).where(eq(subTasks.workflowStepId, step.id));
  }
  await db.delete(workflowSteps).where(eq(workflowSteps.clientId, clientId));
  await db.delete(clients).where(eq(clients.id, clientId));
}

export async function deleteClientFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number, tenantId?: number) {
  // SECURITY: Verify client belongs to tenant before cascading deletes (obrigatório)
  const client = await getClientByIdFromDb(tenantDb, clientId, tenantId);
  if (!client) throw new Error('Client not found or does not belong to this tenant');
  await tenantDb.delete(documents).where(eq(documents.clientId, clientId));
  const clientWorkflowSteps = await tenantDb
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.clientId, clientId));
  for (const step of clientWorkflowSteps) {
    await tenantDb.delete(subTasks).where(eq(subTasks.workflowStepId, step.id));
  }
  await tenantDb.delete(workflowSteps).where(eq(workflowSteps.clientId, clientId));
  await tenantDb.delete(clients).where(eq(clients.id, clientId));
}

// Workflow operations
export async function getWorkflowByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar etapas ordenadas por id para preservar a ordem canônica
  const steps = await db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.clientId, clientId))
    .orderBy(workflowSteps.id);

  // Correção defensiva: se alguma etapa estiver sem stepId ou stepTitle,
  // e o cliente tiver exatamente as 6 etapas padrão, restaurar valores
  const hasCorruptedSteps = steps.some(
    (s: any) => !s.stepId || !s.stepTitle
  );

  if (hasCorruptedSteps && steps.length === 6) {
    const canonicalSteps = [
      { stepId: 'boas-vindas', stepTitle: 'Central de Mensagens' },
      { stepId: 'cadastro', stepTitle: 'Cadastro' },
      { stepId: 'agendamento-psicotecnico', stepTitle: 'Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo' },
      { stepId: 'agendamento-laudo', stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)' },
      { stepId: 'juntada-documento', stepTitle: 'Juntada de Documentos' },
      { stepId: 'acompanhamento-sinarm', stepTitle: 'Acompanhamento Sinarm-CAC' },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step: any = steps[i];
      const canonical = canonicalSteps[i];
      if (!step.stepId || !step.stepTitle) {
        await db
          .update(workflowSteps)
          .set({
            stepId: step.stepId || canonical.stepId,
            stepTitle: step.stepTitle || canonical.stepTitle,
          })
          .where(eq(workflowSteps.id, step.id));
      }
    }

    // Recarregar etapas já corrigidas
    return await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.clientId, clientId))
      .orderBy(workflowSteps.id);
  }

  return steps;
}

export async function getWorkflowByClientFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number) {
  const steps = await tenantDb
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.clientId, clientId))
    .orderBy(workflowSteps.id);

  const hasCorruptedSteps = steps.some(
    (s: any) => !s.stepId || !s.stepTitle
  );

  if (hasCorruptedSteps && steps.length === 6) {
    const canonicalSteps = [
      { stepId: 'boas-vindas', stepTitle: 'Central de Mensagens' },
      { stepId: 'cadastro', stepTitle: 'Cadastro' },
      { stepId: 'agendamento-psicotecnico', stepTitle: 'Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo' },
      { stepId: 'agendamento-laudo', stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)' },
      { stepId: 'juntada-documento', stepTitle: 'Juntada de Documentos' },
      { stepId: 'acompanhamento-sinarm', stepTitle: 'Acompanhamento Sinarm-CAC' },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step: any = steps[i];
      const canonical = canonicalSteps[i];
      if (!step.stepId || !step.stepTitle) {
        await tenantDb
          .update(workflowSteps)
          .set({
            stepId: step.stepId || canonical.stepId,
            stepTitle: step.stepTitle || canonical.stepTitle,
          })
          .where(eq(workflowSteps.id, step.id));
      }
    }

    return await tenantDb
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.clientId, clientId))
      .orderBy(workflowSteps.id);
  }

  return steps;
}

export async function getSubTasksByWorkflowStep(workflowStepId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(subTasks).where(eq(subTasks.workflowStepId, workflowStepId));
}

export async function getSubTasksByWorkflowStepFromDb(
  tenantDb: ReturnType<typeof drizzle>,
  workflowStepId: number,
  tenantId?: number
) {
  // SECURITY: When tenantId is provided, restrict to records belonging to that tenant.
  // Allow NULL tenantId records to pass through (legacy rows not yet backfilled).
  const tenantFilter = tenantId
    ? or(isNull(subTasks.tenantId), eq(subTasks.tenantId, tenantId))!
    : undefined;
  const where = tenantFilter
    ? and(eq(subTasks.workflowStepId, workflowStepId), tenantFilter)
    : eq(subTasks.workflowStepId, workflowStepId);
  return await tenantDb.select().from(subTasks).where(where);
}

export async function getWorkflowStepById(stepId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workflowSteps).where(eq(workflowSteps.id, stepId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getWorkflowStepByIdFromDb(tenantDb: ReturnType<typeof drizzle>, stepId: number, tenantId?: number) {
  // Note: workflowSteps doesn't have tenantId directly — verify via client ownership
  const result = await tenantDb
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.id, stepId))
    .limit(1);
  if (result.length === 0) return undefined;
  // SECURITY: If tenantId provided, verify the parent client belongs to this tenant
  if (tenantId && result[0].clientId) {
    const client = await getClientByIdFromDb(tenantDb, result[0].clientId, tenantId);
    if (!client) return undefined;
  }
  return result[0];
}

export async function upsertWorkflowStep(step: InsertWorkflowStep & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (step.id) {
    await db.update(workflowSteps).set(step).where(eq(workflowSteps.id, step.id));
    return step.id;
  }
  const result = await db.execute(
    sql`INSERT INTO "workflowSteps" ("clientId", "stepId", "stepTitle", "completed")
        VALUES (${step.clientId ?? null}, ${step.stepId ?? null}, ${step.stepTitle ?? null}, ${step.completed ?? false})
        RETURNING "id"`
  );
  const rows = extractRows(result);
  if (rows.length === 0) throw new Error('workflowSteps INSERT returned no rows');
  return rows[0].id as number;
}

export async function upsertSubTask(task: InsertSubTask & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (task.id) {
    await db.update(subTasks).set(task).where(eq(subTasks.id, task.id));
    return task.id;
  }
  const result = await db.execute(
    sql`INSERT INTO "subTasks" ("workflowStepId", "subTaskId", "label", "completed")
        VALUES (${task.workflowStepId ?? null}, ${task.subTaskId ?? null}, ${task.label ?? null}, ${task.completed ?? false})
        RETURNING "id"`
  );
  const rows = extractRows(result);
  if (rows.length === 0) throw new Error('subTasks INSERT returned no rows');
  return rows[0].id as number;
}

export async function upsertSubTaskToDb(
  tenantDb: ReturnType<typeof drizzle>,
  task: InsertSubTask & { id?: number }
) {
  if (task.id) {
    await tenantDb.update(subTasks).set(task).where(eq(subTasks.id, task.id));
    return task.id;
  }

  const result = await tenantDb.execute(
    sql`INSERT INTO "subTasks" ("workflowStepId", "subTaskId", "label", "completed")
        VALUES (${task.workflowStepId ?? null}, ${task.subTaskId ?? null}, ${task.label ?? null}, ${task.completed ?? false})
        RETURNING "id"`
  );
  const rows = extractRows(result);
  if (rows.length === 0) throw new Error('subTasks INSERT returned no rows');
  return rows[0].id as number;
}

export async function updateSubTaskCompleted(subTaskId: number, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subTasks)
    .set({ 
      completed, 
      completedAt: completed ? new Date() : null 
    })
    .where(eq(subTasks.id, subTaskId));
}

export async function updateSubTaskCompletedToDb(
  tenantDb: ReturnType<typeof drizzle>,
  subTaskId: number,
  completed: boolean
) {
  await tenantDb
    .update(subTasks)
    .set({
      completed,
      completedAt: completed ? new Date() : null,
    })
    .where(eq(subTasks.id, subTaskId));
}

// Document operations
export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db
    .insert(documents)
    .values(doc)
    .returning({ id: documents.id });
  return inserted.id;
}

export async function createDocumentToDb(tenantDb: ReturnType<typeof drizzle>, doc: InsertDocument) {
  const [inserted] = await tenantDb
    .insert(documents)
    .values(doc)
    .returning({ id: documents.id });
  return inserted.id;
}

export async function getDocumentsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.createdAt));
}

export async function getDocumentsByClientFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number) {
  return await tenantDb
    .select()
    .from(documents)
    .where(eq(documents.clientId, clientId))
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentById(documentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDocumentByIdFromDb(tenantDb: ReturnType<typeof drizzle>, documentId: number, tenantId?: number) {
  const conditions = [eq(documents.id, documentId)];
  if (tenantId) conditions.push(eq(documents.tenantId, tenantId));
  const result = await tenantDb
    .select()
    .from(documents)
    .where(and(...conditions))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(documents).where(eq(documents.id, documentId));
}

export async function deleteDocumentFromDb(tenantDb: ReturnType<typeof drizzle>, documentId: number, tenantId?: number) {
  const conditions = [eq(documents.id, documentId)];
  if (tenantId) conditions.push(eq(documents.tenantId, tenantId));
  await tenantDb.delete(documents).where(and(...conditions));
}

// User management
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getAllUsersFromDb(tenantDb: ReturnType<typeof drizzle>, tenantId?: number) {
  if (tenantId) {
    return await tenantDb.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(desc(users.createdAt));
  }
  return await tenantDb.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUsersByIds(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return await db.select().from(users).where(inArray(users.id, ids));
}

export async function getUsersByIdsFromDb(tenantDb: ReturnType<typeof drizzle>, ids: number[]) {
  if (ids.length === 0) return [];
  return await tenantDb.select().from(users).where(inArray(users.id, ids));
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function updateUserToDb(
  tenantDb: ReturnType<typeof drizzle>,
  userId: number,
  data: Partial<InsertUser>,
  tenantId?: number
) {
  const conditions = [eq(users.id, userId)];
  if (tenantId) conditions.push(eq(users.tenantId, tenantId));
  await tenantDb.update(users).set(data).where(and(...conditions));
}

export async function updateUserRole(userId: number, role: "operator" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserRoleToDb(
  tenantDb: ReturnType<typeof drizzle>,
  userId: number,
  role: "operator" | "admin",
  tenantId?: number
) {
  const conditions = [eq(users.id, userId)];
  if (tenantId) conditions.push(eq(users.tenantId, tenantId));
  await tenantDb.update(users).set({ role }).where(and(...conditions));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(users).where(eq(users.id, userId));
}

export async function deleteUserFromDb(tenantDb: ReturnType<typeof drizzle>, userId: number, tenantId?: number) {
  const conditions = [eq(users.id, userId)];
  if (tenantId) conditions.push(eq(users.tenantId, tenantId));
  await tenantDb.delete(users).where(and(...conditions));
}

// Tenant SMTP settings - stored directly in tenants table
export interface TenantSmtpSettings {
  name: string | null;
  emailMethod: 'smtp' | 'gateway' | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  postmanGpxBaseUrl: string | null;
  postmanGpxApiKey: string | null;
  emailLogoUrl: string | null;
}

export async function getTenantSmtpSettings(tenantId: number): Promise<TenantSmtpSettings | null> {
  const db = await getDb();
  if (!db) return null;

  const [tenant] = await db
    .select({
      name: tenants.name,
      emailMethod: tenants.emailMethod,
      smtpHost: tenants.smtpHost,
      smtpPort: tenants.smtpPort,
      smtpUser: tenants.smtpUser,
      smtpPassword: tenants.smtpPassword,
      smtpFrom: tenants.smtpFrom,
      postmanGpxBaseUrl: (tenants as any).postmanGpxBaseUrl,
      postmanGpxApiKey: (tenants as any).postmanGpxApiKey,
      emailLogoUrl: (tenants as any).emailLogoUrl,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return null;
  return tenant;
}

export async function updateTenantSmtpSettings(
  tenantId: number,
  settings: Partial<TenantSmtpSettings>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(tenants)
    .set({
      emailMethod: settings.emailMethod,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpPassword: settings.smtpPassword,
      smtpFrom: settings.smtpFrom,
      ...(settings.postmanGpxBaseUrl !== undefined
        ? ({ postmanGpxBaseUrl: settings.postmanGpxBaseUrl } as any)
        : {}),
      ...(settings.postmanGpxApiKey !== undefined
        ? ({ postmanGpxApiKey: settings.postmanGpxApiKey } as any)
        : {}),
      ...(settings.emailLogoUrl !== undefined
        ? ({ emailLogoUrl: settings.emailLogoUrl } as any)
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

// Email settings (SMTP) - legacy table for non-tenant mode
export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  useSecure: boolean;
}

async function ensureEmailSettingsTable(db: ReturnType<typeof drizzle>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "emailSettings" (
      id INTEGER PRIMARY KEY,
      "smtpHost" VARCHAR(255) NOT NULL,
      "smtpPort" INTEGER NOT NULL,
      "smtpUser" VARCHAR(255) NOT NULL,
      "smtpPass" VARCHAR(255) NOT NULL,
      "smtpFrom" VARCHAR(255) NOT NULL,
      "useSecure" BOOLEAN NOT NULL DEFAULT FALSE,
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const db = await getDb();
  if (!db) return null;

  await ensureEmailSettingsTable(db);

  const result: any = await db.execute(sql`
    SELECT "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "useSecure"
    FROM "emailSettings"
    WHERE id = 1
    LIMIT 1
  `);

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    smtpHost: row.smtpHost,
    smtpPort: Number(row.smtpPort),
    smtpUser: row.smtpUser,
    smtpPass: row.smtpPass,
    smtpFrom: row.smtpFrom,
    useSecure: !!row.useSecure,
  };
}

export async function getEmailSettingsFromDb(tenantDb: ReturnType<typeof drizzle>): Promise<EmailSettings | null> {
  await ensureEmailSettingsTable(tenantDb);

  const result: any = await tenantDb.execute(sql`
    SELECT "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "useSecure"
    FROM "emailSettings"
    WHERE id = 1
    LIMIT 1
  `);

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    smtpHost: row.smtpHost,
    smtpPort: Number(row.smtpPort),
    smtpUser: row.smtpUser,
    smtpPass: row.smtpPass,
    smtpFrom: row.smtpFrom,
    useSecure: !!row.useSecure,
  };
}

export async function saveEmailSettings(settings: EmailSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureEmailSettingsTable(db);

  await db.execute(sql`
    INSERT INTO "emailSettings" (id, "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "useSecure")
    VALUES (1, ${settings.smtpHost}, ${settings.smtpPort}, ${settings.smtpUser}, ${settings.smtpPass}, ${settings.smtpFrom}, ${settings.useSecure})
    ON CONFLICT (id) DO UPDATE SET
      "smtpHost" = EXCLUDED."smtpHost",
      "smtpPort" = EXCLUDED."smtpPort",
      "smtpUser" = EXCLUDED."smtpUser",
      "smtpPass" = EXCLUDED."smtpPass",
      "smtpFrom" = EXCLUDED."smtpFrom",
      "useSecure" = EXCLUDED."useSecure";
  `);
}

export async function saveEmailSettingsToDb(
  tenantDb: ReturnType<typeof drizzle>,
  settings: EmailSettings
): Promise<void> {
  await ensureEmailSettingsTable(tenantDb);

  await tenantDb.execute(sql`
    INSERT INTO "emailSettings" (id, "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "useSecure")
    VALUES (1, ${settings.smtpHost}, ${settings.smtpPort}, ${settings.smtpUser}, ${settings.smtpPass}, ${settings.smtpFrom}, ${settings.useSecure})
    ON CONFLICT (id) DO UPDATE SET
      "smtpHost" = EXCLUDED."smtpHost",
      "smtpPort" = EXCLUDED."smtpPort",
      "smtpUser" = EXCLUDED."smtpUser",
      "smtpPass" = EXCLUDED."smtpPass",
      "smtpFrom" = EXCLUDED."smtpFrom",
      "useSecure" = EXCLUDED."useSecure";
  `);
}

export async function getDatabaseSize(dbInstance: ReturnType<typeof drizzle>): Promise<number> {
  try {
    const result = await dbInstance.execute(sql`SELECT pg_database_size(current_database()) as size`);
    // Handle different result formats from drizzle/postgres-js
    const rows = (result as any)?.rows || result;
    const row = Array.isArray(rows) ? rows[0] : rows;
    const size = Number(row?.size || 0);
    if (!size) {
      console.warn("[Database] pg_database_size returned 0. Raw result:", JSON.stringify(result).substring(0, 500));
    }
    return size;
  } catch (error) {
    // pg_database_size may fail due to permissions - try alternative
    console.warn("[Database] pg_database_size failed, trying pg_stat_database fallback:", (error as any)?.message);
    try {
      const fallback = await dbInstance.execute(
        sql`SELECT pg_database_size AS size FROM pg_stat_database WHERE datname = current_database()`
      );
      const rows = (fallback as any)?.rows || fallback;
      const row = Array.isArray(rows) ? rows[0] : rows;
      return Number(row?.size || 0);
    } catch (fallbackErr) {
      console.error("[Database] Both DB size methods failed:", (fallbackErr as any)?.message);
      return 0;
    }
  }
}

// Email template operations
export async function getAllEmailTemplates(module?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (module) {
    const result = await db.select().from(emailTemplates)
      .where(eq(emailTemplates.module, module));
    return result;
  }
  
  const result = await db.select().from(emailTemplates);
  return result;
}

export async function getAllEmailTemplatesFromDb(
  tenantDb: ReturnType<typeof drizzle>,
  module?: string,
  tenantId?: number
) {
  let conditions = [];
  if (module) {
    conditions.push(eq(emailTemplates.module, module));
  }
  if (tenantId) {
    const { isNull, or } = await import('drizzle-orm');
    conditions.push(or(eq(emailTemplates.tenantId, tenantId), isNull(emailTemplates.tenantId))!);
  }

  if (conditions.length > 0) {
    return await tenantDb
      .select()
      .from(emailTemplates)
      .where(and(...conditions));
  }

  return await tenantDb.select().from(emailTemplates);
}

export async function getEmailTemplate(templateKey: string, module?: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  if (module) {
    const result = await db.select().from(emailTemplates)
      .where(and(
        eq(emailTemplates.templateKey, templateKey),
        eq(emailTemplates.module, module)
      ))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }
  
  const result = await db.select().from(emailTemplates)
    .where(eq(emailTemplates.templateKey, templateKey))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function saveEmailTemplate(template: InsertEmailTemplate & { module?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const moduleValue = template.module || 'workflow-cr';
  
  // Check if template already exists for this module
  const existing = await getEmailTemplate(template.templateKey, moduleValue);
  
  if (existing) {
    // Update existing template
    await db.update(emailTemplates)
      .set({
        templateTitle: template.templateTitle || null,
        subject: template.subject,
        content: template.content,
        attachments: template.attachments || null,
        updatedAt: new Date()
      })
      .where(eq(emailTemplates.id, existing.id));
    return existing.id;
  } else {
    // Insert new template
    const [inserted] = await db
      .insert(emailTemplates)
      .values({ ...template, module: moduleValue })
      .returning({ id: emailTemplates.id });
    return inserted.id;
  }
}

export async function deleteEmailTemplate(templateKey: string, module?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const moduleValue = module || 'workflow-cr';

  await db.delete(emailTemplates)
    .where(and(
      eq(emailTemplates.templateKey, templateKey),
      eq(emailTemplates.module, moduleValue)
    ));
}

export async function deleteEmailTemplateFromDb(
  tenantDb: ReturnType<typeof drizzle>,
  templateKey: string,
  module?: string,
  tenantId?: number
) {
  const moduleValue = module || 'workflow-cr';
  const { isNull, or } = await import('drizzle-orm');

  let conditions: any[] = [
    eq(emailTemplates.templateKey, templateKey),
    eq(emailTemplates.module, moduleValue)
  ];
  if (tenantId) {
    // Usar mesma condição do select: deleta tanto templates do tenant quanto globais (tenantId IS NULL)
    conditions.push(or(eq(emailTemplates.tenantId, tenantId), isNull(emailTemplates.tenantId))!);
  }

  await tenantDb.delete(emailTemplates)
    .where(and(...conditions));
}

export async function logEmailSent(log: InsertEmailLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db
    .insert(emailLogs)
    .values(log)
    .returning({ id: emailLogs.id });
  return inserted.id;
}

export async function logEmailSentToDb(tenantDb: ReturnType<typeof drizzle>, log: InsertEmailLog) {
  const [inserted] = await tenantDb
    .insert(emailLogs)
    .values(log)
    .returning({ id: emailLogs.id });
  return inserted.id;
}

export async function getEmailLogsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailLogs)
    .where(eq(emailLogs.clientId, clientId))
    .orderBy(desc(emailLogs.sentAt));
}

export async function getEmailLogsByClientFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number) {
  return await tenantDb
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.clientId, clientId))
    .orderBy(desc(emailLogs.sentAt));
}

export async function getEmailLog(clientId: number, templateKey: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(emailLogs)
    .where(and(
      eq(emailLogs.clientId, clientId),
      eq(emailLogs.templateKey, templateKey)
    ))
    .orderBy(desc(emailLogs.sentAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function getEmailLogFromDb(
  tenantDb: ReturnType<typeof drizzle>,
  clientId: number,
  templateKey: string
) {
  const result = await tenantDb
    .select()
    .from(emailLogs)
    .where(and(
      eq(emailLogs.clientId, clientId),
      eq(emailLogs.templateKey, templateKey)
    ))
    .orderBy(desc(emailLogs.sentAt))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ===========================================
// TENANT FUNCTIONS (Multi-Tenant)
// ===========================================

export async function getPlatformAdminById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(platformAdmins).where(eq(platformAdmins.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPlatformAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(platformAdmins).where(eq(platformAdmins.email, email)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllPlatformAdmins() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: platformAdmins.id,
      email: platformAdmins.email,
      name: platformAdmins.name,
      role: platformAdmins.role,
      isActive: platformAdmins.isActive,
      lastSignedIn: platformAdmins.lastSignedIn,
      createdAt: platformAdmins.createdAt,
    })
    .from(platformAdmins)
    .orderBy(platformAdmins.createdAt);
}

export async function countActivePlatformAdmins() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformAdmins)
    .where(and(eq(platformAdmins.isActive, true), eq(platformAdmins.role, 'superadmin')));
  return result[0]?.count ?? 0;
}

export async function createPlatformAdmin(data: {
  email: string;
  password: string;
  name?: string;
  role?: 'superadmin' | 'admin' | 'support';
}) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const hashedPassword = bcrypt.hashSync(data.password, 12);
  const [inserted] = await db
    .insert(platformAdmins)
    .values({
      email: data.email,
      hashedPassword,
      name: data.name ?? null,
      role: data.role ?? 'admin',
      isActive: true,
    })
    .returning({
      id: platformAdmins.id,
      email: platformAdmins.email,
      name: platformAdmins.name,
      role: platformAdmins.role,
      isActive: platformAdmins.isActive,
    });
  return inserted;
}

export async function updatePlatformAdmin(id: number, data: {
  email?: string;
  name?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const [updated] = await db
    .update(platformAdmins)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(platformAdmins.id, id))
    .returning({
      id: platformAdmins.id,
      email: platformAdmins.email,
      name: platformAdmins.name,
      role: platformAdmins.role,
      isActive: platformAdmins.isActive,
    });
  return updated ?? null;
}

export async function updatePlatformAdminPassword(id: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const hashedPassword = bcrypt.hashSync(newPassword, 12);
  await db
    .update(platformAdmins)
    .set({ hashedPassword, updatedAt: new Date() })
    .where(eq(platformAdmins.id, id));
}

export async function setPlatformAdminStatus(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db
    .update(platformAdmins)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(platformAdmins.id, id));
}

export async function setPlatformAdminRole(id: number, role: 'superadmin' | 'admin' | 'support') {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db
    .update(platformAdmins)
    .set({ role, updatedAt: new Date() })
    .where(eq(platformAdmins.id, id));
}

export async function deletePlatformAdmin(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.delete(platformAdmins).where(eq(platformAdmins.id, id));
}

export async function getAllTenants() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tenants).orderBy(desc(tenants.createdAt));
}

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getTenantBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(tenants)
    .where(and(
      eq(tenants.slug, slug),
      eq(tenants.isActive, true)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getTenantAdmin(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(users)
    .where(and(
      eq(users.tenantId, tenantId),
      eq(users.role, 'admin')
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createTenant(tenant: InsertTenant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payload = {
    ...tenant,
    dbPassword: tenant.dbPassword ? encryptSecret(tenant.dbPassword) : tenant.dbPassword,
    smtpPassword: (tenant as any).smtpPassword ? encryptSecret((tenant as any).smtpPassword as string) : (tenant as any).smtpPassword,
  };
  
  const [inserted] = await db
    .insert(tenants)
    .values(payload)
    .returning({ id: tenants.id });

  return inserted.id;
}

export async function updateTenant(id: number, updates: Partial<InsertTenant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payload: Partial<InsertTenant> = { ...updates };
  if (updates.dbPassword) {
    payload.dbPassword = encryptSecret(updates.dbPassword);
  }
  if ((updates as any).smtpPassword) {
    (payload as any).smtpPassword = encryptSecret((updates as any).smtpPassword as string);
  }
  
  await db.update(tenants)
    .set({ ...payload, updatedAt: new Date() })
    .where(eq(tenants.id, id));
}

export async function deleteTenant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Soft delete - apenas desativa
  await db.update(tenants)
    .set({ isActive: false, subscriptionStatus: 'cancelled', updatedAt: new Date() })
    .where(eq(tenants.id, id));
}

export async function hardDeleteTenant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Buscar todos os clients do tenant para deletar dependências
  // No modo single-db, clients devem ter tenantId. Se não tiverem (legacy), pode ser um problema,
  // mas aqui assumimos que tenants isolados têm tenantId.
  const tenantClients = await db.select({ id: clients.id }).from(clients).where(eq(clients.tenantId, id));
  const clientIds = tenantClients.map(c => c.id);

  if (clientIds.length > 0) {
    // Excluir dependências dos clientes em lotes se necessário, aqui simplificado:
    
    // Email Logs
    await db.delete(emailLogs).where(inArray(emailLogs.clientId, clientIds));
    
    // Documents
    await db.delete(documents).where(inArray(documents.clientId, clientIds));
    
    // Workflow Steps & SubTasks
    const steps = await db.select({ id: workflowSteps.id }).from(workflowSteps).where(inArray(workflowSteps.clientId, clientIds));
    const stepIds = steps.map(s => s.id);
    
    if (stepIds.length > 0) {
      await db.delete(subTasks).where(inArray(subTasks.workflowStepId, stepIds));
      await db.delete(workflowSteps).where(inArray(workflowSteps.clientId, clientIds));
    }

    // Email Scheduled
    await db.delete(emailScheduled).where(inArray(emailScheduled.clientId, clientIds));
    
    // Finalmente, os clientes
    await db.delete(clients).where(eq(clients.tenantId, id));
  }

  // 2. Delete Users
  await db.delete(users).where(eq(users.tenantId, id));

  // 3. Delete Triggers
  // Triggers do tenant
  const triggers = await db.select({ id: emailTriggers.id }).from(emailTriggers).where(eq(emailTriggers.tenantId, id));
  const triggerIds = triggers.map(t => t.id);
  if (triggerIds.length > 0) {
    await db.delete(emailTriggerTemplates).where(inArray(emailTriggerTemplates.triggerId, triggerIds));
    await db.delete(emailTriggers).where(eq(emailTriggers.tenantId, id));
  }

  // 4. Delete Logs
  await db.delete(auditLogs).where(eq(auditLogs.tenantId, id));
  await db.delete(tenantActivityLogs).where(eq(tenantActivityLogs.tenantId, id));

  // 5. Delete Tenant
  await db.delete(tenants).where(eq(tenants.id, id));
}

// ===========================================
// TENANT AUDIT LOGS
// ===========================================
export async function logTenantActivity(entry: InsertTenantActivityLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(tenantActivityLogs).values(entry);
}

// ===========================================
// AUDIT LOGS (Per-Tenant Security Audit Trail)
// ===========================================
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'DOWNLOAD' | 'UPLOAD' | 'EXPORT';
export type AuditEntity = 'CLIENT' | 'DOCUMENT' | 'USER' | 'WORKFLOW' | 'SETTINGS' | 'AUTH';

export interface LogAuditParams {
  tenantId: number;
  userId?: number | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: number | null;
  details?: string | null;
  ipAddress?: string | null;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[AUDIT] Database not available, skipping audit log');
      return;
    }

    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log audit entry:', error);
  }
}

export async function logAuditToDb(
  tenantDb: ReturnType<typeof drizzle>,
  params: LogAuditParams
): Promise<void> {
  try {
    await tenantDb.insert(auditLogs).values({
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log audit entry to tenant db:', error);
  }
}

export interface GetAuditLogsParams {
  tenantId: number;
  startDate?: Date;
  endDate?: Date;
  userId?: number;
  action?: AuditAction;
  entity?: AuditEntity;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(params: GetAuditLogsParams): Promise<{ logs: AuditLog[]; total: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(auditLogs.tenantId, params.tenantId)];

  if (params.startDate) {
    conditions.push(sql`${auditLogs.createdAt} >= ${params.startDate}`);
  }
  if (params.endDate) {
    conditions.push(sql`${auditLogs.createdAt} <= ${params.endDate}`);
  }
  if (params.userId) {
    conditions.push(eq(auditLogs.userId, params.userId));
  }
  if (params.action) {
    conditions.push(eq(auditLogs.action, params.action));
  }
  if (params.entity) {
    conditions.push(eq(auditLogs.entity, params.entity));
  }

  const whereClause = and(...conditions);

  const [logs, countResult] = await Promise.all([
    db.select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
    db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause)
  ]);

  return {
    logs,
    total: Number(countResult[0]?.count ?? 0)
  };
}

export async function getAuditLogsFromDb(
  tenantDb: ReturnType<typeof drizzle>,
  params: GetAuditLogsParams
): Promise<{ logs: AuditLog[]; total: number }> {
  const conditions = [eq(auditLogs.tenantId, params.tenantId)];

  if (params.startDate) {
    conditions.push(sql`${auditLogs.createdAt} >= ${params.startDate}`);
  }
  if (params.endDate) {
    conditions.push(sql`${auditLogs.createdAt} <= ${params.endDate}`);
  }
  if (params.userId) {
    conditions.push(eq(auditLogs.userId, params.userId));
  }
  if (params.action) {
    conditions.push(eq(auditLogs.action, params.action));
  }
  if (params.entity) {
    conditions.push(eq(auditLogs.entity, params.entity));
  }

  const whereClause = and(...conditions);

  const [logs, countResult] = await Promise.all([
    tenantDb.select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
    tenantDb.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause)
  ]);

  return {
    logs,
    total: Number(countResult[0]?.count ?? 0)
  };
}

// ============================================
// EMAIL TRIGGERS FUNCTIONS
// ============================================

export async function createEmailTrigger(data: InsertEmailTrigger) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(emailTriggers).values(data).returning();
  return inserted;
}

export async function createEmailTriggerToDb(tenantDb: ReturnType<typeof drizzle>, data: InsertEmailTrigger) {
  const [inserted] = await tenantDb.insert(emailTriggers).values(data).returning();
  return inserted;
}

export async function getEmailTriggers(tenantId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (tenantId) {
    return await db.select().from(emailTriggers).where(eq(emailTriggers.tenantId, tenantId)).orderBy(desc(emailTriggers.createdAt));
  }
  return await db.select().from(emailTriggers).orderBy(desc(emailTriggers.createdAt));
}

export async function getEmailTriggersFromDb(tenantDb: ReturnType<typeof drizzle>, tenantId?: number) {
  if (tenantId) {
    return await tenantDb.select().from(emailTriggers).where(eq(emailTriggers.tenantId, tenantId)).orderBy(desc(emailTriggers.createdAt));
  }
  return await tenantDb.select().from(emailTriggers).orderBy(desc(emailTriggers.createdAt));
}

export async function getEmailTriggerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailTriggers).where(eq(emailTriggers.id, id)).limit(1);
  return result[0];
}

export async function getEmailTriggerByIdFromDb(tenantDb: ReturnType<typeof drizzle>, id: number) {
  const result = await tenantDb.select().from(emailTriggers).where(eq(emailTriggers.id, id)).limit(1);
  return result[0];
}

export async function getActiveTriggersByEvent(event: string, tenantId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(emailTriggers.triggerEvent, event), eq(emailTriggers.isActive, true)];
  if (tenantId) conditions.push(eq(emailTriggers.tenantId, tenantId));
  return await db.select().from(emailTriggers).where(and(...conditions));
}

export async function getActiveTriggersByEventFromDb(tenantDb: ReturnType<typeof drizzle>, event: string, tenantId?: number) {
  const conditions = [eq(emailTriggers.triggerEvent, event), eq(emailTriggers.isActive, true)];
  if (tenantId) conditions.push(eq(emailTriggers.tenantId, tenantId));
  return await tenantDb.select().from(emailTriggers).where(and(...conditions));
}

export async function updateEmailTrigger(id: number, data: Partial<InsertEmailTrigger>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailTriggers).set({ ...data, updatedAt: new Date() }).where(eq(emailTriggers.id, id));
}

export async function updateEmailTriggerToDb(tenantDb: ReturnType<typeof drizzle>, id: number, data: Partial<InsertEmailTrigger>) {
  await tenantDb.update(emailTriggers).set({ ...data, updatedAt: new Date() }).where(eq(emailTriggers.id, id));
}

export async function deleteEmailTrigger(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete associated templates first
  await db.delete(emailTriggerTemplates).where(eq(emailTriggerTemplates.triggerId, id));
  // Delete scheduled emails
  await db.delete(emailScheduled).where(eq(emailScheduled.triggerId, id));
  // Delete trigger
  await db.delete(emailTriggers).where(eq(emailTriggers.id, id));
}

export async function deleteEmailTriggerFromDb(tenantDb: ReturnType<typeof drizzle>, id: number) {
  await tenantDb.delete(emailTriggerTemplates).where(eq(emailTriggerTemplates.triggerId, id));
  await tenantDb.delete(emailScheduled).where(eq(emailScheduled.triggerId, id));
  await tenantDb.delete(emailTriggers).where(eq(emailTriggers.id, id));
}

// ============================================
// EMAIL TRIGGER TEMPLATES FUNCTIONS
// ============================================

export async function addTemplateToTrigger(data: InsertEmailTriggerTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(emailTriggerTemplates).values(data).returning();
  return inserted;
}

export async function addTemplateToTriggerToDb(tenantDb: ReturnType<typeof drizzle>, data: InsertEmailTriggerTemplate) {
  const [inserted] = await tenantDb.insert(emailTriggerTemplates).values(data).returning();
  return inserted;
}

export async function getTemplatesByTriggerId(triggerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: emailTriggerTemplates.id,
      triggerId: emailTriggerTemplates.triggerId,
      templateId: emailTriggerTemplates.templateId,
      sendOrder: emailTriggerTemplates.sendOrder,
      isForReminder: emailTriggerTemplates.isForReminder,
      template: emailTemplates,
    })
    .from(emailTriggerTemplates)
    .leftJoin(emailTemplates, eq(emailTriggerTemplates.templateId, emailTemplates.id))
    .where(eq(emailTriggerTemplates.triggerId, triggerId))
    .orderBy(emailTriggerTemplates.sendOrder);
}

export async function getTemplatesByTriggerIdFromDb(tenantDb: ReturnType<typeof drizzle>, triggerId: number) {
  return await tenantDb
    .select({
      id: emailTriggerTemplates.id,
      triggerId: emailTriggerTemplates.triggerId,
      templateId: emailTriggerTemplates.templateId,
      sendOrder: emailTriggerTemplates.sendOrder,
      isForReminder: emailTriggerTemplates.isForReminder,
      template: emailTemplates,
    })
    .from(emailTriggerTemplates)
    .leftJoin(emailTemplates, eq(emailTriggerTemplates.templateId, emailTemplates.id))
    .where(eq(emailTriggerTemplates.triggerId, triggerId))
    .orderBy(emailTriggerTemplates.sendOrder);
}

export async function removeTemplateFromTrigger(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(emailTriggerTemplates).where(eq(emailTriggerTemplates.id, id));
}

export async function removeTemplateFromTriggerToDb(tenantDb: ReturnType<typeof drizzle>, id: number) {
  await tenantDb.delete(emailTriggerTemplates).where(eq(emailTriggerTemplates.id, id));
}

// ============================================
// EMAIL SCHEDULED FUNCTIONS
// ============================================

export async function scheduleEmail(data: InsertEmailScheduled) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(emailScheduled).values(data).returning();
  return inserted;
}

export async function scheduleEmailToDb(tenantDb: ReturnType<typeof drizzle>, data: InsertEmailScheduled) {
  const [inserted] = await tenantDb.insert(emailScheduled).values(data).returning();
  return inserted;
}

export async function getPendingScheduledEmails() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db
    .select()
    .from(emailScheduled)
    .where(and(eq(emailScheduled.status, 'pending'), sql`${emailScheduled.scheduledFor} <= ${now}`))
    .orderBy(emailScheduled.scheduledFor);
}

export async function getPendingScheduledEmailsFromDb(tenantDb: ReturnType<typeof drizzle>) {
  const now = new Date();
  return await tenantDb
    .select()
    .from(emailScheduled)
    .where(and(eq(emailScheduled.status, 'pending'), sql`${emailScheduled.scheduledFor} <= ${now}`))
    .orderBy(emailScheduled.scheduledFor);
}

export async function markScheduledEmailSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailScheduled).set({ status: 'sent', sentAt: new Date() }).where(eq(emailScheduled.id, id));
}

export async function markScheduledEmailSentToDb(tenantDb: ReturnType<typeof drizzle>, id: number) {
  await tenantDb.update(emailScheduled).set({ status: 'sent', sentAt: new Date() }).where(eq(emailScheduled.id, id));
}

export async function markScheduledEmailFailed(id: number, errorMessage: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailScheduled).set({ status: 'failed', errorMessage }).where(eq(emailScheduled.id, id));
}

export async function markScheduledEmailFailedToDb(tenantDb: ReturnType<typeof drizzle>, id: number, errorMessage: string) {
  await tenantDb.update(emailScheduled).set({ status: 'failed', errorMessage }).where(eq(emailScheduled.id, id));
}

export async function cancelScheduledEmailsByClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailScheduled).set({ status: 'cancelled' }).where(and(eq(emailScheduled.clientId, clientId), eq(emailScheduled.status, 'pending')));
}

export async function cancelScheduledEmailsByClientToDb(tenantDb: ReturnType<typeof drizzle>, clientId: number) {
  await tenantDb.update(emailScheduled).set({ status: 'cancelled' }).where(and(eq(emailScheduled.clientId, clientId), eq(emailScheduled.status, 'pending')));
}

export async function getScheduledEmailsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailScheduled).where(eq(emailScheduled.clientId, clientId)).orderBy(desc(emailScheduled.scheduledFor));
}

export async function getScheduledEmailsByClientFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number) {
  return await tenantDb.select().from(emailScheduled).where(eq(emailScheduled.clientId, clientId)).orderBy(desc(emailScheduled.scheduledFor));
}

// ============================================
// Plan Definitions — CRUD & Seed
// ============================================

async function seedDefaultPlans(db: ReturnType<typeof drizzle>) {
  try {
    const existing = await db.select({ id: planDefinitions.id }).from(planDefinitions).limit(1);
    if (existing.length > 0) return;
    await db.insert(planDefinitions).values([
      {
        slug: "starter", name: "Plano Starter",
        description: "Ideal para despachantes individuais ou pequenos clubes de tiro.",
        maxUsers: 5, maxClients: 100, maxStorageGB: 10,
        featureWorkflowCR: true, featureApostilamento: false, featureRenovacao: false, featureInsumos: false, featureIAT: false,
        priceMonthlyBRL: 14900, priceYearlyBRL: 149900, setupFeeBRL: 0, trialDays: 14, displayOrder: 1,
        isPublic: true, isActive: true,
      },
      {
        slug: "professional", name: "Plano Professional",
        description: "Para clubes e despachantes em crescimento com múltiplos módulos.",
        maxUsers: 20, maxClients: 1000, maxStorageGB: 100,
        featureWorkflowCR: true, featureApostilamento: true, featureRenovacao: true, featureInsumos: false, featureIAT: false,
        priceMonthlyBRL: 29900, priceYearlyBRL: 299900, setupFeeBRL: 0, trialDays: 14, displayOrder: 2,
        isPublic: true, isActive: true, highlightLabel: "Mais Popular",
      },
      {
        slug: "enterprise", name: "Plano Enterprise",
        description: "Para grandes operações com todos os módulos e suporte dedicado.",
        maxUsers: 100, maxClients: 5000, maxStorageGB: 500,
        featureWorkflowCR: true, featureApostilamento: true, featureRenovacao: true, featureInsumos: true, featureIAT: true,
        priceMonthlyBRL: 59900, priceYearlyBRL: 599900, setupFeeBRL: 0, trialDays: 30, displayOrder: 3,
        isPublic: true, isActive: true,
      },
    ]);
    console.log('[Seed] Default plan definitions created (starter, professional, enterprise)');
  } catch (error: any) {
    if (!error?.message?.includes('duplicate') && !error?.message?.includes('already exists')) {
      console.warn('[Seed] Error creating default plans:', error?.message);
    }
  }
}

export async function getAllPlanDefinitions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(planDefinitions).orderBy(planDefinitions.displayOrder);
}

export async function getActivePlanDefinitions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(planDefinitions)
    .where(and(eq(planDefinitions.isActive, true), eq(planDefinitions.isPublic, true)))
    .orderBy(planDefinitions.displayOrder);
}

export async function getPlanDefinitionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [plan] = await db.select().from(planDefinitions).where(eq(planDefinitions.id, id)).limit(1);
  return plan || null;
}

export async function getPlanDefinitionBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const [plan] = await db.select().from(planDefinitions).where(eq(planDefinitions.slug, slug)).limit(1);
  return plan || null;
}

export async function createPlanDefinition(plan: InsertPlanDefinition) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(planDefinitions).values(plan).returning();
  return created;
}

export async function updatePlanDefinition(id: number, updates: Partial<InsertPlanDefinition>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(planDefinitions).set({ ...updates, updatedAt: new Date() }).where(eq(planDefinitions.id, id));
}

export async function deletePlanDefinition(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(planDefinitions).set({ isActive: false, updatedAt: new Date() }).where(eq(planDefinitions.id, id));
}

// ============================================
// Subscriptions — CRUD
// ============================================

export async function getActiveSubscription(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const [sub] = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.startDate)).limit(1);
  return sub || null;
}

export async function createSubscription(sub: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(subscriptions).values(sub).returning();
  return created;
}

export async function updateSubscription(id: number, updates: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptions).set({ ...updates, updatedAt: new Date() }).where(eq(subscriptions.id, id));
}

export async function syncTenantFromSubscription(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [activeSub] = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), inArray(subscriptions.status, ["active", "trialing"])))
    .orderBy(desc(subscriptions.startDate)).limit(1);
  if (!activeSub) {
    await db.update(tenants).set({ subscriptionStatus: "suspended", updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    return;
  }
  const [plan] = await db.select().from(planDefinitions).where(eq(planDefinitions.id, activeSub.planId)).limit(1);
  if (!plan) { console.warn(`[syncTenant] Plan ID ${activeSub.planId} not found for tenant ${tenantId}`); return; }
  const statusMap: Record<string, "active" | "suspended" | "trial" | "cancelled"> = {
    active: "active", trialing: "trial", past_due: "active", cancelled: "cancelled", expired: "suspended",
  };
  await db.update(tenants).set({
    plan: plan.slug as "starter" | "professional" | "enterprise",
    subscriptionStatus: statusMap[activeSub.status] ?? "suspended",
    subscriptionExpiresAt: activeSub.endDate,
    maxUsers: activeSub.overrideMaxUsers ?? plan.maxUsers,
    maxClients: activeSub.overrideMaxClients ?? plan.maxClients,
    maxStorageGB: activeSub.overrideMaxStorageGB ?? plan.maxStorageGB,
    featureWorkflowCR: plan.featureWorkflowCR,
    featureApostilamento: plan.featureApostilamento,
    featureRenovacao: plan.featureRenovacao,
    featureInsumos: plan.featureInsumos,
    featureIAT: plan.featureIAT,
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));
}

// ============================================
// Invoices — CRUD
// ============================================

export async function getInvoicesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.createdAt));
}

export async function getSubscriptionsByTenant(tenantId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(
    sql`SELECT s.*, pd.name AS "planName", pd.slug AS "planSlug"
        FROM "subscriptions" s
        LEFT JOIN "planDefinitions" pd ON pd.id = s."planId"
        WHERE s."tenantId" = ${tenantId}
        ORDER BY s."startDate" DESC`
  );
  const rows = (result as any)?.rows ?? result;
  return Array.isArray(rows) ? rows : [];
}

export async function getAllInvoices(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) return await db.select().from(invoices).where(eq(invoices.status, status as any)).orderBy(desc(invoices.createdAt));
  return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
}

export async function createInvoice(invoice: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(invoices).values(invoice).returning();
  return created;
}

export async function updateInvoice(id: number, updates: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invoices).set({ ...updates, updatedAt: new Date() }).where(eq(invoices.id, id));
}

export async function markInvoicePaid(id: number, paymentMethod: string, paymentReference?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invoices).set({
    status: "paid", paidAt: new Date(), paymentMethod,
    paymentReference: paymentReference ?? null, updatedAt: new Date(),
  }).where(eq(invoices.id, id));
}

// ============================================
// Usage Snapshots
// ============================================

export async function createUsageSnapshot(snapshot: InsertUsageSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(usageSnapshots).values(snapshot).returning();
  return created;
}

export async function getUsageSnapshotsByTenant(tenantId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(usageSnapshots).where(eq(usageSnapshots.tenantId, tenantId))
    .orderBy(desc(usageSnapshots.snapshotDate)).limit(limit);
}

// ============================================
// Financial Metrics
// ============================================

export async function calculateMRR(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const activeSubs = await db.select({
    priceBRL: subscriptions.priceBRL,
    discountBRL: subscriptions.discountBRL,
    billingCycle: subscriptions.billingCycle,
  }).from(subscriptions).where(inArray(subscriptions.status, ["active", "trialing"]));
  let mrr = 0;
  for (const sub of activeSubs) {
    const net = sub.priceBRL - sub.discountBRL;
    mrr += sub.billingCycle === "monthly" ? net : sub.billingCycle === "yearly" ? Math.round(net / 12) : 0;
  }
  return mrr;
}

export async function getTenantCountByPlan(): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select({ plan: tenants.plan }).from(tenants).where(eq(tenants.isActive, true));
  const counts: Record<string, number> = {};
  for (const row of rows) { const p = row.plan ?? "starter"; counts[p] = (counts[p] || 0) + 1; }
  return counts;
}

// ============================================
// PORTAL DO CLIENTE — Funções de dados
// ============================================
import crypto from "crypto";

const PORTAL_SESSION_DAYS = 30;
const INVITE_TOKEN_DAYS = 30;

/** Gera token de convite para o cliente acessar o portal pela primeira vez */
export async function createClientInviteToken(
  db: ReturnType<typeof drizzle>,
  clientId: number,
  tenantId?: number | null
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex"); // 64 chars
  // ISO 8601 garante compatibilidade com postgres.js (evita problemas com Date.toString() locale)
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Remove token anterior do cliente (se existir) e insere novo
  await db.execute(sql`DELETE FROM "clientInviteTokens" WHERE "clientId" = ${clientId}`);
  try {
    await db.execute(sql`
      INSERT INTO "clientInviteTokens" ("clientId", "tenantId", "token", "expiresAt", "createdAt")
      VALUES (${clientId}, ${tenantId ?? null}, ${token}, ${expiresAt}::timestamp, now())
    `);
  } catch (err: any) {
    console.error('[createClientInviteToken] INSERT falhou:', err?.message ?? err);
    throw err;
  }
  return token;
}

/** Busca um token de convite pelo valor do token */
export async function getClientInviteToken(
  db: ReturnType<typeof drizzle>,
  token: string
) {
  const rows = extractRows(await db.execute(sql`
    SELECT * FROM "clientInviteTokens" WHERE "token" = ${token} LIMIT 1
  `));
  return rows.length > 0 ? rows[0] : null;
}

/** Ativa o token de convite (marca como usado) */
export async function activateInviteToken(
  db: ReturnType<typeof drizzle>,
  token: string
) {
  await db.execute(sql`
    UPDATE "clientInviteTokens"
    SET "activatedAt" = now()
    WHERE "token" = ${token}
  `);
}

/** Busca cliente por email + CPF (autenticação do portal) */
export async function getClientByEmailAndCpf(
  db: ReturnType<typeof drizzle>,
  email: string,
  cpf: string,
  tenantId?: number | null
) {
  const cleanCpf = cpf.replace(/\D/g, "");
  const rows = tenantId
    ? extractRows(await db.execute(sql`
        SELECT * FROM "clients"
        WHERE LOWER("email") = LOWER(${email})
          AND REGEXP_REPLACE("cpf", '[^0-9]', '', 'g') = ${cleanCpf}
          AND "tenantId" = ${tenantId}
        LIMIT 1
      `))
    : extractRows(await db.execute(sql`
        SELECT * FROM "clients"
        WHERE LOWER("email") = LOWER(${email})
          AND REGEXP_REPLACE("cpf", '[^0-9]', '', 'g') = ${cleanCpf}
        LIMIT 1
      `));
  return rows.length > 0 ? rows[0] : null;
}

/** Cria sessão autenticada do portal */
export async function createPortalSession(
  db: ReturnType<typeof drizzle>,
  clientId: number,
  tenantId: number | null | undefined,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  // ISO 8601 garante compatibilidade com postgres.js
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.execute(sql`
    INSERT INTO "clientPortalSessions"
      ("clientId", "tenantId", "sessionToken", "ipAddress", "userAgent", "lastSeenAt", "expiresAt", "createdAt")
    VALUES
      (${clientId}, ${tenantId ?? null}, ${sessionToken}, ${ipAddress ?? null}, ${userAgent ?? null}, now(), ${expiresAt}::timestamp, now())
  `);
  return sessionToken;
}

/** Busca e valida sessão do portal (renova lastSeenAt) */
export async function getPortalSession(
  db: ReturnType<typeof drizzle>,
  sessionToken: string
) {
  const rows = extractRows(await db.execute(sql`
    SELECT * FROM "clientPortalSessions"
    WHERE "sessionToken" = ${sessionToken}
      AND "expiresAt" > now()
    LIMIT 1
  `));
  if (rows.length === 0) return null;
  // Renovar lastSeenAt
  await db.execute(sql`
    UPDATE "clientPortalSessions" SET "lastSeenAt" = now()
    WHERE "sessionToken" = ${sessionToken}
  `);
  return rows[0];
}

/** Remove sessão do portal (logout) */
export async function deletePortalSession(
  db: ReturnType<typeof drizzle>,
  sessionToken: string
) {
  await db.execute(sql`
    DELETE FROM "clientPortalSessions" WHERE "sessionToken" = ${sessionToken}
  `);
}

/** Registra aceite do termo LGPD */
export async function recordLgpdConsent(
  db: ReturnType<typeof drizzle>,
  clientId: number,
  tenantId: number | null | undefined,
  ipAddress?: string,
  userAgent?: string,
  version = "1.0"
) {
  await db.execute(sql`
    INSERT INTO "lgpdConsents" ("clientId", "tenantId", "version", "acceptedAt", "ipAddress", "userAgent", "createdAt")
    VALUES (${clientId}, ${tenantId ?? null}, ${version}, now(), ${ipAddress ?? null}, ${userAgent ?? null}, now())
  `);
}

/** Verifica se cliente já aceitou o termo LGPD */
export async function getLgpdConsent(
  db: ReturnType<typeof drizzle>,
  clientId: number
) {
  const rows = extractRows(await db.execute(sql`
    SELECT * FROM "lgpdConsents"
    WHERE "clientId" = ${clientId}
    ORDER BY "acceptedAt" DESC LIMIT 1
  `));
  return rows.length > 0 ? rows[0] : null;
}

/** Loga atividade do cliente no portal */
export async function logPortalActivity(
  db: ReturnType<typeof drizzle>,
  clientId: number,
  tenantId: number | null | undefined,
  action: string,
  details?: Record<string, any>,
  ipAddress?: string
) {
  await db.execute(sql`
    INSERT INTO "clientPortalActivityLog" ("clientId", "tenantId", "action", "details", "ipAddress", "createdAt")
    VALUES (${clientId}, ${tenantId ?? null}, ${action}, ${details ? JSON.stringify(details) : null}, ${ipAddress ?? null}, now())
  `).catch(() => {}); // log não deve quebrar o fluxo principal
}

/** Atualiza dados cadastrais do cliente pelo portal */
export async function updateClientFromPortal(
  db: ReturnType<typeof drizzle>,
  clientId: number,
  tenantId: number | null | undefined,
  data: {
    name?: string;
    phone?: string;
    phone2?: string;
    identityNumber?: string;
    identityIssueDate?: string;
    identityIssuer?: string;
    identityUf?: string;
    birthDate?: string;
    gender?: string;
    motherName?: string;
    fatherName?: string;
    maritalStatus?: string;
    profession?: string;
    cep?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    residenceUf?: string;
    apostilamentoActivities?: string;
    hasSecondCollectionAddress?: boolean;
    acervoCep?: string;
    acervoAddress?: string;
    acervoAddressNumber?: string;
    acervoNeighborhood?: string;
    acervoCity?: string;
    acervoUf?: string;
    acervoComplement?: string;
  }
) {
  // Construir update usando drizzle set() para tipagem segura
  const setData: Partial<typeof clients.$inferInsert> = {};
  if (data.name !== undefined) setData.name = data.name;
  if (data.phone !== undefined) setData.phone = data.phone;
  if (data.phone2 !== undefined) setData.phone2 = data.phone2;
  if (data.identityNumber !== undefined) setData.identityNumber = data.identityNumber;
  if (data.identityIssueDate !== undefined) setData.identityIssueDate = data.identityIssueDate;
  if (data.identityIssuer !== undefined) setData.identityIssuer = data.identityIssuer;
  if (data.identityUf !== undefined) setData.identityUf = data.identityUf;
  if (data.birthDate !== undefined) setData.birthDate = data.birthDate;
  if (data.gender !== undefined) setData.gender = data.gender;
  if (data.motherName !== undefined) setData.motherName = data.motherName;
  if (data.fatherName !== undefined) setData.fatherName = data.fatherName;
  if (data.maritalStatus !== undefined) setData.maritalStatus = data.maritalStatus;
  if (data.profession !== undefined) setData.profession = data.profession;
  if (data.cep !== undefined) setData.cep = data.cep;
  if (data.address !== undefined) setData.address = data.address;
  if (data.addressNumber !== undefined) setData.addressNumber = data.addressNumber;
  if (data.complement !== undefined) setData.complement = data.complement;
  if (data.neighborhood !== undefined) setData.neighborhood = data.neighborhood;
  if (data.city !== undefined) setData.city = data.city;
  if (data.residenceUf !== undefined) setData.residenceUf = data.residenceUf;
  if (data.apostilamentoActivities !== undefined) setData.apostilamentoActivities = data.apostilamentoActivities;
  if (data.hasSecondCollectionAddress !== undefined) setData.hasSecondCollectionAddress = data.hasSecondCollectionAddress;
  if (data.acervoCep !== undefined) setData.acervoCep = data.acervoCep;
  if (data.acervoAddress !== undefined) setData.acervoAddress = data.acervoAddress;
  if (data.acervoAddressNumber !== undefined) setData.acervoAddressNumber = data.acervoAddressNumber;
  if (data.acervoNeighborhood !== undefined) setData.acervoNeighborhood = data.acervoNeighborhood;
  if (data.acervoCity !== undefined) setData.acervoCity = data.acervoCity;
  if (data.acervoUf !== undefined) setData.acervoUf = data.acervoUf;
  if (data.acervoComplement !== undefined) setData.acervoComplement = data.acervoComplement;
  setData.updatedAt = new Date();

  if (Object.keys(setData).length <= 1) return; // só updatedAt, nada para salvar

  const whereClause = tenantId != null
    ? and(eq(clients.id, clientId), eq(clients.tenantId, tenantId))
    : eq(clients.id, clientId);

  await db.update(clients).set(setData).where(whereClause);
}

// ============================================
// BILLING — Funções para cron jobs
// ============================================

/** Subscriptions ativas com renovação em até dueInDays dias */
export async function getActiveSubscriptionsDueSoon(dueInDays: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const result = await db.execute(sql`
    SELECT s.*, t.name AS "tenantName", t.id AS "tenantIdVal"
    FROM "subscriptions" s
    INNER JOIN "tenants" t ON t.id = s."tenantId"
    WHERE s.status = 'active'
      AND s."currentPeriodEnd" <= ${cutoff}
      AND s."currentPeriodEnd" >= ${now}
  `);
  return extractRows(result);
}

/** Subscriptions ativas com currentPeriodEnd no passado (inadimplentes) */
export async function getExpiredSubscriptions(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const result = await db.execute(sql`
    SELECT s.*, t.name AS "tenantName", t.id AS "tenantIdVal"
    FROM "subscriptions" s
    INNER JOIN "tenants" t ON t.id = s."tenantId"
    WHERE s.status = 'active' AND s."currentPeriodEnd" < ${now}
  `);
  return extractRows(result);
}

/** Cria fatura se ainda não existir para o mês de referência. Retorna true se criada. */
export async function createInvoiceIfNotExists(
  tenantId: number,
  subscriptionId: number,
  periodRef: string,
  amountCents: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.execute(sql`
    SELECT id FROM "invoices"
    WHERE "tenantId" = ${tenantId}
      AND "subscriptionId" = ${subscriptionId}
      AND "periodRef" = ${periodRef}
    LIMIT 1
  `);
  if (extractRows(existing).length > 0) return false;
  await db.execute(sql`
    INSERT INTO "invoices" ("tenantId", "subscriptionId", "periodRef", "amountCents", "status", "createdAt")
    VALUES (${tenantId}, ${subscriptionId}, ${periodRef}, ${amountCents}, 'pending', now())
  `);
  return true;
}

/** Suspende tenant (isActive = false) e subscription (status = suspended) */
export async function suspendTenantSubscription(
  tenantId: number,
  subscriptionId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db.execute(sql`UPDATE "tenants" SET "isActive" = false WHERE id = ${tenantId}`),
    db.execute(sql`UPDATE "subscriptions" SET status = 'suspended' WHERE id = ${subscriptionId}`),
  ]);
}

/** Regenera token de convite (reenvio manual pelo operador) */
export async function regenerateClientInviteToken(
  db: ReturnType<typeof drizzle>,
  clientId: number,
  tenantId?: number | null
): Promise<string> {
  return createClientInviteToken(db, clientId, tenantId);
}

// ============================================
// PORTAL — Documentos Pendentes de Triagem
// ============================================

/** Cria registro de documento pendente enviado pelo cliente via portal */
export async function createPendingDocument(
  db: ReturnType<typeof drizzle>,
  data: {
    clientId: number;
    tenantId?: number | null;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    fileSize?: number | null;
  }
): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO "clientPendingDocuments"
      ("clientId", "tenantId", "fileName", "fileUrl", "mimeType", "fileSize", "status", "uploadedAt", "createdAt")
    VALUES
      (${data.clientId}, ${data.tenantId ?? null}, ${data.fileName}, ${data.fileUrl},
       ${data.mimeType ?? null}, ${data.fileSize ?? null}, 'pending', now(), now())
    RETURNING id
  `);
  return extractRows(result)[0]?.id ?? 0;
}

/** Lista documentos enviados por um cliente (para o próprio cliente ver no portal) */
export async function getPendingDocumentsByClient(
  db: ReturnType<typeof drizzle>,
  clientId: number,
  tenantId?: number | null
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT * FROM "clientPendingDocuments"
    WHERE "clientId" = ${clientId}
    ${tenantId != null ? sql`AND "tenantId" = ${tenantId}` : sql``}
    ORDER BY "uploadedAt" DESC
  `);
  return extractRows(result);
}

/** Retorna quantidade de documentos pendentes de triagem por cliente */
export async function getPendingTriageCountsByClients(
  db: ReturnType<typeof drizzle>,
  clientIds: number[],
  tenantId?: number | null
): Promise<Array<{ clientId: number; pendingCount: number }>> {
  if (!clientIds || clientIds.length === 0) return [];

  const conditions: any[] = [
    eq(clientPendingDocuments.status, 'pending'),
    inArray(clientPendingDocuments.clientId, clientIds),
  ];

  if (tenantId != null) {
    conditions.push(
      or(
        eq(clientPendingDocuments.tenantId, tenantId),
        isNull(clientPendingDocuments.tenantId)
      )
    );
  }

  return await db
    .select({
      clientId: clientPendingDocuments.clientId,
      pendingCount: sql<number>`COUNT(*)::int`,
    })
    .from(clientPendingDocuments)
    .where(and(...conditions))
    .groupBy(clientPendingDocuments.clientId);
}

/** Lista documentos pendentes de triagem de um tenant (para operador) */
export async function getPendingDocumentsForTriage(
  db: ReturnType<typeof drizzle>,
  clientId?: number | null,
  tenantId?: number | null
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT pd.*,
           COALESCE(c.name, 'Cliente') AS "clientName",
           c.email AS "clientEmail"
    FROM "clientPendingDocuments" pd
    LEFT JOIN "clients" c ON c.id = pd."clientId"
    WHERE pd.status = 'pending'
    ${clientId != null ? sql`AND pd."clientId" = ${clientId}` : sql``}
    ${tenantId != null && clientId == null ? sql`AND (pd."tenantId" = ${tenantId} OR pd."tenantId" IS NULL)` : sql``}
    ORDER BY pd."uploadedAt" ASC
  `);
  return extractRows(result);
}

/** Atualiza status de documento pendente após triagem */
export async function updatePendingDocumentStatus(
  db: ReturnType<typeof drizzle>,
  docId: number,
  status: "approved" | "rejected" | "linked",
  opts?: { linkedSubTaskId?: number; rejectionReason?: string; issueDate?: string | null }
): Promise<void> {
  await db.execute(sql`
    UPDATE "clientPendingDocuments"
    SET status = ${status},
        "reviewedAt" = now(),
        "linkedSubTaskId" = ${opts?.linkedSubTaskId ?? null},
        "rejectionReason" = ${opts?.rejectionReason ?? null},
        "issueDate" = ${opts?.issueDate ? sql`${opts.issueDate}::timestamp` : sql`NULL`}
    WHERE id = ${docId}
  `);
}

// ============================================
// MARKETING — Leads
// ============================================

/** Salva lead capturado pelo formulário público da landing page */
export async function createLead(data: {
  name: string;
  clubName?: string;
  email: string;
  whatsapp?: string;
  message?: string;
  ipAddress?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.execute(sql`
    INSERT INTO "leads" ("name", "clubName", "email", "whatsapp", "message", "status", "source", "ipAddress", "createdAt", "updatedAt")
    VALUES (${data.name}, ${data.clubName ?? null}, ${data.email}, ${data.whatsapp ?? null},
            ${data.message ?? null}, 'new', 'landing', ${data.ipAddress ?? null}, now(), now())
    RETURNING id
  `);
  return extractRows(result)[0]?.id ?? 0;
}

/** Garante que as tabelas de portal e leads existem (idempotente) */
export async function ensurePortalAndMarketingTables(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "clientPendingDocuments" (
      id SERIAL PRIMARY KEY,
      "clientId" INTEGER NOT NULL,
      "tenantId" INTEGER,
      "fileName" VARCHAR(255) NOT NULL,
      "fileUrl" TEXT NOT NULL,
      "mimeType" VARCHAR(100),
      "fileSize" INTEGER,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "linkedSubTaskId" INTEGER,
      "rejectionReason" TEXT,
      "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "reviewedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "leads" (
      id SERIAL PRIMARY KEY,
      "name" VARCHAR(255) NOT NULL,
      "clubName" VARCHAR(255),
      "email" VARCHAR(320) NOT NULL,
      "whatsapp" VARCHAR(20),
      "message" TEXT,
      "status" VARCHAR(30) NOT NULL DEFAULT 'new',
      "source" VARCHAR(50) DEFAULT 'landing',
      "ipAddress" VARCHAR(45),
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}
