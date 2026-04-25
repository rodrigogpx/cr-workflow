# Prompt para Cascade — landar fundação do Sprint 0.5

> **Contexto:** o working tree contém 11 arquivos novos + 1 arquivo modificado, todos relativos ao fechamento do Sprint 0 (Sprint 0.5). Esses arquivos foram gerados em sessão anterior (Claude no Cowork) e estão no disco como **untracked / modified**. Este prompt:
>
> 1. Sai limpamente da sessão Cascade anterior (descarta branch local `sprint-0/baseline-freeze` órfã + commit de `pnpm-lock` solto).
> 2. Cria branch `sprint-0/scope-0.5-foundation` em cima de `hml`.
> 3. Comita os 12 arquivos em **2 commits** semanticamente separados.
> 4. Empurra e abre PR contra `hml`.
>
> **Não executa nenhum dos WPs.** Apenas planta o protocolo do Sprint 0.5 em `hml` para que os prompts de ativação (A2/S0-A, A2/S0-B, A2/S0-C-server, A3/S0-C-client) possam ser usados depois.

---

## Lista exata de arquivos a comitar

**Novos (11):**

```
docs/adr/ADR-003-prettier-source-of-truth.md
docs/adr/ADR-004-no-source-grep-tests.md
docs/wp/WP-S0-A.md
docs/wp/WP-S0-B.md
docs/wp/WP-S0-C.md
docs/prompts/CASCADE-CLOSE-SESSION.md
docs/prompts/CASCADE-LAND-SPRINT-0.5.md     ← este próprio arquivo
docs/prompts/ACTIVATE-A2-WP-S0-A.md
docs/prompts/ACTIVATE-A2-WP-S0-B.md
docs/prompts/ACTIVATE-A2-WP-S0-C-server.md
docs/prompts/ACTIVATE-A3-WP-S0-C-client.md
.github/workflows/baseline-freeze.yml
```

**Modificado (1):**

```
docs/TASKS.md
```

Total: **12 arquivos** (1 deles é este prompt; tudo bem comitar — vira referência operacional permanente).

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o operador git deste repositório. Tarefa única e bem
delimitada: landar a fundação do Sprint 0.5 em uma branch nova
e abrir PR contra hml.

## Regras absolutas

1. NÃO edite nenhum dos 12 arquivos listados abaixo. Eles vêm
   prontos do working tree. Sua tarefa é git/gh, não autoria.
2. NÃO execute capture-baseline.sh, nem pnpm install, nem nada
   que mude o lockfile. Este PR é só docs + 1 workflow YAML.
3. NÃO use force-push, reset --hard em hml/main, ou amend de
   commits já em origin.
4. NÃO mergeia o PR. Só abre.
5. Antes de qualquer git checkout que mude branch, valide com
   `git status` que os 12 arquivos do escopo continuam
   presentes (untracked ou modified). Se um deles sumiu, PARE.
6. Se uma operação destrutiva (git clean, git branch -D) for
   necessária, mostre o dry-run primeiro e aguarde luz verde.

## Tarefa

A) Higiene: descartar branch local sprint-0/baseline-freeze
   (órfã da tentativa anterior de baseline) e o commit de
   pnpm-lock que ficou solto nela. Validar que NÃO foi pushada
   para origin antes de deletar.

B) Criar branch sprint-0/scope-0.5-foundation a partir de hml
   atualizada.

C) Comitar os 12 arquivos em 2 commits:
   Commit 1 — docs(sprint-0.5): ADRs, specs, prompts.
   Commit 2 — ci(sprint-0.5): workflow baseline-freeze + TASKS.

D) Push + gh pr create --base hml.

## Execução

### 0) Diagnóstico

Rode e cole outputs:

  git status
  git branch --show-current
  git branch -vv | head -20
  git log --oneline -n 8 --all
  git fetch origin

Reporte em chat:
  a) Branch atual (provável: sprint-0/baseline-freeze).
  b) Branch sprint-0/baseline-freeze existe local? E remota?
     (`git ls-remote origin sprint-0/baseline-freeze`)
  c) Commits locais não-pushados nessa branch.
  d) Working tree: liste os untracked/modified que casam com a
     lista do escopo (12 arquivos abaixo).

