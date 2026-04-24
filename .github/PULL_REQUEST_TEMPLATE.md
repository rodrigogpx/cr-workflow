<!--
  Template obrigatório para todo PR no Firerange Workflow.
  Referências:
    - docs/PLANO-MULTI-AGENTE.md §6 (seleção e claim de tarefas)
    - docs/PLANO-MULTI-AGENTE.md §7 (protocolo de integridade)
    - docs/adr/ADR-000-multi-agent-workflow.md (contrato)
-->

## WP associado

<!-- ex.: WP-02 — Migration do estado grace_period -->
WP-__ — __

**Agente autor:** <!-- A1 / A2 / A3 / humano -->

**Dependências resolvidas:** <!-- listar WPs em [x] que este PR requer, ou "nenhuma" -->

## Resumo da mudança

<!--
  2–5 bullets curtos. Foque em "por quê", não em "o quê".
  Se este PR requisita mudança fora da allowlist do agente, explique aqui
  e referencie o ADR que autorizou.
-->

-

## Escopo

- [ ] Todos os arquivos alterados estão dentro da allowlist do agente autor.
- [ ] `docs/TASKS.md` foi atualizado para refletir o estado atual do WP (`[>]` → `[?]`).
- [ ] Nenhum WP foi fragmentado sem ADR.

## Integrity Report

<!--
  Cole aqui a saída de `scripts/integrity-check.sh` rodado localmente
  antes de abrir o PR. O CI vai rodar novamente e comentar o relatório
  dele — é aceitável que haja pequena variação em durações, mas
  status (✓/✗) deve bater.
-->

```
<colar saída do integrity-check.sh>
```

**Camadas obrigatórias para este PR** (marcar as executadas com ✓):

- [ ] `static` (lint, typecheck, prettier)
- [ ] `unit`
- [ ] `integration`
- [ ] `build`
- [ ] `smoke`
- [ ] `regression` (comparação com `docs/integrity-baseline.json`)
- [ ] `migrations` (se `drizzle/` alterado)
- [ ] `impact(auth)` (se `server/_core/trpc.ts` ou middlewares alterados)
- [ ] `impact(workflow)` (se arquivos de processo alterados)
- [ ] `impact(email)` (se templates/mailer alterados)

## Risco e mitigação

<!--
  O que pode quebrar na prod se este PR contiver um bug?
  Há feature flag? Rollback é reversível via revert simples ou requer migration reversa?
-->

## Checklist pré-merge

- [ ] PR aponta para `hml` (fluxo padrão dos agentes) e passou pelo gate `integrity / Integrity Report`. PRs excepcionais para `main` (ex.: hotfix, promoção `hml → main`) também acionam o CI.
- [ ] Conventional Commit nos commits desta branch.
- [ ] Documentação atualizada (se mudança de API pública, contrato tRPC, ou procedimento operacional).
- [ ] Nenhuma regressão no baseline (bundle size, testes passando, tempo de build).
- [ ] Revisão aprovada por pelo menos 1 CODEOWNER.
