#!/usr/bin/env bash
# scripts/capture-baseline.sh — congela o baseline de integridade
# Referência: docs/PLANO-MULTI-AGENTE.md §7 · docs/SPRINT-0-DIA-2.md
#
# Uso (no Dia 2 do Sprint 0):
#   pnpm install --frozen-lockfile
#   scripts/capture-baseline.sh
#
# Gera / atualiza:
#   docs/integrity-baseline.md   (legível)
#   docs/integrity-baseline.json (parseável pelo gate de regressão)
#
# Commitar ambos no PR `sprint-0/baseline-freeze`.

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

AGENT="baseline"
LAYERS="static,unit,build"
METRICS_OUT="$(mktemp)"
REPORT_OUT="$(mktemp)"

export AGENT LAYERS METRICS_OUT

echo "▶ Rodando integrity-check.sh para capturar baseline..."
set +e
scripts/integrity-check.sh | tee "$REPORT_OUT"
check_exit=$?
set -e

if [[ ! -f "$METRICS_OUT" ]]; then
  echo "❌ Falha: integrity-check.sh não produziu métricas em $METRICS_OUT" >&2
  exit 2
fi

# -----------------------------------------------------------------------------
# Extrair métricas agregadas
# -----------------------------------------------------------------------------
get() {
  grep "^$1=" "$METRICS_OUT" | head -1 | cut -d= -f2-
}

commit="$(get commit)"
branch="$(get branch)"
started="$(get started)"
ended="$(get ended)"
pass="$(get pass)"
fail="$(get fail)"
skip="$(get skip)"
bundle_client_kb="$(get bundle_client_kb)"
bundle_server_kb="$(get bundle_server_kb)"

# Tempos por camada
static_ms=0; unit_ms=0; build_ms=0; integration_ms=0
while IFS=: read -r layer label status dur; do
  [[ -z "$layer" ]] && continue
  [[ "$layer" == \#* ]] && continue
  case "$layer" in
    static)      static_ms=$((static_ms + ${dur:-0})) ;;
    unit)        unit_ms=$((unit_ms + ${dur:-0})) ;;
    build)       build_ms=$((build_ms + ${dur:-0})) ;;
    integration) integration_ms=$((integration_ms + ${dur:-0})) ;;
  esac
done < <(grep -E '^[a-z]+:' "$METRICS_OUT" | grep -v '^#')

# Contagem aproximada de testes a partir da saída do vitest (se presente)
test_count=""; test_passed=""; test_failed=""
if grep -qE 'Test Files|Tests ' "$REPORT_OUT"; then
  test_passed="$(grep -Eo '[0-9]+ passed' "$REPORT_OUT" | head -1 | awk '{print $1}' || true)"
  test_failed="$(grep -Eo '[0-9]+ failed' "$REPORT_OUT" | head -1 | awk '{print $1}' || true)"
  [[ -n "$test_passed" && -n "$test_failed" ]] && test_count=$((test_passed + test_failed))
fi

# Warnings de typecheck (rough — depende do formato tsc)
tsc_warnings="$(grep -cE '(warning|TS[0-9]+)' "$REPORT_OUT" 2>/dev/null || echo 0)"

# -----------------------------------------------------------------------------
# Gerar docs/integrity-baseline.json
# -----------------------------------------------------------------------------
cat > docs/integrity-baseline.json <<JSON
{
  "captured_at": "${ended:-$(date -Iseconds)}",
  "commit": "${commit}",
  "branch": "${branch}",
  "summary": {
    "pass": ${pass:-0},
    "fail": ${fail:-0},
    "skip": ${skip:-0}
  },
  "durations_ms": {
    "static": ${static_ms},
    "unit": ${unit_ms},
    "integration": ${integration_ms},
    "build": ${build_ms}
  },
  "bundle_client_kb": ${bundle_client_kb:-null},
  "bundle_server_kb": ${bundle_server_kb:-null},
  "tests": {
    "total": ${test_count:-null},
    "passed": ${test_passed:-null},
    "failed": ${test_failed:-null}
  },
  "tsc_warnings": ${tsc_warnings:-0},
  "thresholds": {
    "bundle_client_pct_max": 5,
    "build_time_pct_max": 20,
    "regressions_allowed": 0
  }
}
JSON

