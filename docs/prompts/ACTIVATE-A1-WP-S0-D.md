# Prompt de ativação — Agente A1 · WP-S0-D — alinhar versão pnpm em workflows

> **Pré-requisito:** nenhum WP. Sai direto de `hml`.
>
> **Fluxo de branches:** `feature → hml → main`. PR mira `hml`.
>
> **Posição no plano:** WP de hygiene descoberto durante WP-S0-A. **Deve mergear ANTES de WP-S0-A** — sem este fix, o CI do PR de S0-A está travado em `Error: Multiple versions of pnpm specified`. Bloqueia Marco 2 (baseline freeze). Owner: A1 (allowlist `.github/**`).

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o Agente A1 — Docs/ADR do Firerange Workflow (CAC 360).

## Regras absolutas

1. Leia, nesta ordem, antes de qualquer ação:
   - docs/adr/ADR-000-multi-agent-workflow.md
   - docs/wp/WP-S0-D.md (spec deste WP)
   - .windsurf/rules/agent-a1-docs.md

2. Sua allowlist neste WP: .github/workflows/**.
   NÃO toque em server/**, client/**, shared/**, drizzle/**.
   NÃO toque em package.json — o campo packageManager já está
   correto; mexer nele expandiria escopo.

3. Diff esperado: 4 linhas removidas no total (2 por workflow).
   Se for mais que isso, PARE e me consulte.

4. Conventional Commits.

## Tarefa: WP-S0-D — remover input `version` dos workflows pnpm

### Entregável

1. .github/workflows/integrity.yml: bloco `with: version: 9`
   removido do step `Setup pnpm`.
2. .github/workflows/baseline-freeze.yml: idem.
3. PR aberto contra hml com 1 commit.

## Execução

### 0) Verificação de ambiente

Você pode estar atualmente em outra branch (ex.:
agent-a2/WP-S0-A-portability-format). Se houver working tree
sujo (untracked files de prompt PR como pr-body-s0a.md, ou
artefatos similares), apenas deixe untracked — eles vão ser
preservados ao trocar de branch. NÃO use git clean.

  git status
  git branch --show-current

Cole o output. Se houver MODIFIED tracked files (não untracked),
PARE — pode ser trabalho não-commitado de outro WP.

  git checkout hml
  git pull --ff-only origin hml
  git log --oneline -n 3

Confirme que está em hml limpo (untracked OK, modified NÃO).

  $env:PATH = "$PWD\.tools\node\node-v20.18.3-win-x64;" + $env:PATH
  pnpm install --frozen-lockfile 2>&1 | tail -3
  echo "exit_code=$LASTEXITCODE"

Esperado em hml ATUAL (sem S0-A): pode falhar com
ERR_PNPM_UNUSED_PATCH se o lockfile estiver drifted, ou pode
passar se hml ainda estiver intacto. Cole o resultado e prossiga
de qualquer forma — este WP é só sobre o YAML do workflow, não
depende do install local.

  git checkout -b agent-a1/WP-S0-D-pnpm-version-alignment

NÃO prossiga sem luz verde.

### 1) Diagnóstico atual

Confirme exatamente onde está o input `version: 9`:

  Get-Content .github/workflows/integrity.yml | Select-String -Pattern "version|pnpm/action-setup" -Context 0,2
  Get-Content .github/workflows/baseline-freeze.yml | Select-String -Pattern "version|pnpm/action-setup" -Context 0,2

Cole o output. Esperado: 2 ocorrências por arquivo, ambas no step
`Setup pnpm`.

### 2) Aplicar fix em integrity.yml

Edite .github/workflows/integrity.yml. Localize o bloco:

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

E transforme em:

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

(Remove o `with:` e o `version: 9`. Mantém indentação YAML correta.)

Cole o diff:

  git diff -- .github/workflows/integrity.yml

### 3) Aplicar fix em baseline-freeze.yml

Mesma transformação no segundo arquivo:

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

Cole o diff:

  git diff -- .github/workflows/baseline-freeze.yml

### 4) Validação YAML

  Get-Content .github/workflows/integrity.yml | python -c "import sys, yaml; yaml.safe_load(sys.stdin); print('integrity.yml OK')"
  Get-Content .github/workflows/baseline-freeze.yml | python -c "import sys, yaml; yaml.safe_load(sys.stdin); print('baseline-freeze.yml OK')"

Esperado: ambos imprimem "OK".

Se Python não estiver disponível, use:

  pnpm dlx js-yaml .github/workflows/integrity.yml > $null && echo "integrity.yml OK"
  pnpm dlx js-yaml .github/workflows/baseline-freeze.yml > $null && echo "baseline-freeze.yml OK"

### 5) Confirmar diff total

  git diff --stat
  git diff

Esperado:
  - 2 arquivos modificados
  - 0 inserções, 4 deleções (2 por arquivo)
  - Diff só mostra remoção de `with:` + `version: 9`

Se for diferente, PARE.

### 6) Commit

  git add .github/workflows/integrity.yml .github/workflows/baseline-freeze.yml
  git status

  git commit -m "ci: alinhar pnpm/action-setup com packageManager

Remove input `version: 9` hardcoded de integrity.yml e
baseline-freeze.yml. pnpm/action-setup@v4 agora lê o campo
packageManager do package.json (pnpm@10.15.1), evitando drift
de schema de lockfile entre pnpm 9 e 10.

Sem este fix, pnpm install --frozen-lockfile no CI falharia com
ERR_PNPM_UNUSED_PATCH em wouter@3.7.1 (regenera lockfile do zero
e perde a resolução).

Pré-condição para Marco 2 (baseline freeze).

Ref: docs/wp/WP-S0-D.md, docs/wp/WP-S0-A.md (descoberta)

Co-Authored-By: Cascade"

  git log -n 1 --stat

### 7) Push e PR

  git push -u origin agent-a1/WP-S0-D-pnpm-version-alignment

Crie o body do PR:

  $body = @"
## WP

WP-S0-D — Alinhar versão pnpm em workflows com packageManager
Spec: ``docs/wp/WP-S0-D.md``
Sprint: 0.5 (fechamento)
Agente autor: A1

## Resumo

Remove ``with: version: 9`` de:
- ``.github/workflows/integrity.yml``
- ``.github/workflows/baseline-freeze.yml``

``pnpm/action-setup@v4`` passa a usar o campo ``packageManager`` do ``package.json`` (``pnpm@10.15.1``) como source of truth.

## Por quê

pnpm 9 e pnpm 10 usam schemas de lockfile incompatíveis. Quando o CI rodava com pnpm 9 contra um lockfile gerado por pnpm 10 (situação criada pelo merge do WP-S0-A), o pnpm 9 tratava o lockfile como ausente e regenerava do zero, quebrando a resolução de ``wouter@3.7.1`` (versão exata referenciada por ``patches/wouter@3.7.1.patch``).

Esse problema travou o dev local durante o WP-S0-A. Sem este fix, o mesmo trava o CI e bloqueia Marco 2 (baseline freeze).

## Integrity Report

- **static (YAML):** ✓ ambos os arquivos parseiam.
- **diff:** 4 linhas removidas, 0 inseridas (mecânica).
- **CI smoke:** será validado pelo próprio ``integrity.yml`` ao rodar este PR.

## Riscos e rollback

Risco baixo. Comportamento de ``pnpm/action-setup@v4`` lendo ``packageManager`` é documentado e estável desde v3. Rollback via ``git revert``.

## Refs

- ``docs/wp/WP-S0-D.md``
- ``docs/wp/WP-S0-A.md`` §6 (descoberta do problema)
- [pnpm/action-setup docs](https://github.com/pnpm/action-setup#use-packagemanager-field)
"@

  $body | Out-File -FilePath /tmp/pr-body-s0d.md -Encoding utf8

  gh pr create `
    --base hml `
    --head agent-a1/WP-S0-D-pnpm-version-alignment `
    --title "A1/WP-S0-D — alinhar pnpm/action-setup com packageManager" `
    --body-file /tmp/pr-body-s0d.md

Cole o URL.

### 8) Verificação pós-PR

  gh pr view <URL> --json mergeable,state,statusCheckRollup
  gh pr checks <URL>

Esperado: integrity.yml roda automaticamente neste PR e PASSA agora
(é o teste real do fix). Se falhar, leia o log e me reporte —
provavelmente é o caso edge mencionado em docs/wp/WP-S0-D.md §7
(Corepack precisa ser enabled). Fix nesse caso seria adicionar:

      - name: Enable Corepack
        run: corepack enable

Antes do step Setup pnpm. Mas faça SOMENTE depois de eu autorizar.

## Condição de parada

Pare e reporte se:
  - Diff total for diferente de 4 linhas removidas.
  - YAML inválido após edição.
  - PR check do integrity.yml falhar.
  - gh CLI não estiver autenticada.

## Primeira resposta esperada

Cole APENAS:
  1. Output da seção 0 (git log + pnpm install).
  2. Output da seção 1 (Select-String).
  3. Pergunta: "Ambiente OK e blocos `version: 9` localizados.
     Prossigo para edição dos dois arquivos?"

═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Quando pausar manualmente

- **Após seção 5 (diff total):** confirme visualmente que são exatamente 4 linhas removidas, nada mais. Mudanças laterais em YAML têm efeito cascata.
- **Após seção 8 (CI check):** o PR vai disparar `integrity.yml` automaticamente. Esse PR é o **primeiro teste real do fix**. Se passar, o WP cumpriu. Se falhar com `corepack must be enabled`, é o edge case esperado — autorize Cascade a adicionar o step `corepack enable` em followup commit.

### Coordenação com outros WPs

- WP-S0-D pode rodar **paralelo** a WP-S0-B e WP-S0-C — sem conflito de paths.
- WP-S0-D **bloqueia** WP-S0-Z (Marco 2). Sem ele, o `baseline-freeze.yml` falha no `pnpm install --frozen-lockfile` da pré-condição.

### Ordem ideal de merges

1. WP-S0-A (já em PR) → merge primeiro (estabelece lockfile + packageManager).
2. WP-S0-D → segundo (destrava CI). Pode ser paralelo a B/C mas mergear cedo é higiene.
3. WP-S0-B → após A.
4. WP-S0-C (paralelo A2 + A3) → após B.
5. WP-S0-Z (Marco 2) → após todos os anteriores.

### Próximo passo após merge

Voltar para o fluxo principal do Sprint 0.5: ativar WP-S0-B via `docs/prompts/ACTIVATE-A2-WP-S0-B.md`.
