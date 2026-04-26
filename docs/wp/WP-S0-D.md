# WP-S0-D — Alinhar versão pnpm em workflows + reconciliar lockfile

> **Sprint:** 0.5 (fechamento)
> **Owner sugerido:** A1 (allowlist `.github/**`)
> **Branch sugerida:** `agent-a1/WP-S0-D-pnpm-version-alignment`
> **Depende de:** nenhum WP. Roda paralelo a WP-S0-A (descoberto durante a execução de S0-A; conflito de versão pnpm já existe em `hml` hoje, independente das mudanças de S0-A).
> **Bloqueia:** WP-S0-A (CI vermelho até S0-D mergear) e WP-S0-Z (Marco 2 — baseline freeze).
> **Ordem de merge recomendada:** S0-D antes de S0-A. Após merge de S0-D, rebasear S0-A em hml atualizado e re-trigger CI.
> **Estimativa:** 30 min.

---

## 1. Contexto

Durante a execução do WP-S0-A descobrimos que:

1. `package.json` declara `"packageManager": "pnpm@10.15.1"` (campo padrão suportado por Corepack e por `pnpm/action-setup@v4`).
2. `pnpm-lock.yaml` é gerado por pnpm 10.x e **não é compatível** com pnpm 9.x — schemas de lockfile diferem entre majors. pnpm 9 lendo um lockfile do 10 trata como ausente e regenera silenciosamente do zero.
3. Ambos os workflows ativos do repo passam `version: 9` ao `pnpm/action-setup@v4`, **sobrescrevendo** o campo `packageManager`:
   - `.github/workflows/integrity.yml` linha 31
   - `.github/workflows/baseline-freeze.yml` linha 52

Consequência: quando o CI rodar nesses workflows após o merge do WP-S0-A, o `pnpm install --frozen-lockfile` (pré-condição do `baseline-freeze.yml`) vai falhar — exatamente o mesmo `ERR_PNPM_UNUSED_PATCH` que travou o dev local antes do fix.

Sem este WP, o Marco 2 (baseline freeze) não consegue rodar.

## 2. Decisão

Remover o input `version` dos dois workflows e deixar `pnpm/action-setup@v4` ler o campo `packageManager` do `package.json` automaticamente. É o comportamento default da action quando `version` é omitido (e `package_json_file` aponta pro `package.json` na raiz, que também é default).

Alternativa rejeitada: trocar `version: 9` por `version: 10` hardcoded. Resolve o problema agora, mas reintroduz o mesmo drift no próximo bump de pnpm. Perde-se o `packageManager` como single source of truth.

## 3. Escopo

### Arquivos modificados

- `.github/workflows/integrity.yml` (linhas 28–31): remover `with: version: 9`
- `.github/workflows/baseline-freeze.yml` (linhas 49–52): idem
- `pnpm-lock.yaml`: regeneração via `pnpm 10.15.1` para reconciliar drift pré-existente em `hml` (descoberto durante este WP)

### Diff conceitual nos workflows (idêntico nos dois)

```diff
       - name: Setup pnpm
         uses: pnpm/action-setup@v4
-        with:
-          version: 9
```

### Reconciliação do lockfile (efeito colateral necessário)

O lockfile gerado anteriormente por `pnpm 9` mascarava drift em `hml`: itens declarados em `package.json` não estavam refletidos no lockfile, mas `pnpm 9` regenerava silenciosamente em memória sem falhar `--frozen-lockfile`. Após este WP, `pnpm 10` (lido do `packageManager`) detecta o drift e exige reconciliação.

Itens reconciliados (nenhum é regressão de código, todos correspondem a estados já presentes em `package.json` de `hml`):

- `jspdf`, `jspdf-autotable` adicionados (presentes em `dependencies` desde commit anterior)
- `vite-plugin-manus-runtime`, `@medv/finder` removidos (já fora do `package.json`)
- `@tailwindcss/oxide`, `@tailwindcss/vite`, `@builder.io/vite-plugin-jsx-loc` movidos `devDependencies → dependencies` (refletindo uso em runtime do Tailwind 4)
- `jose` specifier `6.1.0 → ^6.1.0` (mudança de pin)
- `wouter@3.7.1` preservado (canário do patch em `patches/`)

### Fora de escopo

- Não tocar em `package.json`. O `packageManager: pnpm@10.15.1` já está correto.
- Não criar workflows novos.
- Não mexer em outras steps dos workflows.
- Não corrigir o anti-pattern conhecido de pacotes Tailwind duplicados em `dependencies` + `devDependencies` (deixar pra hygiene futura — não bloqueia).

## 4. Aceitação

1. `git diff origin/hml -- .github/workflows/` mostra somente remoção de 2 linhas em cada workflow (4 linhas no total).
2. `git diff origin/hml -- pnpm-lock.yaml` mostra apenas reconciliação dos 6 itens de drift listados em §3 — nenhuma mudança de versão em pacotes não-declarados em `package.json`.
3. `wouter@3.7.1` permanece no lockfile (canário do patch em `patches/`).
4. `pnpm install --frozen-lockfile` passa local e em CI.
5. Workflow `integrity.yml` roda neste PR e passa o step `pnpm install --frozen-lockfile`.
6. Workflow `baseline-freeze.yml` roda em modo `dry_run: true` (workflow_dispatch manual) e passa todos os pre-flights (`prettier`, `tsc`, `test`, `build`) — esta validação é pós-merge.
7. Sem regressão: nenhum outro step dos workflows precisa de mudança colateral.

## 5. Integrity Report obrigatório

| Camada       | Como validar                                                     |
| ------------ | ---------------------------------------------------------------- |
| static       | YAML válido (`yamllint .github/workflows/*.yml` ou GitHub UI)    |
| CI smoke     | Re-run do `integrity.yml` em PR vivo, ou push trivial em `hml`   |
| dry-run      | `gh workflow run baseline-freeze.yml -F dry_run=true`            |

## 6. Riscos e rollback

**Risco:** baixo. Mudança puramente declarativa em workflow. `pnpm/action-setup@v4` suporta `packageManager` desde a v3 — comportamento estável e documentado.

**Rollback:** `git revert` simples. Volta ao estado pré-fix. CI fica de novo travado mas o repo continua funcional.

## 7. Notas operacionais

- O `pnpm/action-setup@v4` exige Node já instalado quando `packageManager` está sendo lido (via Corepack). Os dois workflows fazem `setup-node@v4` **depois** de `setup-pnpm`. Isso já funciona hoje (pnpm é baixado standalone), mas após este WP a action vai usar Corepack do Node. Verificar se a ordem `setup-pnpm → setup-node` precisa inverter — em geral não precisa, a action gerencia.
- Se aparecer erro `corepack must be enabled`, adicionar step `run: corepack enable` antes do install. Documentar no PR.

## 8. Referências

- `package.json` campo `packageManager`
- [pnpm/action-setup docs](https://github.com/pnpm/action-setup) — seção "Use packageManager field"
- ADR-003 (prettier source of truth — analogia: lockfile / pnpm version também é single source of truth)
- WP-S0-A (descoberta do problema, lockfile drift wouter@3.7.1)

## 9. Prompt de ativação

`docs/prompts/ACTIVATE-A1-WP-S0-D.md`
