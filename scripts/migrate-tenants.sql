-- =============================================
-- CAC 360 - Migration: Multi-Tenant Tables
-- Execute este script no banco de dados PostgreSQL
-- =============================================

-- Tabela de Tenants (clubes)
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  -- Database connection
  "dbHost" VARCHAR(255) NOT NULL,
  "dbPort" INTEGER DEFAULT 5432 NOT NULL,
  "dbName" VARCHAR(100) NOT NULL,
  "dbUser" VARCHAR(100) NOT NULL,
  "dbPassword" TEXT NOT NULL,
  -- Branding
  logo VARCHAR(500),
  favicon VARCHAR(500),
  "primaryColor" VARCHAR(7) DEFAULT '#1a5c00',
  "secondaryColor" VARCHAR(7) DEFAULT '#4d9702',
  -- Features enabled
  "featureWorkflowCR" BOOLEAN DEFAULT TRUE,
  "featureApostilamento" BOOLEAN DEFAULT FALSE,
  "featureRenovacao" BOOLEAN DEFAULT FALSE,
  "featureInsumos" BOOLEAN DEFAULT FALSE,
  -- SMTP Settings
  "smtpHost" VARCHAR(255),
  "smtpPort" INTEGER DEFAULT 587,
  "smtpUser" VARCHAR(255),
  "smtpPassword" TEXT,
  "smtpFrom" VARCHAR(255),
  -- Storage
  "storageBucket" VARCHAR(255),
  "backupSchedule" VARCHAR(50) DEFAULT '0 3 * * *',
  -- Limits
  "maxUsers" INTEGER DEFAULT 10,
  "maxClients" INTEGER DEFAULT 500,
  "maxStorageGB" INTEGER DEFAULT 50,
  -- Subscription
  plan VARCHAR(20) DEFAULT 'starter',
  "subscriptionStatus" VARCHAR(20) DEFAULT 'trial',
  "subscriptionExpiresAt" TIMESTAMP,
  -- Metadata
  "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela de Platform Admins (Super Admins)
CREATE TABLE IF NOT EXISTS "platformAdmins" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  "hashedPassword" TEXT NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'admin',
  "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
  "lastSignedIn" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela de Activity Logs
CREATE TABLE IF NOT EXISTS "tenantActivityLogs" (
  id SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  "performedBy" INTEGER,
  "performedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants("isActive");
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants("subscriptionStatus");
CREATE INDEX IF NOT EXISTS idx_activity_tenant ON "tenantActivityLogs"("tenantId");
CREATE INDEX IF NOT EXISTS idx_activity_date ON "tenantActivityLogs"("performedAt");

-- Comentários nas tabelas
COMMENT ON TABLE tenants IS 'Tabela principal de tenants/clubes do CAC 360';
COMMENT ON TABLE "platformAdmins" IS 'Super administradores da plataforma';
COMMENT ON TABLE "tenantActivityLogs" IS 'Logs de atividade dos tenants';

-- =============================================
-- DADOS INICIAIS (Opcional)
-- =============================================

-- Inserir tenant padrão para desenvolvimento
INSERT INTO tenants (
  slug, 
  name, 
  "dbHost", 
  "dbName", 
  "dbUser", 
  "dbPassword", 
  "featureWorkflowCR", 
  plan, 
  "subscriptionStatus"
)
VALUES (
  'default', 
  'CAC 360 - Demo', 
  'localhost', 
  'cac360_default', 
  'cac360_user', 
  'change_this_password', 
  TRUE, 
  'enterprise', 
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- Verificar se as tabelas foram criadas
-- =============================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('tenants', 'platformAdmins', 'tenantActivityLogs')
ORDER BY table_name;
