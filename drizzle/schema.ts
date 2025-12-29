import { pgTable, serial, integer, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Agora usando PostgreSQL (pg-core).
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"), // null = platform user, populated = tenant user
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  hashedPassword: text("hashedPassword").notNull(),
  // role pode ser null para usuários pendentes
  role: varchar("role", { length: 20 }).$type<"operator" | "admin" | "despachante">(),
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
  tenantId: integer("tenantId"), // tenant isolation (nullable for migration)
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
  sentBy: integer("sentBy").notNull(),
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

/**
 * Email Triggers table - automation rules for sending emails
 */
export const emailTriggers = pgTable("emailTriggers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  name: varchar("name", { length: 100 }).notNull(),
  triggerEvent: varchar("triggerEvent", { length: 100 }).notNull(), // 'CLIENT_CREATED', 'STEP_COMPLETED:2', 'SCHEDULE_CREATED', etc
  // Destinatários
  recipientType: varchar("recipientType", { length: 20 }).notNull().default('client'), // 'client', 'users', 'both', 'operator'
  recipientUserIds: text("recipientUserIds"), // JSON array: [1, 5, 12]
  // Agendamento
  sendImmediate: boolean("sendImmediate").default(true).notNull(),
  sendBeforeHours: integer("sendBeforeHours"), // Horas antes do evento (ex: 24)
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type EmailTrigger = typeof emailTriggers.$inferSelect;
export type InsertEmailTrigger = typeof emailTriggers.$inferInsert;

/**
 * Email Trigger Templates - links triggers to templates (N:N)
 */
export const emailTriggerTemplates = pgTable("emailTriggerTemplates", {
  id: serial("id").primaryKey(),
  triggerId: integer("triggerId").notNull(),
  templateId: integer("templateId").notNull(),
  sendOrder: integer("sendOrder").default(1).notNull(),
  isForReminder: boolean("isForReminder").default(false).notNull(), // true = lembrete (24h antes)
});

export type EmailTriggerTemplate = typeof emailTriggerTemplates.$inferSelect;
export type InsertEmailTriggerTemplate = typeof emailTriggerTemplates.$inferInsert;

export const emailTriggerTemplatesRelations = relations(emailTriggerTemplates, ({ one }) => ({
  trigger: one(emailTriggers, {
    fields: [emailTriggerTemplates.triggerId],
    references: [emailTriggers.id],
  }),
  template: one(emailTemplates, {
    fields: [emailTriggerTemplates.templateId],
    references: [emailTemplates.id],
  }),
}));

/**
 * Email Scheduled - emails to be sent later (reminders)
 */
export const emailScheduled = pgTable("emailScheduled", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  clientId: integer("clientId").notNull(),
  triggerId: integer("triggerId").notNull(),
  templateId: integer("templateId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  recipientName: varchar("recipientName", { length: 255 }),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  scheduledFor: timestamp("scheduledFor", { withTimezone: false }).notNull(),
  referenceDate: timestamp("referenceDate", { withTimezone: false }),
  status: varchar("status", { length: 20 }).default('pending').notNull(), // 'pending', 'sent', 'cancelled', 'failed'
  sentAt: timestamp("sentAt", { withTimezone: false }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type EmailScheduled = typeof emailScheduled.$inferSelect;
export type InsertEmailScheduled = typeof emailScheduled.$inferInsert;

export const emailScheduledRelations = relations(emailScheduled, ({ one }) => ({
  client: one(clients, {
    fields: [emailScheduled.clientId],
    references: [clients.id],
  }),
  trigger: one(emailTriggers, {
    fields: [emailScheduled.triggerId],
    references: [emailTriggers.id],
  }),
  template: one(emailTemplates, {
    fields: [emailScheduled.templateId],
    references: [emailTemplates.id],
  }),
}));

/**
 * ============================================
 * MULTI-TENANT TABLES (Platform Admin Database)
 * ============================================
 */

/**
 * Tenants table - stores tenant/club information
 */
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(), // URL slug: clubeX.cac360.com
  name: varchar("name", { length: 255 }).notNull(),
  // Database connection
  dbHost: varchar("dbHost", { length: 255 }).notNull(),
  dbPort: integer("dbPort").default(5432).notNull(),
  dbName: varchar("dbName", { length: 100 }).notNull(),
  dbUser: varchar("dbUser", { length: 100 }).notNull(),
  dbPassword: text("dbPassword").notNull(), // Encrypted
  // Branding
  logo: varchar("logo", { length: 500 }),
  favicon: varchar("favicon", { length: 500 }),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#1a5c00"),
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#4d9702"),
  // Features enabled
  featureWorkflowCR: boolean("featureWorkflowCR").default(true),
  featureApostilamento: boolean("featureApostilamento").default(false),
  featureRenovacao: boolean("featureRenovacao").default(false),
  featureInsumos: boolean("featureInsumos").default(false),
  // Email Settings (per tenant)
  emailMethod: varchar("emailMethod", { length: 20 }).default("gateway").$type<"smtp" | "gateway">(), // smtp = direto, gateway = HTTP relay
  smtpHost: varchar("smtpHost", { length: 255 }),
  smtpPort: integer("smtpPort").default(587),
  smtpUser: varchar("smtpUser", { length: 255 }),
  smtpPassword: text("smtpPassword"),
  smtpFrom: varchar("smtpFrom", { length: 255 }),
  // Storage
  storageBucket: varchar("storageBucket", { length: 255 }),
  backupSchedule: varchar("backupSchedule", { length: 50 }).default("0 3 * * *"),
  // Limits
  maxUsers: integer("maxUsers").default(10),
  maxClients: integer("maxClients").default(500),
  maxStorageGB: integer("maxStorageGB").default(50),
  // Subscription
  plan: varchar("plan", { length: 20 }).default("starter").$type<"starter" | "professional" | "enterprise">(),
  subscriptionStatus: varchar("subscriptionStatus", { length: 20 }).default("trial").$type<"active" | "suspended" | "trial" | "cancelled">(),
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt", { withTimezone: false }),
  // Metadata
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/**
 * Platform Admins - Super admins who manage all tenants
 */
export const platformAdmins = pgTable("platformAdmins", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  hashedPassword: text("hashedPassword").notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 }).default("admin").$type<"superadmin" | "admin" | "support">(),
  isActive: boolean("isActive").default(true).notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: false }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type InsertPlatformAdmin = typeof platformAdmins.$inferInsert;

/**
 * Tenant Activity Logs - audit trail for tenant operations
 */
export const tenantActivityLogs = pgTable("tenantActivityLogs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // created, updated, suspended, backup, etc.
  details: text("details"), // JSON with action details
  performedBy: integer("performedBy"), // platformAdminId
  performedAt: timestamp("performedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type TenantActivityLog = typeof tenantActivityLogs.$inferSelect;
export type InsertTenantActivityLog = typeof tenantActivityLogs.$inferInsert;

/**
 * Audit Logs - Security and compliance audit trail
 */
export const auditLogs = pgTable("auditLogs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId"), // Nullable for system actions or deleted users
  action: varchar("action", { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, DOWNLOAD, etc
  entity: varchar("entity", { length: 50 }).notNull(), // CLIENT, DOCUMENT, USER, WORKFLOW, SETTINGS
  entityId: integer("entityId"), // ID of the affected entity
  details: text("details"), // JSON string or text description
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));