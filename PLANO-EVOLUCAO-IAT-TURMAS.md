# Plano de Evolução — Módulo IAT: Turmas

> Gerado em: 09/04/2026

---

## Situação Atual

As turmas **já existem** no sistema com a seguinte estrutura:

| Tabela | Papel |
|--------|-------|
| `iat_course_classes` | Turma vinculada a um curso, **1 instrutor**, data única, status |
| `iat_class_enrollments` | Matrícula de aluno (clientId) em uma turma |
| `iat_class_sessions` | Sessões/aulas individuais dentro da turma |
| `iat_attendance` | Frequência por aluno × sessão |

### Gaps identificados vs. requisitos

| Requisito | Estado atual | O que falta |
|-----------|-------------|-------------|
| Período fixo (início/fim) | Apenas `scheduledDate` (data única) | Adicionar `startDate`, `endDate`, `weekDay`, `defaultTime` |
| Múltiplos instrutores | Coluna `instructorId` (FK singular) | Criar tabela M:N `iat_class_instructors` |
| Selecionar clientes do tenant | Enrollment já usa `clientId` | UI de seleção com busca na base de clientes |
| Cadastrar novo cliente inline | Não existe | Dialog/drawer de cadastro rápido dentro do fluxo de turma |
| Email genérico de boas-vindas | `generateWelcomePDF` fala só de CR | Refatorar para email/PDF genérico da plataforma CAC 360 |
| Gerar sessões semanais automáticas | Sessões são criadas manualmente | Auto-gerar N sessões ao criar turma com período fixo |

---

## Fase 1 — Alterações no Banco de Dados

### 1.1 Nova tabela: `iat_class_instructors`

```sql
CREATE TABLE IF NOT EXISTS "iat_class_instructors" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" INTEGER NOT NULL,
  "classId" INTEGER NOT NULL,
  "instructorId" INTEGER NOT NULL,
  "role" VARCHAR(30) DEFAULT 'instrutor',  -- instrutor | auxiliar | supervisor
  "assignedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("classId", "instructorId")
);
```

**Motivo**: Permite vincular N instrutores a uma turma, cada um com um papel.

### 1.2 Novas colunas em `iat_course_classes`

```sql
ALTER TABLE "iat_course_classes"
  ADD COLUMN IF NOT EXISTS "startDate" DATE,
  ADD COLUMN IF NOT EXISTS "endDate" DATE,
  ADD COLUMN IF NOT EXISTS "weekDay" INTEGER,         -- 0=dom, 1=seg, ..., 6=sáb
  ADD COLUMN IF NOT EXISTS "defaultTime" VARCHAR(5),   -- ex: "14:00"
  ADD COLUMN IF NOT EXISTS "defaultDurationMinutes" INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "defaultLocation" VARCHAR(255);
```

**Motivo**: `startDate` + `endDate` + `weekDay` permitem calcular automaticamente as sessões semanais. A `scheduledDate` antiga continua existindo por retrocompatibilidade.

### 1.3 Novo campo `source` em `clients`

```sql
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "source" VARCHAR(30) DEFAULT 'cr';  -- cr | iat | manual | portal
```

**Motivo**: Diferenciar clientes cadastrados pelo fluxo CR vs. pela tela de turmas IAT. Isso controla qual email de boas-vindas enviar.

---

## Fase 2 — Schema Drizzle (`drizzle/schema.ts`)

### 2.1 Adicionar `iatClassInstructors`

```ts
export const iatClassInstructors = pgTable("iat_class_instructors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  classId: integer("classId").notNull(),
  instructorId: integer("instructorId").notNull(),
  role: varchar("role", { length: 30 }).default("instrutor"),
  assignedAt: timestamp("assignedAt", { withTimezone: false }).defaultNow().notNull(),
});
```

### 2.2 Adicionar colunas em `iatCourseClasses`

Adicionar os campos `startDate`, `endDate`, `weekDay`, `defaultTime`, `defaultDurationMinutes`, `defaultLocation` na definição da tabela.

### 2.3 Adicionar `source` em `clients`

Adicionar `source: varchar("source", { length: 30 }).default("cr")` na tabela `clients`.

