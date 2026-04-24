# ADR-000 — Workflow Multi-Agente com Windsurf Cascade

- **Status:** Accepted
- **Data:** 2026-04-21
- **Autor:** A1 (Docs/ADR) — aprovado por Rodrigo
- **Contexto:** Firerange Workflow (CAC 360) — projetos "Gestão Financeira" e "RBAC Platform Admin"
- **Supersede:** —
- **Referência principal:** `docs/PLANO-MULTI-AGENTE.md`

---

## 1. Contexto

O desenvolvimento dos módulos de **Gestão Financeira** (lifecycle de assinatura, enforcement de limites, cobrança) e **RBAC Platform Admin** (segregação entre `platform_admin` e `platform_super_admin`) envolve mudanças simultâneas em backend (`server/`, `drizzle/`), frontend (`client/`) e documentação (`docs/`). Executar sequencialmente é lento; executar em paralelo sem protocolo causa conflitos de merge, regressões silenciosas e perda de rastreabilidade.

A proposta do plano `PLANO-MULTI-AGENTE.md` define três agentes operando via Windsurf Cascade:

- **A1 — Docs/ADR:** documentação técnica e ADRs.
- **A2 — Backend/DB:** schema, migrations, serviços, middlewares tRPC.
- **A3 — Frontend/UX:** componentes React, telas, testes de UI.

Este ADR formaliza as **regras de engajamento** que tornam esse paralelismo seguro.

## 2. Decisão

Adotamos **git-based distributed locking** como mecanismo primário de coordenação entre agentes:

1. **Fonte de verdade única:** `docs/TASKS.md` lista todos os work packages (WPs) e seus estados.
2. **Claim atômico:** reivindicar um WP exige um commit isolado que altera apenas a linha do WP em `TASKS.md` (de `[ ]` para `[~]`) e preenche `owner`, `branch`, `claimed_at`. O primeiro `git push` vence; o perdedor recebe conflito de merge e escolhe outro WP.
3. **Não-fragmentação:** um agente reivindica o WP inteiro. Subdividir exige abrir novo WP via A1 + novo ADR.
4. **Allowlist de diretórios** (enforced via `.windsurf/rules/`):
   - A1: `docs/**`, `.github/**`, `README.md`, `CHANGELOG.md`.
   - A2: `server/**`, `drizzle/**`, `shared/**`, `scripts/**`, `drizzle.config.ts`.
   - A3: `client/**`, `public/**`, `tests/frontend/**`, `index.html`, `vite.config.ts`.
5. **Branch-por-agente-por-WP:** nomenclatura `agent-{a1|a2|a3}/WP-XX-slug`. PRs miram `hml` (homologação) com review obrigatório. A promoção `hml → main` é manual, sob responsabilidade do owner do repositório, fora do loop dos agentes. O CI de integridade roda nos PRs que mirem `hml` **e** nos que mirem `main`.
6. **CODEOWNERS** reforça mecanicamente a allowlist: PR que toque diretório fora do escopo do autor bloqueia merge.
7. **Integrity Report obrigatório:** antes de mover um WP para `[?]` (review), o agente executa `scripts/integrity-check.sh` e cola a saída na descrição do PR. Sem report verde nas camadas obrigatórias, o PR não é elegível para merge.

## 3. Estados canônicos de WP

| Marcador | Estado | Semântica |
| - | - | - |
| `[ ]` | available | Qualquer agente com escopo compatível pode reivindicar. |
| `[~]` | claimed | Reivindicado; nenhum outro agente edita os mesmos paths. |
| `[>]` | in_progress | Agente iniciou commits de implementação. |
| `[?]` | review | PR aberto; aguardando revisão e Integrity Report. |
| `[x]` | completed | Merge em `hml`. Movido para histórico ao final do sprint. (A eventual promoção `hml → main` é ortogonal ao ciclo de vida do WP.) |
| `[!]` | blocked | Dependência, decisão pendente ou falha de integridade. |

## 4. Camadas de integridade (resumo)

Detalhe completo em `docs/PLANO-MULTI-AGENTE.md` §7. Resumo da obrigatoriedade:

| Camada | A1 (docs) | A2 (backend) | A3 (frontend) |
| - | - | - | - |
| static (lint/typecheck/format/docs-lint) | ✔ | ✔ | ✔ |
| unit | — | ✔ | ✔ |
| integration | — | ✔ | condicional |
| build | — | ✔ | ✔ |
| smoke | — | ✔ | ✔ |
| regression | — | ✔ | ✔ |
| migrations | — | ✔ (se schema alterado) | — |
| impact (auth/workflow/email) | — | ✔ (conforme WP) | condicional |

## 5. Consequências

**Positivas:**

- Paralelismo seguro entre três agentes sem intervenção manual constante.
- Rastreabilidade: cada WP tem claim, branch, PR, Integrity Report e merge vinculados.
- Baseline de integridade congelado no Sprint 0 evita regressões invisíveis.

**Negativas / trade-offs aceitos:**

- Sobrecarga inicial: Sprint 0 inteiro dedicado a protocolo, sem entrega funcional.
- Contenção em arquivos-ponte (ex.: `server/_core/trpc.ts`) exige serialização via dependências declaradas em `depends_on`.
- Claim por commit atômico pode gerar retrabalho se dois agentes racharem no mesmo segundo; mitigado por "primeiro push vence" e mensagens claras de conflito.

## 6. Alternativas descartadas

- **Fila central (Redis/DB):** adiciona infra para problema resolvido por `git push` atômico.
- **Locks por arquivo:** frágil; vários WPs tocam múltiplos arquivos e resultaria em deadlocks frequentes.
- **Execução serial com review humano entre cada WP:** descarta o ganho de paralelismo.

## 7. Ações habilitadas por este ADR

1. Criação de `docs/TASKS.md` (feita em WP-00).
2. Criação de `.windsurf/rules/agent-{a1,a2,a3}.md` (feita em WP-00).
3. Criação de `scripts/integrity-check.sh` (feita em WP-00).
4. Configuração de `.github/CODEOWNERS` e proteção das branches `hml` e `main` (feita em WP-00 + passo operacional no GitHub). A branch `hml` recebe PRs dos agentes; `main` só recebe promoções manuais a partir de `hml`.
5. Abertura dos primeiros WPs reivindicáveis: WP-01, WP-02, WP-03, WP-R1.

## 8. Revisão

Este ADR será revisitado se:

- Mais de 5 WPs forem bloqueados por conflito de escopo em um sprint.
- Algum agente operar consistentemente fora da allowlist (falha sistêmica).
- Introdução de um quarto agente.
