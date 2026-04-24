# Operacional — Alinhamento do protocolo ao fluxo `feature → hml → main`

Este guia descreve a execução dos 2 PRs que ajustam o protocolo multi-agente ao fluxo canônico do repositório. Ambos já estão commitados localmente e aguardam push.

> **Ordem dos PRs:** não importa qual vai primeiro, o resultado final é `main` e `hml` com o mesmo protocolo alinhado. Minha sugestão: abrir os dois em paralelo, revisar juntos, mergear juntos.

---

## PR 1 — `sprint-0/hml-alignment → main`

**O que faz:** ajusta os arquivos de protocolo que já estão em `main` para mirar `hml` em vez de `main` como branch de PR dos agentes. 1 commit, 7 arquivos tocados.

**Commits:**
- `553377a` — `chore(sprint-0): alinhar protocolo ao fluxo feature → hml → main`

**Comandos (via Cascade ou terminal local com acesso ao GitHub):**

```bash
git fetch origin
git checkout sprint-0/hml-alignment
git push -u origin sprint-0/hml-alignment

gh pr create \
  --base main \
  --head sprint-0/hml-alignment \
  --title "chore(sprint-0): alinhar protocolo ao fluxo feature → hml → main" \
  --body-file <(cat <<'BODY'
## Contexto

O fluxo canônico do repositório é `feature → hml → main`. O Sprint 0 foi originalmente configurado para mirar `main` diretamente. Este PR corrige essa inconsistência.

## O que muda

- `.github/workflows/integrity.yml`: passa a disparar em PRs e push para `hml` **e** `main` (antes só `main`).
- `docs/prompts/ACTIVATE-A1-WP-01.md`, `ACTIVATE-A2-WP-02.md`, `ACTIVATE-A1-WP-R1.md`: `git checkout main` → `hml`; `gh pr create --base main` → `--base hml`.
- `docs/adr/ADR-000-multi-agent-workflow.md`: documenta explicitamente que PRs dos agentes miram `hml`; a promoção `hml → main` fica sob responsabilidade do owner do repo, fora do loop dos agentes.
- `.github/PULL_REQUEST_TEMPLATE.md` e `.github/ISSUE_TEMPLATE/baseline-integridade.md`: ajustam referência de branch base para `hml`.

## Integrity Report

Somente camada `static` — mudanças documentais + configuração de CI. Nenhum código de runtime foi tocado.

## Riscos e rollback

Baixo. `git revert` simples. Nenhuma migração envolvida.
BODY
)
```

---

## PR 2 — `sprint-0/backfill-to-hml → hml`

**O que faz:** traz o Sprint 0 (fundação + ajustes de `hml`) para a branch `hml`, de modo que o protocolo exista também lá. 6 commits, 21 arquivos adicionados.

**Commits:**
- `93c2aac` — fundação do protocolo multi-agente
- `290a642` — corpo do PR de fundação
- `a26c798` — prompt de ativação do A1 para WP-01
- `1745274` — ativação do A2 (WP-02) e do A1 (WP-R1)
- `517b285` — alinhar protocolo ao fluxo feature → hml → main
- `6643975` — PR bodies para hml-alignment e backfill-to-hml

**Comandos:**

```bash
git checkout sprint-0/backfill-to-hml
git push -u origin sprint-0/backfill-to-hml

gh pr create \
  --base hml \
  --head sprint-0/backfill-to-hml \
  --title "chore(sprint-0): backfill do protocolo multi-agente para hml" \
  --body-file .github/PR-BODY-backfill-to-hml.md
```

---

## Por que os dois PRs são necessários

| Sem PR 1 (hml-alignment) | Sem PR 2 (backfill-to-hml) |
|---|---|
| Prompts dos agentes em `main` continuariam instruindo `--base main`, violando o fluxo canônico. | `hml` não teria o workflow `.github/workflows/integrity.yml`, então PRs dos agentes contra `hml` rodariam sem gate de integridade. |
| CI não rodaria em PRs que mirem `hml`. | `hml` não teria `CODEOWNERS`, `scripts/integrity-check.sh`, nem os prompts ACTIVATE — os agentes não teriam onde partir. |

Os dois PRs são complementares e independentes. Pode mergear em qualquer ordem.

---

## Verificação pós-merge

Depois dos 2 merges:

```bash
git checkout main && git pull --ff-only
git checkout hml && git pull --ff-only

# Sanidade: mesmo conteúdo dos arquivos de protocolo em ambas
diff <(git show main:.github/workflows/integrity.yml) \
     <(git show hml:.github/workflows/integrity.yml)
# deve retornar vazio

diff <(git show main:docs/prompts/ACTIVATE-A1-WP-01.md) \
     <(git show hml:docs/prompts/ACTIVATE-A1-WP-01.md)
# deve retornar vazio
```

Se os dois `diff` retornarem vazio, `hml` e `main` estão sincronizados no protocolo. O trabalho dos agentes pode começar a partir de `hml`.

---

## Próximo marco depois disso

Voltar ao plano original:

1. **Marco 2 — Baseline**: rodar `scripts/capture-baseline.sh` em `hml` (com `pnpm install`), abrir PR `sprint-0/baseline-freeze → hml`.
2. **Marco 3 — Teams/CODEOWNERS**: criar teams `@a1-docs`, `@a2-backend`, `@a3-frontend` no GitHub; atualizar `CODEOWNERS` substituindo placeholders.
3. **Marco 4 — Primeiro WP real**: ativar A1 com `docs/prompts/ACTIVATE-A1-WP-01.md` no Windsurf Cascade.
