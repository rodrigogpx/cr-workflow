import { eq, and, desc, sql } from "drizzle-orm";
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
  InsertEmailLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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

export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClientById(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateClient(clientId: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(clients).set(data).where(eq(clients.id, clientId));
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

export async function getSubTasksByWorkflowStep(workflowStepId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(subTasks).where(eq(subTasks.workflowStepId, workflowStepId));
}

export async function getWorkflowStepById(stepId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workflowSteps).where(eq(workflowSteps.id, stepId)).limit(1);
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

export async function getDocumentsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.createdAt));
}

export async function getDocumentById(documentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(documents).where(eq(documents.id, documentId));
}

// User management
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: "operator" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(users).where(eq(users.id, userId));
}

// Email settings (SMTP) - stored in a dedicated table managed via raw SQL
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
    SELECT smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, useSecure
    FROM emailSettings
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

// Email template operations
export async function getAllEmailTemplates() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(emailTemplates);
  return result;
}

export async function getEmailTemplate(templateKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(emailTemplates)
    .where(eq(emailTemplates.templateKey, templateKey))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function saveEmailTemplate(template: InsertEmailTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if template already exists
  const existing = await getEmailTemplate(template.templateKey);
  
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
      .values(template)
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

export async function getEmailLogsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailLogs)
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
