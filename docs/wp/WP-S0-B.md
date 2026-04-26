# WP-S0-B — Saneamento de testes frágeis

- **Sprint:** 0.5 (fechamento)
- **Owner alvo:** A2 (Backend/DB)
- **Branch:** `agent-a2/WP-S0-B-purge-source-grep-tests`
- **Base branch:** `hml`
- **Depends on:** WP-S0-A (mergeado em `hml`)
- **Bloqueia:** WP-S0-C, Marco 2 (baseline freeze)
- **ADR de referência:** [ADR-004](../adr/ADR-004-no-source-grep-tests.md)
- **Estimativa:** 2h
- **Risco:** médio (perda nominal de 14 testes; abertura de 4 follow-ups)

---

## 1. Contexto

Quatro arquivos em `server/` falham com 14 asserts quebrados. O padrão comum em todos eles é validar funcionalidade lendo source code de outro arquivo como string e usando `expect(content).toContain('...')`. Esses testes são proibidos pelo ADR-004.

Ver ADR-004 §1 e §6 para o diagnóstico detalhado de cada arquivo.

## 2. Escopo

### 2.1. Deletar arquivos

- `server/agendamento-laudo.test.ts`
- `server/delete-user.test.ts`
- `server/email.test.ts` — **decisão:** se este arquivo contém também testes legítimos (não-grep) sobre envio de email, manter o arquivo e deletar **somente** as suítes/testes que fazem grep em source. A2 deve abrir o arquivo e classificar caso a caso antes de apagar.
- `server/formulario-agendamento-laudo.test.ts`

### 2.2. Confirmar que vitest não os referencia explicitamente

- Verificar `vitest.config.ts` e `package.json` por `include`/`exclude` que cite explicitamente os arquivos. Se houver, remover a referência.

### 2.3. Abrir 4 issues de follow-up rotuladas `tests-rewrite`

Para cada arquivo deletado (ou suíte deletada em `email.test.ts`), criar uma issue com:

- **Título:** `[tests-rewrite] Reescrever cobertura de <funcionalidade> sem grep em source`
- **Descrição:** copiar o substituto recomendado do ADR-004 §6 + lista dos cenários originais que precisam virar teste de comportamento.
- **Label:** `tests-rewrite`, `tech-debt`.
- **Assignee:** — (fica em backlog).

## 3. Arquivos esperados no diff

| Arquivo                                       | Tipo de mudança                                   |
| --------------------------------------------- | ------------------------------------------------- |
| `server/agendamento-laudo.test.ts`            | Deletado                                          |
| `server/delete-user.test.ts`                  | Deletado                                          |
| `server/email.test.ts`                        | Editado (ou deletado, conforme classificação)     |
| `server/formulario-agendamento-laudo.test.ts` | Deletado                                          |
| `vitest.config.ts` ou `package.json`          | Editado **somente se** tinha referência explícita |

## 4. Critérios de aceite

- [ ] Os 4 testes (ou suítes) listados no ADR-004 §6 não existem mais no codebase.
- [ ] `pnpm test` roda sem erros de "arquivo de teste não encontrado".
- [ ] Os **104 testes restantes** (118 originais − 14 frágeis) continuam passando. Esse delta exato deve ser reportado no PR.
- [ ] 4 issues `tests-rewrite` abertas no GitHub, uma por suíte deletada.
- [ ] PR mergeado em `hml`.
- [ ] `pnpm run check` (typecheck) **continua falhando** — escopo de WP-S0-C.

## 5. Boundaries

- ❌ Não reescreve nenhum teste agora. Reescrita é trabalho futuro, rastreado por issue.
- ❌ Não toca em código de produção (`server/` exceto os 4 `.test.ts`).
- ❌ Não toca em `client/**` nem `shared/**`.
- ❌ Não desabilita testes via `.skip()` — apaga de fato (regra explícita do ADR-004 §4).

## 6. Estratégia de revisão (humano)

1. Para cada arquivo deletado, abrir a versão pré-merge e confirmar visualmente que é grep-em-source. Se algum teste parecer legítimo, recusar PR e pedir replan.
2. Validar que `pnpm test` passa exibindo `104 passed, 0 failed` (ou número equivalente conforme contagem real).
3. Confirmar links das 4 issues no corpo do PR.

## 7. Rollback

- Reverter PR. Restaura os 4 arquivos. Custo de rollback: baixo, mas resgata o anti-padrão; só rolar se descoberta de teste legítimo no meio da deleção.

## 8. Próximo WP após merge

**WP-S0-C** — Saúde de tipos. Roda em paralelo: A2 pega parte servidor, A3 pega parte cliente.
