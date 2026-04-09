# Auditoria de Isolamento entre Tenants

> Data: 09/04/2026 | Modo de operação em produção: **single-db** (todos os tenants no mesmo banco)

---

## Contexto Crítico

Em produção (`NODE_ENV === 'production'`), o sistema opera em modo **single-db**: a função `getTenantDbOrNull()` retorna o `platformDb` (banco compartilhado) para todos os tenants. Isso significa que **o isolamento depende exclusivamente de filtros `WHERE tenantId = X` em cada query**, e não da separação física de bancos.

---

## 1. Vulnerabilidades CRÍTICAS

### 1.1 `getClientByIdFromDb()` — tenantId opcional, NUNCA passado no router principal

**Arquivo:** `server/db.ts` (linha 851)

```ts
export async function getClientByIdFromDb(
  tenantDb, clientId: number, tenantId?: number  // ← tenantId é OPCIONAL
) {
  const conditions = [eq(clients.id, clientId)];
  if (tenantId) conditions.push(eq(clients.tenantId, tenantId)); // ← só filtra SE receber
  ...
}
```

**Chamadas no `server/routers.ts`** — todas SEM tenantId:
```ts
// Linha 580, 856, 898, 972, 1005, 1148, 1219, 1495, 1527, 1552, 1583, 1659, 1763, 1796, 1927
await db.getClientByIdFromDb(tenantDb, input.clientId)  // ← SEM terceiro parâmetro
```

**Impacto:** Um admin do Tenant A pode, em teoria, acessar dados de um cliente do Tenant B informando o `clientId` diretamente. Em single-db mode, `tenantDb` é o mesmo banco, então a query retorna `SELECT * FROM clients WHERE id = X` sem filtro de tenant.

**Mitigação parcial existente:** Após buscar o cliente, muitos handlers verificam `client.operatorId === ctx.user.id`, mas um usuário com `role: 'admin'` passa essa verificação sem restrição de tenant.

**Correção necessária:** Alterar TODAS as chamadas para:
```ts
await db.getClientByIdFromDb(tenantDb, input.clientId, ctx.tenant?.id)
```

---

### 1.2 `deleteClientFromDb()` — chamado sem tenantId

**Arquivo:** `server/routers.ts` (linha 1013)

```ts
await db.deleteClientFromDb(tenantDb, input.id);  // ← SEM tenantId
```

**Impacto:** Um admin poderia deletar um cliente de outro tenant. A função `deleteClientFromDb` faz cascade delete em `documents`, `workflowSteps`, `subTasks` e `clients` — perda de dados irreversível.

**Correção necessária:**
```ts
await db.deleteClientFromDb(tenantDb, input.id, ctx.tenant?.id);
```

---

### 1.3 `workflowSteps` — tabela SEM coluna tenantId

**Arquivo:** `drizzle/schema.ts`

A tabela `workflowSteps` não possui coluna `tenantId`. O isolamento depende de:
- RLS policy que faz JOIN com `clients` para verificar tenant
- A query buscar pelo `clientId` (que pertence a um tenant)

**Risco:** Se a RLS não estiver ativa na conexão (ex: migrations, seeds, scripts), qualquer workflowStep é visível. Além disso, queries diretas por `workflowSteps.id` sem JOIN com `clients` ignoram o isolamento.

**Correção recomendada (longo prazo):** Adicionar `tenantId` à tabela `workflowSteps` para isolamento direto.

---

### 1.4 `emailTriggerTemplates` — tabela sem tenantId no schema

**Arquivo:** `drizzle/schema.ts` (linha 306)

```ts
export const emailTriggerTemplates = pgTable("emailTriggerTemplates", {
  id: serial("id").primaryKey(),
  triggerId: integer("triggerId").notNull(),
  templateId: integer("templateId").notNull(),
  sendOrder: integer("sendOrder").default(1).notNull(),
  isForReminder: boolean("isForReminder").default(false).notNull(),
  // ← NÃO TEM tenantId
});
```

A política RLS existe no SQL (`0013_enable_rls.sql` linha 82) e referencia `tenantId`, mas **a coluna não existe na tabela**. A policy seria um no-op ou causaria erro.

**Correção necessária:** Adicionar `tenantId` à tabela ou ajustar o isolamento via JOIN com `emailTriggers`.

---

## 2. Vulnerabilidades MÉDIAS

### 2.1 `getTenantId()` no IAT router retorna 0 se não há tenant

**Arquivo:** `server/routers/iat.ts` (linha 20)

```ts
function getTenantId(ctx: any): number {
  return ctx?.tenant?.id ?? 0;  // ← fallback para 0 em vez de erro
}
```

