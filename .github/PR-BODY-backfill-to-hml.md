## Contexto

O Sprint 0 (fundação do protocolo multi-agente) foi mergeado em `main` (PR #2). Como o fluxo canônico do projeto é `feature → hml → main`, o mesmo conteúdo precisa existir em `hml` — senão PRs dos agentes (que miram `hml`) não terão o workflow de CI, CODEOWNERS, nem os scripts de integridade rodando.

## O que este PR faz

Cherry-pick dos 5 commits do Sprint 0 para `hml`:

1. `93c2aac` — `chore(sprint-0): fundação do protocolo multi-agente`
2. `290a642` — `chore(sprint-0): adicionar corpo do PR de fundação`
3. `a26c798` — `docs(prompts): prompt de ativação do A1 para WP-01`
4. `1745274` — `docs(prompts): ativação do A2 (WP-02) e do A1 (WP-R1)`
5. `517b285` — `chore(sprint-0): alinhar protocolo ao fluxo feature → hml → main`

Esses commits reproduzem em `hml` o que já está em `main`, **já com os ajustes do commit 5** (prompts mirando `hml` em vez de `main`, workflow CI disparando em ambas as branches).

## Integrity Report

Somente camada `static`. Nenhum código de runtime foi tocado.

## Dependência operacional

Idealmente mergeado **junto com** o PR `sprint-0/hml-alignment → main`. A ordem não importa entre os dois — o resultado final é `hml` e `main` com o mesmo protocolo.

## Riscos e rollback

- **Risco:** baixo. Fast-forward limpo sobre `hml` atual.
- **Rollback:** `git revert` dos 5 commits, ou reset da branch `hml` para o commit pré-merge.
