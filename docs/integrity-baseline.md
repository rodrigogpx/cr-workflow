# Integrity Baseline

> Este arquivo congela o estado de integridade do repositório no momento em que o protocolo multi-agente foi adotado. É comparado por `scripts/integrity-check.sh` na camada `regression` para detectar degradações ao longo do tempo.

**Referência:** `docs/PLANO-MULTI-AGENTE.md` §7 · `docs/adr/ADR-000-multi-agent-workflow.md`

---

## Metadados

- Registrado em: _pendente — preencher no Dia 2 do Sprint 0_
- Commit base: `<sha>`
- Branch: `main`
- Autor: `@rodrigogpx`
- Ambiente: `<os + node + pnpm versions>`

## Como preencher (Dia 2 do Sprint 0)

Em ambiente local com dependências instaladas:

```bash
pnpm install --frozen-lockfile
AGENT=baseline LAYERS=static,unit,build scripts/integrity-check.sh | tee /tmp/baseline.txt
```

Copie o bloco `INTEGRITY REPORT` da saída para a seção **Relatório** abaixo. Também registre os valores numéricos derivados (tempo de build, nº de testes, bundle size) para detecção de regressão no tempo.

---

## Relatório

```
<colar aqui a saída do integrity-check.sh>
```

## Métricas numéricas congeladas

| Métrica | Valor | Medido em |
| - | - | - |
| Tempo de `pnpm build` | _— s_ | _— _ |
| Tempo de `pnpm test` | _— s_ | _— _ |
| Total de testes unitários | _— _ | _— _ |
| Testes passando | _— _ | _— _ |
| Testes falhando | _— _ | _— _ |
| Bundle size (`dist/client`) | _— KB_ | _— _ |
| Artefato do servidor (`dist/index.cjs`) | _— KB_ | _— _ |
| Warnings de typecheck | _— _ | _— _ |
| Warnings de lint | _— _ | _— _ |

## Critérios de regressão

A partir deste baseline, qualquer PR que cause:

1. **Qualquer teste antes passante agora falhando** → bloqueia merge.
2. **Bundle size do cliente +5% ou mais** → requer justificativa no PR.
3. **Tempo de build +20% ou mais** → requer investigação registrada em follow-up.
4. **Aumento no número de warnings de typecheck ou lint** → requer redução antes do merge.

## Histórico de atualizações do baseline

_Sempre que o baseline for atualizado, registrar aqui a justificativa (ex.: "upgrade de framework", "refatoração legítima de performance")._

| Data | Motivo | PR | Responsável |
| - | - | - | - |
| _— _ | _baseline inicial_ | _— _ | _@rodrigogpx_ |
