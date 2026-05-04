# TASKS — Backlog Multi-Agente

> **Fonte de verdade** para reivindicação de tarefas pelos agentes A1, A2 e A3.
> **Nunca** edite este arquivo fora do protocolo descrito em `docs/PLANO-MULTI-AGENTE.md` §6.
>
> **Referência obrigatória:** `docs/adr/ADR-000-multi-agent-workflow.md`.

---

## Estados

| Marcador | Estado      | Significado                                                                  |
| -------- | ----------- | ---------------------------------------------------------------------------- |
| `[ ]`    | available   | Disponível para reivindicação por qualquer agente compatível com o escopo.   |
| `[~]`    | claimed     | Reivindicado por um agente. Nenhum outro agente pode editar os mesmos paths. |
| `[>]`    | in_progress | Agente iniciou commits de implementação.                                     |
| `[?]`    | review      | PR aberto, aguardando revisão e Integrity Report verde.                      |
| `[x]`    | completed   | PR merged em `main`. Mover para o histórico ao final do sprint.              |
| `[!]`    | blocked     | Bloqueado por dependência, decisão pendente ou falha de integridade.         |

## Regras de reivindicação

1. **Commit atômico para claim**: um commit isolado alterando apenas a linha do WP de `[ ]` para `[~]` e preenchendo `owner`, `branch`, `claimed_at`.
2. **Não-fragmentação**: um agente reivindica o WP inteiro. Subdividir exige abrir novo WP via A1 + ADR.
3. **Allowlist de diretórios**:
   - **A1 (Docs/ADR):** `docs/**`, `.github/**` (exceto workflows de deploy), `README.md`, `CHANGELOG.md`.
   - **A2 (Backend/DB):** `server/**`, `drizzle/**`, `shared/**`, `scripts/**`, `drizzle.config.ts`.
   - **A3 (Frontend/UX):** `client/**`, `public/**`, `tests/frontend/**`, `index.html`, `vite.config.ts`.
4. **Integrity Report obrigatório** antes de mover para `[?]` (ver §7 do plano).
5. Se dois agentes atingirem o mesmo WP: o primeiro `git push` vence. O segundo recebe conflito de merge e deve escolher outro WP.

---

## Sprint 0 — Fundação do protocolo (somente A1)

- [x] WP-00 — Fundação do protocolo multi-agente
  - owner: A1
  - branch: sprint-0/protocol-foundation
  - scope: `docs/TASKS.md`, `docs/adr/ADR-000-multi-agent-workflow.md`, `.windsurf/rules/*`, `scripts/integrity-check.sh`, `.github/CODEOWNERS`
  - acceptance: Este próprio arquivo committed, ADR-000 merged, regras Windsurf ativas, script de integridade executável e CI detectando integridade.

---

## Sprint 0.5 — Fechamento (destravar baseline)

> **Origem:** captura de baseline (Marco 2) em `hml` falhou em 4/4 camadas — build cross-platform (NODE_OPTIONS Windows), prettier (50+ arquivos), unit tests (4 arquivos grep-em-source), typecheck (~50 erros em 3 arquivos).
>
> **Objetivo:** zerar essas falhas em 3 mini-WPs antes de congelar baseline. Estes são os primeiros WPs reais executados pelos agentes (validação ponta-a-ponta do protocolo).

- [ ] WP-S0-C — Saúde de tipos (typecheck verde)
  - owner: A2 + A3 em paralelo
  - branches: `agent-a2/WP-S0-C-server-types`, `agent-a3/WP-S0-C-client-types`
  - claimed_at: —
  - scope:
    - A2: `server/routers/iat.ts`, `shared/validations.ts`, `server/_core/getDb.ts` (novo)
    - A3: `client/src/pages/SuperAdminTenants.tsx`
  - depends_on: WP-S0-B
  - deliverable: zero erros de `tsc --noEmit` em todo o repo. 2 PRs paralelos.
  - integrity_required: static (typecheck), unit, build
  - estimate: 4-6h em paralelo
  - spec: `docs/wp/WP-S0-C.md`
  - prompts: `docs/prompts/ACTIVATE-A2-WP-S0-C-server.md`, `docs/prompts/ACTIVATE-A3-WP-S0-C-client.md`
  - **frente A2**: merged via PR #18 / commit `3376984` em 2026-04-30. Plano D recortado (refactor `getIatDb` com TRPCError null-guard + Zod v4 `errorMap` → `error` em `shared/validations.ts`). Redução 182→138 TS errors. Spec original divergia da realidade (assumia ~50, encontrados 182). Follow-ups documentados no PR body: A2-FU-1 (74 `ctx.user` TS18047 em routers.ts → middleware `authedProcedure`), A2-FU-2 (8 heterogêneos em routers.ts: 5 TS2345 + 2 TS2305 emailService imports + 1 TS2802), A2-FU-3 (15 heterogêneos em `_core/`).
  - **frente A3**: pendente. Spec `docs/prompts/ACTIVATE-A3-WP-S0-C-client.md` ajustada em 2026-05-04 (17 erros reais em `SuperAdminTenants.tsx` vs ~8 originalmente esperado).

