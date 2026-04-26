# 🎨 Padrões de Configuração - Guia Prático

## 1️⃣ Padrão: Adicionar Campo Simples ao Tenant

### Cenário

Você quer adicionar um novo campo de configuração que é simples (texto, número, booleano).

### Exemplo: Adicionar "Phone" do Responsável

#### Passo 1: Schema

```typescript
// drizzle/schema.ts (linha ~407)

export const tenants = pgTable("tenants", {
  // ... campos existentes ...

  // ✅ Adicionar AQUI
  signatureResponsiblePhone: varchar("signatureResponsiblePhone", {
    length: 20,
  }),

  // ... resto ...
});

// ✅ Atualizar tipo
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
```

#### Passo 2: Config Type

```typescript
// server/config/tenant.config.ts (linha ~54)

export interface TenantConfig {
  // ... campos existentes ...

  // ✅ Adicionar AQUI
  signatureResponsiblePhone: string | null;

  // ... resto ...
}
```

#### Passo 3: Migração

```sql
-- drizzle/migrations/YYYYMMDDHHMM_add_signature_responsible_phone.sql

ALTER TABLE tenants ADD COLUMN signature_responsible_phone VARCHAR(20);
```

#### Passo 4: Rotas

```typescript
// server/routers.ts (linha 2988 - create)

.input(z.object({
  // ... campos existentes ...
  signatureResponsiblePhone: z.string().optional(),
}))

// Passar para createTenant:
const tenantId = await db.createTenant({
  // ...
  signatureResponsiblePhone: input.signatureResponsiblePhone,
});

// ---

// server/routers.ts (linha 3109 - update)

.input(z.object({
  // ... campos existentes ...
  signatureResponsiblePhone: z.string().optional(),
}))

// updateTenant recebe como spread:
await db.updateTenant(id, updates); // updates inclui signatureResponsiblePhone
```

#### Passo 5: Usar no Código

```typescript
// Em qualquer rota que tenha ctx.tenant:

const phone = ctx.tenant?.signatureResponsiblePhone;

if (phone) {
  // enviar SMS, incluir em PDF, etc
}
```

#### Checklist

- [ ] Adicionado ao schema (drizzle/schema.ts)
- [ ] Adicionado ao TenantConfig (tenant.config.ts)
- [ ] Arquivo de migração criado
- [ ] Campo adicionado ao routers create (line ~2988)
- [ ] Campo adicionado ao routers update (line ~3109)
- [ ] Código de uso implementado
- [ ] Migração executada: `npm run migrate`
- [ ] Testado em dev/staging

---

## 2️⃣ Padrão: Adicionar Campo Secret (Encriptado)

### Cenário

Campo sensível como API key, senha, token.

### Exemplo: API Key para Integração

#### Passo 1-3: Schema + Tipo + Migração

(Mesmo que padrão anterior, mas usar `text` em vez de `varchar`)

```typescript
// drizzle/schema.ts
integrationApiKey: text("integrationApiKey"), // use text para valores longos
```

#### Passo 4: Rotas (DIFERENTE!)

```typescript
// server/routers.ts - create

import { encryptSecret } from "../config/crypto.util";

const tenantId = await db.createTenant({
  // ...
  integrationApiKey: input.integrationApiKey
    ? encryptSecret(input.integrationApiKey)
    : null,
});

// ---

// server/routers.ts - update

const updates = input; // gets spread
if (input.integrationApiKey !== undefined) {
  updates.integrationApiKey = encryptSecret(input.integrationApiKey);
}

await db.updateTenant(id, updates);
```

#### Passo 5: Usar no Código

```typescript
// server/config/tenant.config.ts - já descriptografa automaticamente!

if (tenant.integrationApiKey) {
  tenant.integrationApiKey = decryptSecret(tenant.integrationApiKey);
}

// Em rotas:
const apiKey = ctx.tenant?.integrationApiKey; // já descriptografado
await fetch("https://api.external.com", {
  headers: { Authorization: `Bearer ${apiKey}` },
});
```

#### Checklist

- [ ] Usar `text` em vez de `varchar` no schema
- [ ] Encriptar ao SALVAR: `encryptSecret()`
- [ ] Descriptografar ao CARREGAR: já automático em `getTenantConfig()`
- [ ] **NUNCA** logar ou expor o valor
- [ ] Testado em dev/staging

---

## 3️⃣ Padrão: Adicionar Toggle de Feature

### Cenário

Habilitar/desabilitar um feature por tenant (ex: nova funcionalidade, módulo, integração).

### Exemplo: Feature de Agenda de Psicólogo

#### Passo 1: Schema

```typescript
// drizzle/schema.ts

featurePsychologistScheduling: boolean("featurePsychologistScheduling")
  .default(false)
  .notNull(),
```

#### Passo 2-3: Config + Migração

```typescript
// tenant.config.ts
export interface TenantConfig {
  // ...
  featurePsychologistScheduling: boolean;
}

// SQL migration
ALTER TABLE tenants
ADD COLUMN feature_psychologist_scheduling BOOLEAN DEFAULT false NOT NULL;
```

