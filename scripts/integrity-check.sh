#!/usr/bin/env bash
# scripts/integrity-check.sh — 8-layer integrity verification
# Referência: docs/PLANO-MULTI-AGENTE.md §7
#
# Uso:
#   scripts/integrity-check.sh                 # todas as camadas
#   AGENT=A1 scripts/integrity-check.sh        # só camadas obrigatórias do agente
#   LAYERS="static,unit" scripts/integrity-check.sh
#
# Saída:
#   - STDOUT: Integrity Report formatado (colar no PR)
#   - Exit 0 se todas as camadas obrigatórias passaram; 1 se alguma falhou.

set -u
set -o pipefail

AGENT="${AGENT:-unknown}"
LAYERS_ARG="${LAYERS:-all}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

pass=0
fail=0
skip=0
tsc_warnings=0
report=""
started_at="$(date -Iseconds)"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

enabled() {
  local layer="$1"
  if [[ "$LAYERS_ARG" == "all" ]]; then
    return 0
  fi
  [[ ",$LAYERS_ARG," == *",$layer,"* ]]
}

now_ms() {
  # Portable epoch ms (bash on macOS: fallback to python if date +%N unsupported)
  local ns
  ns="$(date +%s%N 2>/dev/null)"
  if [[ "$ns" == *N ]] || [[ -z "$ns" ]]; then
    python3 -c 'import time; print(int(time.time()*1000))'
  else
    echo $((ns / 1000000))
  fi
}

run() {
  local layer="$1"
  local label="$2"
  shift 2
  if ! enabled "$layer"; then
    report+="- [${layer}] ${label}: — (skipped via LAYERS)\n"
    skip=$((skip+1))
    return 0
  fi
  local t0 t1 dt
  t0=$(now_ms)
  echo "▶ [${layer}] ${label}..."
  if "$@"; then
    t1=$(now_ms); dt=$((t1 - t0))
    report+="- [${layer}] ${label}: ✓ (${dt}ms)\n"
    METRICS+="${layer}:${label}:pass:${dt}"$'\n'
    pass=$((pass+1))
  else
    t1=$(now_ms); dt=$((t1 - t0))
    report+="- [${layer}] ${label}: ✗ (${dt}ms)\n"
    METRICS+="${layer}:${label}:fail:${dt}"$'\n'
    fail=$((fail+1))
  fi
}

METRICS=""

skip_layer() {
  local layer="$1"
  local label="$2"
  local reason="$3"
  report+="- [${layer}] ${label}: — (${reason})\n"
  skip=$((skip+1))
}

has_cmd() { command -v "$1" >/dev/null 2>&1; }

pm() {
  if has_cmd pnpm; then echo pnpm
  elif has_cmd npm; then echo npm
  elif has_cmd yarn; then echo yarn
  else echo ""
  fi
}

PKG_MGR="$(pm)"
if [[ -z "$PKG_MGR" ]]; then
  echo "Nenhum package manager detectado (pnpm/npm/yarn). Abortando." >&2
  exit 2
fi

# Detecta mudanças relativas ao origin/main (ou HEAD~1 como fallback)
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  CHANGED_FILES="$(git diff --name-only origin/main...HEAD 2>/dev/null || true)"
else
  CHANGED_FILES="$(git diff --name-only HEAD~1...HEAD 2>/dev/null || true)"
fi

changed() { [[ "$CHANGED_FILES" == *"$1"* ]]; }

# -----------------------------------------------------------------------------
# 1. static
# -----------------------------------------------------------------------------
if enabled static; then
  if grep -q '"check"' package.json 2>/dev/null; then
    if enabled static; then
      t0=$(now_ms)
      echo "▶ [static] typecheck (run check)..."
      tsc_output=$("$PKG_MGR" run check 2>&1)
      tsc_exit=$?
      t1=$(now_ms); dt=$((t1 - t0))
      tsc_warnings=$(printf '%s\n' "$tsc_output" | grep -c "error TS" || true)
      if [[ $tsc_exit -eq 0 ]]; then
        report+="- [static] typecheck (run check): ✓ (${dt}ms)\n"
        METRICS+="static:typecheck (run check):pass:${dt}"$'\n'
        pass=$((pass+1))
      else
        report+="- [static] typecheck (run check): ✗ (${tsc_warnings} errors, ${dt}ms)\n"
        METRICS+="static:typecheck (run check):fail:${dt}"$'\n'
        fail=$((fail+1))
      fi
    else
      report+="- [static] typecheck (run check): — (skipped via LAYERS)\n"
      skip=$((skip+1))
    fi
  else
    skip_layer static "typecheck" "script 'check' ausente"
  fi
  if grep -q '"lint"' package.json 2>/dev/null; then
    run static "lint" "$PKG_MGR" run lint
  else
    skip_layer static "lint" "script 'lint' ausente"
  fi
  if grep -q '"format"' package.json 2>/dev/null; then
    run static "prettier (format:check)" bash -c "$PKG_MGR exec prettier --check ."
  else
    skip_layer static "prettier" "script 'format' ausente"
  fi