Lista do escopo a verificar:

  docs/adr/ADR-003-prettier-source-of-truth.md
  docs/adr/ADR-004-no-source-grep-tests.md
  docs/wp/WP-S0-A.md
  docs/wp/WP-S0-B.md
  docs/wp/WP-S0-C.md
  docs/prompts/CASCADE-CLOSE-SESSION.md
  docs/prompts/CASCADE-LAND-SPRINT-0.5.md
  docs/prompts/ACTIVATE-A2-WP-S0-A.md
  docs/prompts/ACTIVATE-A2-WP-S0-B.md
  docs/prompts/ACTIVATE-A2-WP-S0-C-server.md
  docs/prompts/ACTIVATE-A3-WP-S0-C-client.md
  .github/workflows/baseline-freeze.yml
  docs/TASKS.md  (modificado, não untracked)

Confirme que os 11 primeiros aparecem como untracked e o 12º
(TASKS.md) como modified. Se algum estiver faltando, PARE.

NÃO PROSSIGA sem minha luz verde.

### 1) Confirmar que sprint-0/baseline-freeze NÃO foi pushada

  git ls-remote origin sprint-0/baseline-freeze

Esperado: saída vazia. Se a branch existe no remoto, PARE — vou
decidir caso a caso (pode ter PR aberto que precisa fechar
primeiro).

### 2) Mover para hml preservando working tree

Fundamental: `git checkout hml` precisa preservar os 12 arquivos
no working tree (eles são untracked/modified, não estão em
nenhum commit ainda — git checkout não os apaga).

  git checkout hml
  git pull --ff-only origin hml
  git status

Verifique de novo que os 12 arquivos continuam visíveis.

### 3) Deletar branch local sprint-0/baseline-freeze

Só após confirmação remota negativa da seção 1:

  git branch -D sprint-0/baseline-freeze

Esperado: "Deleted branch sprint-0/baseline-freeze (was <hash>)".
Reporte o hash. Esse hash representa o commit de pnpm-lock
descartado intencionalmente.

  git status

Confirme que os 12 arquivos continuam no working tree.

### 4) Criar branch de fundação

  git checkout -b sprint-0/scope-0.5-foundation

  git status

Os 12 arquivos devem estar listados como untracked / modified.

### 5) Commit 1 — ADRs, specs, prompts (docs only)

Adicione APENAS estes 10 arquivos:

  git add \
    docs/adr/ADR-003-prettier-source-of-truth.md \
    docs/adr/ADR-004-no-source-grep-tests.md \
    docs/wp/WP-S0-A.md \
    docs/wp/WP-S0-B.md \
    docs/wp/WP-S0-C.md \
    docs/prompts/CASCADE-CLOSE-SESSION.md \
    docs/prompts/CASCADE-LAND-SPRINT-0.5.md \
    docs/prompts/ACTIVATE-A2-WP-S0-A.md \
    docs/prompts/ACTIVATE-A2-WP-S0-B.md \
    docs/prompts/ACTIVATE-A2-WP-S0-C-server.md \
    docs/prompts/ACTIVATE-A3-WP-S0-C-client.md

  git status

Confirme que somente esses 11 arquivos estão staged. Os 2 restantes
(.github/workflows/baseline-freeze.yml e docs/TASKS.md) devem
permanecer unstaged.

  git diff --cached --stat

Cole o output. Aguarde luz verde.

Após luz verde:

  git commit -m "docs(sprint-0.5): ADRs, specs e prompts de fechamento

ADRs:
  - ADR-003: prettier como fonte da verdade de formatação.
  - ADR-004: banimento de testes que validam código por inspeção
    textual de source.

WP specs:
  - WP-S0-A: portabilidade do build (cross-env) + prettier --write.
  - WP-S0-B: saneamento de testes frágeis (deletar 4 arquivos
    que fazem grep em source).
  - WP-S0-C: saúde de tipos (iat.ts + validations.ts no servidor;
    SuperAdminTenants.tsx no cliente; A2 e A3 em paralelo).

Prompts Cascade:
  - CASCADE-CLOSE-SESSION: higiene da sessão de baseline órfã.
  - CASCADE-LAND-SPRINT-0.5: landar este próprio escopo.
  - ACTIVATE-A2-WP-S0-A / S0-B / S0-C-server.
  - ACTIVATE-A3-WP-S0-C-client.

