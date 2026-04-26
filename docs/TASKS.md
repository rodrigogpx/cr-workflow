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

- [ ] WP-S0-A — Portabilidade do build + normalização prettier
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: `package.json`, `pnpm-lock.yaml`, **+ todo arquivo tocado por `prettier --write .`** (autorizado por exceção no spec)
  - depends_on: —
  - deliverable: cross-env nos scripts dev/start/build:client; repo inteiro normalizado por prettier. 2 commits separados.
  - integrity_required: static (prettier), build
  - estimate: 1h
  - spec: `docs/wp/WP-S0-A.md`
  - prompt: `docs/prompts/ACTIVATE-A2-WP-S0-A.md`

- [ ] WP-S0-B — Saneamento de testes frágeis
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: `server/agendamento-laudo.test.ts`, `server/delete-user.test.ts`, `server/email.test.ts` (parcial), `server/formulario-agendamento-laudo.test.ts`
  - depends_on: WP-S0-A
  - deliverable: 4 arquivos (ou suítes) deletados; 4 issues `tests-rewrite` abertas. ADR-004.
  - integrity_required: static, unit
  - estimate: 2h
  - spec: `docs/wp/WP-S0-B.md`
  - prompt: `docs/prompts/ACTIVATE-A2-WP-S0-B.md`

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

- [~] WP-S0-D — Alinhar versão pnpm em workflows com `packageManager`
  - owner: A1
  - branch: agent-a1/WP-S0-D-pnpm-version-alignment
  - claimed_at: 2026-04-25
  - scope: `.github/workflows/integrity.yml`, `.github/workflows/baseline-freeze.yml`
  - depends_on: nenhum (paralelo a S0-A; deve mergear ANTES de S0-A para destravar CI)
  - deliverable: remover input `version: 9` dos dois workflows; `pnpm/action-setup@v4` passa a ler `packageManager` do `package.json`. 1 commit, 4 linhas removidas.
  - integrity_required: static (YAML), CI smoke (re-run de `integrity.yml` no próprio PR)
  - estimate: 30min
  - spec: `docs/wp/WP-S0-D.md`
  - prompt: `docs/prompts/ACTIVATE-A1-WP-S0-D.md`

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

_nenhum_

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
