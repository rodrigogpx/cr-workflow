# Prompt para Cascade — fechar sessão atual sem rodar baseline

> **Contexto:** a sessão Cascade que executou `CASCADE-MARCO-2-BASELINE.md` chegou na seção 3 (rodar `capture-baseline.sh`) e descobriu que 4 das 4 camadas de integridade falhavam em `hml`. A decisão foi **não congelar baseline agora**, mas primeiro executar Sprint 0.5 (WP-S0-A, WP-S0-B, WP-S0-C) para destravar build cross-platform, sanear testes frágeis e zerar erros de tipo.
>
> **Objetivo deste prompt:** sair limpo da sessão atual. Descartar a branch `sprint-0/baseline-freeze` que ficou aberta (e o commit de `pnpm-lock.yaml` que ela acumulou), voltar para `hml` em estado limpo, e parar.
>
> **Não abre PR.** Não mergeia nada. Não congela baseline. Apenas higiene de workspace.

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o operador de higiene de workspace deste repositório.

## Regras absolutas

1. NÃO use force-push, reset --hard em hml/main, nem amend de
   commits já em origin.
2. NÃO mergeia PR. NÃO descarta branch remota sem confirmação
   explícita.
3. Trabalhe SOMENTE local. Branch local sprint-0/baseline-freeze
   pode ser descartada com `git branch -D` após confirmação.
4. Se houver mudanças não-commitadas em hml ou em outras
   branches, PARE e me reporte — isso pode ser trabalho
   importante.
5. Se a branch sprint-0/baseline-freeze foi PUSHADA pra origin
   (improvável, mas verifique), PARE — a deleção do remoto exige
   minha confirmação explícita.

## Tarefa: limpar workspace pós-tentativa de baseline

### Entregável

1. Branch local sprint-0/baseline-freeze deletada.
2. Working tree em hml limpo (git status sem modificações).
3. Eventual commit local de pnpm-lock (se ainda não pushado)
   descartado junto com a branch.

## Execução

### 0) Diagnóstico inicial

  git status
  git branch --show-current
  git branch -vv | head -20
  git log --oneline -n 10 --all

Cole o output. Reporte:
  a) Em qual branch está atualmente.
  b) Se sprint-0/baseline-freeze existe local e/ou remota.
  c) Se há commits locais nessa branch ainda não pushados.
  d) Se há working tree sujo (modified, untracked).

NÃO MEXA EM NADA. Aguarde minha luz verde com base no
diagnóstico.

### 1) Cenário esperado (e como tratar)

Provável estado:
  - Branch atual: sprint-0/baseline-freeze (local).
  - Commits locais: 1 (pnpm-lock.yaml) — não pushado.
  - Working tree: limpo OU com algum artefato gerado por
    capture-baseline.sh (logs em /tmp, integrity-metrics.txt
    na raiz).
  - Branch remota sprint-0/baseline-freeze: NÃO existe.

Se for esse o caso, prossiga para seção 2.
Se for diferente (ex.: branch já pushada), PARE.

### 2) Sair da branch

  git checkout hml
  git pull --ff-only origin hml

Esperado: já está atualizado. Se houver conflito ou divergência
com origin/hml, PARE.

### 3) Limpar artefatos do working tree (se houver)

  git status

Se aparecerem arquivos como:
  - integrity-metrics.txt
  - integrity-report.txt
  - /tmp/baseline-output.log (geralmente fora do repo, ok)

Eles podem ser apagados ou ignorados. Adicione ao .gitignore se
não estiverem (mas isso é opcional — pode ser tratado em WP futuro).

  git clean -fd -n  # dry-run primeiro

Cole o output. Se for só lixo (logs, builds), aguarde luz verde
e rode sem -n. Se mostrar arquivo importante, PARE.

### 4) Deletar branch local sprint-0/baseline-freeze

  git branch -D sprint-0/baseline-freeze

Esperado:
  "Deleted branch sprint-0/baseline-freeze (was <hash>)."

Reporte o hash deletado em chat. Esse é o commit do pnpm-lock que
foi descartado — guarde mentalmente caso precise resgatar.

### 5) Confirmação final

  git status
  git branch --show-current
  git log --oneline -n 5

Esperado:
  - branch atual: hml.
  - working tree limpo.
  - log mostra os merges recentes (PRs #2, #3, #4 + commit de
    sprint-0/hml-alignment, sprint-0/backfill-to-hml).

Cole o output e diga: "Workspace limpo. Pronto para ativar
WP-S0-A."

## Condição de parada

Pare e me notifique em:
  - Branch sprint-0/baseline-freeze foi pushada pra origin.
  - Working tree tem mudanças que não reconheço (ex.: arquivos
    novos fora de integridade).
  - hml local diverge de origin/hml (não é só fast-forward).
  - Algum commit "perdido" em outra branch local.

## Primeira resposta esperada

Cole APENAS:
  1. Output da seção 0.
  2. Diagnóstico com os 4 itens (branch atual, baseline-freeze
     existe, commits não-pushados, working tree).
  3. Pergunta: "Posso prosseguir para limpeza?"

═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Por que descartar o commit de `pnpm-lock.yaml`?

O commit `6ddd035` (215 linhas mexendo em pnpm-lock) foi feito durante a tentativa de baseline para destravar o `pnpm install --frozen-lockfile`. Esse commit **não tem valor sozinho** — ele:

1. Foi gerado por `pnpm install --no-frozen-lockfile` resolvendo um drift entre `package.json` e `pnpm-lock.yaml`.
2. Vai ser regenerado automaticamente pelo WP-S0-A quando A2 rodar `pnpm add -D cross-env` (que mexe em lockfile de qualquer forma).
3. Carregar esse commit órfão na `hml` polui o histórico.

Descartar agora e deixar o WP-S0-A gerar o lockfile correto é a higiene certa.

### Se a branch foi pushada (caso edge)

Se por algum motivo `sprint-0/baseline-freeze` chegou no remoto (ex.: Cascade fez `git push -u` em algum passo que você não esperava), avalie:

- Há PR aberto para ela? Se sim, feche o PR (`gh pr close`) antes de deletar a branch remota.
- Deletar branch remota: `git push origin --delete sprint-0/baseline-freeze`. Isso é destrutivo — só faça se você certificou que não havia review pendente.

### Próximo passo após este prompt

Ativar A2 com `docs/prompts/ACTIVATE-A2-WP-S0-A.md`.