#### Passo 4: Rotas

```typescript
// create input
featurePsychologistScheduling: z.boolean().default(false),

// Passar para create
featurePsychologistScheduling: input.featurePsychologistScheduling,

// update input
featurePsychologistScheduling: z.boolean().optional(),
```

#### Passo 5: Usar no Código

```typescript
// Em qualquer rota:

if (ctx.tenant?.featurePsychologistScheduling) {
  // mostrar agenda do psicólogo
  // habilitaáginas relacionadas
} else {
  // ocultar feature
}

// Ou no frontend:
const features = getTenantFeatures(ctx.tenant);
if (features.includes("psychologist-scheduling")) {
  // renderizar menu item
}
```

#### Checklist

- [ ] Adicionar ao schema com `.default(false)`
- [ ] Adicionar ao TenantConfig
- [ ] Criar migração
- [ ] Adicionar aos inputs create/update
- [ ] Usar em rotas/resolvers
- [ ] Implementar lógica de ocultar se false
- [ ] Testar ativado e desativado

---

## 4️⃣ Padrão: Adicionar Configuração de Integração

### Cenário

Variáveis para integração com serviço externo (ex: Webhook URL, credenciais).

### Exemplo: Webhook da PF (Polícia Federal)

#### Estrutura Recomendada

```typescript
// Agrupar configurações relacionadas em objeto JSON

pfWebhookUrl: varchar("pfWebhookUrl", { length: 500 }),           // URL webhook
pfWebhookSecret: text("pfWebhookSecret"),                          // Secret (encriptar!)
pfIntegrationEnabled: boolean("pfIntegrationEnabled").default(false), // Toggle
pfLastSync: timestamp("pfLastSync"),                               // Metadata
```

#### Schema

```typescript
// drizzle/schema.ts

// Integração com PF
pfWebhookUrl: varchar("pfWebhookUrl", { length: 500 }),
pfWebhookSecret: text("pfWebhookSecret"), // ENCRIPTAR
pfIntegrationEnabled: boolean("pfIntegrationEnabled").default(false),
pfLastSyncAt: timestamp("pfLastSyncAt"),
```

#### Tipos

```typescript
export interface TenantConfig {
  // ...
  pfWebhookUrl: string | null;
  pfWebhookSecret: string | null; // descriptografado automaticamente
  pfIntegrationEnabled: boolean;
  pfLastSyncAt: Date | null;
}
```

#### Rotas

```typescript
// Input
.input(z.object({
  pfWebhookUrl: z.string().url().optional(),
  pfWebhookSecret: z.string().optional(),
  pfIntegrationEnabled: z.boolean().optional(),
}))

// Create/Update
const updates = {
  pfWebhookUrl: input.pfWebhookUrl,
  pfWebhookSecret: input.pfWebhookSecret
    ? encryptSecret(input.pfWebhookSecret)
    : undefined,
  pfIntegrationEnabled: input.pfIntegrationEnabled,
};

await db.createTenant(updates);
```

#### Uso

```typescript
// Em função webhook handler:

if (!ctx.tenant?.pfIntegrationEnabled) {
  throw new Error("PF integration not enabled");
}

const secret = ctx.tenant.pfWebhookSecret; // já descriptografado
const url = ctx.tenant.pfWebhookUrl;

// Validar assinatura
if (signature !== hmac(body, secret)) {
  throw new Error("Invalid signature");
}

// Processar webhook...
```

#### Checklist

- [ ] Todas as URLs/configurações documentadas
- [ ] Secrets marcadas para criptografia
- [ ] Toggle para habilitar/desabilitar
- [ ] Metadata (lastSyncAt, etc) para debugging
- [ ] Validações apropriadas nas rotas
- [ ] Testes de integração

---

## 5️⃣ Padrão: Adicionar Configuração com Valores Pré-Definidos

### Cenário

Enum/select com valores específicos (ex: plano, tipo de integração).

### Exemplo: Tipo de Pagamento Aceito

#### Schema

```typescript
export const tenants = pgTable("tenants", {
  // ...
  paymentMethod: varchar("paymentMethod", { length: 20 })
    .default("pix")
    .$type<"pix" | "creditcard" | "boleto" | "all">(),
});
```

#### Tipo

```typescript
export interface TenantConfig {
  // ...
  paymentMethod: "pix" | "creditcard" | "boleto" | "all";
}
```

#### Rotas

```typescript
.input(z.object({
  paymentMethod: z.enum(['pix', 'creditcard', 'boleto', 'all']).optional(),
}))
```

#### Uso

```typescript
switch (ctx.tenant?.paymentMethod) {
  case "pix":
    // mostrar apenas PIX
    break;
  case "creditcard":
    // mostrar apenas cartão
    break;
  case "boleto":
    // mostrar apenas boleto
    break;
  case "all":
    // mostrar todos os métodos
    break;
}
```

#### Checklist

- [ ] Enum bem definido (não valores mágicos)
- [ ] Type safety com Zod enum
- [ ] Default sensato
- [ ] Documentar valores possíveis
- [ ] Usar switch/if ao consumir