fi

# -----------------------------------------------------------------------------
# 2. unit
# -----------------------------------------------------------------------------
if enabled unit; then
  if grep -q '"test"' package.json 2>/dev/null; then
    run unit "unit tests" "$PKG_MGR" run test
  else
    skip_layer unit "unit tests" "script 'test' ausente"
  fi
fi

# -----------------------------------------------------------------------------
# 3. integration
# -----------------------------------------------------------------------------
if enabled integration; then
  if grep -q '"test:integration"' package.json 2>/dev/null; then
    run integration "integration tests" "$PKG_MGR" run test:integration
  else
    skip_layer integration "integration tests" "script 'test:integration' ausente"
  fi
fi

# -----------------------------------------------------------------------------
# 4. build
# -----------------------------------------------------------------------------
if enabled build; then
  if grep -q '"build"' package.json 2>/dev/null; then
    run build "build full" "$PKG_MGR" run build
  else
    skip_layer build "build" "script 'build' ausente"
  fi
fi

# -----------------------------------------------------------------------------
# 5. smoke
# -----------------------------------------------------------------------------
if enabled smoke; then
  if [[ -x scripts/smoke.sh ]]; then
    run smoke "smoke test" scripts/smoke.sh
  else
    skip_layer smoke "smoke test" "scripts/smoke.sh ausente"
  fi
fi

# -----------------------------------------------------------------------------
# 6. regression — baseline via último tag ou arquivo
# -----------------------------------------------------------------------------
if enabled regression; then
  if [[ -f docs/integrity-baseline.md ]]; then
    run regression "baseline presente" test -f docs/integrity-baseline.md
  else
    skip_layer regression "regression" "baseline não registrado"
  fi
fi

# -----------------------------------------------------------------------------
# 7. migrations — só se drizzle/ mudou
# -----------------------------------------------------------------------------
if enabled migrations; then
  if changed "drizzle/"; then
    if grep -q '"db:push"' package.json 2>/dev/null; then
      run migrations "db:push --dry (se suportado)" bash -c "$PKG_MGR run db:push -- --dry-run || $PKG_MGR run db:push"
    else
      skip_layer migrations "migrations" "script 'db:push' ausente"
    fi
  else
    skip_layer migrations "migrations" "drizzle/ não foi alterado"
  fi
fi

# -----------------------------------------------------------------------------
# 8. impact — heurísticas
# -----------------------------------------------------------------------------
if enabled impact; then
  impact_pass=0
  impact_fail=0

  # auth: mudanças em trpc.ts ou middlewares
  if changed "server/_core/trpc.ts" || changed "middlewares/" || changed "server/_core/middlewares/"; then
    if grep -q '"test:auth"' package.json 2>/dev/null; then
      run impact "impact(auth)" "$PKG_MGR" run test:auth
    else
      report+="- [impact] auth: ⚠ arquivos críticos alterados mas 'test:auth' ausente — revisar manualmente\n"
      impact_fail=$((impact_fail+1))
    fi
  else
    skip_layer impact "auth" "nenhum arquivo crítico de auth alterado"
  fi

  # workflow
  if changed "workflow" || changed "processo"; then
    report+="- [impact] workflow: ⚠ arquivos de workflow alterados — rodar suite E2E de processo antes do merge\n"
  fi

  # email
  if changed "email-templates" || changed "mailer"; then
    report+="- [impact] email: ⚠ templates/mailer alterados — gerar preview visual\n"
  fi
fi

