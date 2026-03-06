-- Migration: Add tenantId to dependent tables for proper multi-tenant isolation
-- Date: 2025-01-28 15:00
-- Description: Adds tenantId column to tables that depend on clients/users for tenant isolation

-- 1. Add tenantId column to workflowSteps
ALTER TABLE "workflowSteps" ADD COLUMN "tenantId" INTEGER;

-- 2. Add tenantId column to documents
ALTER TABLE documents ADD COLUMN "tenantId" INTEGER;

-- 3. Add tenantId column to subTasks
ALTER TABLE "subTasks" ADD COLUMN "tenantId" INTEGER;

-- 4. Add tenantId column to emailLogs
ALTER TABLE "emailLogs" ADD COLUMN "tenantId" INTEGER;

-- 5. Add tenantId column to sinarmCommentsHistory
ALTER TABLE "sinarmCommentsHistory" ADD COLUMN "tenantId" INTEGER;

-- 6. Populate tenantId in workflowSteps from clients
UPDATE "workflowSteps" ws
SET "tenantId" = c."tenantId"
FROM clients c
WHERE ws."clientId" = c.id
AND c."tenantId" IS NOT NULL;

-- 7. Populate tenantId in documents from clients
UPDATE documents d
SET "tenantId" = c."tenantId"
FROM clients c
WHERE d."clientId" = c.id
AND c."tenantId" IS NOT NULL;

-- 8. Populate tenantId in subTasks from workflowSteps
UPDATE "subTasks" st
SET "tenantId" = ws."tenantId"
FROM "workflowSteps" ws
WHERE st."workflowStepId" = ws.id
AND ws."tenantId" IS NOT NULL;

-- 9. Populate tenantId in emailLogs from clients
UPDATE "emailLogs" el
SET "tenantId" = c."tenantId"
FROM clients c
WHERE el."clientId" = c.id
AND c."tenantId" IS NOT NULL;

-- 10. Populate tenantId in sinarmCommentsHistory from workflowSteps
UPDATE "sinarmCommentsHistory" sch
SET "tenantId" = ws."tenantId"
FROM "workflowSteps" ws
WHERE sch."workflowStepId" = ws.id
AND ws."tenantId" IS NOT NULL;

-- 11. Create indexes for performance (critical for multi-tenant queries)
CREATE INDEX IF NOT EXISTS idx_workflowSteps_tenantId ON "workflowSteps"("tenantId");
CREATE INDEX IF NOT EXISTS idx_documents_tenantId ON documents("tenantId");
CREATE INDEX IF NOT EXISTS idx_subTasks_tenantId ON "subTasks"("tenantId");
CREATE INDEX IF NOT EXISTS idx_emailLogs_tenantId ON "emailLogs"("tenantId");
CREATE INDEX IF NOT EXISTS idx_sinarmCommentsHistory_tenantId ON "sinarmCommentsHistory"("tenantId");

-- 12. Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_workflowSteps_clientId_tenantId ON "workflowSteps"("clientId", "tenantId");
CREATE INDEX IF NOT EXISTS idx_documents_clientId_tenantId ON documents("clientId", "tenantId");
CREATE INDEX IF NOT EXISTS idx_emailLogs_clientId_tenantId ON "emailLogs"("clientId", "tenantId");

-- Note: We're keeping tenantId as nullable for now to allow gradual migration
-- In a future migration, we can make it NOT NULL after ensuring all data is populated