---

## 🔄 Fluxo de Desenvolvimento Típico

```
1. ENTENDER O REQUISITO
   └─ Qual é o campo?
   └─ É secret? É enum? É array?
   └─ Qual é o padrão/default?

2. SCHEMA (5 minutos)
   └─ drizzle/schema.ts
   └─ Adicionar coluna
   └─ Atualizar tipo Tenant

3. MIGRAÇÃO (2 minutos)
   └─ Criar arquivo SQL
   └─ ALTER TABLE tenants ADD COLUMN ...

4. CONFIG TYPE (1 minuto)
   └─ tenant.config.ts
   └─ Adicionar ao interface TenantConfig

5. ROTAS (10 minutos)
   └─ routers.ts create (linha ~2988)
   └─ routers.ts update (linha ~3109)
   └─ Adicionar input
   └─ Passar para db.createTenant/updateTenant

6. IMPLEMENTAÇÃO (30+ minutos)
   └─ Usar ctx.tenant?.field em rotas
   └─ Testes unitários
   └─ Testes de integração

7. MIGRATION (5 minutos)
   └─ npm run migrate
   └─ Verificar: SELECT * FROM tenants;

8. DEPLOY (5+ minutos)
   └─ git push
   └─ Railway deploy
   └─ Verificar logs
```

---

## 📚 Referência de Tipos

### Simple Types

```typescript
name: varchar(255),              // Texto curto
description: text(),             // Texto longo
email: varchar(320),             // Email (RFC 5321)
color: varchar(7),               // Hex color "#ff0000"
url: varchar(500),               // URLs/URIs
```

### Secret Types

```typescript
password: text(),                // ENCRIPTAR!
apiKey: text(),                  // ENCRIPTAR!
token: text(),                   // ENCRIPTAR!
secret: text(),                  // ENCRIPTAR!
```

### Number Types

```typescript
port: integer(),                 // 1-65535
maxUsers: integer().default(10),
maxStorageGB: numeric(10, 2),   // decimal com 2 casas
```

### Boolean Types

```typescript
isActive: boolean().default(true),
featureX: boolean().default(false),
```

### Date Types

```typescript
createdAt: timestamp().defaultNow(),
expiresAt: timestamp(),
lastSyncAt: timestamp(),
```

---

## ❌ Erros Comuns

### ❌ Erro 1: Esquecer Migração

```
Código compila, mas falha em produção
⚠️ Solução: SEMPRE criar arquivo de migração
```

### ❌ Erro 2: Encriptar valor que já está encriptado

```typescript
// ❌ ERRADO
if (input.apiKey) {
  updates.apiKey = encryptSecret(input.apiKey); // já está criptografado!
}

// ✅ CORRETO
if (input.apiKey) {
  updates.apiKey = encryptSecret(input.apiKey);
}
```

### ❌ Erro 3: Não validar enum

```typescript
// ❌ ERRADO - aceita qualquer string
paymentMethod: z.string().optional(),

// ✅ CORRETO - apenas valores válidos
paymentMethod: z.enum(['pix', 'creditcard', 'boleto']).optional(),
```

### ❌ Erro 4: Expor secret no log

```typescript
// ❌ ERRADO
console.log("API Key:", ctx.tenant.apiKey);

// ✅ CORRETO
console.log("API Key configured:", !!ctx.tenant.apiKey);
```

### ❌ Erro 5: Não passar tenantId ao emailService

```typescript
// ❌ ERRADO - usa SMTP padrão
await sendEmail({ to, subject, html });

// ✅ CORRETO - usa SMTP do tenant
await sendEmail({
  to,
  subject,
  html,
  tenantId: ctx.tenant?.id, // ← importante
  tenantDb: tenantDb, // ← importante
});
```

---

## ✅ Boas Práticas

1. **Agrupar configurações relacionadas**
   - Ao invés de: `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword`
   - Considerar: `smtpConfig: { host, port, user, password }`

2. **Sempre ter padrão sensato**

   ```typescript
   primaryColor: varchar(7).default("#1a5c00"),
   isActive: boolean().default(true),
   ```

3. **Documentar no commit**

   ```
   feat: adiciona configuração de webhook PF

   - Adiciona pfWebhookUrl (configurável por tenant)
   - Adiciona pfWebhookSecret (encriptado)
   - Adiciona pfIntegrationEnabled (toggle)
   - Adiciona pfLastSyncAt (metadata)
   ```

4. **Testar em dev antes de produção**

   ```bash
   # Local
   npm run dev

   # Criar tenant com novo campo
   POST /api/trpc/tenant.create
   { newField: "value" }

   # Usar em rota
   GET /api/trpc/rota.test

   # Depois: push + deploy
   ```

5. **Validar tipos no TypeScript**
   - Usar `z.enum()` para enums
   - Usar `z.string().url()` para URLs
   - Usar `z.number().min(1).max(100)` para ranges

---

**Última Atualização**: 14 de Abril de 2026
**Status**: ✅ Guia Completo