---

## Fase 3 — Server (tRPC Router)

### 3.1 `iat.class.create` — Evolução

**Input atualizado**:
```ts
z.object({
  courseId: z.number(),
  classNumber: z.string().optional(),
  title: z.string().optional(),
  startDate: z.string(),          // NOVO: "2026-05-01"
  endDate: z.string(),            // NOVO: "2026-07-24"
  weekDay: z.number().min(0).max(6), // NOVO: dia da semana
  defaultTime: z.string().optional(), // NOVO: "14:00"
  defaultDurationMinutes: z.number().optional(),
  location: z.string().optional(),
  maxStudents: z.number().optional(),
  instructorIds: z.array(z.number()).min(1), // NOVO: substitui instructorId
  notes: z.string().optional(),
})
```

**Lógica no handler**:
1. Inserir registro em `iat_course_classes` com `startDate`, `endDate`, `weekDay`, etc.
2. Inserir N registros em `iat_class_instructors` (um por instrutor).
3. **Auto-gerar sessões semanais**: calcular todas as datas entre `startDate` e `endDate` que caem no `weekDay` e criar registros em `iat_class_sessions` automaticamente com `sessionNumber` incremental.

```ts
// Pseudo-código para gerar sessões
const sessions = [];
let current = new Date(startDate);
let num = 1;
while (current <= new Date(endDate)) {
  if (current.getDay() === weekDay) {
    sessions.push({
      classId, tenantId,
      sessionNumber: num++,
      title: `Sessão ${num - 1}`,
      scheduledDate: current.toISOString().split('T')[0],
      scheduledTime: defaultTime,
      durationMinutes: defaultDurationMinutes,
      location,
    });
  }
  current.setDate(current.getDate() + 1);
}
// Bulk insert em iat_class_sessions
```

### 3.2 `iat.class.update` — Evolução

Permitir atualizar instrutores (diff: adicionar novos, remover desvinculados).

### 3.3 `iat.class.get` — Evolução

Retornar `instructors[]` (join com `iat_class_instructors` + `iat_instructors`) em vez do `instructorId` singular.

### 3.4 `iat.enrollment.enroll` — Manter como está

Já suporta `clientIds: z.array(z.number())` com bulk enroll. Apenas a UI precisa mudar para mostrar a lista de clientes do tenant.

### 3.5 Novo: `client.createQuick` — Cadastro rápido

```ts
createQuick: protectedProcedure
  .input(z.object({
    name: z.string().min(2),
    cpf: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    source: z.enum(['cr', 'iat', 'manual']).default('iat'),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Criar cliente com dados mínimos (source: 'iat')
    // 2. Enviar email genérico de boas-vindas se tiver email
    // 3. Retornar { id, name, cpf } para uso imediato no enrollment
  })
```

---

## Fase 4 — Email Genérico de Boas-Vindas

### 4.1 Refatorar `generateWelcomePDF()`

A função atual é 100% focada em CR. A abordagem:

**Opção escolhida**: Criar `generateGenericWelcomePDF(client, context)` onde `context` é `'cr' | 'iat' | 'platform'`.

- `context = 'cr'`: Comportamento atual (checklist de docs CR, próximos passos CR)
- `context = 'iat'`: Texto genérico de boas-vindas à plataforma CAC 360, sem menção a CR
- `context = 'platform'`: Versão neutra — "Bem-vindo ao CAC 360"

**Template IAT**:
```
Título: Boas-Vindas à Plataforma CAC 360
Corpo:
- Saudação personalizada
- "Você foi cadastrado(a) na plataforma CAC 360"
- "Nosso sistema permite acompanhar sua participação em cursos, treinamentos e atividades"
- Dados do cadastro (CPF, contato)
- Informações de acesso ao portal (se aplicável)
- Contato / suporte
```

### 4.2 `buildGenericWelcomeEmailHtml(clientName, tenantName, context)`

Novo template HTML de email que substitui a referência direta a CR por conteúdo dinâmico baseado no `context`.

### 4.3 Trigger de envio