Origem: captura de baseline (Marco 2) em hml falhou em 4/4
camadas. Sprint 0.5 destrava cada uma antes de retomar Marco 2
em ambiente Linux/CI.

Ref: docs/wp/WP-S0-A.md, docs/wp/WP-S0-B.md, docs/wp/WP-S0-C.md

Co-Authored-By: Claude (Cowork) <noreply@anthropic.com>"

### 6) Commit 2 — workflow CI + atualização do TASKS

  git add \
    .github/workflows/baseline-freeze.yml \
    docs/TASKS.md

  git status

Confirme que esses 2 arquivos estão staged e não há mais nada
unstaged ou untracked.

  git diff --cached --stat

Cole o output. Aguarde luz verde.

Após luz verde:

  git commit -m "ci(sprint-0.5): workflow baseline-freeze + atualizar TASKS

Workflow .github/workflows/baseline-freeze.yml (workflow_dispatch):
  - Roda em Ubuntu/CI (não no sandbox local Windows).
  - Pré-condições validadas no próprio job: prettier --check,
    pnpm run check, pnpm test, pnpm run build — todas verdes.
  - capture-baseline.sh executa, sanity checks no JSON gerado.
  - Abre PR sprint-0/baseline-freeze-<timestamp> automaticamente
    contra hml.
  - Suporta input dry_run para gerar artifact sem abrir PR.

docs/TASKS.md:
  - Nova seção 'Sprint 0.5 — Fechamento' com WP-S0-A, WP-S0-B,
    WP-S0-C e WP-S0-Z (Marco 2).
  - WP-01 e WP-R1 do Sprint 1 ganham depends_on: WP-S0-Z.

Ref: docs/wp/WP-S0-C.md §7

Co-Authored-By: Claude (Cowork) <noreply@anthropic.com>"

### 7) Verificação pós-commit

  git log --oneline -n 5
  git diff hml..sprint-0/scope-0.5-foundation --stat

Esperado:
  - 2 commits novos vs hml.
  - 12 arquivos no diff (11 novos + 1 modificado).
  - Nenhum arquivo fora do escopo.

Se aparecer arquivo inesperado (ex.: pnpm-lock.yaml, package.json),
PARE — algo extra entrou no add.

### 8) Push + PR

  git push -u origin sprint-0/scope-0.5-foundation

  gh pr create \
    --base hml \
    --head sprint-0/scope-0.5-foundation \
    --title "chore(sprint-0.5): fundação do fechamento — ADRs + WPs + workflow baseline" \
    --body-file <(cat <<'BODY'
## Contexto

Captura de baseline (Marco 2 do Sprint 0) em `hml` falhou em 4 camadas:

1. **build** — `NODE_OPTIONS='...' vite build` não funciona em Windows Git Bash (sintaxe Unix inline).
2. **prettier** — 50+ arquivos divergentes do `.prettierrc`.
3. **unit tests** — 4 arquivos em `server/` validam código por grep em source-files (anti-padrão).
4. **typecheck** — ~50 erros em 3 arquivos (`server/routers/iat.ts`, `shared/validations.ts`, `client/src/pages/SuperAdminTenants.tsx`).

Antes de retomar Marco 2, este PR planta a fundação do **Sprint 0.5** que destrava cada uma dessas falhas como WP discreto, executado pelos agentes (validação ponta-a-ponta do protocolo multi-agente).

## Conteúdo

### ADRs (2)
- `docs/adr/ADR-003-prettier-source-of-truth.md`
- `docs/adr/ADR-004-no-source-grep-tests.md`

### WP specs (3)
- `docs/wp/WP-S0-A.md` — Portabilidade do build + prettier
- `docs/wp/WP-S0-B.md` — Saneamento de testes frágeis
- `docs/wp/WP-S0-C.md` — Saúde de tipos (frentes A2 + A3 paralelas)

### Prompts Cascade (5)
- `CASCADE-CLOSE-SESSION` — higiene da sessão de baseline órfã
- `CASCADE-LAND-SPRINT-0.5` — landar este próprio escopo
- `ACTIVATE-A2-WP-S0-A` / `S0-B` / `S0-C-server`
- `ACTIVATE-A3-WP-S0-C-client`

### Workflow CI (1)
- `.github/workflows/baseline-freeze.yml` — Marco 2 reposicionado para Ubuntu/CI, com pré-condições explícitas e abertura automática de PR.

### TASKS.md
- Nova seção "Sprint 0.5 — Fechamento" com 4 WPs (S0-A/B/C/Z).
- WP-01 e WP-R1 do Sprint 1 agora declaram `depends_on: WP-S0-Z`.

## Integrity Report

Somente camada `static` aplicável — mudanças documentais + 1 workflow YAML. Nenhum código de runtime tocado.

Camadas que continuam falhando intencionalmente (escopo dos próximos WPs):
- build cross-platform → WP-S0-A.
- prettier --check → WP-S0-A.
- unit tests → WP-S0-B.
- typecheck → WP-S0-C.

## Sequência operacional pós-merge

1. Ativar A2 com `ACTIVATE-A2-WP-S0-A.md` → PR → merge.
2. Ativar A2 com `ACTIVATE-A2-WP-S0-B.md` → PR → merge.
3. Ativar A2 e A3 **em paralelo** com os prompts de S0-C → 2 PRs → merge.
4. Disparar `Baseline Freeze` workflow no GitHub Actions → merge do PR automático.
5. **Marco 2 concluído.** WP-01 e WP-R1 do Sprint 1 ficam elegíveis.

## Riscos e rollback

Risco: muito baixo. Apenas docs + 1 workflow novo. Nenhum código de runtime.
Rollback: `git revert` simples.
BODY
)

