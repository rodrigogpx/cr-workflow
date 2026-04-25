# Prompt de ativação — Agente A2 · WP-S0-B (saneamento de testes frágeis)

> **Pré-requisito obrigatório:** WP-S0-A mergeado em `hml`.
>
> **Fluxo de branches:** `feature → hml → main`. PR deste WP mira `hml`.
>
> **Posição no plano:** segundo WP do Sprint 0.5. Remove 4 arquivos de teste que fazem grep em código-fonte. Bloqueante para WP-S0-C e Marco 2.

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o Agente A2 — Backend/DB do Firerange Workflow (CAC 360).

## Regras absolutas

1. Leia, nesta ordem, antes de qualquer ação:
   - docs/adr/ADR-000-multi-agent-workflow.md
   - docs/adr/ADR-004-no-source-grep-tests.md
   - docs/wp/WP-S0-B.md
   - .windsurf/rules/agent-a2-backend.md

2. Você vai DELETAR arquivos. Antes de cada deleção, abra o
   arquivo e confirme em chat que é grep-em-source. Se houver
   teste legítimo no meio, separe e me consulte.

3. Não toque em código de produção. Apenas .test.ts em server/.
   Não toque em client/. Não toque em docs/ (exceto TASKS.md
   via protocolo de claim, se aplicável).

4. Não use .skip(). Apaga. Regra explícita do ADR-004 §4.

5. Conventional Commits.

## Tarefa: WP-S0-B — Saneamento de testes frágeis

### Entregável

1. 4 arquivos de teste analisados, deletados (ou suítes deletadas
   no caso de email.test.ts se houver mistura).
2. 4 issues no GitHub rotuladas `tests-rewrite` documentando o
   que precisa ser reescrito.
3. PR aberto contra `hml`.

## Execução

### 0) Verificação de ambiente

  git checkout hml
  git pull --ff-only origin hml
  git log --oneline -n 3

Confirme que o último commit em hml é o merge de WP-S0-A
(chore(format): normalizar repo com prettier --write ou similar).

  git checkout -b agent-a2/WP-S0-B-purge-source-grep-tests

NÃO prossiga sem luz verde.

### 1) Auditoria dos arquivos antes de deletar

Para cada arquivo da lista:
  - server/agendamento-laudo.test.ts
  - server/delete-user.test.ts
  - server/email.test.ts
  - server/formulario-agendamento-laudo.test.ts

Faça:

  cat <arquivo> | head -80
  grep -n "readFileSync\|toContain\|existsSync" <arquivo>

E me responda:
  a) É 100% grep-em-source? (todos os asserts dependem de leitura
     textual de outro arquivo .ts/.tsx)
  b) Tem teste legítimo no meio (ex.: chama função real, valida
     resposta, mocka serviço)?
  c) Para email.test.ts especificamente: há suíte SMTP isolada
     que faz grep, e suítes outras que fazem teste legítimo?

NÃO DELETE NADA AINDA. Aguarde minha luz verde por arquivo.

### 2) Vitest config check

  cat vitest.config.ts
  grep -n "agendamento-laudo\|delete-user\|formulario-agendamento\|email\.test" vitest.config.ts package.json

Reporte se há referência explícita aos arquivos que serão
deletados. Se houver, vamos remover essas referências também.

### 3) Deleção (após luz verde por arquivo)

Para cada arquivo confirmado:

  git rm server/<arquivo>.test.ts

Para email.test.ts se for caso parcial (suíte SMTP misturada):

  - Edite manualmente removendo APENAS as suítes/testes que
    fazem grep em source.
  - Mantenha intactos os testes legítimos.
  - git add server/email.test.ts

### 4) Commit

  git commit -m "test(server): remover testes que validam código por grep em source

Remove 4 arquivos de teste (ou suítes específicas em email.test.ts)
que validavam funcionalidade lendo source code de outros arquivos
como string. Padrão proibido pelo ADR-004.

Cobertura desses cenários será reescrita como testes de
comportamento (render + interação) ou de schema (drizzle introspect),
rastreado via 4 issues rotuladas tests-rewrite.

Files removed:
  - server/agendamento-laudo.test.ts (3 assertions)
  - server/delete-user.test.ts (5 assertions)
  - server/formulario-agendamento-laudo.test.ts (2 assertions)
  - server/email.test.ts ou suítes SMTP nele (1 assertion)

Ref: docs/wp/WP-S0-B.md, docs/adr/ADR-004-no-source-grep-tests.md

Co-Authored-By: Cascade"

### 5) Verificação

  pnpm test 2>&1 | tail -30

Esperado:
  - "Test Files  X passed" — sem failed.
  - Total de testes deve ser (118 - 14) = 104, ou contagem
    coerente. Cole o output exato.