# Valida JSON
if has_cmd=$(command -v python3); then
  python3 -c "import json; json.load(open('docs/integrity-baseline.json'))" \
    || { echo "❌ JSON inválido gerado" >&2; exit 3; }
fi

# -----------------------------------------------------------------------------
# Atualizar docs/integrity-baseline.md (apenas seção "Relatório" e "Métricas")
# -----------------------------------------------------------------------------
os_desc="$(uname -sr 2>/dev/null || echo unknown)"
node_desc="$(node --version 2>/dev/null || echo unknown)"
pm_desc=""
if command -v pnpm >/dev/null 2>&1; then pm_desc="pnpm $(pnpm --version)"
elif command -v npm >/dev/null 2>&1; then pm_desc="npm $(npm --version)"
fi

cat > docs/integrity-baseline.md <<MD
# Integrity Baseline

> Congelado por \`scripts/capture-baseline.sh\` no Dia 2 do Sprint 0.
> Referência: \`docs/PLANO-MULTI-AGENTE.md\` §7 · \`docs/adr/ADR-000-multi-agent-workflow.md\`.

## Metadados

- Registrado em: ${ended:-$(date -Iseconds)}
- Commit base: \`${commit}\`
- Branch: \`${branch}\`
- Autor: \`@rodrigogpx\`
- Ambiente: ${os_desc} · Node ${node_desc} · ${pm_desc}

## Relatório

\`\`\`
$(cat "$REPORT_OUT")
\`\`\`

## Métricas numéricas congeladas

| Métrica                              | Valor                                  |
| ------------------------------------ | -------------------------------------- |
| Duração camada \`static\`              | ${static_ms} ms                        |
| Duração camada \`unit\`                | ${unit_ms} ms                          |
| Duração camada \`integration\`         | ${integration_ms} ms                   |
| Duração camada \`build\`               | ${build_ms} ms                         |
| Total de testes                      | ${test_count:-—}                       |
| Testes passando                      | ${test_passed:-—}                      |
| Testes falhando                      | ${test_failed:-—}                      |
| Bundle cliente (\`dist/public\`)       | ${bundle_client_kb:-—} KB              |
| Artefato servidor (\`dist/index.cjs\`) | ${bundle_server_kb:-—} KB              |
| Warnings de typecheck                | ${tsc_warnings}                        |

## Critérios de regressão (enforced pelo gate)

Qualquer PR que cause:

1. **Qualquer teste antes passante agora falhando** → bloqueia merge.
2. **Bundle cliente +5% ou mais** → bloqueia merge automaticamente.
3. **Tempo de build +20% ou mais** → requer investigação registrada no PR.
4. **Aumento de warnings de typecheck ou lint** → requer redução antes do merge.

Thresholds versionados em \`docs/integrity-baseline.json#thresholds\`.

## Histórico de atualizações

| Data | Motivo | PR | Responsável |
| ---- | ------ | -- | ----------- |
| ${ended:-—} | baseline inicial | sprint-0/baseline-freeze | @rodrigogpx |
MD

rm -f "$METRICS_OUT" "$REPORT_OUT"

echo ""
echo "✅ Baseline congelado em:"
echo "   - docs/integrity-baseline.md"
echo "   - docs/integrity-baseline.json"
echo ""
echo "Próximos passos:"
echo "   git checkout -b sprint-0/baseline-freeze"
echo "   git add docs/integrity-baseline.md docs/integrity-baseline.json"
echo "   git commit -m 'chore(sprint-0): congelar baseline de integridade'"
echo "   git push -u origin sprint-0/baseline-freeze"
echo "   gh pr create --title 'Sprint 0 — Baseline de integridade' --body-file .github/ISSUE_TEMPLATE/baseline-integridade.md"

exit $check_exit