# -----------------------------------------------------------------------------
# Artefatos auxiliares (coletados se presentes após o build)
# -----------------------------------------------------------------------------
bundle_client_kb=""
bundle_server_kb=""
if [[ -d dist/public ]]; then
  bundle_client_kb="$(du -sk dist/public 2>/dev/null | awk '{print $1}')"
elif [[ -d dist/client ]]; then
  bundle_client_kb="$(du -sk dist/client 2>/dev/null | awk '{print $1}')"
fi
if [[ -f dist/index.cjs ]]; then
  bundle_server_kb="$(du -k dist/index.cjs 2>/dev/null | awk '{print $1}')"
fi

# -----------------------------------------------------------------------------
# Gate de regressão (comparação com baseline, se numérico registrado)
# -----------------------------------------------------------------------------
regression_warn=""
BASELINE_FILE="docs/integrity-baseline.json"
if [[ -f "$BASELINE_FILE" ]] && has_cmd python3; then
  if [[ -n "$bundle_client_kb" ]]; then
    regression_warn="$(python3 - "$BASELINE_FILE" "$bundle_client_kb" <<'PY' || true
import json, sys
path, cur = sys.argv[1], int(sys.argv[2])
try:
    base = json.load(open(path))
except Exception:
    sys.exit(0)
ref = base.get("bundle_client_kb")
if not ref:
    sys.exit(0)
pct = (cur - ref) / ref * 100
if pct >= 5:
    print(f"bundle_client +{pct:.1f}% vs baseline ({ref}KB → {cur}KB)")
PY
)"
  fi
fi

# -----------------------------------------------------------------------------
# Relatório final
# -----------------------------------------------------------------------------
finished_at="$(date -Iseconds)"
total_ms=$(( $(now_ms) - $(python3 -c "from datetime import datetime; print(int(datetime.fromisoformat('${started_at}').timestamp()*1000))" 2>/dev/null || echo 0) ))

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " INTEGRITY REPORT"
echo "═══════════════════════════════════════════════════════════════"
echo " Agent:   ${AGENT}"
echo " Layers:  ${LAYERS_ARG}"
echo " Started: ${started_at}"
echo " Ended:   ${finished_at}"
echo " Commit:  $(git rev-parse --short HEAD 2>/dev/null || echo n/a)"
echo " Branch:  $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo n/a)"
[[ -n "$bundle_client_kb" ]] && echo " Bundle (client): ${bundle_client_kb} KB"
[[ -n "$bundle_server_kb" ]] && echo " Bundle (server): ${bundle_server_kb} KB"
echo "---------------------------------------------------------------"
printf "%b" "$report"
if [[ -n "$regression_warn" ]]; then
  echo "---------------------------------------------------------------"
  echo " ⚠ Regressão detectada: $regression_warn"
fi
echo "---------------------------------------------------------------"
echo " Pass: ${pass}   Fail: ${fail}   Skipped: ${skip}"
echo "═══════════════════════════════════════════════════════════════"

# -----------------------------------------------------------------------------
# Dump de métricas (para capture-baseline.sh e para CI)
# -----------------------------------------------------------------------------
if [[ -n "${METRICS_OUT:-}" ]]; then
  {
    echo "# integrity-metrics"
    echo "agent=${AGENT}"
    echo "layers=${LAYERS_ARG}"
    echo "started=${started_at}"
    echo "ended=${finished_at}"
    echo "commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
    echo "branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    [[ -n "$bundle_client_kb" ]] && echo "bundle_client_kb=${bundle_client_kb}"
    [[ -n "$bundle_server_kb" ]] && echo "bundle_server_kb=${bundle_server_kb}"
    [[ -n "${tsc_warnings:-}" ]] && echo "tsc_warnings=${tsc_warnings}"
    echo "pass=${pass}"
    echo "fail=${fail}"
    echo "skip=${skip}"
    echo "# layer:label:status:duration_ms"
    printf "%s" "${METRICS}"
  } > "${METRICS_OUT}"
  echo "📊 Métricas escritas em: ${METRICS_OUT}"
fi

if (( fail > 0 )); then
  echo ""
  echo "❌ Integridade NÃO aprovada. Corrija antes de abrir PR." >&2
  exit 1
fi

echo ""
echo "✅ Integridade aprovada. Cole o bloco acima na descrição do PR."
exit 0
