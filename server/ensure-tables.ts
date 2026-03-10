import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { hashPassword } from "./_core/auth";

export async function ensureMissingTables() {
  const db = await getDb();
  if (!db) {
    console.error("[Migration] Database connection not available");
    return;
  }

  try {
    // Tenants
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" serial PRIMARY KEY NOT NULL,
        "slug" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "dbHost" varchar(255) NOT NULL,
        "dbPort" integer DEFAULT 5432 NOT NULL,
        "dbName" varchar(100) NOT NULL,
        "dbUser" varchar(100) NOT NULL,
        "dbPassword" text NOT NULL,
        "logo" varchar(500),
        "favicon" varchar(500),
        "primaryColor" varchar(7) DEFAULT '#1a5c00',
        "secondaryColor" varchar(7) DEFAULT '#4d9702',
        "featureWorkflowCR" boolean DEFAULT true,
        "featureApostilamento" boolean DEFAULT false,
        "featureRenovacao" boolean DEFAULT false,
        "featureInsumos" boolean DEFAULT false,
        "featureIAT" boolean DEFAULT false,
        "emailMethod" varchar(20) DEFAULT 'gateway',
        "smtpHost" varchar(255),
        "smtpPort" integer DEFAULT 587,
        "smtpUser" varchar(255),
        "smtpPassword" text,
        "smtpFrom" varchar(255),
        "postmanGpxBaseUrl" varchar(500),
        "postmanGpxApiKey" text,
        "storageBucket" varchar(255),
        "backupSchedule" varchar(50) DEFAULT '0 3 * * *',
        "maxUsers" integer DEFAULT 10,
        "maxClients" integer DEFAULT 500,
        "maxStorageGB" integer DEFAULT 50,
        "plan" varchar(20) DEFAULT 'starter',
        "subscriptionStatus" varchar(20) DEFAULT 'trial',
        "subscriptionExpiresAt" timestamp,
        "isActive" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
      );
    `);

    // Ensure new columns exist for existing installations
    await db.execute(sql`
      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "postmanGpxBaseUrl" varchar(500);
    `);
    await db.execute(sql`
      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "postmanGpxApiKey" text;
    `);

    // Platform Settings
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "platformSettings" (
        "id" serial PRIMARY KEY NOT NULL,
        "key" varchar(120) NOT NULL,
        "value" text NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "platformSettings_key_unique" UNIQUE("key")
      );
    `);

    // Platform Admins
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "platformAdmins" (
        "id" serial PRIMARY KEY NOT NULL,
        "email" varchar(320) NOT NULL,
        "hashedPassword" text NOT NULL,
        "name" varchar(255),
        "role" varchar(20) DEFAULT 'admin',
        "isActive" boolean DEFAULT true NOT NULL,
        "lastSignedIn" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "platformAdmins_email_unique" UNIQUE("email")
      );
    `);

    // Tenant Activity Logs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "tenantActivityLogs" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "action" varchar(100) NOT NULL,
        "details" text,
        "performedBy" integer,
        "performedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Audit Logs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "auditLogs" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "userId" integer,
        "action" varchar(50) NOT NULL,
        "entity" varchar(50) NOT NULL,
        "entityId" integer,
        "details" text,
        "ipAddress" varchar(45),
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Email Templates
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "emailTemplates" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer,
        "module" varchar(50) DEFAULT 'workflow-cr' NOT NULL,
        "templateKey" varchar(100) NOT NULL,
        "templateTitle" varchar(255),
        "subject" varchar(255) NOT NULL,
        "content" text NOT NULL,
        "attachments" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Ensure tenantId exists for existing installations
    await db.execute(sql`
      ALTER TABLE "emailTemplates"
        ADD COLUMN IF NOT EXISTS "tenantId" integer;
    `);

    // Email Triggers
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "emailTriggers" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer,
        "name" varchar(100) NOT NULL,
        "triggerEvent" varchar(100) NOT NULL,
        "recipientType" varchar(20) DEFAULT 'client' NOT NULL,
        "recipientUserIds" text,
        "sendImmediate" boolean DEFAULT true NOT NULL,
        "sendBeforeHours" integer,
        "isActive" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Email Trigger Templates
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "emailTriggerTemplates" (
        "id" serial PRIMARY KEY NOT NULL,
        "triggerId" integer NOT NULL,
        "templateId" integer NOT NULL,
        "sendOrder" integer DEFAULT 1 NOT NULL,
        "isForReminder" boolean DEFAULT false NOT NULL
      );
    `);

    // Email Scheduled
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "emailScheduled" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer,
        "clientId" integer NOT NULL,
        "triggerId" integer NOT NULL,
        "templateId" integer NOT NULL,
        "recipientEmail" varchar(320) NOT NULL,
        "recipientName" varchar(255),
        "subject" varchar(255) NOT NULL,
        "content" text NOT NULL,
        "scheduledFor" timestamp NOT NULL,
        "referenceDate" timestamp,
        "status" varchar(20) DEFAULT 'pending' NOT NULL,
        "sentAt" timestamp,
        "errorMessage" text,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // IAT Instructors
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "iat_instructors" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "userId" integer,
        "name" varchar(255) NOT NULL,
        "cpf" varchar(20),
        "cr_number" varchar(50),
        "phone" varchar(20),
        "email" varchar(255),
        "is_pf_accredited" boolean DEFAULT false NOT NULL,
        "pf_accreditation_number" varchar(100),
        "signature_image" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // IAT Courses
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "iat_courses" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "workload_hours" integer DEFAULT 0,
        "course_type" varchar(100) NOT NULL,
        "institution_name" varchar(255),
        "completion_date" timestamp,
        "is_active" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Add new columns to iat_courses if missing (for existing tables)
    await db.execute(sql`ALTER TABLE "iat_courses" ADD COLUMN IF NOT EXISTS "institution_name" varchar(255);`);
    await db.execute(sql`ALTER TABLE "iat_courses" ADD COLUMN IF NOT EXISTS "completion_date" timestamp;`);

    // IAT Schedules
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "iat_schedules" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "scheduleType" varchar(20) NOT NULL,
        "courseId" integer,
        "examId" integer,
        "instructorId" integer,
        "scheduledDate" timestamp NOT NULL,
        "scheduledTime" varchar(10),
        "location" varchar(255),
        "title" varchar(255) NOT NULL,
        "notes" text,
        "status" varchar(50) DEFAULT 'agendado' NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // IAT Exams
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "iat_exams" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "clientId" integer NOT NULL,
        "instructorId" integer NOT NULL,
        "courseId" integer,
        "scheduled_date" timestamp,
        "exam_type" varchar(100) NOT NULL,
        "status" varchar(50) DEFAULT 'agendado' NOT NULL,
        "weapon_type" varchar(100),
        "score" varchar(50),
        "observations" text,
        "laudo_pdf_url" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Alter tenants to add featureIAT if missing
    await db.execute(sql`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "featureIAT" boolean DEFAULT false;
    `);

    // IAT Course Classes (Turmas)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "iat_course_classes" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "courseId" integer NOT NULL,
        "instructorId" integer,
        "classNumber" varchar(50),
        "title" varchar(255),
        "scheduledDate" timestamp,
        "scheduledTime" varchar(10),
        "location" varchar(255),
        "maxStudents" integer,
        "status" varchar(30) DEFAULT 'agendada' NOT NULL,
        "notes" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // IAT Class Enrollments (Matrículas)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "iat_class_enrollments" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenantId" integer NOT NULL,
        "classId" integer NOT NULL,
        "clientId" integer NOT NULL,
        "status" varchar(30) DEFAULT 'inscrito' NOT NULL,
        "enrolledAt" timestamp DEFAULT now() NOT NULL,
        "completedAt" timestamp,
        "certificateUrl" text,
        "certificateIssuedAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Sinarm Comments History
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "sinarmCommentsHistory" (
        "id" serial PRIMARY KEY NOT NULL,
        "workflowStepId" integer NOT NULL,
        "oldStatus" varchar(50),
        "newStatus" varchar(50) NOT NULL,
        "comment" text NOT NULL,
        "createdBy" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Add sinarmOpenDate to workflowSteps if missing
    await db.execute(sql`
      ALTER TABLE "workflowSteps" ADD COLUMN IF NOT EXISTS "sinarmOpenDate" timestamp;
    `);

    // Add protocolNumber to workflowSteps if missing
    await db.execute(sql`
      ALTER TABLE "workflowSteps" ADD COLUMN IF NOT EXISTS "protocolNumber" varchar(100);
    `);

    // Migrate CPF unique constraint: UNIQUE(cpf) -> UNIQUE(tenantId, cpf) for tenant isolation
    try {
      await db.execute(sql`ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_cpf_unique";`);
      await db.execute(sql`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'clients_tenantId_cpf_unique'
          ) THEN
            ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_cpf_unique" UNIQUE ("tenantId", "cpf");
          END IF;
        END $$;
      `);
    } catch (cpfErr) {
      console.error("[Migration] Error migrating CPF constraint:", cpfErr);
    }

    // Ensure default platform admin exists
    try {
      const adminEmails = process.env.SUPER_ADMIN_EMAILS 
        ? process.env.SUPER_ADMIN_EMAILS.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
        : ['admin@acrdigital.com.br', 'admin@acedigital.com.br'];
        
      if (adminEmails.length > 0) {
        const hashedPassword = await hashPassword('admin123'); // Default password, they should change it
        
        for (const email of adminEmails) {
          // Check if it already exists - handle both array and { rows: [] } formats from drizzle-orm
          const rawResult = await db.execute(sql`SELECT id FROM "platformAdmins" WHERE email = ${email} LIMIT 1`);
          const rows = Array.isArray(rawResult) ? rawResult : (rawResult as any)?.rows ?? [];
          
          if (!rows || rows.length === 0) {
            await db.execute(sql`
              INSERT INTO "platformAdmins" ("email", "hashedPassword", "name", "isActive", "createdAt", "updatedAt")
              VALUES (${email}, ${hashedPassword}, 'Platform Admin', true, now(), now());
            `);
          } else {
            await db.execute(sql`UPDATE "platformAdmins" SET "hashedPassword" = ${hashedPassword}, "updatedAt" = now() WHERE email = ${email}`);
          }

          // Also ensure admin exists in users table for tenant login
          const userResult = await db.execute(sql`SELECT id FROM "users" WHERE email = ${email} LIMIT 1`);
          const userRows = Array.isArray(userResult) ? userResult : (userResult as any)?.rows ?? [];
          if (!userRows || userRows.length === 0) {
            await db.execute(sql`
              INSERT INTO "users" ("email", "hashedPassword", "name", "role", "perfil", "createdAt", "updatedAt")
              VALUES (${email}, ${hashedPassword}, 'Administrador', 'admin', 'admin', now(), now());
            `);
          } else {
            await db.execute(sql`UPDATE "users" SET "hashedPassword" = ${hashedPassword}, "updatedAt" = now() WHERE email = ${email}`);
          }
        }
      }
    } catch (adminErr) {
      console.error("[Migration] Error ensuring platform admins:", adminErr);
    }
  } catch (error) {
    console.error("[Migration] Error creating tables:", error);
  }
}
