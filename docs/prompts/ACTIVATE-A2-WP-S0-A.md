# Prompt de ativação — Agente A2 · WP-S0-A (portabilidade + formatação)

> **Pré-requisito obrigatório:** sessão Cascade anterior fechada via `docs/prompts/CASCADE-CLOSE-SESSION.md` (branch `sprint-0/baseline-freeze` descartada, `hml` limpo).
>
> **Fluxo de branches:** `feature → hml → main`. PR deste WP mira `hml`.
>
> **Posição no plano:** primeiro WP do Sprint 0.5 (fechamento). Destrava o build cross-platform e zera dívida de formatação. Bloqueante para WP-S0-B, WP-S0-C e Marco 2.

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o Agente A2 — Backend/DB do Firerange Workflow (CAC 360),
mas neste WP específico vai tocar arquivos de configuração e
formatação que extrapolam a allowlist normal. Isso é autorizado
por exceção documentada no docs/wp/WP-S0-A.md §3.

## Regras absolutas

1. Leia, nesta ordem, antes de qualquer ação:
   - docs/adr/ADR-000-multi-agent-workflow.md
   - docs/adr/ADR-003-prettier-source-of-truth.md
   - docs/wp/WP-S0-A.md (escopo deste WP)
   - .windsurf/rules/agent-a2-backend.md (referência)

2. Não corrija nenhum erro de TypeScript. Não delete nenhum
   teste. Não toque em lógica de negócio. Se o prettier reescrever
   algum arquivo de teste ou de schema, isso é OK — o que NÃO é
   OK é você editar à mão fora do escopo definido.

3. Conventional Commits. Dois commits separados, na ordem:
   - chore(build): adicionar cross-env para portabilidade
   - chore(format): normalizar repo com prettier --write

4. Se `pnpm install` falhar após adicionar cross-env, PARE e me
   mostre o output. Não tente "consertar" o lockfile com flags
   exóticas.

5. Se o `prettier --write .` reescrever um número absurdo de
   arquivos (ex.: > 200), PARE e me mostre o git diff --stat
   para validar antes de commitar.

## Tarefa: WP-S0-A — Portabilidade + Formatação

### Entregável

1. cross-env adicionado em devDependencies.
2. Scripts dev / start / build:client reescritos usando cross-env.
3. Repo inteiro normalizado com prettier --write .
4. PR aberto contra `hml` com 2 commits separados.

## Execução

### 0) Verificação de ambiente

  node -v
  pnpm -v
  git status
  git branch --show-current
  git log --oneline -n 3 origin/hml

Confirme que:
  - Está em `hml` atualizado (git fetch origin && git checkout hml
    && git pull --ff-only).
  - git status limpo (sem arquivos modificados pendentes).
  - A branch sprint-0/baseline-freeze NÃO existe localmente
    (foi limpa pelo prompt CASCADE-CLOSE-SESSION).

NÃO prossiga sem luz verde.

### 1) Criar branch

  git checkout -b agent-a2/WP-S0-A-portability-format

### 2) Adicionar cross-env

  pnpm add -D cross-env

Esperado:
  - package.json ganha "cross-env": "^7.x.x" em devDependencies.
  - pnpm-lock.yaml atualizado.

Mostre o diff de package.json e aguarde luz verde.

### 3) Reescrever scripts em package.json

Usando o edit tool do Cascade, mudar APENAS estas três linhas:

ANTES:
  "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
  "build:client": "NODE_OPTIONS='--max-old-space-size=3072' vite build",
  "start": "NODE_ENV=production node dist/index.cjs",

DEPOIS:
  "dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts",
  "build:client": "cross-env NODE_OPTIONS=--max-old-space-size=3072 vite build",
  "start": "cross-env NODE_ENV=production node dist/index.cjs",

Verifique:
  - "build:server" intocado (não usa env vars).
  - "build" intocado (apenas orquestra).
  - "check", "format", "test", "db:push", "db:seed" intocados.

Cole o diff completo do package.json em chat. Aguarde luz verde.

### 4) Smoke test do build

  pnpm install --frozen-lockfile
  pnpm run build

Esperado: exit code 0. Cole as últimas 20 linhas do output.

Se falhar, PARE e me mande o output completo.

### 5) Commit 1 — cross-env

  git add package.json pnpm-lock.yaml
  git commit -m "chore(build): adicionar cross-env para portabilidade Windows/macOS/Linux

Refatora os scripts dev / start / build:client para usar cross-env
em vez de variável inline. Sintaxe inline NODE_OPTIONS='...' não
funciona em Windows Git Bash, bloqueando capture-baseline.sh.

