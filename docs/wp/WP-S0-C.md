# WP-S0-C — Saúde de tipos (typecheck verde)

- **Sprint:** 0.5 (fechamento)
- **Owner alvo:** A2 + A3 (em paralelo)
- **Branches:**
  - `agent-a2/WP-S0-C-server-types` (A2: `server/routers/iat.ts` + `shared/validations.ts`)
  - `agent-a3/WP-S0-C-client-types` (A3: `client/src/pages/SuperAdminTenants.tsx`)
- **Base branch:** `hml`
- **Depends on:** WP-S0-B (mergeado em `hml`)
- **Bloqueia:** Marco 2 (baseline freeze), todos os WPs subsequentes (WP-01, WP-02, WP-03, WP-R1)
- **ADRs de referência:** — (sem ADR específico; é higiene técnica baseada em `tsc --noEmit`)
- **Estimativa:** 4-6h total (≈3h A2, ≈3h A3, em paralelo)
- **Risco:** médio (mexe em código de produção)

---

## 1. Contexto

Captura de baseline (Marco 2) reportou ~50 erros de `tsc --noEmit` concentrados em 3 arquivos:

1. **`server/routers/iat.ts`** — 40+ erros `TS18047: 'db' is possibly 'null'`. Causa: `db` exportado de `server/db.ts` é tipado como `Database | null` (provavelmente para suportar boot sem DB), mas as procedures do router IAT usam `db` diretamente sem narrowing.
2. **`shared/validations.ts`** — 1 erro `TS2769: No overload matches this call`. Causa: uso da API antiga do Zod (`{ errorMap: ... }` em `z.enum`) que não existe na v4 instalada.
3. **`client/src/pages/SuperAdminTenants.tsx`** — ~8 erros mistos:
   - `TS2769`: argumento `{}` passado onde `string | number | Date` é esperado (provável query do TanStack Query sem narrowing).
   - `TS2322 / TS2345`: `string | null` passado onde `string` é esperado (campos de `Tenant` que podem ser nullable).
   - `TS2339: Property 'isLoading' does not exist` — TRPC v11 renomeou `isLoading` para `isPending` em mutations.

Build do código funciona (`vite build` passa). O typecheck é o gate da camada `static` da matriz de integridade.

## 2. Escopo

Dividido em duas frentes paralelas. **Cada agente abre seu próprio PR.**

### 2.1. Frente A2 — `server/routers/iat.ts` + `shared/validations.ts`

#### `server/routers/iat.ts`

**Problema:** ~40 acessos diretos a `db` (que é `Database | null`).

**Solução proposta** (uma das duas opções, A2 escolhe):

- **Opção 1 — Helper único:** criar `server/_core/getDb.ts` exportando `requireDb(): Database` que joga `throw new Error('Database not initialized')` se `db === null`. Cada handler do router IAT troca `db.query(...)` por `requireDb().query(...)`.
- **Opção 2 — Guard top-of-handler:** em cada procedure, `if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not initialized' })`. Após o guard, TS narrowing aceita `db` como não-null.

A2 deve preferir Opção 1 (mais reutilizável). Documentar a escolha no commit.

#### `shared/validations.ts:269`

**Problema:** uso de `errorMap` em chamada Zod incompatível com v4.

**Solução:** migrar para a API atual. Em Zod v4, mensagens customizadas em `z.enum` usam:

```ts
z.enum(["a", "b"], { error: () => "mensagem" });
```

…em vez de:

```ts
z.enum(["a", "b"], { errorMap: () => ({ message: "..." }) });
```

A2 deve abrir o arquivo, ver o uso real, e migrar mantendo a mesma mensagem.

#### Critérios de aceite (A2)

- [ ] `pnpm tsc --noEmit server/routers/iat.ts` retorna 0 erros (ou: `pnpm run check` não reporta mais erros de `iat.ts`).
- [ ] `pnpm tsc --noEmit shared/validations.ts` retorna 0 erros.
- [ ] `pnpm test` continua verde (104 testes ou contagem coerente pós-WP-S0-B).
- [ ] Branch tem 2 commits:
  - `refactor(iat): adicionar guard de db null em router IAT`
  - `fix(validations): migrar z.enum para API Zod v4`