- [ ] WP-S0-Z — Marco 2: congelar baseline em Linux/CI
  - owner: humano (workflow_dispatch)
  - branch: gerada pelo workflow (`sprint-0/baseline-freeze-<timestamp>`)
  - claimed_at: —
  - scope: `docs/integrity-baseline.md`, `docs/integrity-baseline.json`
  - depends_on: WP-S0-A, WP-S0-B, WP-S0-C, WP-S0-D (todos mergeados)
  - deliverable: baseline congelado em Ubuntu via `.github/workflows/baseline-freeze.yml` (workflow_dispatch). PR aberto automaticamente.
  - integrity_required: pré-condição validada pelo próprio workflow (prettier, typecheck, test, build verdes).
  - estimate: 15min de relógio (workflow + review)
  - workflow: `.github/workflows/baseline-freeze.yml`

---

## Sprint 1 — Lifecycle financeiro + baseline RBAC

- [ ] WP-01 — ADR de lifecycle de assinatura (7 estados)
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: `docs/adr/ADR-001-subscription-lifecycle.md`
  - depends_on: WP-S0-Z (baseline congelado)
  - deliverable: ADR descrevendo transições (`trial → active → pending_payment → grace_period → suspended → canceled → archived`) com matriz de guardas, side-effects e eventos.
  - integrity_required: static, docs-lint
  - estimate: 0.5 dia

- [ ] WP-02 — Migration do estado `grace_period` e enum `subscription_status`
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: `drizzle/schema.ts` (tabela `subscriptions`), `drizzle/migrations/*_subscription_status_grace.sql`
  - depends_on: WP-01
  - deliverable: migration idempotente adicionando valor `grace_period` ao enum + coluna `grace_period_until TIMESTAMPTZ`. Rollback documentado.
  - integrity_required: static, unit, build, migrations
  - estimate: 1 dia

- [ ] WP-03 — Middleware `requireActiveSubscription` + helpers de lifecycle
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: `server/_core/trpc.ts`, `server/_core/middlewares/subscription.ts`, `server/_core/services/subscription-lifecycle.ts`, `shared/types/subscription.ts`
  - depends_on: WP-02
  - deliverable: middleware tRPC bloqueando chamadas em `suspended`/`canceled`; permitindo leitura em `grace_period`; emissão de eventos de transição.
  - integrity_required: static, unit, integration, build, impact(auth)
  - estimate: 1.5 dia

- [ ] WP-R1 — Auditoria do roleset platform admin atual
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: `docs/adr/ADR-002-platform-admin-roleset.md`
  - depends_on: WP-S0-Z (baseline congelado)
  - deliverable: ADR mapeando todas as procedures protegidas hoje por `platformSuperAdminProcedure` e `platformAdminOrSuperProcedure`, decisão sobre separar `platform_admin_ops` de `platform_admin_billing`.
  - integrity_required: static, docs-lint
  - estimate: 0.5 dia

---

## Em execução (claimed / in_progress)

_nenhum_

## Em revisão (review)

_nenhum_

## Bloqueados

_nenhum_

## Concluídos (mover após merge)

### Sprint 0.5

- [x] WP-S0-D — Alinhar versão pnpm em workflows + reconciliar lockfile
  - owner: A1
  - branch: agent-a1/WP-S0-D-pnpm-version-alignment
  - claimed_at: 2026-04-25
  - merged_pr: #8
  - merged_at: 2026-04-26T15:12:29Z
  - merge_commit: 12ecedb
  - scope: `.github/workflows/integrity.yml`, `.github/workflows/baseline-freeze.yml`, `pnpm-lock.yaml`
  - deliverable_realized: input `version: 9` removido dos dois workflows; `pnpm/action-setup@v4` agora lê `packageManager` do `package.json`. Lockfile reconciliado (6 itens de drift mascarados historicamente por pnpm 9).
  - spec: `docs/wp/WP-S0-D.md`

