# Sprint 0 — Dia 2 · Calibração do CI e congelamento do baseline

> Passo-a-passo operacional. Execute **uma única vez**, preferencialmente em máquina limpa ou container idêntico ao CI (Node 20, pnpm 9). Resultado: baseline congelado e workflow CI agindo como gate de regressão.

## Pré-requisitos

- [x] Dia 1 do Sprint 0 já mergeado em `main` (PR `sprint-0/protocol-foundation`).
- [ ] `pnpm 9` instalado (`corepack enable && corepack prepare pnpm@9 --activate`).
- [ ] `python3` no PATH (usado por `capture-baseline.sh` e pelo gate de regressão no CI).
- [ ] Repositório limpo: `git status` sem alterações pendentes.

## 1. Sincronizar e verificar ambiente

```bash
git checkout main
git pull --ff-only
pnpm install --frozen-lockfile
node --version      # esperado: v20.x
pnpm --version      # esperado: 9.x
```

## 2. Rodar o capture do baseline

```bash
scripts/capture-baseline.sh
```

O que este script faz:

- Invoca `scripts/integrity-check.sh` com `AGENT=baseline` e `LAYERS=static,unit,build`.
- Coleta tempos de cada camada, tamanho do bundle, contagem aproximada de testes.
- Gera ou sobrescreve:
  - `docs/integrity-baseline.md` (legível)
  - `docs/integrity-baseline.json` (consumido pelo gate de regressão)

**Critério de sucesso:** exit code 0 (todas as camadas obrigatórias passaram) **ou** exit code 1 com falhas declaradas no relatório — neste caso, os testes já passantes viram o contrato: nenhum PR futuro pode quebrar os que passaram.

### Se o baseline tem testes falhando

Isso é comum em repos reais. Procedimento:

1. Commite o baseline mesmo assim — isso congela "o que está quebrado hoje".
2. Abra uma issue de follow-up por cada teste falhando, com label `tech-debt`.
3. Atualize `docs/integrity-baseline.md` → seção **Observações / desvios** listando os testes herdados.
4. O gate de regressão só falha se um teste **antes passante** passar a falhar. Os já-falhando são tolerados até o follow-up fechar.

## 3. Branch de baseline + PR

```bash
git checkout -b sprint-0/baseline-freeze
git add docs/integrity-baseline.md docs/integrity-baseline.json
git commit -m "chore(sprint-0): congelar baseline de integridade"
git push -u origin sprint-0/baseline-freeze
gh pr create \
  --title "Sprint 0 — Baseline de integridade" \
  --body-file .github/ISSUE_TEMPLATE/baseline-integridade.md \
  --label sprint-0 \
  --label integridade \
  --label baseline
```

Preencha manualmente no PR a saída do `capture-baseline.sh` e os valores numéricos.

## 4. Configurar proteção da branch `main` (GitHub UI)

Settings → Branches → Branch protection rule → `main`:

- [x] **Require a pull request before merging**
  - [x] Require approvals: 1
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners
- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Status check obrigatório: **`integrity / Integrity Report`**
- [x] **Require conversation resolution before merging**
- [x] **Do not allow bypassing the above settings** (desative apenas em caso de hotfix autorizado)

## 5. Criar os teams / handles do CODEOWNERS

Settings → Organization → Teams (ou Members → assignees). Crie:

- `@a1-docs`
- `@a2-backend`
- `@a3-frontend`

Adicione você mesmo (`@rodrigogpx`) como membro dos três teams por enquanto — os agentes Windsurf operam em sua conta. Quando contas dedicadas forem criadas para os agentes, substitua.

Depois, atualize `.github/CODEOWNERS` trocando os placeholders — se os nomes dos teams forem diferentes do default.

## 6. Rodar um PR de fumaça (opcional mas recomendado)

Para validar que o gate está ativo antes de passar para a Sprint 1:

```bash
git checkout -b agent-a1/smoke-ci
echo "<!-- smoke test $(date) -->" >> docs/TASKS.md
git add docs/TASKS.md
git commit -m "chore(a1): smoke test do workflow de integridade"
git push -u origin agent-a1/smoke-ci
gh pr create --title "[smoke] CI integrity gate" --body "Valida que workflow CI roda e comenta Integrity Report"
```

Observe no PR:

- Check `integrity / Integrity Report` aparece e roda.
- Comentário automático com o Integrity Report é postado.
- Se tudo OK, feche o PR sem merge (ou reverta o commit).

## 7. Checklist de conclusão do Dia 2

- [ ] `docs/integrity-baseline.md` e `docs/integrity-baseline.json` mergeados em `main`.
- [ ] Issue "Baseline de integridade — Sprint 0" aberta com a saída colada.
- [ ] Branch protection ativa em `main` requerendo o check `integrity / Integrity Report`.
- [ ] CODEOWNERS com teams reais (ou confirmada a decisão de manter `@rodrigogpx` provisoriamente).
- [ ] PR de smoke validou o fluxo ponta a ponta (opcional).
- [ ] Follow-ups abertos para qualquer teste/warning herdado.

## 8. Depois do Dia 2

Pronto para começar o Dia 3 com **ensaio serial**:

1. A1 reivindica `WP-01` (ADR de lifecycle). Merge.
2. A2 reivindica `WP-02` (migration grace_period). Merge.
3. Só então, paralelismo real: A2 (`WP-03`) + A3 (pega primeiro WP de frontend da próxima sprint) + A1 (`WP-R1`).