- [ ] PR mergeado em `hml`.

### 2.2. Frente A3 — `client/src/pages/SuperAdminTenants.tsx`

**Problemas a resolver:**

| Linha aprox. | Erro                                            | Solução                                                                  |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| 243:53       | `TS2769`: `{}` not assignable to `Date`         | Narrowing: validar que o valor é `Date \| string \| number` antes do uso |
| 624:34       | `TS2322`: `string \| null` to `BackgroundColor` | Fallback `?? 'neutral'` ou narrowing                                     |
| 631:43       | `TS2345`: `string \| null` to `string`          | Fallback `?? ''` ou guard                                                |
| 680:106      | `TS2345`: `primaryColor: string \| null`        | Fallback `?? '#000000'` ou tornar prop nullable no consumidor            |
| 688:45       | `TS2339`: `isLoading` does not exist            | Trocar `isLoading` por `isPending` (padrão TRPC/TanStack Query v5)       |

A3 deve abrir o arquivo, mapear cada erro real (linhas podem ter deslocado após o `prettier --write` do WP-S0-A), e aplicar a correção mais conservadora possível — sem refatorar componente.

#### Critérios de aceite (A3)

- [ ] `pnpm tsc --noEmit client/src/pages/SuperAdminTenants.tsx` retorna 0 erros.
- [ ] Comportamento visual da página em desenvolvimento permanece idêntico (smoke manual: abrir tela, navegar, verificar render).
- [ ] Nenhum teste de UI quebra.
- [ ] Branch tem 1 commit:
  - `fix(tenants): corrigir tipos em SuperAdminTenants (null narrowing + isPending)`
- [ ] PR mergeado em `hml`.

## 3. Critério final consolidado (após **ambos** mergeados)

- [ ] `pnpm run check` em `hml` retorna **0 erros**.
- [ ] `pnpm test` em `hml` retorna **0 falhas**.
- [ ] `pnpm run build` em `hml` retorna exit code 0.
- [ ] `pnpm prettier --check .` em `hml` retorna 0 divergências.
- [ ] Todas as 4 camadas obrigatórias do `integrity-check.sh` passam em `hml`.

Quando os 4 acima forem verdade, **Marco 2 (baseline freeze) está destravado** — disparar workflow `baseline-freeze.yml`.

## 4. Boundaries

- ❌ A2 não toca em `client/**`, A3 não toca em `server/**` ou `shared/**`. Allowlist do ADR-000 vale rigorosamente neste WP.
- ❌ Não refatorar componentes nem rotas. Apenas correções pontuais de tipo.
- ❌ Não suprimir erros com `// @ts-expect-error` ou `// @ts-ignore` sem ADR. Se algum erro for genuinamente impossível de corrigir sem refactor maior, o caminho é abrir issue + voltar a tarefa para `[!]` (blocked) e me consultar.

## 5. Estratégia de revisão (humano)

1. Frente A2: ler `iat.ts` antes/depois — confirmar que **comportamento em runtime é o mesmo** (apenas adicionou guard), não introduziu lógica nova.
2. Frente A2: rodar `pnpm test -- shared/validations` para garantir que a migração de Zod não quebrou parsing.
3. Frente A3: abrir o app localmente e navegar até `/super-admin/tenants`. Render correto, sem warning no console.
4. Após ambos mergeados, rodar `pnpm run check && pnpm test && pnpm run build && pnpm prettier --check .` localmente. Tudo verde → disparar baseline freeze.

## 6. Rollback

- Reverter cada PR independentemente. Sem migration, sem schema. Custo de rollback: baixo.

## 7. Próximo passo após merge

**Marco 2 — Baseline Freeze** via workflow `.github/workflows/baseline-freeze.yml` (gera o PR `sprint-0/baseline-freeze` com `docs/integrity-baseline.{md,json}` rodado em ambiente Ubuntu/CI).