Cole o URL do PR.

### 9) Verificação final

  gh pr view <URL> --json title,baseRefName,headRefName,mergeable
  gh pr checks <URL>

Espero:
  - base: hml, head: sprint-0/scope-0.5-foundation.
  - mergeable: MERGEABLE.
  - Integrity Check rodando (deve passar — só camada static é
    obrigatória para PR de docs/CI).

## Condição de parada

Pare e me notifique em:
  - Working tree não tem todos os 12 arquivos.
  - Branch sprint-0/baseline-freeze foi pushada para origin.
  - hml local diverge de origin/hml (não é só fast-forward).
  - Algum git add acidental incluiu arquivo fora da lista.
  - Push falhou (auth, conflito, branch protegida).
  - gh pr create falhou.

## Primeira resposta esperada

Cole APENAS:
  1. Output da seção 0.
  2. Diagnóstico:
     - Branch atual:
     - sprint-0/baseline-freeze local existe? remota?
     - Commits locais não-pushados:
     - 12 arquivos do escopo presentes? (cheque um a um)
  3. Pergunta: "Posso prosseguir para deletar a branch órfã e
     criar sprint-0/scope-0.5-foundation?"

═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Pontos onde pausar manualmente

- **Após seção 0:** confira que os 12 arquivos aparecem no `git status`. Se algum estiver faltando, é sinal de que o working tree foi alterado entre a sessão Claude (Cowork) e a sessão Cascade — pode ser um `git clean -fd` involuntário. Recupere antes de prosseguir.
- **Após seção 1:** se `git ls-remote` mostrar que `sprint-0/baseline-freeze` ESTÁ no remoto, PARE e me consulte. Provavelmente PR aberto que precisa fechar.
- **Após seção 5 (`git diff --cached --stat` do commit 1):** valide que aparecem exatamente 11 arquivos staged, todos em `docs/`. Nenhum YAML, nenhum `.json`, nenhum `package.json`.
- **Após seção 6 (`git diff --cached --stat` do commit 2):** valide que aparecem exatamente 2 arquivos: `.github/workflows/baseline-freeze.yml` e `docs/TASKS.md`.
- **Após seção 7:** o `git diff hml..sprint-0/scope-0.5-foundation --stat` é o resumo final. Espera-se 12 arquivos, ~1500-2500 linhas adicionadas.

### Sinais de que deu certo

- 2 commits limpos na branch `sprint-0/scope-0.5-foundation`.
- PR aberto contra `hml`, MERGEABLE.
- Integrity Check verde (apenas camada static obrigatória; PR não toca código de runtime).
- Branch local `sprint-0/baseline-freeze` deletada (commit de pnpm-lock descartado limpamente).

### Próximo passo após merge

Ativar A2 com `docs/prompts/ACTIVATE-A2-WP-S0-A.md`.
