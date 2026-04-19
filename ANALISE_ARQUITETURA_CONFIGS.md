# 📐 Análise Completa - Arquitetura de Configurações

## 🎯 Visão Geral

A aplicação CAC 360 é um sistema **multi-tenant** onde cada clube/organização (tenant) tem:
- Sua própria base de dados PostgreSQL (ou tabela isolada em single-DB)
- Suas próprias configurações (cores, logo, SMTP, features)
- Suas próprias rotas, usuários e clientes
- Suas próprias templates de email e fluxos de trabalho

---

## 🏗️ Arquitetura em 3 Camadas

### Camada 1: Plataforma (Platform Layer)
```
┌─────────────────────────────────────────────────┐
│         Banco de Dados da Plataforma            │
│  (PostgreSQL: PLATFORM_DATABASE_URL)            │
│                                                 │
│  ├─ tenants (configuração de cada clube)       │
│  ├─ platform_admins (admins da plataforma)     │
│  ├─ platform_settings (config global)          │
│  └─ ... outras tabelas globais                 │
└─────────────────────────────────────────────────┘
```

**Arquivo**: `server/config/tenant.config.ts`

**Responsabilidades**:
- Armazenar metadados de cada tenant
- Resolver qual tenant está sendo acessado (por slug/subdomínio)
- Gerenciar cache de configurações (TTL: 5 minutos)

---

### Camada 2: Contexto (Context Layer)
```
┌──────────────────────────────────────────────────┐
│    TrpcContext (server/_core/context.ts)        │
│                                                  │
│  Criado a cada requisição HTTP:                 │
│  ├─ req: Express Request                        │
│  ├─ res: Express Response                       │
│  ├─ user: User | null (usuário autenticado)    │
│  ├─ platformAdmin: Admin | null                │
│  ├─ tenant: TenantConfig | null                │
│  └─ tenantSlug: string | null                  │
└──────────────────────────────────────────────────┘
```

**Fluxo de Resolução do Tenant**:

1. **Extração da Sessão**
   ```
   SDK.authenticateRequestWithTenant(req)
   └─> Verifica JWT/sessão para tenantSlug
   ```

2. **Resolução do Slug** (se não houve sessão)
   - Header: `x-tenant-slug` (seguro apenas sem sessão)
   - Hostname/Subdomínio: `tiroesp.cac360.com.br` → slug = `tiroesp`
   - Localhost: Usa `DEV_TENANT_SLUG` (dev)

3. **Carregamento da Configuração**
   ```typescript
   if (tenantSlug) {
     tenant = await getTenantConfig(tenantSlug);
     // ├─ Verifica cache (5 min TTL)
     // ├─ Se miss: busca no banco
     // ├─ Descriptografa secrets
     // └─ Cacheia resultado
   }
   ```

---

### Camada 3: Banco de Dados do Tenant
```
┌────────────────────────────────────────┐
│   Banco de Dados do Tenant             │
│  (PostgreSQL por tenant ou single-db)  │
│                                        │
│  ├─ users (usuários do clube)         │
│  ├─ clients (interessados)            │
│  ├─ workflow_steps (processo CR)      │
│  ├─ email_templates (templates local) │
│  ├─ email_triggers (disparadores)     │
│  └─ ... dados específicos do tenant   │
└────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Configuração - Exemplo Prático

### Exemplo: Enviar Email com Logo do Tenant

```
1. REQUISIÇÃO HTTP
   ├─ POST /api/trpc/sendPsychReferral
   ├─ Body: { clientId: 123 }
   └─ Headers: host: "tiroesp.cac360.com.br"

2. CONTEXTO (context.ts)
   ├─ resolveTenantSlug("tiroesp.cac360.com.br")
   │  └─> retorna "tiroesp"
   ├─ getTenantConfig("tiroesp")
   │  ├─ Verifica cache
   │  ├─ Se miss: SELECT * FROM tenants WHERE slug='tiroesp'
   │  ├─ Descriptografa smtpPassword
   │  └─> Retorna TenantConfig { ... emailLogoUrl, logo, ... }
   └─> ctx.tenant = TenantConfig

