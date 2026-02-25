-- Migração para habilitar Row-Level Security (RLS) no modo Single-DB

-- 1. Habilitar RLS nas tabelas principais
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflowSteps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subTasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emailLogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emailTriggers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emailTriggerTemplates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emailScheduled" ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas de isolamento (Policies)
-- A variável 'app.current_tenant_id' deve ser setada na sessão do banco via 'SET LOCAL'

-- Política para Users
CREATE POLICY tenant_isolation_policy ON "users"
    AS RESTRICTIVE
    USING ("tenantId" = current_setting('app.current_tenant_id')::integer);

-- Política para Clients
CREATE POLICY tenant_isolation_policy ON "clients"
    AS RESTRICTIVE
    USING ("tenantId" = current_setting('app.current_tenant_id')::integer);

-- Política para Documents
-- Como documents pode não ter tenantId diretamente, ele liga com client.
-- Mas vamos assumir que tem ou se liga via clientId
-- UPDATE: Adicionar tenantId em documents se não existir para simplificar RLS
-- Por enquanto, fazer join com clients
CREATE POLICY tenant_isolation_policy ON "documents"
    AS RESTRICTIVE
    USING (
        EXISTS (
            SELECT 1 FROM "clients" c 
            WHERE c.id = "documents"."clientId" 
            AND c."tenantId" = current_setting('app.current_tenant_id')::integer
        )
    );

-- Política para WorkflowSteps
CREATE POLICY tenant_isolation_policy ON "workflowSteps"
    AS RESTRICTIVE
    USING (
        EXISTS (
            SELECT 1 FROM "clients" c 
            WHERE c.id = "workflowSteps"."clientId" 
            AND c."tenantId" = current_setting('app.current_tenant_id')::integer
        )
    );

-- Política para SubTasks
CREATE POLICY tenant_isolation_policy ON "subTasks"
    AS RESTRICTIVE
    USING (
        EXISTS (
            SELECT 1 FROM "workflowSteps" w
            JOIN "clients" c ON c.id = w."clientId"
            WHERE w.id = "subTasks"."workflowStepId" 
            AND c."tenantId" = current_setting('app.current_tenant_id')::integer
        )
    );

-- Política para EmailLogs
CREATE POLICY tenant_isolation_policy ON "emailLogs"
    AS RESTRICTIVE
    USING (
        EXISTS (
            SELECT 1 FROM "clients" c 
            WHERE c.id = "emailLogs"."clientId" 
            AND c."tenantId" = current_setting('app.current_tenant_id')::integer
        )
    );

-- Política para EmailTriggers
CREATE POLICY tenant_isolation_policy ON "emailTriggers"
    AS RESTRICTIVE
    USING ("tenantId" = current_setting('app.current_tenant_id')::integer);

-- Política para EmailTriggerTemplates
CREATE POLICY tenant_isolation_policy ON "emailTriggerTemplates"
    AS RESTRICTIVE
    USING ("tenantId" = current_setting('app.current_tenant_id')::integer);

-- Política para EmailScheduled
CREATE POLICY tenant_isolation_policy ON "emailScheduled"
    AS RESTRICTIVE
    USING (
        EXISTS (
            SELECT 1 FROM "clients" c 
            WHERE c.id = "emailScheduled"."clientId" 
            AND c."tenantId" = current_setting('app.current_tenant_id')::integer
        )
    );

-- 3. Bypass para Super Admins
-- Para permitir que Super Admins acessem sem restrições de tenant
-- Podemos adicionar uma política que permite acesso se o tenant_id não estiver setado
-- ou se for uma role específica de superadmin.
-- Como estamos setando o tenant_id na conexão, o bypass não é estritamente necessário
-- se os super admins não usarem as conexões com SET LOCAL app.current_tenant_id.