Ref: docs/wp/WP-S0-A.md, docs/adr/ADR-003-prettier-source-of-truth.md

Co-Authored-By: Cascade"

### 6) Rodar prettier

  pnpm run format

Esperado: prettier reescreve 50+ arquivos. Cole git diff --stat.

Se o número de arquivos for muito diferente do esperado (ex.: 0
ou 500), PARE e me reporte.

### 7) Commit 2 — formatação

  git add -A
  git commit -m "chore(format): normalizar repo com prettier --write

Aplica formatação determinística em todo o codebase, conforme
ADR-003 (prettier como fonte da verdade de formatação).

Ref: docs/wp/WP-S0-A.md, docs/adr/ADR-003-prettier-source-of-truth.md

Co-Authored-By: Cascade"

### 8) Verificação final pós-commit

  pnpm prettier --check .
  pnpm run build

Esperado:
  - prettier --check: exit 0.
  - build: exit 0 (mesmo com erros de typecheck pendentes — typecheck
    é WP-S0-C).

Não rode pnpm run check (typecheck) — vai falhar por motivos de
WP-S0-C. Não rode pnpm test — vai falhar por motivos de WP-S0-B.

### 9) Push e PR

  git push -u origin agent-a2/WP-S0-A-portability-format

  gh pr create \
    --base hml \
    --head agent-a2/WP-S0-A-portability-format \
    --title "A2/WP-S0-A — portabilidade do build + format prettier" \
    --body-file <(cat <<'BODY'
WP: WP-S0-A — Portabilidade do build + normalização de formatação
ADR: docs/adr/ADR-003-prettier-source-of-truth.md
Spec: docs/wp/WP-S0-A.md
Agente autor: A2
Sprint: 0.5 (fechamento)

## Resumo

- cross-env adicionado em devDependencies.
- dev / start / build:client reescritos para sintaxe portável.
- 50+ arquivos normalizados com prettier --write (ver git diff --stat).

## Integrity Report (parcial)

Camadas ainda falhando intencionalmente neste PR:
  - typecheck — escopo de WP-S0-C
  - unit tests — escopo de WP-S0-B

Camadas verdes após este PR:
  - build (exit 0 em Windows/Linux/macOS)
  - prettier --check (exit 0)

## Riscos e rollback

Risco: baixo. Mudança mecânica.
Rollback: git revert simples. Sem migration, sem schema.

## Próximos WPs

WP-S0-B (saneamento de testes frágeis) — pode ser pego logo após merge.
BODY
)

Cole o URL do PR criado.

### 10) Verificação final

  gh pr view <URL> --json title,baseRefName,headRefName,mergeable
  gh pr checks <URL>

Espero:
  - base: hml, head: agent-a2/WP-S0-A-portability-format
  - mergeable: MERGEABLE
  - Integrity Check rodando (pode falhar em unit/typecheck — OK,
    é esperado neste WP).

## Condição de parada

Pare e me notifique em:
  - pnpm install ou pnpm add falhou.
  - prettier reescreveu número anômalo de arquivos.
  - build falhou em qualquer plataforma.
  - Conflito ao dar push.
  - Algum dos commits acidentalmente incluiu mudança não-prettier
    (ex.: lógica de tipo, deleção de teste).

## Primeira resposta esperada

Cole APENAS:
  1. Output da seção 0 (node -v, pnpm -v, git status, git log hml).
  2. Pergunta: "Ambiente pronto. Prossigo para criar a branch e
     adicionar cross-env?"

═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Quando pausar manualmente

- **Após seção 3 (diff de package.json):** confira que só 3 linhas mudaram (dev, start, build:client) + a entrada nova de cross-env em devDependencies.
- **Após seção 6 (`prettier --write`):** olhe `git diff --stat`. Se o volume parecer absurdo (ex.: 500+ arquivos com 50000 linhas), recuse e investigue. O esperado é ~50-150 arquivos com ~500-3000 linhas, dominado por trocas de aspas, indentação e quebras de linha.
- **Após seção 8 (verificação final):** confirme com seus olhos que `pnpm prettier --check .` retorna 0 — qualquer arquivo flagged aqui significa que o `--write` não pegou (raro, mas pode acontecer com arquivos no `.prettierignore` mal configurado).

### Sinais de que deu certo

- `git log --oneline` na branch mostra exatamente 2 commits.
- PR aberto em `agent-a2/WP-S0-A-portability-format → hml`, MERGEABLE.
- CI roda; camadas `build` e `prettier --check` ✓.
- Camadas `unit` e `typecheck` ✗ — esperado, é WP-S0-B/C.

### Próximo passo após merge

Ativar A2 novamente com `docs/prompts/ACTIVATE-A2-WP-S0-B.md`.