3. ROTA (routers.ts ~ linha 1596)
   ├─ Busca client
   ├─ Obtém responsibleName:
   │  ├─ if (ctx.tenant?.signatureResponsibleName) → usa esse
   │  ├─ else → busca nome do admin
   │  └─> default: "CAC 360"
   └─> Passa para generatePsychReferralPDF()

4. GERADOR PDF (generate-pdf.ts)
   ├─ Usa responsibleName em cursivo
   └─> Retorna PDF Buffer

5. EMAIL SERVICE (emailService.ts)
   ├─ Busca SMTP settings do tenant
   │  ├─ Verifica ctx.tenant?.smtpHost (SMTP customizado)
   │  └─> Fallback: SMTP_HOST (global)
   ├─ Fetch logo do tenant
   │  ├─ ctx.tenant?.emailLogoUrl
   │  └─> buildInlineLogoAttachment()
   ├─ Envia email com:
   │  ├─ SMTP do tenant
   │  ├─ Logo inline
   │  └─ PDF anexado
   └─> { success: true, messageId }
```

---

## 📊 Estrutura do TenantConfig

```typescript
interface TenantConfig {
  // Identificadores
  id: number;
  slug: string;                    // URL: tiroesp.cac360.com.br
  name: string;                    // "Tiro Esportivo Brasil"

  // Banco de Dados
  dbHost: string;                  // localhost / RDS host
  dbPort: number;                  // 5432
  dbName: string;                  // cac360_tiroesp
  dbUser: string;                  // usuario
  dbPassword: string;              // ENCRYPTED

  // Branding
  logo: string | null;             // URL da logo
  favicon: string | null;          // URL do favicon
  primaryColor: string;            // "#1a5c00"
  secondaryColor: string;          // "#4d9702"

  // Features (toggles)
  featureWorkflowCR: boolean;      // Workflow de CR
  featureApostilamento: boolean;   // Apostilamento
  featureRenovacao: boolean;       // Renovação
  featureInsumos: boolean;         // Módulo de insumos
  featureIAT: boolean;             // Instrutor de tiro

  // Email (SMTP Customizado)
  smtpHost: string | null;         // smtp.seuservidor.com
  smtpPort: number;                // 587 ou 465
  smtpUser: string | null;         // usuario@seuservidor.com
  smtpPassword: string | null;     // ENCRYPTED
  smtpFrom: string | null;         // "Tiro Esportivo" <noreply@...>
  emailLogoUrl: text;              // Base64 ou URL da logo para email

  // Nova: Assinatura de Documentos
  signatureResponsibleName: string; // "João Silva"

  // Limits
  maxUsers: number;                // 10
  maxClients: number;              // 500
  maxStorageGB: number;            // 50 GB

  // Subscription
  plan: "starter" | "professional" | "enterprise";
  subscriptionStatus: "active" | "suspended" | "trial" | "cancelled";
  subscriptionExpiresAt: Date | null;

