---
name: Baseline de integridade — Sprint 0
about: Registrar o congelamento do baseline de integridade (executado uma vez por marco; ver docs/integrity-baseline.md)
title: "Baseline de integridade — <data>"
labels: ["sprint-0", "integridade", "baseline"]
assignees: []
---

## Contexto

Registro do congelamento do baseline de integridade do Firerange Workflow, conforme `docs/PLANO-MULTI-AGENTE.md` §7 e `docs/adr/ADR-000-multi-agent-workflow.md`.

Este baseline é referência para o gate de regressão do workflow CI `integrity.yml`.

## Metadados

- **Data:**
- **Commit base:**
- **Branch:** `hml` (baseline é congelado a partir de `hml`, que é o target dos PRs dos agentes)
- **Autor:** @rodrigogpx
- **PR associado:** `sprint-0/baseline-freeze`

## Comando executado

```bash
pnpm install --frozen-lockfile
scripts/capture-baseline.sh
```

## Integrity Report produzido

```
<colar saída completa do integrity-check.sh>
```

## Métricas congeladas

| Métrica                  | Valor |
| ------------------------ | ----- |
| Duração `static`         |       |
| Duração `unit`           |       |
| Duração `build`          |       |
| Total de testes passando |       |
| Total de testes falhando |       |
| Bundle cliente           | KB    |
| Artefato servidor        | KB    |
| Warnings de typecheck    |       |

## Thresholds de regressão (versionados em `docs/integrity-baseline.json`)

- Bundle cliente: +5% ou mais → bloqueia merge automaticamente.
- Tempo de build: +20% ou mais → exige justificativa no PR.
- Qualquer teste antes passante agora falhando → bloqueia merge.
- Aumento de warnings: exige redução antes do merge.

## Observações / desvios

<!--
  Registrar aqui qualquer teste já falhando, warning persistente,
  ou métrica fora do ideal que ficou "herdada" no baseline.
  Isso não impede o congelamento, mas precisa virar follow-up.
-->

## Follow-ups abertos

- [ ]
- [ ]

## Aprovação

- [ ] Baseline verificado por @rodrigogpx
- [ ] `docs/integrity-baseline.md` e `docs/integrity-baseline.json` committed
- [ ] Workflow `integrity.yml` passando com `regression: ✓` na branch `hml`
