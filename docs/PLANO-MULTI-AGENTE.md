# Plano de Desenvolvimento Multi-Agente — CAC 360

**Escopo:** Gestão Financeira + RBAC Platform Admin
**Coordenação:** 3 agentes via Windsurf Cascade
**Versão:** 1.0 — Abril 2026

---

## Índice

1. [Visão geral e objetivos](#1-visão-geral-e-objetivos)
2. [Agentes — papéis, responsabilidades e perfis](#2-agentes--papéis-responsabilidades-e-perfis)
3. [Arquitetura de colaboração no Windsurf Cascade](#3-arquitetura-de-colaboração-no-windsurf-cascade)
4. [Fluxo Git e branching strategy](#4-fluxo-git-e-branching-strategy)
5. [Protocolos de comunicação](#5-protocolos-de-comunicação)
6. [Protocolo de seleção de tarefas via checklist no código](#6-protocolo-de-seleção-de-tarefas-via-checklist-no-código)
7. [Protocolo de verificação de integridade pós-desenvolvimento](#7-protocolo-de-verificação-de-integridade-pós-desenvolvimento)
8. [Decomposição do trabalho por work package](#8-decomposição-do-trabalho-por-work-package)
9. [Planejamento temporal](#9-planejamento-temporal)
10. [Quality gates e critérios de aceite](#10-quality-gates-e-critérios-de-aceite)
11. [Gestão de risco](#11-gestão-de-risco-e-pontos-de-atenção)
12. [Onboarding dos agentes no Windsurf](#12-onboarding-dos-agentes-no-windsurf-setup)
13. [Métricas e ritos](#13-métricas-e-ritos-de-acompanhamento)
14. [Apêndice A — prompts](#14-apêndice-a--prompts-padronizados-por-agente)
15. [Apêndice B — checklist pré-merge](#15-apêndice-b--checklist-pré-merge)
16. [Apêndice C — template TASKS.md](#16-apêndice-c--template-do-arquivo-docstasksmd)
17. [Apêndice D — script integridade](#17-apêndice-d--script-de-verificação-de-integridade)

---

## 1. Visão geral e objetivos

Este plano descreve como coordenar três agentes de desenvolvimento — um Arquiteto/Revisor, um Backend e um Frontend — operando simultaneamente sobre o repositório CAC 360 através da plataforma **Windsurf Cascade**. O objetivo é implementar, em paralelo e com garantia de qualidade, dois blocos de trabalho já validados: (i) gestão financeira (8 fases do roadmap) e (ii) RBAC de platform admin (CRUD de admins, guards granulares, bootstrap de primeiro superadmin).

### Benefícios esperados

- Paralelismo controlado: agentes atuam em branches independentes sem colidir.
- Qualidade incremental: Arquiteto revisa PRs antes de merge (quality gate).
- Aderência ao código existente: agentes recebem contexto do repo via Cascade.
- Rastreabilidade: cada mudança tem branch, PR, issue e log de agente.

### Premissas

- Repositório em GitHub, ambiente `hml` no Railway conforme documentado.
- Todos os agentes operam com Windsurf Cascade, cada um em sessão isolada.
- O usuário (tech lead) aprova PRs e resolve conflitos quando necessário.
- Modelo de LLM dos agentes: **Sonnet 4.6** (padrão); **Opus 4.6** para o Arquiteto em revisões complexas.

---

## 2. Agentes — papéis, responsabilidades e perfis

Três agentes foram definidos para equilibrar paralelismo e custo de coordenação. Cada agente opera em sua própria sessão Windsurf, com sua própria branch e seu próprio conjunto de regras de contexto (`.windsurfrules` ou equivalente).

| Agente                       | Responsabilidades                                                                       | Artefatos                                                                    | NÃO faz                                          |
| ---------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **A1 — Arquiteto / Revisor** | Define contratos de API, schemas do DB, decide padrões. Revisa todos os PRs. Gera ADRs. | ADRs em `docs/adr/`, specs tRPC, checklists                                  | NÃO implementa features; foca em direção técnica |
| **A2 — Backend**             | DB (drizzle + migrations), routers tRPC, middlewares, cron, emailService, limites       | Migrations, `server/routers/*`, `server/_core/trpc.ts`, jobs, testes backend | NÃO altera UI nem componentes React              |
| **A3 — Frontend**            | Páginas React, componentes de gating (Paywall, Banner), hooks, formulários              | `client/src/pages/*`, `client/src/components/billing/*`, hooks, testes e2e   | NÃO altera schema do DB nem rotas tRPC           |

### 2.1. Matriz RACI resumida

| Atividade                | A1 Arq | A2 Back | A3 Front | Tech lead |
| ------------------------ | :----: | :-----: | :------: | :-------: |
| Definir contrato de tRPC |  R/A   |    C    |    C     |     I     |
| Desenhar schema          |   A    |    R    |    I     |     C     |
| Escrever migration       |   C    |    R    |    I     |     A     |
| Implementar rota backend |   C    |   R/A   |    I     |     I     |
| Implementar UI + hooks   |   C    |    C    |   R/A    |     I     |
| Escrever testes          |   I    |   R/A   |   R/A    |     I     |
| Revisar PR               |  R/A   |    C    |    C     |     I     |
| Aprovar e mergear PR     |   R    |    I    |    I     |     A     |
| Deploy em hml            |   I    |    C    |    C     |    R/A    |

**Legenda:** R = Responsável, A = Aprova, C = Consultado, I = Informado.

---

## 3. Arquitetura de colaboração no Windsurf Cascade

O Windsurf Cascade é o agente de IDE que roda dentro do Windsurf (editor baseado em VS Code). Cada agente do plano é uma **sessão Cascade distinta**, operando em um checkout local do repositório, em uma branch dedicada. A coordenação é feita via Git, issues no GitHub e arquivos de contexto.

### 3.1. Visão topológica

Cada sessão Cascade tem:

- Workspace local (clone do repo) apontando para uma branch específica do agente.
- Arquivo `.windsurfrules` na raiz — define comportamento do agente.
- Context docs — referências obrigatórias em `.windsurf/context/*.md`.
- Escopo restrito — cada agente só pode editar diretórios que lhe foram atribuídos.

### 3.2. Estrutura de diretórios proposta

```
.windsurf/
├── rules/
│   ├── architect.md    # Regras do A1
│   ├── backend.md      # Regras do A2
│   └── frontend.md     # Regras do A3
└── context/
    ├── ANALISE-PROJETO.md
    ├── GESTAO-FINANCEIRA-VALIDACAO.md
    └── platform-admin-rbac.md
docs/
├── adr/                # Architecture Decision Records
│   └── TEMPLATE.md
├── TASKS.md            # Fila oficial de trabalho (ver §6)
└── PLANO-MULTI-AGENTE.md
scripts/
└── integrity-check.sh  # Ver Apêndice D
```

### 3.3. Escopo de edição por agente (allowlist)

| Agente       | Caminhos permitidos                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1 Arq**   | `docs/**`, `.windsurf/**`, `README.md`. Modo leitura: todo o repo. Qualquer mudança em código é feita via PR do A2 ou A3 sob orientação do A1. |
| **A2 Back**  | `server/**`, `drizzle/**`, `shared/**`, `scripts/**`, `package.json` (com justificativa), `tests/backend/**`                                   |
| **A3 Front** | `client/**`, `public/**`, `index.html`, `vite.config.*`, `tests/frontend/**`, `styles.**`                                                      |

### 3.4. Ferramentas Cascade utilizadas

- **Todos**: Read, Edit, Grep/Search, Run Command (npm, git), Browser Preview.
- **A1**: Write apenas em `docs/**`; Explore Repo para mapeamento.
- **A2**: Write em `server/**`, `drizzle/**`; roda `npm run db:push`, `npm test`, `npm run dev`.
- **A3**: Write em `client/**`; roda `npm run dev`, `npm run build`, `npm run e2e`.

---

## 4. Fluxo Git e branching strategy

Adotamos **trunk-based development** com branches curtas por agente, baseadas em `hml`. Branches long-lived são proibidas para os agentes.

### 4.1. Convenção de nomes

- `feat/a1/adr-<nn>-<slug>` — ADRs do Arquiteto
- `feat/a2/<fase>-<slug>` — Backend (ex: `feat/a2/f1-acl-schema`)
- `feat/a3/<fase>-<slug>` — Frontend (ex: `feat/a3/f1-paywall-ui`)
- `chore/<slug>` — infraestrutura/docs

### 4.2. Ciclo de uma tarefa

1. A1 escreve ADR em `docs/adr/ADR-XXX.md` em branch `feat/a1/adr-xxx-<slug>`.
2. A1 abre PR do ADR; tech lead aprova. ADR vira fonte da verdade.
3. A2 cria branch `feat/a2/<fase>-<slug>` a partir de `hml`, implementa migration + rota + testes.
4. A3, em paralelo, cria branch `feat/a3/<fase>-<slug>`; inicialmente usa mocks dos tipos tRPC.
5. A2 faz push; Draft PR aberto; A3 rebaseia sobre a branch de A2 quando tipos mudam.
6. Após testes locais OK, A2 e A3 marcam PR como Ready; A1 revisa; tech lead aprova e mergea em `hml`.
7. Railway faz deploy automático em hml; fumaça manual no ambiente.
8. Após 2 sprints estáveis em hml, tech lead faz PR `hml → main` (release).

### 4.3. Regras rígidas

- Proibido push direto em `hml` ou `main` — sempre via PR.
- Um PR nunca mistura escopo (ex: não pode mudar `server/` E `client/` no mesmo PR).
- Commits seguem **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Toda migration tem número sequencial e é irreversível após merge em `hml`.

---

## 5. Protocolos de comunicação

### 5.1. Contexto compartilhado (single source of truth)

- **ADRs em `docs/adr/**`\*\* — única fonte de verdade para decisões técnicas.
- **Tipos tRPC exportados em `shared/`** — contrato backend ↔ frontend.
- **OpenAPI-like spec em `docs/specs/*.md`** — escrita pelo A1 antes do A2 implementar.
- **Issues do GitHub** — task atômica vinculada a uma fase e a um agente.

### 5.2. Handoff A1 → A2 (arquiteto para backend)

Entrega obrigatória do A1 antes de o A2 iniciar:

- ADR aprovado (contexto, decisão, consequências, alternativas).
- Esboço da migration (tabelas + colunas + índices + FKs).
- Assinatura de cada rota tRPC nova (input/output em TypeScript-like ou Zod pseudo-schema).
- Lista de middlewares a aplicar em cada rota.

### 5.3. Handoff A2 → A3 (backend para frontend)

Entrega obrigatória do A2:

- Branch A2 mergeada em hml com tipos tRPC disponíveis via npm workspace ou via `shared/`.
- Exemplo de chamada no README do PR (curl ou snippet tRPC).
- Erros esperados documentados (`TRPCError`) — A3 precisa saber o que renderizar em toast.

### 5.4. Escalação

- Divergência entre A2 e A3 sobre contrato → chamar A1.
- Divergência entre A1 e implementação → tech lead decide via comentário no ADR.
- Bloqueio por dependência externa → issue com label `blocked`.

---

## 6. Protocolo de seleção de tarefas via checklist no código

Para evitar colisão entre agentes, garantir rastreabilidade e dar visibilidade do progresso, adotamos um arquivo de checklist versionado no próprio repositório: **`docs/TASKS.md`** (template no Apêndice C). Este arquivo é a fila de trabalho oficial; **nenhum agente inicia uma tarefa sem reivindicá-la previamente nesse checklist e commitar a reivindicação**.

### 6.1. Princípios

- **Uma tarefa = um work package completo** (do WP-01 ao WP-15 e WP-R1 a WP-R4). Agentes NUNCA pegam fração de tarefa.
- Todo acesso ao checklist é **atômico via commit no Git** — o Git serve como lock distribuído.
- Agentes só têm **uma** tarefa `in_progress` por vez.
- Tarefa não reivindicada no checklist é tarefa que não existe no planejamento oficial.

### 6.2. Estados de uma tarefa

| Estado        | Marcador | Significado                                                                                        |
| ------------- | :------: | -------------------------------------------------------------------------------------------------- |
| `available`   |  `[ ]`   | Ainda não reivindicada; qualquer agente elegível pode pegá-la.                                     |
| `claimed`     |  `[~]`   | Reivindicada; metadados preenchidos (agente, branch, timestamp, ADR). Locked para outros.          |
| `in_progress` |  `[>]`   | Trabalho iniciado de fato; primeiro commit de código feito; PR draft aberto.                       |
| `review`      |  `[?]`   | Implementação concluída + integridade verificada; aguardando review do A1.                         |
| `completed`   |  `[x]`   | PR mergeado em `hml`; link do PR + hash do commit registrados.                                     |
| `blocked`     |  `[!]`   | Dependência externa impediu progresso. Motivo documentado. Retorna a `available` após desbloqueio. |

### 6.3. Workflow obrigatório: claim → work → release

#### Passo 1 — Descoberta de tarefas disponíveis

1. `git checkout hml && git pull origin hml`
2. Abrir `docs/TASKS.md` e listar todas as tarefas com estado `[ ]`.
3. Filtrar pelo seu perfil (A1, A2 ou A3).
4. Filtrar por tarefas cujas dependências já estão `[x]`.
5. Selecionar **uma** tarefa completa. Jamais metade.

#### Passo 2 — Reivindicação (CLAIM) antes de começar

Este passo é OBRIGATÓRIO e acontece ANTES de qualquer mudança de código.

1. Criar a branch: `git checkout -b feat/<agente>/<id-wp>-<slug>`
2. Editar `docs/TASKS.md`: mudar o `[ ]` da tarefa escolhida para `[~]` e preencher o bloco de metadados.
3. **Commit dedicado**: `git commit -m "chore(tasks): claim WP-XX by A2"` — APENAS o arquivo `docs/TASKS.md` nesse commit.
4. `git push origin feat/<agente>/<id-wp>-<slug>` — o push funciona como "anúncio" aos outros agentes.
5. Abrir **PR Draft imediatamente** (mesmo sem código ainda) com título `[WP-XX] <descrição>`.
6. Colar no corpo do PR o checklist do Apêndice B preenchido parcialmente.

#### Passo 3 — Promoção a in_progress

1. Ao fazer o primeiro commit de código, rodar `git fetch origin hml`.
2. Editar `docs/TASKS.md`: mudar `[~]` para `[>]`.
3. Commitar a mudança do checklist junto com o primeiro commit de código.

#### Passo 4 — Desenvolvimento

- Fazer commits pequenos e focados (máx. ~200 linhas cada).
- Rebaser em hml diariamente: `git fetch origin hml && git rebase origin/hml`.
- Se conflitar no `docs/TASKS.md` com claim de outro agente: sinalizar no PR; tech lead decide.
- **NÃO abandonar tarefa no meio.** Se impossível seguir: mudar estado para `[!]` com motivo.

#### Passo 5 — Encerramento (verificação + release)

Ver §7 para o protocolo completo de verificação. Resumo:

1. Rodar o script de verificação de integridade (Apêndice D).
2. Se todos os checks passaram: editar `docs/TASKS.md` → `[>]` vira `[?]` + preencher campo `integrityChecks`.
3. Tirar o PR de Draft, marcar como Ready for review e solicitar review do A1.
4. Após merge: mudar `[?]` para `[x]` e preencher PR URL + commit hash.
5. **Só então** o agente pode voltar ao Passo 1 para nova tarefa.

### 6.4. Regras anti-colisão

- Dois agentes NUNCA podem ter a mesma tarefa no estado `[~]` ou `[>]`. Se acontecer, o Git detecta conflito no merge do claim commit e o tech lead intervém.
- Uma tarefa só vai para `[?]` se o PR estiver efetivamente Ready; caso contrário, permanece `[>]`.
- Tarefa abandonada >48h sem commit em review: tech lead pode voltá-la para `[ ]`.
- Agente SÓ lê `docs/TASKS.md` da branch `hml` mais recente; nunca da sua branch (que pode estar defasada).

---

## 7. Protocolo de verificação de integridade pós-desenvolvimento

Antes de marcar uma tarefa como `review [?]` e solicitar aprovação, o agente **deve rodar e registrar no PR** um conjunto de verificações que asseguram que o sistema continua íntegro. O script completo está no Apêndice D.

### 7.1. Camadas de verificação

|  #  | Camada     | O que valida                                             | Como executar                                               |
| :-: | ---------- | -------------------------------------------------------- | ----------------------------------------------------------- |
|  1  | Estática   | Lint + TypeScript + formatação                           | `npm run lint && npm run typecheck && npm run format:check` |
|  2  | Unit       | Lógica isolada (helpers, pure functions)                 | `npm test -- --run`                                         |
|  3  | Integração | Rotas tRPC + DB em memória                               | `npm run test:integration`                                  |
|  4  | Build      | Frontend e backend compilam sem erros novos              | `npm run build`                                             |
|  5  | Smoke      | App sobe; rota saúde OK; login funciona                  | `npm run dev` + `curl /api/health`                          |
|  6  | Regressão  | Áreas NÃO relacionadas continuam funcionando             | E2E em módulos não tocados                                  |
|  7  | Migrations | Migrations up/down aplicam sem erro                      | DB limpo → migrations → seed → testes                       |
|  8  | Impacto    | Impacto em módulos adjacentes (auth, workflow CR, email) | Testes dos módulos listados em "Impacto em" do ADR          |

### 7.2. Matriz de obrigatoriedade por agente

| Camada       | A1 Arq | A2 Back | A3 Front | Observação                                |
| ------------ | :----: | :-----: | :------: | ----------------------------------------- |
| 1 Estática   |   —    | **OBR** | **OBR**  | A1 valida via lint de markdown em `docs/` |
| 2 Unit       |   —    | **OBR** | **OBR**  |                                           |
| 3 Integração |   —    | **OBR** |    —     | A3 mocka tRPC                             |
| 4 Build      |   —    | **OBR** | **OBR**  |                                           |
| 5 Smoke      |   —    | **OBR** | **OBR**  |                                           |
| 6 Regressão  |   —    | **OBR** | **OBR**  | Parcial se tarefa pequena + ADR autoriza  |
| 7 Migrations |   —    | **CND** |    —     | Só se tocou `drizzle/**`                  |
| 8 Impacto    |   —    | **OBR** | **OBR**  | Lista do ADR define escopo                |

**OBR** = obrigatório; **CND** = condicional; **—** = não aplicável.

### 7.3. Registro do resultado no PR

Ao marcar o PR como Ready, o agente DEVE colar na descrição um bloco **Integrity Report**:

```
Integrity Report (WP-XX) — executado em <timestamp UTC>
- Estática: ✓ (lint 0 warn, typecheck 0 err)
- Unit: ✓ (124/124 passing, cobertura +3%)
- Integração: ✓ (28/28)
- Build: ✓ (bundle +4 KB em relação ao main; dentro do limite)
- Smoke: ✓ (/api/health 200, login OK, workflow CR OK)
- Regressão: ✓ (auth + email + workflow CR intactos)
- Migrations: n/a — tarefa não tocou drizzle/**
- Impacto (auth, workflow, email): ✓
```

### 7.4. Política de falha

- Qualquer camada ✗ bloqueia a promoção a `[?]` review. A tarefa permanece em `[>]`.
- O agente deve corrigir e rodar novamente o ciclo completo.
- Se a falha estiver em módulo NÃO tocado (regressão verdadeira), abrir issue específica e pausar.
- Três ciclos reprovados consecutivos = bloqueio automático e escalação para tech lead.

---

## 8. Decomposição do trabalho por work package

### 8.1. Bloco FINANCEIRO — 8 fases

| ID    | Fase              | Pacote                                                       | Owner | Depende | ADR     |
| ----- | ----------------- | ------------------------------------------------------------ | :---: | ------- | ------- |
| WP-01 | F1 ACL            | Schema: catálogo de planos, featureOverrides JSONB           |  A2   | —       | ADR-001 |
| WP-02 | F1 ACL            | `reconcileFeatures(tenant)` + `requirePlan` + tests          |  A2   | WP-01   | ADR-001 |
| WP-03 | F1 ACL            | `useSubscription` hook + `<Paywall/>` + banners              |  A3   | WP-01   | ADR-001 |
| WP-04 | F2 Lifecycle      | `subscriptionEvents` table + migration + helpers             |  A2   | WP-02   | ADR-002 |
| WP-05 | F2 Lifecycle      | `cron.billing.dailyTick` + `lifecycleTick`                   |  A2   | WP-04   | ADR-002 |
| WP-06 | F2 Lifecycle      | `billingBypass` decorator + allowlist em suspended           |  A2   | WP-02   | ADR-002 |
| WP-07 | F3 Billing admin  | Rotas tRPC: `confirmPayment`, `voidInvoice`, `adjustInvoice` |  A2   | WP-04   | ADR-003 |
| WP-08 | F3 Billing admin  | UI SuperAdmin: Faturamento, MRR/ARR/inadimplência            |  A3   | WP-07   | ADR-003 |
| WP-09 | F4 Emails billing | Templates D-7/D-0/D+3/D+5/suspended/receipt                  |  A2   | WP-05   | ADR-004 |
| WP-10 | F5 Self-service   | Página "Minha assinatura"                                    |  A3   | WP-08   | ADR-005 |
| WP-11 | F5 Self-service   | Rotas: `requestUpgrade`, `requestDowngrade`, `requestCancel` |  A2   | WP-07   | ADR-005 |
| WP-12 | F6 LGPD           | `cron.lgpd.purge` + `tenants.requestDeletion`                |  A2   | WP-05   | ADR-006 |
| WP-13 | F6 LGPD           | UI super admin: pedidos LGPD, janela 30d                     |  A3   | WP-12   | ADR-006 |
| WP-14 | F7 Gateway        | Skeleton Stripe/PagSeguro (sandbox) — _opcional_             |  A2   | WP-07   | ADR-007 |
| WP-15 | F8 Fiscal         | Emissão NFS-e — _opcional_                                   |  A2   | WP-14   | ADR-008 |

### 8.2. Bloco RBAC Platform Admin — 4 frentes

| ID    | Frente       | Pacote                                                                                                                                  | Owner | Depende | ADR    |
| ----- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | :---: | ------- | ------ |
| WP-R1 | DB layer     | 8 funções em `server/dbLayer`: getAllPlatformAdmins, create, update, changePassword, setStatus, setRole, delete, countActiveSuperAdmins |  A2   | —       | ADR-R1 |
| WP-R2 | tRPC routers | Router `platformAdmins.*` + guards granulares                                                                                           |  A2   | WP-R1   | ADR-R1 |
| WP-R3 | Bootstrap    | `auth.bootstrapSuperAdmin` + script CLI                                                                                                 |  A2   | WP-R2   | ADR-R2 |
| WP-R4 | UI           | PlatformAdminUsers, AdminList, AdminForm, ChangePasswordDialog                                                                          |  A3   | WP-R2   | ADR-R1 |

### 8.3. Grafo de paralelismo

Onde paralelizar:

- WP-02 (A2) || WP-03 (A3) — A3 consome tipo via mock até A2 mergear.
- WP-07 (A2) || WP-10 (A3 com mocks) || WP-R4 (A3).
- WP-12 (A2) || WP-13 (A3 preparando UI com mocks).

**Regra:** nunca dois work packages do mesmo agente em paralelo. A1 pode trabalhar em qualquer ADR a qualquer momento.

---

## 9. Planejamento temporal

Sprints de 1 semana. Total estimado: **11 sprints (~3 meses)** para o MVP (fases 1–6 + RBAC).

| Sprint | Work Packages                 | Objetivo                                        |
| :----: | ----------------------------- | ----------------------------------------------- |
|   S1   | ADRs 001–003 + WP-01 + WP-R1  | Fundação ACL e schema DB                        |
|   S2   | WP-02 + WP-03 + WP-R2         | Middleware `requirePlan` + paywall + rotas RBAC |
|   S3   | WP-04 + WP-06 + WP-R3 + WP-R4 | Lifecycle base + bootstrap superadmin + UI RBAC |
|   S4   | WP-05 + ADR-004               | Cron billing ciclo completo                     |
|   S5   | WP-07 + WP-09                 | Billing admin API + emails billing              |
|   S6   | WP-08                         | UI super admin Faturamento + MRR/ARR            |
|   S7   | WP-11 + ADR-005               | APIs self-service                               |
|   S8   | WP-10                         | UI self-service "Minha assinatura"              |
|   S9   | WP-12 + WP-13 + ADR-006       | LGPD: purge + UI + audit                        |
|  S10   | Hardening + testes e2e        | Corrida de bugs; testes em hml                  |
|  S11   | UAT + go-live hml→main        | Aprovação e deploy                              |

Sprints 12+ (opcional): WP-14 (gateway, 3 sprints) + WP-15 (fiscal, 3 sprints).

---

## 10. Quality gates e critérios de aceite

### 10.1. Gate 1 — Antes de abrir PR

- Lint OK (`npm run lint`).
- TypeScript check OK (`npm run typecheck`).
- Testes unitários passando (cobertura ≥ 70% na área alterada).
- Commit seguindo Conventional Commits.

### 10.2. Gate 2 — Revisão do A1

- Aderência ao ADR correspondente.
- Contratos tRPC backward compatible (salvo ADR explícito).
- Convenções de nomes cumpridas.
- Migrations têm rollback documentado.
- UI cumpre padrões de acessibilidade.

### 10.3. Gate 3 — Aprovação do tech lead

- CI verde (lint, typecheck, tests, build).
- Smoke manual em preview do Railway OU localmente.
- Documentação atualizada.
- Issue do GitHub ligada ao PR.

### 10.4. Gate 4 — Aceitação em hml

- Railway deploy concluído.
- Migração aplicada (logs confirmam).
- Fluxo end-to-end manual validado.
- Para fases críticas: tenant piloto acompanha o rollout.

---

## 11. Gestão de risco e pontos de atenção

| Risco                                                    | Severidade | Mitigação                                                                     |
| -------------------------------------------------------- | :--------: | ----------------------------------------------------------------------------- |
| Agentes entram em conflito (dois editam o mesmo arquivo) |    ALTA    | Allowlist estrita (§3.3); branches separadas; A1 detecta no review            |
| Contrato tRPC muda e quebra o frontend                   |    ALTA    | A2 isola mudanças de tipos em PR específico; `typecheck` no CI                |
| Migrations incompatíveis aplicadas em ordem errada       |    ALTA    | Numeração sequencial; só A2 cria; A1 revisa                                   |
| Agente perde contexto entre sessões Cascade              |   MÉDIA    | Contexto em `.windsurf/context/`; `.windsurfrules` referencia ADRs            |
| Alucinação de API inexistente                            |   MÉDIA    | `.windsurfrules` exige Grep antes de usar API; CI falha se import não resolve |
| PRs muito grandes tornam review infactível               |   MÉDIA    | Regra: PR ≤ 600 linhas de diff                                                |
| Agente commita segredos                                  |    ALTA    | Hook pre-commit (gitleaks); `.gitignore`; regra proíbe `.env`                 |
| Custo de tokens dispara                                  |   MÉDIA    | Monitorar por agente; Haiku 4.5 para tarefas simples                          |

---

## 12. Onboarding dos agentes no Windsurf (setup)

### 12.1. Uma vez (setup do repositório)

1. Criar diretório `.windsurf/` na raiz.
2. Criar `.windsurf/rules/architect.md`, `backend.md`, `frontend.md` (Apêndice A).
3. Copiar `ANALISE-PROJETO.md`, `GESTAO-FINANCEIRA-VALIDACAO.md`, `platform-admin-rbac.md` para `.windsurf/context/`.
4. Adicionar `.windsurf/` ao git; commitar em `chore/windsurf-setup`; abrir PR.
5. Criar `docs/adr/TEMPLATE.md`.
6. Criar `docs/TASKS.md` com o template do Apêndice C.
7. Criar `scripts/integrity-check.sh` com o script do Apêndice D (`chmod +x`).

### 12.2. Por sessão de agente

1. Clonar o repo em diretório dedicado (ex: `~/repos/cac360-a2-backend`).
2. `git checkout hml`; `git pull`; verificar ausência de sujeira.
3. Abrir o workspace no Windsurf.
4. No Cascade, iniciar a sessão com o prompt do Apêndice A correspondente.
5. Cascade lê automaticamente `.windsurfrules` e `.windsurf/rules/<agente>.md`.
6. Primeira ação: **ler `docs/TASKS.md` e aplicar o protocolo §6** (claim → work → integrity → release).

### 12.3. Modelos de LLM sugeridos

- **A1 Arquiteto**: Opus 4.6 (decisões complexas).
- **A2 Backend**: Sonnet 4.6 (código + testes).
- **A3 Frontend**: Sonnet 4.6 (UI + hooks); Haiku 4.5 para tarefas pequenas.
- Todos podem subir para Opus ao lidar com bug difícil.

---

## 13. Métricas e ritos de acompanhamento

### 13.1. Métricas por agente (por sprint)

- Work packages concluídos / planejados.
- Lead time de WP (criação da issue → merge).
- Número de revisões solicitadas pelo A1 por PR.
- % de PRs aceitos em primeira revisão.
- Bugs encontrados pós-merge por WP.

### 13.2. Ritos

- **Daily async (15 min):** cada agente publica em `docs/standup/YYYY-MM-DD-<agente>.md` — feito/farei/bloqueio.
- **Planning semanal (humano):** tech lead prioriza WPs.
- **Retrospectiva quinzenal (humano):** o que funcionou; rever `.windsurfrules`.
- **PR review assíncrono:** A1 revisa em até 4h úteis após Ready.

---

## 14. Apêndice A — prompts padronizados por agente

Estes prompts vão em `.windsurf/rules/<agente>.md`.

### A.1. Arquiteto / Revisor (architect.md)

```
Você é o Agente Arquiteto/Revisor do projeto CAC 360. Sua função é:
1) Ler o código existente e os documentos em .windsurf/context/ antes de qualquer decisão.
2) Gerar ADRs em docs/adr/ para toda decisão técnica nova.
3) Revisar PRs dos agentes A2 (backend) e A3 (frontend).

FLUXO OBRIGATÓRIO (§6 do plano):
- ANTES: ler docs/TASKS.md, selecionar tarefa Owner=A1 em estado [ ], reivindicar
  (mudar para [~]) em commit dedicado, fazer push e abrir PR Draft.
- DURANTE: promover para [>] no primeiro commit de doc; pequenos commits; rebase diário.
- APÓS: rodar verificações aplicáveis (markdownlint); colar Integrity Report no PR;
  promover para [?] review.

REGRAS DE ESCOPO:
- Você SÓ pode escrever em docs/**, .windsurf/**, README.md.
- Nunca edite código em server/** ou client/**; proponha mudanças via comentário no PR.
- Todo ADR segue docs/adr/TEMPLATE.md.
- Ao revisar PR: verifique aderência ao ADR, contratos tRPC, convenções, testes
  E presença do Integrity Report.
- Se encontrar violação de allowlist de outro agente, bloqueie o PR.

Referências obrigatórias: .windsurf/context/GESTAO-FINANCEIRA-VALIDACAO.md,
platform-admin-rbac.md, ANALISE-PROJETO.md, docs/TASKS.md.
```

### A.2. Backend (backend.md)

```
Você é o Agente Backend do projeto CAC 360. Sua função é implementar migrations,
rotas tRPC, middlewares, jobs cron e emailService conforme ADRs aprovados.

FLUXO OBRIGATÓRIO (§6 do plano — NÃO PULAR):
1) git checkout hml && git pull origin hml.
2) Abrir docs/TASKS.md; listar tarefas com Owner=A2 e estado [ ]; filtrar por
   dependências já [x].
3) Escolher UMA tarefa completa (nunca fragmentar).
4) Criar branch: git checkout -b feat/a2/<id-wp>-<slug>.
5) CLAIM: editar docs/TASKS.md mudando [ ] para [~] + preencher metadados
   (agente=A2, branch, timestamp UTC, ADR, PR). Commitar APENAS o checklist;
   push; abrir PR Draft.
6) Implementar a tarefa; no primeiro commit de código, promover [~] → [>].
7) AO FINAL: rodar scripts/integrity-check.sh; se qualquer camada falhar,
   corrigir e rodar de novo.
8) Colar o Integrity Report completo na descrição do PR.
9) Mudar [>] para [?] (review) em commit final; tirar PR de Draft; solicitar
   revisão do A1.
10) SOMENTE após merge pelo tech lead, voltar ao passo 1 para nova tarefa.

REGRAS DE ESCOPO:
- Você SÓ pode editar: server/**, drizzle/**, shared/**, scripts/**, tests/backend/**.
- Edite package.json apenas com justificativa explícita no PR.
- Nunca toque em client/**.

REGRAS TÉCNICAS:
- Integrity obrigatório: estática + unit + integração + build + smoke + regressão + impacto.
- Migrations: apenas em PR de migration; numeração sequencial.
- Toda rota tRPC tem validação Zod no input.
- Respeite o contrato definido no ADR; mudanças passam pelo A1.

ANTES DE AGIR: leia o ADR da WP atual. Não invente APIs — procure no código
existente (Grep) antes de usar qualquer módulo.
```

### A.3. Frontend (frontend.md)

```
Você é o Agente Frontend do projeto CAC 360. Sua função é implementar páginas React,
componentes, hooks e chamadas tRPC para a UI dos fluxos financeiros e de RBAC.

FLUXO OBRIGATÓRIO (§6 do plano — NÃO PULAR):
1) git checkout hml && git pull origin hml.
2) Abrir docs/TASKS.md; listar tarefas Owner=A3 estado [ ]; filtrar por deps [x].
3) Escolher UMA tarefa completa.
4) Criar branch: git checkout -b feat/a3/<id-wp>-<slug>.
5) CLAIM: editar docs/TASKS.md mudando [ ] para [~] + metadados; commit dedicado;
   push; abrir PR Draft.
6) Implementar; no primeiro commit de código, promover [~] → [>].
7) AO FINAL: rodar scripts/integrity-check.sh; camadas: estática + unit + build
   + smoke + regressão + impacto.
8) Colar Integrity Report na descrição do PR.
9) Mudar [>] para [?] (review); tirar PR de Draft; solicitar revisão do A1.
10) SOMENTE após merge, voltar ao passo 1.

REGRAS DE ESCOPO:
- Você SÓ pode editar: client/**, public/**, tests/frontend/**, index.html, vite.config.*.
- Nunca toque em server/**, drizzle/**, shared/** — consuma apenas os tipos exportados.

REGRAS TÉCNICAS:
- Use exclusivamente componentes já existentes no design system.
- Toda página nova tem loading/error/empty states.
- Paywalls e banners seguem o padrão definido no ADR-001.
- Se o backend ainda não entregou um tipo, use mock tipado em client/src/__mocks__/
  até A2 mergear.

ANTES DE AGIR: verifique se a rota tRPC já existe. Se não, NÃO implemente fake
no backend — use mock no frontend e sinalize dependência no PR.
```

---

## 15. Apêndice B — checklist pré-merge

Cole no template de PR do GitHub.

### Para todos os agentes

- [ ] Branch segue convenção `feat/<agente>/<slug>`.
- [ ] Commits seguem Conventional Commits.
- [ ] Diff ≤ 600 linhas (excluindo lock files).
- [ ] PR referencia issue GitHub e ADR correspondente.
- [ ] Título do PR descreve objetivo e impacto.
- [ ] Lint, typecheck e testes passando localmente.
- [ ] Nenhum segredo committado.
- [ ] `docs/TASKS.md`: tarefa está no estado `[?]` (review) com metadados corretos.
- [ ] Integrity Report completo colado na descrição do PR.
- [ ] Nenhuma outra tarefa do mesmo agente está em `[~]` ou `[>]` neste momento.

### Adicional Backend (A2)

- [ ] Migration tem rollback documentado no ADR.
- [ ] Toda rota tem validação Zod.
- [ ] Middlewares aplicados conforme ADR.
- [ ] Cobertura de testes ≥ 70% na área alterada.
- [ ] Logs estruturados (nada de `console.log` solto).

### Adicional Frontend (A3)

- [ ] Loading/error/empty states implementados.
- [ ] Acessibilidade: labels, keyboard, contraste.
- [ ] Nenhum hardcode de string — i18n quando disponível.
- [ ] Testes de integração do fluxo novo (Cypress/Playwright).
- [ ] Build de produção passa sem warnings novos.

### Adicional Arquiteto (A1)

- [ ] ADR segue TEMPLATE.md (contexto, decisão, consequências, alternativas).
- [ ] Numeração ADR sequencial e única.
- [ ] Referências cruzadas a ADRs anteriores quando houver.
- [ ] Impacto em outros WPs listado.

---

## 16. Apêndice C — template do arquivo `docs/TASKS.md`

```markdown
# TASKS.md — Fila oficial de trabalho

## Legenda

- [ ] available — aguarda reivindicação
- [~] claimed — reivindicado, sem código ainda
- [>] in_progress — em desenvolvimento
- [?] review — integrity OK, aguardando A1
- [x] completed — mergeado em hml
- [!] blocked — bloqueado (motivo obrigatório)

## FINANCEIRO — FASE 1 ACL

- [ ] WP-01 Schema: catálogo de planos e featureOverrides JSONB
  - owner: A2
  - branch: —
  - claimed_at: —
  - adr: ADR-001
  - pr: —
  - depends_on: —
  - integrityChecks: —

- [ ] WP-02 reconcileFeatures + requirePlan + tests
  - owner: A2
  - branch: —
  - claimed_at: —
  - adr: ADR-001
  - pr: —
  - depends_on: WP-01
  - integrityChecks: —

- [ ] WP-03 useSubscription hook + Paywall + banners
  - owner: A3
  - branch: —
  - claimed_at: —
  - adr: ADR-001
  - pr: —
  - depends_on: WP-01 (mock ok)
  - integrityChecks: —

(...demais WPs...)
```

### Exemplo de tarefa reivindicada

```markdown
- [~] WP-01 Schema: catálogo de planos e featureOverrides JSONB
  - owner: A2
  - branch: feat/a2/f1-acl-schema
  - claimed_at: 2026-04-19T21:45:00Z
  - adr: ADR-001
  - pr: #142 (draft)
  - depends_on: —
  - integrityChecks: —
```

### Exemplo pós-integridade

```markdown
- [?] WP-01 Schema: catálogo de planos e featureOverrides JSONB
  - owner: A2
  - branch: feat/a2/f1-acl-schema
  - claimed_at: 2026-04-19T21:45:00Z
  - adr: ADR-001
  - pr: #142 (ready)
  - depends_on: —
  - integrityChecks: static✓ unit✓ integration✓ build✓ smoke✓ regression✓ migrations✓ impact✓
```

---

## 17. Apêndice D — script de verificação de integridade

Criar em `scripts/integrity-check.sh` (`chmod +x`).

```bash
#!/usr/bin/env bash
# scripts/integrity-check.sh
# Verificação de integridade pós-desenvolvimento para CAC 360.
# Uso: ./scripts/integrity-check.sh [--skip-smoke] [--skip-e2e]
set -u
pass=0; fail=0; report=""

run() {
  local label="$1"; shift
  echo "── [$label] ─────────────────────────"
  if "$@"; then
    echo "[$label] OK"
    report+="- $label: ✓\n"
    ((pass++))
  else
    echo "[$label] FAIL"
    report+="- $label: ✗\n"
    ((fail++))
  fi
}

# 1. Estática
run "static:lint"       npm run lint --silent
run "static:typecheck"  npm run typecheck --silent
run "static:format"     npm run format:check --silent

# 2. Unit
run "unit"              npm test -- --run --silent

# 3. Integração (apenas se existir script)
if npm run | grep -q test:integration; then
  run "integration"     npm run test:integration --silent
fi

# 4. Build
run "build"             npm run build --silent

# 5. Smoke (opcional)
if [[ "${1:-}" != "--skip-smoke" ]]; then
  run "smoke:health"    bash -c 'npm run dev >/tmp/dev.log 2>&1 & sleep 15; curl -fsS http://localhost:3000/api/health >/dev/null; kill %1'
fi

# 6. Regressão (E2E) — opcional
if [[ "${1:-}" != "--skip-e2e" ]] && npm run | grep -q test:e2e; then
  run "regression:e2e"  npm run test:e2e --silent
fi

# 7. Migrations (apenas se tocou drizzle/**)
if git diff --name-only origin/hml... | grep -q '^drizzle/'; then
  run "migrations:up"   npm run db:migrate --silent
fi

# 8. Impacto — testes de módulos adjacentes
run "impact:auth"       npm test -- --run server/_core --silent
run "impact:workflow"   npm test -- --run server/routers --silent
run "impact:email"      npm test -- --run server/emailService --silent

# Resumo
echo ""
echo "======= INTEGRITY REPORT ======="
echo -e "$report"
echo "Resultado: $pass OK | $fail FAIL"
echo "================================"

# Salva o report em arquivo temporário para colar no PR
echo -e "$report" > /tmp/integrity-report.txt

if [[ $fail -gt 0 ]]; then exit 1; fi
exit 0
```

### Como usar

1. Rodar a partir da raiz do repo: `./scripts/integrity-check.sh`
2. Se retornar `exit 0`, copiar `/tmp/integrity-report.txt` e colar na descrição do PR.
3. Se retornar `exit 1`, corrigir os pontos em FAIL e rodar o script novamente do zero.
4. **NÃO** é permitido promover para `[?]` review se o script retornar `exit 1`.

### Variações por agente

- **A2 Backend**: rodar sem flags (todas as camadas).
- **A3 Frontend**: pode usar `--skip-e2e` se já estiver rodando testes específicos do módulo tocado.
- **A1 Arquiteto**: substituir por `npx markdownlint docs/**`.

---

## Aprovações

| Responsável   | Data / Assinatura |
| ------------- | ----------------- |
| Tech Lead     |                   |
| Product Owner |                   |