  // Meta
  isActive: boolean;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

---

## 🔐 Segurança de Configuração

### 1. Criptografia de Secrets
```typescript
// Ao SALVAR:
smtpPassword = encryptSecret(plainPassword);

// Ao CARREGAR:
smtpPassword = decryptSecret(encryptedPassword);
```

**Arquivo**: `server/config/crypto.util.ts`

**Onde é usado**:
- Senhas de SMTP
- Senhas de banco de dados (multi-DB mode)
- API keys

---

### 2. Isolamento de Tenant

#### Multi-DB Mode (Recomendado em Produção)
```typescript
// Cada tenant tem seu próprio banco
Tenant A: postgres://user@host1:5432/cac360_clubea
Tenant B: postgres://user@host2:5432/cac360_clubeb
```

**Pool de Conexões**:
- MAX: 50 conexões simultâneas (configurável)
- TTL: 10 minutos (inativo)
- Eviction: Remove 10% mais antigas quando limite atingido

#### Single-DB Mode (Development / Railway)
```typescript
// Todos os dados em UM banco
DATABASE_URL = postgres://...

// Isolamento via tenantId
SELECT * FROM users WHERE "tenantId" = 1
SELECT * FROM clients WHERE "tenantId" = 1
```

**Como ativa**:
```bash
TENANT_DB_MODE=single
```

---

### 3. Validação de Tenant
```typescript
function isTenantActive(tenant: TenantConfig): boolean {
  if (!tenant.isActive) return false;

  if (tenant.subscriptionStatus === 'cancelled' || 'suspended')
    return false;

  if (tenant.subscriptionExpiresAt < now)
    return false;

  return true;
}
```

---

## 🎯 Fluxo de Criação de Tenant

### Passo 1: API Request
```typescript
POST /api/trpc/tenant.create
{
  "slug": "novo-clube",
  "name": "Novo Clube de Tiro",
  "adminName": "João Admin",
  "adminEmail": "admin@novo.com",
  "adminPassword": "senha123",
  "primaryColor": "#ff0000",
  "signatureResponsibleName": "João Silva",  // NOVO
  // ... outros campos
}
```

### Passo 2: Validação
```typescript
// routers.ts linha 2966+
❌ if (getTenantBySlug(input.slug) exists)
   throw "Slug já em uso"

❌ if (getUserByEmail(input.adminEmail) exists)
   throw "Email já cadastrado"
```

### Passo 3: Criar Tenant
```typescript
// Salva no banco da plataforma
await db.createTenant({
  slug: "novo-clube",
  name: "Novo Clube de Tiro",
  dbHost: "localhost",           // ou do DATABASE_URL
  dbPort: 5432,
  dbName: "cac360_novo_clube",
  dbUser: "...",
  dbPassword: encryptSecret("..."),
  primaryColor: "#ff0000",
  secondaryColor: "#ff5555",
  signatureResponsibleName: "João Silva",  // NOVO CAMPO
  plan: "starter",
  subscriptionStatus: "trial",
  isActive: true,
});
```

### Passo 4: Criar Admin do Tenant
```typescript
// Salva na tabela users (do tenant específico)
await db.upsertUser({
  tenantId: newTenantId,
  name: "João Admin",
  email: "admin@novo.com",
  hashedPassword: await hashPassword("senha123"),
  role: "admin",
  approved: true,
});
```

### Passo 5: Seed do Tenant
```typescript
// Executa seed de templates, triggers, etc
await seedTenantDefaults(tenantDb, newTenantId);
// ├─ Copia templates de email
// ├─ Copia triggers
// └─ Copia configurações padrão
```

---

## 📝 Padrões de Desenvolvimento

### Pattern 1: Usar tenant no contexto
```typescript
// ✅ CORRETO - tenant vem do contexto
async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
  const tenantId = ctx.tenant?.id;
  const tenantDb = await getTenantDb(ctx.tenant);

  // ... usar tenantDb e tenantId
}

// ❌ ERRADO - buscar tenant manualmente
const tenant = await db.getTenantBySlug(input.slug);
```

### Pattern 2: Email com tenant
```typescript
// ✅ CORRETO - passa tenantDb e tenantId
await sendEmail({
  to: email,
  subject: "...",
  html: "...",
  tenantDb: tenantDb,      // ← importante
  tenantId: ctx.tenant?.id, // ← importante
});

// No sendEmail(), vai:
// ├─ Buscar SMTP do tenant
// ├─ Buscar logo do tenant
// └─ Enviar com configuração específica
```

### Pattern 3: Feature flags
```typescript
const features = getTenantFeatures(ctx.tenant);

if (features.includes('workflow-cr')) {
  // Feature ativa para este tenant
}

// Ou direto:
if (ctx.tenant?.featureWorkflowCR) {
  // ...
}
```

---

## 🔄 Cache Strategy

### 1. Tenant Config Cache
```
TTL: 5 minutos
Key: tenantSlug
Invalidate:
  ├─ Ao criar tenant
  ├─ Ao atualizar tenant
  └─ Manualmente via invalidateTenantCache()
```

### 2. Tenant DB Connection Pool
```
MAX: 50 conexões
IDLE_TIMEOUT: 10 minutos
Cleanup: Automático a cada 10 min
```

### 3. Email Template Cache
```
Carregado no seedTenant
Atualizado ao editar template
```

---

## 📋 Checklist para Adicionar Nova Configuração

1. **Schema** (`drizzle/schema.ts`)
   ```typescript
   ✅ Adicionar campo à tabela tenants
   ✅ Atualizar tipo TenantConfig
   ✅ Criar arquivo de migração SQL
   ```

2. **Rota de Criação** (`routers.ts` ~ linha 2966)
   ```typescript
   ✅ Adicionar ao z.object() do input
   ✅ Passar para db.createTenant()
   ```

3. **Rota de Atualização** (`routers.ts` ~ linha 3087)
   ```typescript
   ✅ Adicionar ao z.object() do input
   ✅ Passar para db.updateTenant()
   ```

4. **Uso na Aplicação**
   ```typescript
   ✅ ctx.tenant?.newField
   ✅ Passar para funções que precisam
   ```

5. **Criptografia** (se secret)
   ```typescript
   ✅ Ao salvar: encryptSecret()
   ✅ Ao carregar: decryptSecret()
   ```

6. **Migração Railway**
   ```bash
   ✅ npm run migrate
   ✅ Verificar: SELECT * FROM tenants;
   ```

---

## 🚀 Exemplo Concreto: signatureResponsibleName

### O que foi alterado:

1. **Schema** ✅
   ```typescript
   signatureResponsibleName: varchar(255)
   ```

2. **Criação** ✅
   ```typescript
   POST /api/trpc/tenant.create
   { signatureResponsibleName: "João Silva" }
   ```

3. **Atualização** ✅
   ```typescript
   POST /api/trpc/tenant.update
   { id: 1, signatureResponsibleName: "Maria Santos" }
   ```

4. **Uso no PDF** ✅
   ```typescript
   // Prioridade:
   if (ctx.tenant?.signatureResponsibleName) {
     responsibleName = ctx.tenant.signatureResponsibleName;
   } else if (adminUser) {
     responsibleName = adminUser.name;
   } else {
     responsibleName = "CAC 360";
   }

   // Passa para PDF:
   generatePsychReferralPDF(client, responsibleName);
   // ├─ Letra cursiva (DancingScript)
   // ├─ Tamanho 26pt
   // └─ Cor azul #123A63
   ```

---

## 📚 Arquivos Chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `server/config/tenant.config.ts` | Resolver + Cache config tenant |
| `server/_core/context.ts` | Criar context a cada requisição |
| `server/db.ts` | Funções CRUD do banco |
| `server/routers.ts` | Rotas de admin (create/update) |
| `drizzle/schema.ts` | Definição de tabelas |
| `server/emailService.ts` | Envio de emails com config tenant |
| `server/generate-pdf.ts` | Geração de PDFs |

---

## 🎓 Conceitos Importantes

### Multi-Tenant vs Single-Tenant
- **Multi-Tenant**: Cada cliente tem seu próprio banco
- **Single-Tenant**: Um único banco, isolamento por `tenantId`
- CAC 360: Suporta ambos (modo configurável)

### Slugs
- Identificador único por tenant
- Usado em URLs: `tiroesp.cac360.com.br`
- Nunca muda após criação

### Feature Flags
- `featureWorkflowCR`, `featureApostilamento`, etc
- Ativa/desativa funcionalidades por tenant
- Usado em paywalls ou produtos específicos

### Subscription
- `plan`: starter, professional, enterprise
- `subscriptionStatus`: active, trial, suspended, cancelled
- `subscriptionExpiresAt`: data de vencimento

---

## 🔗 Relacionamentos

```
platform (banco)
├─ tenants (metadados + config)
├─ platform_admins (admins globais)
└─ platform_settings (config global)

tenant 1 (seu banco)
├─ users (usuários do clube 1)
├─ clients (interessados)
├─ email_templates (templates locais)
└─ ... dados específicos

tenant 2 (outro banco)
├─ users (usuários do clube 2)
├─ clients (interessados)
└─ ... dados específicos
```

---

**Ultima Atualização**: 14 de Abril de 2026
**Status**: ✅ Análise Completa
