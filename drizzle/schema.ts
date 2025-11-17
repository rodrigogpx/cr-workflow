import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["operator", "admin"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clients table - stores client information
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  operatorId: int("operatorId").notNull(),
  
  // Dados pessoais adicionais
  identityNumber: varchar("identityNumber", { length: 50 }),
  identityIssueDate: varchar("identityIssueDate", { length: 10 }),
  identityIssuer: varchar("identityIssuer", { length: 50 }),
  identityUf: varchar("identityUf", { length: 2 }),
  birthDate: varchar("birthDate", { length: 10 }),
  birthCountry: varchar("birthCountry", { length: 100 }),
  birthUf: varchar("birthUf", { length: 2 }),
  birthPlace: varchar("birthPlace", { length: 255 }),
  gender: varchar("gender", { length: 1 }),
  profession: varchar("profession", { length: 255 }),
  otherProfession: varchar("otherProfession", { length: 255 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  currentActivities: text("currentActivities"),
  phone2: varchar("phone2", { length: 20 }),
  motherName: varchar("motherName", { length: 255 }),
  fatherName: varchar("fatherName", { length: 255 }),
  
  // Endereço
  cep: varchar("cep", { length: 10 }),
  address: varchar("address", { length: 255 }),
  addressNumber: varchar("addressNumber", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  city: varchar("city", { length: 100 }),
  complement: varchar("complement", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Workflow steps table - tracks progress for each client
 */
export const workflowSteps = mysqlTable("workflowSteps", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  stepId: varchar("stepId", { length: 100 }).notNull(),
  stepTitle: varchar("stepTitle", { length: 255 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  // Campos para agendamento de laudo
  scheduledDate: timestamp("scheduledDate"),
  examinerName: varchar("examinerName", { length: 255 }),
  // Campos para Acompanhamento Sinarm-CAC
  sinarmStatus: mysqlEnum("sinarmStatus", ["Solicitado", "Aguardando Baixa GRU", "Em Análise", "Correção Solicitada", "Deferido", "Indeferido"]),
  protocolNumber: varchar("protocolNumber", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

/**
 * Sub-tasks table - tracks sub-tasks for workflow steps
 */
export const subTasks = mysqlTable("subTasks", {
  id: int("id").autoincrement().primaryKey(),
  workflowStepId: int("workflowStepId").notNull(),
  subTaskId: varchar("subTaskId", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubTask = typeof subTasks.$inferSelect;
export type InsertSubTask = typeof subTasks.$inferInsert;

/**
 * Documents table - stores uploaded documents for each client
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  workflowStepId: int("workflowStepId"),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  documents: many(documents),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  operator: one(users, {
    fields: [clients.operatorId],
    references: [users.id],
  }),
  workflowSteps: many(workflowSteps),
  documents: many(documents),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one, many }) => ({
  client: one(clients, {
    fields: [workflowSteps.clientId],
    references: [clients.id],
  }),
  subTasks: many(subTasks),
  documents: many(documents),
}));

export const subTasksRelations = relations(subTasks, ({ one }) => ({
  workflowStep: one(workflowSteps, {
    fields: [subTasks.workflowStepId],
    references: [workflowSteps.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  workflowStep: one(workflowSteps, {
    fields: [documents.workflowStepId],
    references: [workflowSteps.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

/**
 * Email Templates table - stores email templates for Boas Vindas
 */
export const emailTemplates = mysqlTable("emailTemplates", {
  id: int("id").autoincrement().primaryKey(),
  templateKey: varchar("templateKey", { length: 100 }).notNull().unique(), // 'welcome', 'process', 'status'
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

/**
 * Email Logs table - tracks sent emails
 */
export const emailLogs = mysqlTable("emailLogs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  templateKey: varchar("templateKey", { length: 100 }).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  sentBy: int("sentBy").notNull(), // userId who sent the email
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  client: one(clients, {
    fields: [emailLogs.clientId],
    references: [clients.id],
  }),
  sentByUser: one(users, {
    fields: [emailLogs.sentBy],
    references: [users.id],
  }),
}));