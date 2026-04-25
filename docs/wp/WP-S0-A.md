# WP-S0-A — Portabilidade do build + normalização de formatação

- **Sprint:** 0.5 (fechamento)
- **Owner alvo:** A2 (Backend/DB)
- **Branch:** `agent-a2/WP-S0-A-portability-format`
- **Base branch:** `hml`
- **Depends on:** —
- **Bloqueia:** WP-S0-B, WP-S0-C, Marco 2 (baseline freeze)
- **ADR de referência:** [ADR-003](../adr/ADR-003-prettier-source-of-truth.md)
- **Estimativa:** 1h
- **Risco:** baixo

---

## 1. Contexto

Captura de baseline (Marco 2) falhou em duas camadas por motivos não-funcionais:

1. **Build no Windows**: `NODE_OPTIONS='--max-old-space-size=3072' vite build` é sintaxe Unix de variável inline. Git Bash do Windows recusa, retornando `'NODE_OPTIONS' não é reconhecido como comando interno ou externo`. O `vite build` em si funciona — provado quando rodado isolado, gera todos os chunks com exit code 0.
2. **Formatação**: 50+ arquivos divergem do `.prettierrc`. A camada `static` do `integrity-check.sh` falha em `prettier --check`.

Os dois bloqueiam o baseline mas não são bug de código. Este WP é a higiene mecânica que destrava tudo.

## 2. Escopo

### 2.1. Portabilidade (`cross-env`)

- Adicionar `cross-env` em `devDependencies` do `package.json`.
- Reescrever scripts que usam variável inline:
  - `build:client`: `"NODE_OPTIONS='--max-old-space-size=3072' vite build"` → `"cross-env NODE_OPTIONS=--max-old-space-size=3072 vite build"`
  - `dev`: `"NODE_ENV=development tsx watch server/_core/index.ts"` → `"cross-env NODE_ENV=development tsx watch server/_core/index.ts"`
  - `start`: `"NODE_ENV=production node dist/index.cjs"` → `"cross-env NODE_ENV=production node dist/index.cjs"`
- Não tocar em `build:server` (esbuild não usa env vars) nem em `build` (orquestrador).

### 2.2. Normalização (`prettier --write`)

- Rodar `pnpm install` para garantir lockfile coerente após adição de `cross-env`.
- Rodar `pnpm run format` (que internamente chama `prettier --write .`).
- Commitar resultado.

## 3. Arquivos esperados no diff

| Arquivo                       | Tipo de mudança                                     |
| ----------------------------- | --------------------------------------------------- |
| `package.json`                | Adiciona `cross-env`, reescreve 3 scripts           |
| `pnpm-lock.yaml`              | Atualizado para incluir `cross-env`                 |
| `client/**/*.{ts,tsx,css}`    | Formatação                                          |
| `server/**/*.ts`              | Formatação                                          |
| `shared/**/*.ts`              | Formatação                                          |
| `scripts/**/*.{sh,mjs,js}`    | Formatação (se prettier souber a linguagem)         |
| `.github/**/*.{yml,md}`       | Formatação                                          |
| `.windsurf/**/*.md`           | Formatação                                          |
| Raiz: `*.md`, `*.json`, etc.  | Formatação                                          |

> **Importante:** o WP-S0-A toca arquivos fora da allowlist normal de A2 (especificamente `client/**` e `.windsurf/**`). Isto é **autorizado por exceção** porque o conteúdo da mudança é gerado por ferramenta determinística (prettier), não escrita por humano/agente. O CODEOWNERS deve dispensar review por path neste PR (responsabilidade do owner do repo).

## 4. Critérios de aceite

- [ ] `pnpm run build` roda em Windows Git Bash, macOS e Linux sem mudar comando.
- [ ] `pnpm prettier --check .` retorna exit code 0.
- [ ] `pnpm run check` (typecheck) **continua falhando** — tipo é WP-S0-C, não este. Mas o número de erros de typecheck **não pode aumentar** vs. estado atual de `hml`.
- [ ] `pnpm test` continua com os mesmos 14 testes falhando — eles são WP-S0-B, não este.
- [ ] Diff do `package.json` é mínimo: 1 dependência nova, 3 scripts editados.
- [ ] Branch tem **2 commits separados**:
  - Commit 1: `chore(build): adicionar cross-env para portabilidade Windows/macOS/Linux`
  - Commit 2: `chore(format): normalizar repo com prettier --write`
- [ ] PR mergeado em `hml`.

## 5. Boundaries (o que **não** faz parte deste WP)

- ❌ Não corrige nenhum erro de TypeScript.
- ❌ Não deleta nenhum teste.
- ❌ Não toca em lógica de negócio.
- ❌ Não atualiza dependências além de adicionar `cross-env`.
- ❌ Não roda `capture-baseline.sh` — Marco 2 é após WP-S0-A + WP-S0-B + WP-S0-C.

## 6. Estratégia de revisão (humano)

1. Olhar o diff de `package.json` linha por linha — deve caber em 8 linhas mudadas.
2. Olhar diff de `pnpm-lock.yaml` apenas para confirmar que só `cross-env` (e suas deps transitivas) foram adicionados.
3. **Pular leitura linha por linha do commit de formatação** — confiar no prettier. Olhar só o `git diff --stat` para confirmar volume coerente (~50 arquivos, ~500-1500 linhas mudadas).
4. Smoke local opcional: `pnpm run build` em uma máquina Windows para confirmar que `cross-env` funciona.

## 7. Rollback

- Reverter PR. Não há side-effect persistente (nenhuma migration, nenhum schema mudou).
- Custo de rollback: 0.

## 8. Próximo WP após merge

**WP-S0-B** — Saneamento de testes frágeis. Pode ser pego pelo mesmo A2 imediatamente após merge.
