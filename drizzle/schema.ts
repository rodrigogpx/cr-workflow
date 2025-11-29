import { pgTable, serial, integer, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Agora usando PostgreSQL (pg-core).
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  hashedPassword: text("hashedPassword").notNull(),
  // role pode ser null para usuários pendentes
  role: varchar("role", { length: 20 }).$type<"operator" | "admin">(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: false }).defaultNow().notNull(),
  // Campos opcionais para compatibilidade com OAuth legado
  openId: varchar("openId", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 50 }),
  perfil: varchar("perfil", { length: 50 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clients table - stores client information
 */
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  operatorId: integer("operatorId").notNull(),
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
  maritalStatus: varchar("maritalStatus", { length: 20 }),
  requestType: varchar("requestType", { length: 20 }),
  cacNumber: varchar("cacNumber", { length: 50 }),
  cacCategory: varchar("cacCategory", { length: 50 }),
  previousCrNumber: varchar("previousCrNumber", { length: 50 }),
  psychReportValidity: varchar("psychReportValidity", { length: 10 }),
  techReportValidity: varchar("techReportValidity", { length: 10 }),
  residenceUf: varchar("residenceUf", { length: 2 }),
  // Endereço
  cep: varchar("cep", { length: 10 }),
  address: varchar("address", { length: 255 }),
  addressNumber: varchar("addressNumber", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  city: varchar("city", { length: 100 }),
  complement: varchar("complement", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Workflow steps table - tracks progress for each client
 */
export const workflowSteps = pgTable("workflowSteps", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  stepId: varchar("stepId", { length: 100 }).notNull(),
  stepTitle: varchar("stepTitle", { length: 255 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt", { withTimezone: false }),
  // Campos para agendamento de laudo
  scheduledDate: timestamp("scheduledDate", { withTimezone: false }),
  examinerName: varchar("examinerName", { length: 255 }),
  // Campos para Acompanhamento Sinarm-CAC
  sinarmStatus: varchar("sinarmStatus", { length: 50 }),
  protocolNumber: varchar("protocolNumber", { length: 100 }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

/**
 * Sub-tasks table - tracks sub-tasks for workflow steps
 */
export const subTasks = pgTable("subTasks", {
  id: serial("id").primaryKey(),
  workflowStepId: integer("workflowStepId").notNull(),
  subTaskId: varchar("subTaskId", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt", { withTimezone: false }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type SubTask = typeof subTasks.$inferSelect;
export type InsertSubTask = typeof subTasks.$inferInsert;

/**
 * Documents table - stores uploaded documents for each client
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  workflowStepId: integer("workflowStepId"),
  subTaskId: integer("subTaskId"), // ID da subtarefa associada ao documento
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: integer("fileSize"),
  uploadedBy: integer("uploadedBy").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
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
 * Email Templates table - stores email templates per module
 */
export const emailTemplates = pgTable("emailTemplates", {
  id: serial("id").primaryKey(),
  module: varchar("module", { length: 50 }).notNull().default('workflow-cr'), // 'workflow-cr', 'platform', etc
  templateKey: varchar("templateKey", { length: 100 }).notNull(), // 'welcome', 'process', 'status'
  templateTitle: varchar("templateTitle", { length: 255 }), // Human-readable title for display
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(), // HTML content from rich editor
  attachments: text("attachments"), // JSON array of attachment file keys [{fileName, fileKey, fileUrl}]
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

/**
 * Email Logs table - tracks sent emails
 */
export const emailLogs = pgTable("emailLogs", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  templateKey: varchar("templateKey", { length: 100 }).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sentAt", { withTimezone: false }).defaultNow().notNull(),
  sentBy: integer("sentBy").notNull(), // userId who sent the email
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