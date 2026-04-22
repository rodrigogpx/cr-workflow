# TASKS — Backlog Multi-Agente

> **Fonte de verdade** para reivindicação de tarefas pelos agentes A1, A2 e A3.
> **Nunca** edite este arquivo fora do protocolo descrito em `docs/PLANO-MULTI-AGENTE.md` §6.
>
> **Referência obrigatória:** `docs/adr/ADR-000-multi-agent-workflow.md`.

---

## Estados

| Marcador | Estado         | Significado                                                                   |
| -------- | -------------- | ----------------------------------------------------------------------------- |
| `[ ]`    | available      | Disponível para reivindicação por qualquer agente compatível com o escopo.    |
| `[~]`    | claimed        | Reivindicado por um agente. Nenhum outro agente pode editar os mesmos paths. |
| `[>]`    | in_progress    | Agente iniciou commits de implementação.                                      |
| `[?]`    | review         | PR aberto, aguardando revisão e Integrity Report verde.                       |
| `[x]`    | completed      | PR merged em `main`. Mover para o histórico ao final do sprint.               |
| `[!]`    | blocked        | Bloqueado por dependência, decisão pendente ou falha de integridade.          |

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

## Sprint 1 — Lifecycle financeiro + baseline RBAC

- [ ] WP-01 — ADR de lifecycle de assinatura (7 estados)
  - owner: —
  - branch: —
  - claimed_at: —
  - scope: `docs/adr/ADR-001-subscription-lifecycle.md`
  - depends_on: WP-00
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
  - depends_on: WP-00
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
  - deliverable: <descrição objetiva e verificável>
  - integrity_required: <camadas>
  - estimate: <X dias>
```