O email genérico deve ser disparado **ao cadastrar um novo cliente** (conforme resposta do usuário). No `client.createQuick` e no `client.create` existente, verificar:
- Se `source === 'iat'` → usar template genérico
- Se `source === 'cr'` → manter template atual de CR

---

## Fase 5 — Client (React)

### 5.1 Tela de Criação/Edição de Turma — Evolução

**Formulário atualizado** no dialog de criação de turma (`IATModule.tsx`, tab "Turmas"):

```
┌──────────────────────────────────────────────┐
│ Nova Turma                                   │
├──────────────────────────────────────────────┤
│ Curso:        [Select ▾ lista de cursos]     │
│ Código:       [01/2026]                      │
│ Título:       [Turma Manhã - Básico]         │
│                                              │
│ ── Período ──                                │
│ Início:       [📅 01/05/2026]                │
│ Término:      [📅 24/07/2026]                │
│ Dia da Semana:[Select ▾ Quarta-feira]        │
│ Horário:      [14:00]                        │
│ Duração:      [60 min]                       │
│                                              │
│ ── Instrutores ──                            │
│ [✓] João Silva (Instrutor Principal)         │
│ [✓] Maria Santos (Auxiliar)                  │
│ [ ] Pedro Alves                              │
│                                              │
│ Local:        [Sala de aula 1]               │
│ Máx. Alunos:  [20]                           │
│ Obs:          [_______________]              │
│                                              │
│              [Cancelar]  [Criar Turma]       │
└──────────────────────────────────────────────┘
```

Ao clicar **Criar Turma**:
1. Salva a turma no servidor
2. Server auto-gera as sessões semanais (ex: 12 sessões para 12 semanas)
3. UI exibe confirmação: "Turma criada com X sessões"

### 5.2 Tela de Matrícula — Seleção de Clientes

Ao abrir a turma e clicar "Adicionar Alunos":

```
┌──────────────────────────────────────────────┐
│ Adicionar Alunos à Turma                     │
├──────────────────────────────────────────────┤
│ 🔍 Buscar por nome ou CPF: [___________]    │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ [✓] Ana Oliveira — 123.456.789-00       │ │
│ │ [ ] Carlos Mendes — 987.654.321-00      │ │
│ │ [✓] Fernanda Lima — 456.789.123-00      │ │
│ │ [ ] ... (lista de clientes do tenant)    │ │
│ │ Mostrando clientes não matriculados      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ── ou cadastrar novo ──                      │
│ [+ Cadastrar Novo Cliente]                   │
│                                              │
│         2 selecionados                       │
│              [Cancelar]  [Matricular]        │
└──────────────────────────────────────────────┘
```

O botão **"+ Cadastrar Novo Cliente"** abre um sub-dialog com campos mínimos (nome, CPF, email, telefone) que chama `client.createQuick` com `source: 'iat'`, já dispara o email genérico de boas-vindas, e retorna o novo client para seleção imediata.

### 5.3 Visualização da Turma — Detalhe

Painel expandido ou drawer ao clicar na turma:

```
┌──────────────────────────────────────────────┐
│ Turma 01/2026 — Básico Manhã         [Edit] │
├──────────────────────────────────────────────┤
│ Curso: Tiro Prático Básico                   │
│ Período: 01/05/2026 → 24/07/2026 (Quartas)  │
│ Horário: 14:00 | Duração: 60 min            │
│ Local: Sala 1 | Alunos: 15/20               │
│                                              │
│ Instrutores:                                 │
│   • João Silva (Instrutor)                   │
│   • Maria Santos (Auxiliar)                  │
│                                              │
│ ┌─ Tabs ─────────────────────────────┐       │
│ │ Alunos │ Sessões │ Frequência │    │       │
│ └────────────────────────────────────┘       │
│                                              │
│ [aba ativa renderiza conteúdo]               │
└──────────────────────────────────────────────┘
```

---

## Fase 6 — Migração de Dados

### 6.1 `ensure-tables.ts`

Adicionar no bloco de criação de tabelas IAT:

