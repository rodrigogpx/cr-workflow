# WP-S0-D — Alinhar versão pnpm em workflows com `packageManager`

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

- `.github/workflows/integrity.yml` (linhas 28–31)
- `.github/workflows/baseline-freeze.yml` (linhas 49–52)

### Diff conceitual (idêntico nos dois arquivos)

```diff
       - name: Setup pnpm
         uses: pnpm/action-setup@v4
-        with:
-          version: 9
```

### Fora de escopo

- Não tocar em `package.json`. O `packageManager: pnpm@10.15.1` já está correto e será o source of truth daqui em diante.
- Não criar workflows novos.
- Não mexer em outras steps dos workflows.

## 4. Aceitação

1. `git diff origin/hml` mostra somente remoção de 2 linhas em cada workflow (4 linhas no total).
2. Workflow `integrity.yml` roda em PR de smoke (qualquer PR vivo que toque `client/**` ou `server/**` serve) e passa o step `pnpm install --frozen-lockfile`.
3. Workflow `baseline-freeze.yml` roda em modo `dry_run: true` (workflow_dispatch manual) e passa todos os pre-flights (`prettier`, `tsc`, `test`, `build`).
4. Sem regressão: nenhum outro step dos workflows precisa de mudança colateral.

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
