import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    // Apenas atribui role se for o owner ou se role for explicitamente fornecida
    if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    // Novos usuários (não owner) ficam com role NULL até admin aprovar

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
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
  
  // Build insert object with only provided fields (no undefined, no null for optional fields)
  const insertData: any = {};
  
  // Required fields
  if (client.name) insertData.name = client.name;
  if (client.cpf) insertData.cpf = client.cpf;
  if (client.phone) insertData.phone = client.phone;
  if (client.email) insertData.email = client.email;
  if (client.operatorId) insertData.operatorId = client.operatorId;
  
  // Optional fields - only add if provided
  if (client.identityNumber) insertData.identityNumber = client.identityNumber;
  if (client.identityIssueDate) insertData.identityIssueDate = client.identityIssueDate;
  if (client.identityIssuer) insertData.identityIssuer = client.identityIssuer;
  if (client.identityUf) insertData.identityUf = client.identityUf;
  if (client.birthDate) insertData.birthDate = client.birthDate;
  if (client.birthCountry) insertData.birthCountry = client.birthCountry;
  if (client.birthUf) insertData.birthUf = client.birthUf;
  if (client.birthPlace) insertData.birthPlace = client.birthPlace;
  if (client.gender) insertData.gender = client.gender;
  if (client.profession) insertData.profession = client.profession;
  if (client.otherProfession) insertData.otherProfession = client.otherProfession;
  if (client.registrationNumber) insertData.registrationNumber = client.registrationNumber;
  if (client.currentActivities) insertData.currentActivities = client.currentActivities;
  if (client.phone2) insertData.phone2 = client.phone2;
  if (client.motherName) insertData.motherName = client.motherName;
  if (client.fatherName) insertData.fatherName = client.fatherName;
  if (client.cep) insertData.cep = client.cep;
  if (client.address) insertData.address = client.address;
  if (client.addressNumber) insertData.addressNumber = client.addressNumber;
  if (client.neighborhood) insertData.neighborhood = client.neighborhood;
  if (client.city) insertData.city = client.city;
  if (client.complement) insertData.complement = client.complement;
  
  console.log("[createClient] Insert data:", JSON.stringify(insertData, null, 2));
  
  const result = await db.insert(clients).values(insertData);
  return result[0].insertId;
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
  
  return await db.select().from(workflowSteps).where(eq(workflowSteps.clientId, clientId));
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
    const result = await db.insert(workflowSteps).values(step);
    return result[0].insertId;
  }
}

export async function upsertSubTask(task: InsertSubTask & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (task.id) {
    await db.update(subTasks).set(task).where(eq(subTasks.id, task.id));
    return task.id;
  } else {
    const result = await db.insert(subTasks).values(task);
    return result[0].insertId;
  }
}

// Document operations
export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(documents).values(doc);
  return result[0].insertId;
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

export async function updateUserRole(userId: number, role: "operator" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// Email template operations
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
        subject: template.subject,
        content: template.content,
        updatedAt: new Date()
      })
      .where(eq(emailTemplates.id, existing.id));
    return existing.id;
  } else {
    // Insert new template
    const result = await db.insert(emailTemplates).values(template);
    return result[0].insertId;
  }
}

export async function logEmailSent(log: InsertEmailLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emailLogs).values(log);
  return result[0].insertId;
}

export async function getEmailLogsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailLogs)
    .where(eq(emailLogs.clientId, clientId))
    .orderBy(desc(emailLogs.sentAt));
}

export async function checkEmailSent(clientId: number, templateKey: string) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select().from(emailLogs)
    .where(and(
      eq(emailLogs.clientId, clientId),
      eq(emailLogs.templateKey, templateKey)
    ))
    .limit(1);
  
  return result.length > 0;
}