```ts
// iat_class_instructors
await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "iat_class_instructors" (
    "id" SERIAL PRIMARY KEY,
    "tenantId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "instructorId" INTEGER NOT NULL,
    "role" VARCHAR(30) DEFAULT 'instrutor',
    "assignedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE("classId", "instructorId")
  );
`);

// Novas colunas em iat_course_classes
await db.execute(sql`ALTER TABLE "iat_course_classes" ADD COLUMN IF NOT EXISTS "startDate" DATE;`);
await db.execute(sql`ALTER TABLE "iat_course_classes" ADD COLUMN IF NOT EXISTS "endDate" DATE;`);
await db.execute(sql`ALTER TABLE "iat_course_classes" ADD COLUMN IF NOT EXISTS "weekDay" INTEGER;`);
await db.execute(sql`ALTER TABLE "iat_course_classes" ADD COLUMN IF NOT EXISTS "defaultTime" VARCHAR(5);`);
await db.execute(sql`ALTER TABLE "iat_course_classes" ADD COLUMN IF NOT EXISTS "defaultDurationMinutes" INTEGER DEFAULT 60;`);
await db.execute(sql`ALTER TABLE "iat_course_classes" ADD COLUMN IF NOT EXISTS "defaultLocation" VARCHAR(255);`);

// Novo campo source em clients
await db.execute(sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "source" VARCHAR(30) DEFAULT 'cr';`);
```

### 6.2 Migração de instrutores existentes

Para turmas que já têm `instructorId` preenchido, criar registro correspondente em `iat_class_instructors`:

```sql
INSERT INTO "iat_class_instructors" ("tenantId", "classId", "instructorId", "role")
SELECT "tenantId", "id", "instructorId", 'instrutor'
FROM "iat_course_classes"
WHERE "instructorId" IS NOT NULL
ON CONFLICT ("classId", "instructorId") DO NOTHING;
```

---

## Ordem de Implementação

| # | Tarefa | Arquivos | Estimativa |
|---|--------|----------|------------|
| 1 | Migração DB (ensure-tables + schema) | `ensure-tables.ts`, `drizzle/schema.ts` | 30 min |
| 2 | Server: tabela `iat_class_instructors` CRUD | `server/routers/iat.ts` | 45 min |
| 3 | Server: evolução `class.create` (período + auto-sessões) | `server/routers/iat.ts` | 1h |
| 4 | Server: `client.createQuick` + email genérico | `server/routers.ts`, `server/emailService.ts`, `server/generate-pdf.ts` | 1h |
| 5 | Client: formulário de turma (período, instrutores) | `client/src/pages/IATModule.tsx` | 1.5h |
| 6 | Client: seleção de clientes + cadastro inline | `client/src/pages/IATModule.tsx` | 1.5h |
| 7 | Client: detalhe da turma com tabs | `client/src/pages/IATModule.tsx` | 1h |
| 8 | Refatorar email boas-vindas (genérico) | `server/generate-pdf.ts`, `server/emailService.ts` | 45 min |
| 9 | Testes e validação | - | 1h |

**Total estimado: ~8-9 horas de implementação**

---

## Decisões Técnicas

1. **Retrocompatibilidade**: O campo `instructorId` em `iat_course_classes` continua existindo (nullable), mas a fonte de verdade passa a ser `iat_class_instructors`. Turmas antigas são migradas automaticamente.

2. **Auto-geração de sessões**: Ao criar turma com período fixo, as sessões são geradas no server em batch. O operador pode editá-las individualmente depois (mudar data, cancelar, etc.).

3. **Cadastro rápido de cliente**: Campos mínimos (nome, CPF) + opcionais (email, phone). O `source: 'iat'` permite diferenciar no email e em relatórios futuros.

4. **Email de boas-vindas genérico**: Disparado automaticamente ao criar qualquer cliente novo (independente do source). O conteúdo varia conforme o `source`:
   - `cr` → template atual com checklist de documentos CR
   - `iat` → template genérico da plataforma CAC 360
   - `manual`/`portal` → template genérico

5. **Vínculo CR opcional**: O campo `clientId` no enrollment referencia a mesma tabela `clients`. Se o cliente tiver workflow CR, aparece no detalhe; se não, funciona normalmente.
