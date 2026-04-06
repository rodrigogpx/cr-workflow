import { pgTable, serial, integer, text, varchar, timestamp, boolean, unique, numeric } from "drizzle-orm/pg-core";
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
  cpf: varchar("cpf", { length: 14 }).notNull(),
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
  apostilamentoActivities: text("apostilamentoActivities"), // JSON string: ["atirador","cacador"]
  hasSecondCollectionAddress: boolean("hasSecondCollectionAddress").default(false),
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
  // Geolocalização / Segundo Endereço do Acervo
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  acervoCep: varchar("acervoCep", { length: 10 }),
  acervoAddress: varchar("acervoAddress", { length: 255 }),
  acervoAddressNumber: varchar("acervoAddressNumber", { length: 20 }),
  acervoNeighborhood: varchar("acervoNeighborhood", { length: 100 }),
  acervoCity: varchar("acervoCity", { length: 100 }),
  acervoUf: varchar("acervoUf", { length: 2 }),
  acervoComplement: varchar("acervoComplement", { length: 255 }),
  acervoLatitude: varchar("acervoLatitude", { length: 50 }),
  acervoLongitude: varchar("acervoLongitude", { length: 50 }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
}, (table: any) => [
  unique("clients_tenantId_cpf_unique").on(table.tenantId, table.cpf),
]);

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
  sinarmOpenDate: timestamp("sinarmOpenDate"),
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
  tenantId: integer("tenantId"), // nullable for migration, populated from workflowSteps
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
  tenantId: integer("tenantId"), // nullable for migration, populated from clients
  clientId: integer("clientId").notNull(),
  workflowStepId: integer("workflowStepId"),
  subTaskId: integer("subTaskId"), // ID da subtarefa associada ao documento
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: integer("fileSize"),
  uploadedBy: integer("uploadedBy").notNull(),
  issueDate: timestamp("issueDate", { withTimezone: false }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Relations
export const usersRelations = relations(users, ({ many }: any) => ({
  clients: many(clients),
  documents: many(documents),
}));

export const clientsRelations = relations(clients, ({ one, many }: any) => ({
  operator: one(users, {
    fields: [clients.operatorId],
    references: [users.id],
  }),
  workflowSteps: many(workflowSteps),
  documents: many(documents),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one, many }: any) => ({
  client: one(clients, {
    fields: [workflowSteps.clientId],
    references: [clients.id],
  }),
  subTasks: many(subTasks),
  documents: many(documents),
  sinarmComments: many(sinarmCommentsHistory),
}));

export const sinarmCommentsHistory = pgTable("sinarmCommentsHistory", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"), // nullable for migration, populated from workflowSteps
  workflowStepId: integer("workflowStepId").notNull(),
  oldStatus: varchar("oldStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }).notNull(),
  comment: text("comment").notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type SinarmCommentHistory = typeof sinarmCommentsHistory.$inferSelect;
export type InsertSinarmCommentHistory = typeof sinarmCommentsHistory.$inferInsert;

export const sinarmCommentsHistoryRelations = relations(sinarmCommentsHistory, ({ one }: any) => ({
  workflowStep: one(workflowSteps, {
    fields: [sinarmCommentsHistory.workflowStepId],
    references: [workflowSteps.id],
  }),
  user: one(users, {
    fields: [sinarmCommentsHistory.createdBy],
    references: [users.id],
  }),
}));

export const subTasksRelations = relations(subTasks, ({ one }: any) => ({
  workflowStep: one(workflowSteps, {
    fields: [subTasks.workflowStepId],
    references: [workflowSteps.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }: any) => ({
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
  tenantId: integer("tenantId"), // null = global default template, populated = tenant specific template
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

export const emailLogsRelations = relations(emailLogs, ({ one }: any) => ({
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

export const emailTriggerTemplatesRelations = relations(emailTriggerTemplates, ({ one }: any) => ({
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

export const emailScheduledRelations = relations(emailScheduled, ({ one }: any) => ({
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
  featureIAT: boolean("featureIAT").default(false),
  // Email Settings (per tenant)
  emailMethod: varchar("emailMethod", { length: 20 }).default("gateway").$type<"smtp" | "gateway">(), // smtp = direto, gateway = HTTP relay
  smtpHost: varchar("smtpHost", { length: 255 }),
  smtpPort: integer("smtpPort").default(587),
  smtpUser: varchar("smtpUser", { length: 255 }),
  smtpPassword: text("smtpPassword"),
  smtpFrom: varchar("smtpFrom", { length: 255 }),
  postmanGpxBaseUrl: varchar("postmanGpxBaseUrl", { length: 500 }),
  postmanGpxApiKey: text("postmanGpxApiKey"),
  // Email Logo (URL da imagem copiada do site do clube)
  emailLogoUrl: text("emailLogoUrl"),
  // Storage
  storageBucket: varchar("storageBucket", { length: 255 }),
  backupSchedule: varchar("backupSchedule", { length: 50 }).default("0 3 * * *"),
  // Limits
  maxUsers: integer("maxUsers").default(10),
  maxClients: integer("maxClients").default(500),
  maxStorageGB: numeric("maxStorageGB", { precision: 10, scale: 2 }).default("50"),
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
 * ============================================
 * Plan Definitions - Catálogo formal de planos
 * ============================================
 */
export const planDefinitions = pgTable("planDefinitions", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  maxUsers: integer("maxUsers").notNull().default(5),
  maxClients: integer("maxClients").notNull().default(100),
  maxStorageGB: numeric("maxStorageGB", { precision: 10, scale: 2 }).notNull().default("10"),
  featureWorkflowCR: boolean("featureWorkflowCR").notNull().default(true),
  featureApostilamento: boolean("featureApostilamento").notNull().default(false),
  featureRenovacao: boolean("featureRenovacao").notNull().default(false),
  featureInsumos: boolean("featureInsumos").notNull().default(false),
  featureIAT: boolean("featureIAT").notNull().default(false),
  priceMonthlyBRL: integer("priceMonthlyBRL").notNull().default(0),
  priceYearlyBRL: integer("priceYearlyBRL").notNull().default(0),
  setupFeeBRL: integer("setupFeeBRL").notNull().default(0),
  trialDays: integer("trialDays").notNull().default(14),
  displayOrder: integer("displayOrder").notNull().default(0),
  isPublic: boolean("isPublic").notNull().default(true),
  isActive: boolean("isActive").notNull().default(true),
  highlightLabel: varchar("highlightLabel", { length: 50 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type PlanDefinition = typeof planDefinitions.$inferSelect;
export type InsertPlanDefinition = typeof planDefinitions.$inferInsert;

/**
 * ============================================
 * Subscriptions - Histórico de assinaturas por tenant
 * ============================================
 */
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  planId: integer("planId").notNull(),
  startDate: timestamp("startDate", { withTimezone: true }).notNull(),
  endDate: timestamp("endDate", { withTimezone: true }),
  billingCycle: varchar("billingCycle", { length: 20 }).notNull().default("monthly"),
  priceBRL: integer("priceBRL").notNull(),
  discountBRL: integer("discountBRL").notNull().default(0),
  overrideMaxUsers: integer("overrideMaxUsers"),
  overrideMaxClients: integer("overrideMaxClients"),
  overrideMaxStorageGB: integer("overrideMaxStorageGB"),
  status: varchar("status", { length: 20 }).notNull().default("active").$type<"active" | "past_due" | "cancelled" | "expired" | "trialing">(),
  cancelledAt: timestamp("cancelledAt", { withTimezone: true }),
  cancelReason: text("cancelReason"),
  paymentGateway: varchar("paymentGateway", { length: 30 }),
  externalId: varchar("externalId", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer("createdBy"),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * ============================================
 * Invoices - Faturas geradas para tenants
 * ============================================
 */
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  subscriptionId: integer("subscriptionId"),
  periodStart: timestamp("periodStart", { withTimezone: true }).notNull(),
  periodEnd: timestamp("periodEnd", { withTimezone: true }).notNull(),
  subtotalBRL: integer("subtotalBRL").notNull(),
  discountBRL: integer("discountBRL").notNull().default(0),
  totalBRL: integer("totalBRL").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending").$type<"pending" | "paid" | "overdue" | "cancelled" | "refunded">(),
  dueDate: timestamp("dueDate", { withTimezone: true }).notNull(),
  paidAt: timestamp("paidAt", { withTimezone: true }),
  paymentMethod: varchar("paymentMethod", { length: 30 }),
  paymentReference: varchar("paymentReference", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * ============================================
 * Usage Snapshots - Foto diária de uso por tenant
 * ============================================
 */
export const usageSnapshots = pgTable("usageSnapshots", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  snapshotDate: timestamp("snapshotDate", { withTimezone: true }).notNull(),
  usersCount: integer("usersCount").notNull().default(0),
  clientsCount: integer("clientsCount").notNull().default(0),
  storageUsedGB: numeric("storageUsedGB", { precision: 10, scale: 3 }).notNull().default("0"),
  dbSizeMB: numeric("dbSizeMB", { precision: 10, scale: 1 }).notNull().default("0"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table: any) => [
  unique("usageSnapshots_tenantId_snapshotDate_unique").on(table.tenantId, table.snapshotDate),
]);

export type UsageSnapshot = typeof usageSnapshots.$inferSelect;
export type InsertUsageSnapshot = typeof usageSnapshots.$inferInsert;

/**
 * Platform Settings - key/value storage for install wizard configuration
 */
export const platformSettings = pgTable("platformSettings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 120 }).notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = typeof platformSettings.$inferInsert;

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
 * Platform Admin Audit Logs - audit trail for super admin operations
 */
export const platformAdminAuditLogs = pgTable("platformAdminAuditLogs", {
  id: serial("id").primaryKey(),
  platformAdminId: integer("platformAdminId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // TENANT_CREATE, TENANT_DELETE, IMPERSONATE, etc
  targetTenantId: integer("targetTenantId"),
  details: text("details"), // JSON with action details
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type PlatformAdminAuditLog = typeof platformAdminAuditLogs.$inferSelect;
export type InsertPlatformAdminAuditLog = typeof platformAdminAuditLogs.$inferInsert;

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

export const auditLogsRelations = relations(auditLogs, ({ one }: any) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

/**
 * ============================================
 * IAT MODULE TABLES
 * ============================================
 */

/**
 * IAT Instructors
 */
export const iatInstructors = pgTable("iat_instructors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId"), // Optional link to system user
  name: varchar("name", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 20 }),
  crNumber: varchar("cr_number", { length: 50 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  isPfAccredited: boolean("is_pf_accredited").default(false).notNull(),
  pfAccreditationNumber: varchar("pf_accreditation_number", { length: 100 }),
  signatureImage: text("signature_image"), // URL to uploaded signature
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type IatInstructor = typeof iatInstructors.$inferSelect;
export type InsertIatInstructor = typeof iatInstructors.$inferInsert;

export const iatInstructorsRelations = relations(iatInstructors, ({ one, many }: any) => ({
  user: one(users, {
    fields: [iatInstructors.userId],
    references: [users.id],
  }),
  exams: many(iatExams),
  classes: many(iatCourseClasses),
}));

/**
 * IAT Courses
 */
export const iatCourses = pgTable("iat_courses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  workloadHours: integer("workload_hours").default(0),
  courseType: varchar("course_type", { length: 100 }).notNull(), // Tiro Básico, Especialização, etc
  institutionName: varchar("institution_name", { length: 255 }), // Nome da instituição
  completionDate: timestamp("completion_date", { withTimezone: false }), // Data de conclusão
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type IatCourse = typeof iatCourses.$inferSelect;
export type InsertIatCourse = typeof iatCourses.$inferInsert;

export const iatCoursesRelations = relations(iatCourses, ({ many }: any) => ({
  exams: many(iatExams),
  schedules: many(iatSchedules),
  classes: many(iatCourseClasses),
}));

/**
 * IAT Schedules
 */
export const iatSchedules = pgTable("iat_schedules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  scheduleType: varchar("scheduleType", { length: 20 }).notNull(), // 'curso' or 'exame'
  courseId: integer("courseId"),
  examId: integer("examId"),
  instructorId: integer("instructorId"),
  scheduledDate: timestamp("scheduledDate", { withTimezone: false }).notNull(),
  scheduledTime: varchar("scheduledTime", { length: 10 }),
  location: varchar("location", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).default('agendado').notNull(), // agendado, realizado, cancelado
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type IatSchedule = typeof iatSchedules.$inferSelect;
export type InsertIatSchedule = typeof iatSchedules.$inferInsert;

export const iatSchedulesRelations = relations(iatSchedules, ({ one }: any) => ({
  course: one(iatCourses, {
    fields: [iatSchedules.courseId],
    references: [iatCourses.id],
  }),
  instructor: one(iatInstructors, {
    fields: [iatSchedules.instructorId],
    references: [iatInstructors.id],
  }),
  exam: one(iatExams, {
    fields: [iatSchedules.examId],
    references: [iatExams.id],
  }),
}));

/**
 * IAT Exams & Tests
 */
export const iatExams = pgTable("iat_exams", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  clientId: integer("clientId").notNull(),
  instructorId: integer("instructorId").notNull(),
  courseId: integer("courseId"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: false }),
  examType: varchar("exam_type", { length: 100 }).notNull(), // Laudo PF, Laudo Exército, Curso de Tiro
  status: varchar("status", { length: 50 }).default('agendado').notNull(), // agendado, realizado, aprovado, reprovado, cancelado
  weaponType: varchar("weapon_type", { length: 100 }), // Espécie de arma avaliada
  score: varchar("score", { length: 50 }),
  observations: text("observations"),
  laudoPdfUrl: text("laudo_pdf_url"),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type IatExam = typeof iatExams.$inferSelect;
export type InsertIatExam = typeof iatExams.$inferInsert;

export const iatExamsRelations = relations(iatExams, ({ one }: any) => ({
  client: one(clients, {
    fields: [iatExams.clientId],
    references: [clients.id],
  }),
  instructor: one(iatInstructors, {
    fields: [iatExams.instructorId],
    references: [iatInstructors.id],
  }),
  course: one(iatCourses, {
    fields: [iatExams.courseId],
    references: [iatCourses.id],
  }),
}));

/**
 * ============================================
 * IAT COURSE CLASSES (Turmas)
 * ============================================
 */
export const iatCourseClasses = pgTable("iat_course_classes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  courseId: integer("courseId").notNull(),
  instructorId: integer("instructorId"),
  classNumber: varchar("classNumber", { length: 50 }), // Ex: "01/2026"
  title: varchar("title", { length: 255 }),
  scheduledDate: timestamp("scheduledDate", { withTimezone: false }),
  scheduledTime: varchar("scheduledTime", { length: 10 }),
  location: varchar("location", { length: 255 }),
  maxStudents: integer("maxStudents"),
  status: varchar("status", { length: 30 }).default('agendada').notNull(), // agendada, em_andamento, concluida, cancelada
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type IatCourseClass = typeof iatCourseClasses.$inferSelect;
export type InsertIatCourseClass = typeof iatCourseClasses.$inferInsert;

export const iatCourseClassesRelations = relations(iatCourseClasses, ({ one, many }: any) => ({
  course: one(iatCourses, {
    fields: [iatCourseClasses.courseId],
    references: [iatCourses.id],
  }),
  instructor: one(iatInstructors, {
    fields: [iatCourseClasses.instructorId],
    references: [iatInstructors.id],
  }),
  enrollments: many(iatClassEnrollments),
}));

/**
 * ============================================
 * IAT CLASS ENROLLMENTS (Matrículas)
 * ============================================
 */
export const iatClassEnrollments = pgTable("iat_class_enrollments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  classId: integer("classId").notNull(),
  clientId: integer("clientId").notNull(),
  status: varchar("status", { length: 30 }).default('inscrito').notNull(), // inscrito, confirmado, concluido, cancelado
  enrolledAt: timestamp("enrolledAt", { withTimezone: false }).defaultNow().notNull(),
  completedAt: timestamp("completedAt", { withTimezone: false }),
  certificateUrl: text("certificateUrl"),
  certificateIssuedAt: timestamp("certificateIssuedAt", { withTimezone: false }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type IatClassEnrollment = typeof iatClassEnrollments.$inferSelect;
export type InsertIatClassEnrollment = typeof iatClassEnrollments.$inferInsert;

export const iatClassEnrollmentsRelations = relations(iatClassEnrollments, ({ one }: any) => ({
  courseClass: one(iatCourseClasses, {
    fields: [iatClassEnrollments.classId],
    references: [iatCourseClasses.id],
  }),
  client: one(clients, {
    fields: [iatClassEnrollments.clientId],
    references: [clients.id],
  }),
}));

/**
 * ============================================
 * Portal do Cliente — Tokens de Convite
 * Gerado ao criar cliente; usado para primeiro acesso
 * ============================================
 */
export const clientInviteTokens = pgTable("clientInviteTokens", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  tenantId: integer("tenantId"),
  token: varchar("token", { length: 64 }).notNull().unique(),
  activatedAt: timestamp("activatedAt", { withTimezone: false }),
  expiresAt: timestamp("expiresAt", { withTimezone: false }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type ClientInviteToken = typeof clientInviteTokens.$inferSelect;
export type InsertClientInviteToken = typeof clientInviteTokens.$inferInsert;

/**
 * ============================================
 * Portal do Cliente — Sessões Autenticadas
 * Criada após verificação email+CPF; válida 30 dias
 * ============================================
 */
export const clientPortalSessions = pgTable("clientPortalSessions", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  tenantId: integer("tenantId"),
  sessionToken: varchar("sessionToken", { length: 64 }).notNull().unique(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  lastSeenAt: timestamp("lastSeenAt", { withTimezone: false }).defaultNow(),
  expiresAt: timestamp("expiresAt", { withTimezone: false }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type ClientPortalSession = typeof clientPortalSessions.$inferSelect;
export type InsertClientPortalSession = typeof clientPortalSessions.$inferInsert;

/**
 * ============================================
 * Portal do Cliente — Consentimentos LGPD
 * Registra aceite do termo com IP e timestamp
 * ============================================
 */
export const lgpdConsents = pgTable("lgpdConsents", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  tenantId: integer("tenantId"),
  version: varchar("version", { length: 10 }).notNull().default("1.0"),
  acceptedAt: timestamp("acceptedAt", { withTimezone: false }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type LgpdConsent = typeof lgpdConsents.$inferSelect;
export type InsertLgpdConsent = typeof lgpdConsents.$inferInsert;

/**
 * ============================================
 * Portal do Cliente — Log de Atividades
 * Auditoria de tudo que o cliente faz no portal
 * ============================================
 */
export const clientPortalActivityLog = pgTable("clientPortalActivityLog", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  tenantId: integer("tenantId"),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type ClientPortalActivity = typeof clientPortalActivityLog.$inferSelect;

/**
 * ============================================
 * Portal do Cliente — Documentos Pendentes de Triagem
 * Arquivos enviados pelo cliente aguardando validação do operador
 * ============================================
 */
export const clientPendingDocuments = pgTable("clientPendingDocuments", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  tenantId: integer("tenantId"),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: integer("fileSize"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // pending | approved | rejected | linked
  linkedSubTaskId: integer("linkedSubTaskId"),
  rejectionReason: text("rejectionReason"),
  uploadedAt: timestamp("uploadedAt", { withTimezone: false }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt", { withTimezone: false }),
  issueDate: timestamp("issueDate", { withTimezone: false }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
});

export type ClientPendingDocument = typeof clientPendingDocuments.$inferSelect;
export type InsertClientPendingDocument = typeof clientPendingDocuments.$inferInsert;

/**
 * ============================================
 * Marketing — Leads de demonstração
 * Capturados pelo formulário público da landing page
 * ============================================
 */
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  clubName: varchar("clubName", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 20 }),
  message: text("message"),
  status: varchar("status", { length: 30 }).notNull().default("new"),
  // new | contacted | demo_scheduled | converted | lost
  source: varchar("source", { length: 50 }).default("landing"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
