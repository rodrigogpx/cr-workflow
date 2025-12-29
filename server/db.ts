import { eq, and, desc, sql, inArray, like } from "drizzle-orm";
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
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { encryptSecret } from "./config/crypto.util";
import bcrypt from "bcryptjs";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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
  template: InsertEmailTemplate & { module?: string }
) {
  const moduleValue = template.module || 'workflow-cr';
  const existing = await getEmailTemplateFromDb(tenantDb, template.templateKey, moduleValue);

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
    .values({ ...template, module: moduleValue })
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

  const [inserted] = await tenantDb
    .insert(workflowSteps)
    .values(step)
    .returning({ id: workflowSteps.id });
  return inserted.id;
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
  module?: string
) {
  if (module) {
    const result = await tenantDb
      .select()
      .from(emailTemplates)
      .where(and(
        eq(emailTemplates.templateKey, templateKey),
        eq(emailTemplates.module, module)
      ))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  const result = await tenantDb
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.templateKey, templateKey))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByIdFromDb(tenantDb: ReturnType<typeof drizzle>, id: number) {
  const result = await tenantDb.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmailFromDb(tenantDb: ReturnType<typeof drizzle>, email: string) {
  const result = await tenantDb.select().from(users).where(eq(users.email, email)).limit(1);
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

export async function createClientToDb(tenantDb: ReturnType<typeof drizzle>, client: InsertClient) {
  const [inserted] = await tenantDb
    .insert(clients)
    .values(client)
    .returning({ id: clients.id });

  return inserted.id;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  console.log(`[DB DEBUG] getUserById(${id}) result:`, JSON.stringify(result[0], null, 2));

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
  console.log("[createClient] CALLED with:", JSON.stringify(client, null, 2));
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inserted] = await db
    .insert(clients)
    .values(client)
    .returning({ id: clients.id });

  return inserted.id;
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

export async function getAllClientsFromDb(tenantDb: ReturnType<typeof drizzle>, tenantId?: number) {
  if (tenantId) {
    return await tenantDb.select().from(clients).where(eq(clients.tenantId, tenantId)).orderBy(desc(clients.createdAt));
  }
  return await tenantDb.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClientById(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getClientByIdFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number) {
  const result = await tenantDb.select().from(clients).where(eq(clients.id, clientId)).limit(1);
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
  data: Partial<InsertClient>
) {
  await tenantDb.update(clients).set(data).where(eq(clients.id, clientId));
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

export async function deleteClientFromDb(tenantDb: ReturnType<typeof drizzle>, clientId: number) {
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
  workflowStepId: number
) {
  return await tenantDb
    .select()
    .from(subTasks)
    .where(eq(subTasks.workflowStepId, workflowStepId));
}

export async function getWorkflowStepById(stepId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workflowSteps).where(eq(workflowSteps.id, stepId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getWorkflowStepByIdFromDb(tenantDb: ReturnType<typeof drizzle>, stepId: number) {
  const result = await tenantDb
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.id, stepId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertWorkflowStep(step: InsertWorkflowStep & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (step.id) {
    await db.update(workflowSteps).set(step).where(eq(workflowSteps.id, step.id));
    return step.id;
  } else {
    const [inserted] = await db
      .insert(workflowSteps)
      .values(step)
      .returning({ id: workflowSteps.id });
    return inserted.id;
  }
}

export async function upsertSubTask(task: InsertSubTask & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (task.id) {
    await db.update(subTasks).set(task).where(eq(subTasks.id, task.id));
    return task.id;
  } else {
    const [inserted] = await db
      .insert(subTasks)
      .values(task)
      .returning({ id: subTasks.id });
    return inserted.id;
  }
}

export async function upsertSubTaskToDb(
  tenantDb: ReturnType<typeof drizzle>,
  task: InsertSubTask & { id?: number }
) {
  if (task.id) {
    await tenantDb.update(subTasks).set(task).where(eq(subTasks.id, task.id));
    return task.id;
  }

  const [inserted] = await tenantDb
    .insert(subTasks)
    .values(task)
    .returning({ id: subTasks.id });
  return inserted.id;
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

export async function getDocumentByIdFromDb(tenantDb: ReturnType<typeof drizzle>, documentId: number) {
  const result = await tenantDb
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(documents).where(eq(documents.id, documentId));
}

export async function deleteDocumentFromDb(tenantDb: ReturnType<typeof drizzle>, documentId: number) {
  await tenantDb.delete(documents).where(eq(documents.id, documentId));
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

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function updateUserToDb(
  tenantDb: ReturnType<typeof drizzle>,
  userId: number,
  data: Partial<InsertUser>
) {
  await tenantDb.update(users).set(data).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: "operator" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserRoleToDb(
  tenantDb: ReturnType<typeof drizzle>,
  userId: number,
  role: "operator" | "admin"
) {
  await tenantDb.update(users).set({ role }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(users).where(eq(users.id, userId));
}

export async function deleteUserFromDb(tenantDb: ReturnType<typeof drizzle>, userId: number) {
  await tenantDb.delete(users).where(eq(users.id, userId));
}

// Tenant SMTP settings - stored directly in tenants table
export interface TenantSmtpSettings {
  emailMethod: 'smtp' | 'gateway' | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
}

export async function getTenantSmtpSettings(tenantId: number): Promise<TenantSmtpSettings | null> {
  const db = await getDb();
  if (!db) return null;

  const [tenant] = await db
    .select({
      emailMethod: tenants.emailMethod,
      smtpHost: tenants.smtpHost,
      smtpPort: tenants.smtpPort,
      smtpUser: tenants.smtpUser,
      smtpPassword: tenants.smtpPassword,
      smtpFrom: tenants.smtpFrom,
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

  const rows = result[0] as any[];
  if (!rows || rows.length === 0) {
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

  const rows = result[0] as any[];
  if (!rows || rows.length === 0) {
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
  module?: string
) {
  if (module) {
    const result = await tenantDb
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.module, module));
    return result;
  }

  const result = await tenantDb.select().from(emailTemplates);
  return result;
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

// ===========================================
// SEED MOCK TENANTS/USERS/CLIENTS
// ===========================================
 const defaultMockTenantDbConfig = (() => {
   const rawUrl = process.env.MOCK_TENANT_DATABASE_URL || process.env.DATABASE_URL;
   if (!rawUrl) return null;
 
   try {
     const url = new URL(rawUrl);
     const dbName = (url.pathname || "").replace(/^\//, "");
     return {
       dbHost: url.hostname,
       dbPort: Number(url.port || 5432),
       dbName,
       dbUser: decodeURIComponent(url.username || ""),
       dbPassword: decodeURIComponent(url.password || ""),
     };
   } catch {
     return null;
   }
 })();

const mockTenants = [
  {
    slug: "tiroesp",
    name: "Clube de Tiro Esportivo SP",
    dbHost: defaultMockTenantDbConfig?.dbHost ?? "localhost",
    dbPort: defaultMockTenantDbConfig?.dbPort ?? 5432,
    dbName: defaultMockTenantDbConfig?.dbName ?? "cac360_tiroesp",
    dbUser: defaultMockTenantDbConfig?.dbUser ?? "tiroesp_user",
    dbPassword: defaultMockTenantDbConfig?.dbPassword ?? "tiroesp_pass",
    primaryColor: "#1a5c00",
    secondaryColor: "#4d9702",
    featureWorkflowCR: true,
    featureApostilamento: true,
    featureRenovacao: true,
    featureInsumos: false,
    plan: "professional" as const,
    subscriptionStatus: "active" as const,
    subscriptionExpiresAt: null,
    maxUsers: 20,
    maxClients: 1000,
    maxStorageGB: 100,
    isActive: true,
  },
  {
    slug: "cluberio",
    name: "Clube Tiro Rio",
    dbHost: defaultMockTenantDbConfig?.dbHost ?? "localhost",
    dbPort: defaultMockTenantDbConfig?.dbPort ?? 5432,
    dbName: defaultMockTenantDbConfig?.dbName ?? "cac360_cluberio",
    dbUser: defaultMockTenantDbConfig?.dbUser ?? "cluberio_user",
    dbPassword: defaultMockTenantDbConfig?.dbPassword ?? "cluberio_pass",
    primaryColor: "#002366",
    secondaryColor: "#4169E1",
    featureWorkflowCR: true,
    featureApostilamento: false,
    featureRenovacao: false,
    featureInsumos: false,
    plan: "starter" as const,
    subscriptionStatus: "trial" as const,
    subscriptionExpiresAt: null,
    maxUsers: 5,
    maxClients: 100,
    maxStorageGB: 50,
    isActive: true,
  },
  {
    slug: "norteclub",
    name: "Clube Norte CAC",
    dbHost: defaultMockTenantDbConfig?.dbHost ?? "localhost",
    dbPort: defaultMockTenantDbConfig?.dbPort ?? 5432,
    dbName: defaultMockTenantDbConfig?.dbName ?? "cac360_norteclub",
    dbUser: defaultMockTenantDbConfig?.dbUser ?? "norte_user",
    dbPassword: defaultMockTenantDbConfig?.dbPassword ?? "norte_pass",
    primaryColor: "#0f172a",
    secondaryColor: "#10b981",
    featureWorkflowCR: true,
    featureApostilamento: true,
    featureRenovacao: false,
    featureInsumos: true,
    plan: "enterprise" as const,
    subscriptionStatus: "active" as const,
    subscriptionExpiresAt: null,
    maxUsers: 50,
    maxClients: 5000,
    maxStorageGB: 500,
    isActive: true,
  },
] as const;

export async function clearMockTenants() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const mockSlugs = mockTenants.map((m) => m.slug);

  await db.delete(clients).where(like(clients.email, "%@example.com"));
  await db.delete(users).where(like(users.email, "%@example.com"));
  await db.delete(tenants).where(inArray(tenants.slug, mockSlugs));

  return { tenants: mockSlugs.length };
}

export async function seedMockTenants() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const mocks = mockTenants;

  // Limpar dados mockados anteriores (emails @example.com e tenants de mock)
  const mockSlugs = mocks.map((m) => m.slug);
  await db.delete(clients).where(like(clients.email, "%@example.com"));
  await db.delete(users).where(like(users.email, "%@example.com"));
  await db.delete(tenants).where(inArray(tenants.slug, mockSlugs));

  // Inserir tenants (usa encryptSecret na camada createTenant)
  const tenantIds: Record<string, number> = {};
  for (const t of mocks) {
    const tenantId = await createTenant({
      ...t,
      dbPassword: t.dbPassword,
    });
    tenantIds[t.slug] = tenantId;
  }

  // Seed platform users (2 admins + 3 operadores por tenant)
  const passwordHash = bcrypt.hashSync("123456", 10);
  const tenantUserIds: Record<string, { admins: number[]; operators: number[] }> = {};

  for (const t of mocks) {
    const admins: number[] = [];
    const operators: number[] = [];

    for (let i = 1; i <= 2; i++) {
      const email = `${t.slug}.admin${i}@example.com`;
      const [inserted] = await db
        .insert(users)
        .values({
          tenantId: tenantIds[t.slug],
          name: `${t.name} Admin ${i}`,
          email,
          hashedPassword: passwordHash,
          role: "admin",
        })
        .onConflictDoNothing()
        .returning({ id: users.id });
      if (inserted?.id) admins.push(inserted.id);
    }

    for (let i = 1; i <= 3; i++) {
      const email = `${t.slug}.op${i}@example.com`;
      const [inserted] = await db
        .insert(users)
        .values({
          tenantId: tenantIds[t.slug],
          name: `${t.name} Operador ${i}`,
          email,
          hashedPassword: passwordHash,
          role: "operator",
        })
        .onConflictDoNothing()
        .returning({ id: users.id });
      if (inserted?.id) operators.push(inserted.id);
    }

    tenantUserIds[t.slug] = { admins, operators };
  }

  // Seed clients (15 por tenant)
  let clientsInserted = 0;
  let tenantIndex = 0;
  for (const t of mocks) {
    tenantIndex++;
    const { operators } = tenantUserIds[t.slug];
    if (!operators || operators.length === 0) continue;

    for (let i = 1; i <= 15; i++) {
      // CPF único por tenant: prefixo baseado no índice do tenant
      const cpf = `${String(tenantIndex).padStart(3, "0")}${String(i).padStart(3, "0")}${String(tenantIndex).padStart(4, "0")}${String(i).padStart(2, "0")}`;
      const email = `${t.slug}.cliente${i}@example.com`;

      await db
        .insert(clients)
        .values({
          tenantId: tenantIds[t.slug],
          name: `Cliente ${i} - ${t.name}`,
          cpf,
          phone: `11999${String(i).padStart(4, "0")}`,
          email,
          operatorId: operators[(i - 1) % operators.length],
          address: "Rua Exemplo",
          addressNumber: `${100 + i}`,
          neighborhood: "Centro",
          city: "São Paulo",
          cep: "01000-000",
        })
        .onConflictDoNothing();
      clientsInserted += 1;
    }
  }

  return {
    tenants: mocks.length,
    users: Object.values(tenantUserIds).reduce((acc, v) => acc + v.admins.length + v.operators.length, 0),
    clients: clientsInserted,
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
