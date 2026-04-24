# Prompt para Cascade — push + PRs de alinhamento ao fluxo `feature → hml → main`

> **Contexto:** 2 branches já estão commitados localmente (`sprint-0/hml-alignment` e `sprint-0/backfill-to-hml`). Este prompt pede ao Cascade para fazer o `git push` e abrir os 2 PRs correspondentes. O sandbox original que gerou os commits não tem acesso a `github.com`, por isso delegamos ao Cascade.
>
> **Como usar:** abra o Windsurf Cascade no repositório, cole o bloco abaixo delimitado por `═══` como primeira mensagem, e siga as confirmações.

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o operador de git/GitHub para este repositório. Esta
sessão tem escopo restrito: apenas push e abertura de PRs.

## Regras absolutas

1. NÃO edite nenhum arquivo. Todos os commits já estão prontos.
2. NÃO use `git rebase`, `git reset --hard`, `git push --force`,
   `git amend`, nem `git cherry-pick`. Apenas `push` e `gh pr create`.
3. NÃO altere a branch `hml` ou `main` diretamente. Abra PRs.
4. NÃO feche, merge ou modifique PRs existentes (ex.: PR #2).
5. Se qualquer comando retornar erro não trivial, PARE e me mostre
   o output completo antes de tentar de novo.

## Tarefa

Fazer push de 2 branches locais e abrir 2 PRs:

| Branch local                     | Base     | Título                                                           |
|---------------------------------|---------|------------------------------------------------------------------|
| sprint-0/hml-alignment          | main    | chore(sprint-0): alinhar protocolo ao fluxo feature → hml → main |
| sprint-0/backfill-to-hml        | hml     | chore(sprint-0): backfill do protocolo multi-agente para hml     |

## Execução

### 0) Verificação inicial

Rode e cole os outputs:

  git status
  git branch --show-current
  git log --oneline --all --decorate -n 15
  git remote -v

Confirme:
  - Working tree limpo (ou apenas arquivos não relacionados untracked).
  - Branch atual é `sprint-0/hml-alignment` OU `sprint-0/backfill-to-hml`.
  - origin aponta para o repositório github.com/rodrigogpx/cr-workflow
    (ou similar — me confirme o owner/repo antes de prosseguir).
  - As branches `sprint-0/hml-alignment` e `sprint-0/backfill-to-hml`
    existem localmente (ls refs/heads/sprint-0/).
  - `gh auth status` retorna logado.

NÃO PROSSIGA sem luz verde minha.

### 1) Push do branch 1 (sprint-0/hml-alignment)

  git checkout sprint-0/hml-alignment
  git log --oneline origin/main..sprint-0/hml-alignment

Me mostre quantos commits serão enviados. Esperado: 2 commits
novos (553377a e dd4a2f4) além dos commits do Sprint 0 que já
foram mergeados em main via PR #2.

Se o diff mostrar MUITO mais que isso (ex.: 500 arquivos), PARE
— algo está errado, provavelmente a branch `main` local está
defasada. Nesse caso me avise para eu fazer `git fetch` antes.

Se estiver OK:

  git push -u origin sprint-0/hml-alignment

### 2) Abrir PR 1 (→ main)

  gh pr create \
    --base main \
    --head sprint-0/hml-alignment \
    --title "chore(sprint-0): alinhar protocolo ao fluxo feature → hml → main" \
    --body-file <(cat <<'BODY'
## Contexto

O fluxo canônico do repositório é `feature → hml → main`. O Sprint 0 (PR #2) foi originalmente configurado para mirar `main` diretamente. Este PR corrige essa inconsistência.

## O que muda

- `.github/workflows/integrity.yml`: passa a disparar em PRs e push para `hml` **e** `main` (antes só `main`).
- `docs/prompts/ACTIVATE-A1-WP-01.md`, `ACTIVATE-A2-WP-02.md`, `ACTIVATE-A1-WP-R1.md`: `git checkout main` → `hml`; `gh pr create --base main` → `--base hml`.
- `docs/adr/ADR-000-multi-agent-workflow.md`: documenta explicitamente que PRs dos agentes miram `hml`; a promoção `hml → main` fica sob responsabilidade do owner do repo, fora do loop dos agentes.
- `.github/PULL_REQUEST_TEMPLATE.md` e `.github/ISSUE_TEMPLATE/baseline-integridade.md`: ajustam referência de branch base para `hml`.
- `docs/OPERATIONAL-HML-ALIGNMENT.md`: guia operacional dos 2 PRs de alinhamento.

## Dependência operacional

Este PR é complementar ao PR `sprint-0/backfill-to-hml → hml` (abertos em paralelo). A ordem de merge não importa.

## Integrity Report

Somente camada `static` — mudanças documentais + configuração de CI. Nenhum código de runtime foi tocado.

## Riscos e rollback

Baixo. `git revert` simples. Nenhuma migração envolvida.
BODY
)

Me cole o URL do PR criado.

### 3) Push do branch 2 (sprint-0/backfill-to-hml)

  git checkout sprint-0/backfill-to-hml
  git log --oneline origin/hml..sprint-0/backfill-to-hml

Esperado: 6 commits (93c2aac, 290a642, a26c798, 1745274, 517b285,
6643975). Se bater, seguir:

  git push -u origin sprint-0/backfill-to-hml

### 4) Abrir PR 2 (→ hml)

O body do PR 2 já está commitado em `.github/PR-BODY-backfill-to-hml.md`,
então basta referenciar:

  gh pr create \
    --base hml \
    --head sprint-0/backfill-to-hml \
    --title "chore(sprint-0): backfill do protocolo multi-agente para hml" \
    --body-file .github/PR-BODY-backfill-to-hml.md

Me cole o URL do PR criado.

### 5) Verificação pós-push

  gh pr list --state open --limit 10
  gh pr view <URL-do-PR-1> --json title,baseRefName,headRefName,mergeable
  gh pr view <URL-do-PR-2> --json title,baseRefName,headRefName,mergeable

Espero ver os 2 PRs abertos:
  - #<n1>: sprint-0/hml-alignment → main
  - #<n2>: sprint-0/backfill-to-hml → hml

Ambos com mergeable: MERGEABLE ou UNKNOWN (se CI ainda rodando).

### 6) Aguardar CI (opcional, só para reportar)

Se quiser acompanhar:

  gh pr checks <URL-do-PR-1>
  gh pr checks <URL-do-PR-2>

Reporte o status de cada check. NÃO faça merge — essa decisão é
minha, após revisão manual.

## Condição de parada

Pare e me notifique em qualquer um desses casos:
  - `git push` retornou erro de permissão, conflito, ou "non-fast-forward".
  - `gh pr create` falhou com qualquer mensagem não trivial.
  - O branch local `sprint-0/hml-alignment` ou `sprint-0/backfill-to-hml`
    não existe ou está em um commit diferente do esperado.
  - O repositório origin aponta para um owner/repo diferente do
    que eu esperava.

## Primeira resposta esperada

Na primeira mensagem, cole APENAS:
  1. Output dos comandos da seção 0 (verificação inicial).
  2. Pergunta: "Tudo consistente. Prossigo com o push do PR 1?"

Só depois da minha confirmação, execute cada seção (1, 2, 3, 4, 5)
pausando após cada uma para eu te dar luz verde.
═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Sinais de que deu certo

- 2 novos PRs abertos no GitHub, com títulos corretos e bases corretas.
- PR 1 mostra 7 arquivos modificados (ajustes de protocolo).
- PR 2 mostra 21 arquivos novos (fundação + ajustes).
- Ambos disparam o workflow `Integrity Check` (visível em `gh pr checks`).

### Se o CI falhar no PR 1

- **Mais provável:** gate de regressão em `pending` (baseline ainda não existe em `main`). Aceitável — esse PR é meta-infra.
- **Menos provável:** `static` falha (lint/format). Cascade deve te mostrar o report; me chame para decidir se faço o fix aqui no sandbox e te mando novo commit.

### Se o CI falhar no PR 2

- Mesma coisa, mas rodando contra `hml`. Como o workflow `integrity.yml` só existe em `hml` DEPOIS que este PR mergear, é possível que o check nem dispare inicialmente — isso é o esperado; o primeiro PR contra `hml` depois deste é que vai acionar o CI de verdade.

### Rollback

Se depois do merge eu perceber que algo está errado:
- PR 1 revertido: `gh pr create` com branch que faz `git revert <merge-commit>` — não precisa de ação destrutiva.
- PR 2 revertido: idem.