- [x] WP-S0-A — Portabilidade do build + normalização prettier
  - owner: A2
  - branch: agent-a2/WP-S0-A-portability-format
  - claimed_at: 2026-04-25
  - merged_pr: #7
  - merged_at: 2026-04-27T19:22:45Z
  - merge_commit: a0c6c75
  - scope: `package.json`, `pnpm-lock.yaml`, `.gitignore`, `.prettierignore`, + arquivos tocados por `prettier --write`
  - deliverable_realized: `cross-env` adicionado a `devDependencies` e aplicado nos scripts `dev`/`start`/`build:client`; 194 arquivos formatados por prettier; `.gitignore` expandido (`.tools/`, `.patches/`, prompts auxiliares); `email-templates/` adicionado a `.prettierignore`.
  - spec: `docs/wp/WP-S0-A.md`

- [x] WP-S0-B — Saneamento de testes frágeis
  - owner: A2
  - branch: agent-a2/WP-S0-B-purge-source-grep-tests
  - claimed_at: 2026-04-27
  - merged_pr: #13
  - merged_at: 2026-04-27T20:37:40Z
  - merge_commit: 7399d5b
  - scope: `server/agendamento-laudo.test.ts`, `server/delete-user.test.ts`, `server/formulario-agendamento-laudo.test.ts`, `server/email.test.ts` (escopo reduzido pós-auditoria)
  - deliverable_realized: 3 arquivos deletados (54 asserts grep-em-source removidos); `email.test.ts` preservado com `describe.skipIf(!process.env.SMTP_HOST)` (auditoria descobriu integração SMTP legítima, não grep). 4 issues de follow-up abertas: #9, #10, #11 (`tests-rewrite`), #12 (`tech-debt`).
  - spec: `docs/wp/WP-S0-B.md`

- [x] WP-S0-E — Renormalização de line endings + gate de prettier
  - owner: A1
  - branch: agent-a1/WP-S0-E-line-endings-and-prettier-gate
  - claimed_at: 2026-04-29
  - merged_pr: #15
  - merged_at: 2026-04-29T20:00:42Z
  - merge_commit: c681f59
  - scope: `.gitattributes` (novo), `.github/workflows/integrity.yml`, `Dockerfile`, `email-templates/psicotecnico.html`, `railway.toml`, `docs/wp/WP-S0-D.md`, `server/email.test.ts`
  - deliverable_realized: `.gitattributes` força `eol=lf` em text files (binários explícitos via `*.png/jpg/woff/etc binary`); novo step `pnpm prettier --check .` no workflow `Integrity Check` como gate de PR. 4 arquivos com drift CRLF→LF renormalizados. 2 arquivos com drift de prettier corrigidos via `prettier --write` (incluindo exceção documentada: `server/email.test.ts` em zona A2 tocado por A1 via mudança puramente mecânica).
  - spec: WP-S0-E (sem documento dedicado; spec inline na conversa de ativação).

- [x] hotfix-cross-env — Remove `cross-env` do start script (deploy Railway)
  - owner: A1 (hot-fix reativo)
  - branch: railway/fix-deploy-7141ea
  - claimed_at: 2026-04-29
  - merged_pr: #16
  - merged_at: 2026-04-29T20:51:31Z
  - merge_commit: dd15455
  - scope: `package.json`
  - deliverable_realized: troca de `"start": "cross-env NODE_ENV=production node dist/index.cjs"` por `"start": "NODE_ENV=production node dist/index.cjs"`. Causa raiz: `Dockerfile` faz `pnpm prune --prod` removendo `cross-env` (devDependency), e `start` precisava do binário em runtime. Bash inline `NODE_ENV=...` é portável em containers Linux.
  - tipo: hotfix (não planejado), reativo a Railway crash loop. Branch criada pela integração Railway/GitHub (nome `railway/fix-deploy-<hash>`).

---

## Notas operacionais — Sprint 0.5

### Lacuna do state machine (descoberta em WP-S0-B)

O state `[x]` é definido como "PR merged em `main`". O fluxo `feature → hml → main` cria um estado intermediário sem rótulo oficial: "merged em `hml`, aguardando promoção batch para `main` via Marco 2".

Convenção temporária para este sprint: marcar como `[x]` ao mergear em `hml`. A promoção `hml → main` acontece no fechamento do Marco 2, via PR de promoção dedicado.

Formalizar em adendo ao ADR-000 (próximo turno de A1).

### Aprendizados de execução

1. **Pausa explícita = parada total.** Quando o operador escreve "Pause" ou "Cole X antes de Y", o agente NÃO antecipa, NÃO consolida output, NÃO infere. Para naquele exato ponto e cola o output cru.
2. **Conflitos de push (non-fast-forward) e rebase exigem pausa.** Agente nunca resolve autonomamente. Reporta erro, espera decisão.

Ambas as regras descobertas em violação durante a execução do WP-S0-B. Formalizar em adendo ao ADR-000.

---

## Template para novos WPs

```
- [ ] WP-XX — <título curto>
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: <caminhos específicos>
  - depends_on: <WP-YY | —>

```