Se algum teste fora dos 4 arquivos quebrou, PARE — pode ser que
o arquivo deletado importava algo usado por outro teste (raro
mas possível). Investigue antes de prosseguir.

### 6) Abrir 4 issues no GitHub

Use gh issue create. Para cada arquivo deletado, copie o template
e ajuste:

  gh issue create \
    --title "[tests-rewrite] Reescrever cobertura de agendamento de laudo sem grep em source" \
    --body-file <(cat <<'BODY'
Originado pelo merge de WP-S0-B, que deletou `server/agendamento-laudo.test.ts`
por violação do ADR-004 (testes que validam código por inspeção textual de source).

## Cenários a cobrir (substituto recomendado pelo ADR-004 §6)

Localização nova: `tests/frontend/ClientWorkflow.spec.tsx`
Stack: @testing-library/react + vitest

Cenários originalmente cobertos pelo arquivo deletado:
  - Renderização do passo de agendamento de laudo no ClientWorkflow.
  - Passagem de scheduledDate como prop ao subcomponente.
  - Presença do componente EmailPreview no fluxo (testar via render real).

## Critério de aceite

- [ ] 3 testes novos em tests/frontend/ usando render + interação.
- [ ] Vitest verde.
- [ ] Não há nenhum readFileSync/toContain de source no arquivo novo.

## Labels

tests-rewrite, tech-debt
BODY
) \
    --label "tests-rewrite,tech-debt"

Repita para os outros 3. Cole os 4 URLs em chat.

### 7) Push e PR

  git push -u origin agent-a2/WP-S0-B-purge-source-grep-tests

  gh pr create \
    --base hml \
    --head agent-a2/WP-S0-B-purge-source-grep-tests \
    --title "A2/WP-S0-B — remover testes grep-em-source" \
    --body-file <(cat <<'BODY'
WP: WP-S0-B — Saneamento de testes frágeis
ADR: docs/adr/ADR-004-no-source-grep-tests.md
Spec: docs/wp/WP-S0-B.md
Agente autor: A2
Sprint: 0.5 (fechamento)

## Resumo

- 4 arquivos (ou suítes) de teste removidos por violação do ADR-004.
- 14 asserts frágeis a menos.
- 104 testes restantes verdes.

## Issues de follow-up

- #<issue1> — agendamento de laudo
- #<issue2> — delete user
- #<issue3> — formulário de agendamento de laudo
- #<issue4> — SMTP config

## Integrity Report (parcial)

Camada ainda falhando neste PR:
  - typecheck — escopo de WP-S0-C

Camadas verdes após este PR:
  - build, prettier --check, unit (104/104).

## Riscos e rollback

Risco: médio (perda nominal de cobertura).
Mitigação: 4 issues abertas rastreando reescrita.
Rollback: git revert. Restaura testes frágeis.

## Próximos WPs

WP-S0-C — Saúde de tipos (A2 + A3 em paralelo).
BODY
)

Cole o URL.

### 8) Verificação final

  gh pr view <URL> --json mergeable
  gh pr checks <URL>

Espero MERGEABLE e CI rodando.

## Condição de parada

Pare e me notifique em:
  - Auditoria revelar teste legítimo dentro de algum dos 4
    arquivos.
  - pnpm test após deleção quebrar testes não-listados.
  - gh issue create falhar (rate limit, label inexistente).
  - Conflito de merge ao dar push.

## Primeira resposta esperada

Cole APENAS:
  1. Output da seção 0 (git log hml).
  2. Pergunta: "Ambiente pronto. Prossigo para auditoria dos 4
     arquivos?"

═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Quando pausar manualmente

- **Auditoria (seção 1):** A2 vai te pedir confirmação por arquivo. Para cada um, abra mentalmente: "esse teste valida comportamento, ou só verifica que uma string existe num source?". Se valida comportamento → recuse deleção e ajuste o WP.
- **email.test.ts (caso especial):** se for arquivo misto, exige edição manual em vez de deleção. Confira que A2 está mantendo os testes legítimos (que importam serviço de email, mockam, validam send) e só removendo suíte SMTP que faz `expect(content).toContain(...)`.
- **Issues (seção 6):** confira que `gh label create tests-rewrite` foi rodado antes (ou ajuste o `--label` para labels existentes). Se preferir, peça para A2 abrir as issues sem label e você adiciona depois.

### Sinais de que deu certo

- `pnpm test` reporta 104 passed (ou contagem coerente próximo disso).
- 4 issues `tests-rewrite` no backlog.
- PR `agent-a2/WP-S0-B-purge-source-grep-tests → hml` aberto, MERGEABLE.

### Próximo passo após merge

Ativar **em paralelo**:
  - A2 com `docs/prompts/ACTIVATE-A2-WP-S0-C-server.md`
  - A3 com `docs/prompts/ACTIVATE-A3-WP-S0-C-client.md`
