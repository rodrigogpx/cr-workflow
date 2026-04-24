## Contexto

O fluxo canônico do repositório é `feature → hml → main`. O Sprint 0 foi originalmente configurado para mirar `main` diretamente, o que criou duas inconsistências:

1. Os prompts de ativação dos agentes (A1/WP-01, A2/WP-02, A1/WP-R1) instruem `git checkout main` e `gh pr create --base main`, o que **viola o fluxo padrão do projeto**.
2. O workflow `.github/workflows/integrity.yml` só disparava em PRs para `main`, deixando PRs que mirem `hml` (o caso de uso real) sem validação de integridade.

## O que este PR faz

- **`.github/workflows/integrity.yml`**: passa a disparar em PRs e push para `hml` **e** `main`.
- **`docs/prompts/ACTIVATE-A1-WP-01.md`**, **`ACTIVATE-A2-WP-02.md`**, **`ACTIVATE-A1-WP-R1.md`**: `git checkout main` → `hml`; `gh pr create --base main` → `--base hml`.
- **`docs/adr/ADR-000-multi-agent-workflow.md`**: documenta explicitamente que PRs dos agentes miram `hml`; a promoção `hml → main` fica sob responsabilidade do owner do repo, fora do loop dos agentes.
- **`.github/PULL_REQUEST_TEMPLATE.md`** e **`.github/ISSUE_TEMPLATE/baseline-integridade.md`**: ajustam referência de branch base para `hml`.

## Integrity Report

Somente camada `static` — mudanças documentais + configuração de CI. Nenhum código de runtime foi tocado.

## Dependência operacional

Após o merge deste PR em `main`, o PR irmão `sprint-0/backfill-to-hml` deve ser mergeado em `hml` para que o protocolo (workflow de integridade, CODEOWNERS, prompts, scripts) exista também em `hml`. Sem isso, os WPs dos agentes abrirão PRs contra `hml` que não vão rodar o CI de integridade.

## Riscos e rollback

- **Risco:** baixo. Somente arquivos de configuração e documentação.
- **Rollback:** `git revert` simples. Nenhuma migração de dados envolvida.