**Risco:** Se por algum bug o middleware não setar o tenant, todas as queries do IAT filtrariam por `tenantId = 0`, o que retornaria dados vazios (bom) mas também permitiria INSERIR dados com `tenantId = 0` (ruim — dados "órfãos" que nenhum tenant consegue ver).

**Correção:**
```ts
function getTenantId(ctx: any): number {
  if (!ctx?.tenant?.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não identificado' });
  return ctx.tenant.id;
}
```

### 2.2 `getAllClientsFromDb()` — tenantId opcional

**Arquivo:** `server/db.ts` (linha 836)

```ts
export async function getAllClientsFromDb(tenantDb, tenantId?: number) {
  if (tenantId) {
    return tenantDb.select().from(clients).where(eq(clients.tenantId, tenantId))...;
  }
  return tenantDb.select().from(clients)...;  // ← SEM filtro
}
```

**Uso no router:** Felizmente, TODAS as chamadas no `routers.ts` passam `tenantId`:
```ts
await db.getAllClientsFromDb(tenantDb, tenantId)  // ✓ OK
```

**Risco residual:** Baixo atualmente, mas a API permite chamadas sem filtro. Recomendação: tornar `tenantId` obrigatório.

### 2.3 RLS depende de `SET LOCAL app.current_tenant_id`

**Arquivo:** `drizzle/0013_enable_rls.sql`

As policies usam `current_setting('app.current_tenant_id')::integer`. Se a aplicação não executar `SET LOCAL "app.current_tenant_id" = X` antes de cada transação, a RLS **não funciona**.

**Verificação necessária:** Confirmar que `getTenantDb()` ou a connection pool seta essa variável de sessão. Se não seta, o RLS é **ineficaz**.

---

## 3. Pontos OK (✓)

| Área | Status | Detalhe |
|------|--------|---------|
| IAT router (todas as 35 procedures) | ✓ | Todas filtram por `tenantId` via `getTenantId(ctx)` |
| `getAllClientsFromDb` chamadas | ✓ | Sempre passam `tenantId` |
| Schema IAT (8 tabelas) | ✓ | Todas têm `tenantId` |
| Schema core (clients, users, documents) | ✓ | Todas têm `tenantId` |
| Middleware `iatProcedure` | ✓ | Usa `strictTenantProcedure` + feature gate |
| Bulk enrollment | ✓ | Filtra por `tenantId` antes de inserir |
| Cascade deletes no IAT | ✓ | Filtram por `tenantId` em cada nível |

---

## 4. Plano de Correção (por prioridade)

### P0 — Imediato (antes de novas features)

| # | Correção | Arquivos | Esforço |
|---|----------|----------|---------|
| 1 | Passar `ctx.tenant?.id` em TODAS as chamadas `getClientByIdFromDb` | `server/routers.ts` (~15 linhas) | 15 min |
| 2 | Passar `ctx.tenant?.id` em `deleteClientFromDb` | `server/routers.ts` (1 linha) | 5 min |
| 3 | `getTenantId()` no IAT: throw em vez de retornar 0 | `server/routers/iat.ts` (1 linha) | 5 min |

### P1 — Curto prazo

| # | Correção | Arquivos | Esforço |
|---|----------|----------|---------|
| 4 | Tornar `tenantId` obrigatório em `getAllClientsFromDb`, `getClientByIdFromDb`, `deleteClientFromDb` | `server/db.ts` | 30 min |
| 5 | Adicionar `tenantId` à tabela `emailTriggerTemplates` + migração | `drizzle/schema.ts`, `ensure-tables.ts` | 20 min |
| 6 | Verificar se `SET LOCAL app.current_tenant_id` é executado pela conexão | `server/_core/trpc.ts` ou config | 30 min |

### P2 — Médio prazo

| # | Correção | Arquivos | Esforço |
|---|----------|----------|---------|
| 7 | Adicionar `tenantId` à tabela `workflowSteps` + migração de dados | `drizzle/schema.ts`, `ensure-tables.ts`, `db.ts` | 2h |
| 8 | Adicionar `tenantId` à tabela `emailLogs` | similar | 1h |
| 9 | Teste automatizado de isolamento (seed 2 tenants, tentar cross-access) | novo test file | 2h |

---

## 5. Resumo Executivo

O módulo **IAT está bem isolado** — todas as 35 procedures filtram por tenantId corretamente. O problema está no **router principal** (`server/routers.ts`) onde a função `getClientByIdFromDb` é chamada **15 vezes sem o parâmetro tenantId**. Em single-db mode, isso significa que qualquer usuário admin pode potencialmente acessar ou deletar clientes de outro tenant apenas conhecendo o `clientId`.

A correção P0 (adicionar `ctx.tenant?.id` nas chamadas existentes) é simples, rápida e resolve 90% do risco. As correções P1 e P2 fortalecem a defesa em profundidade.
