# ADR-004 — Banimento de testes que validam código por inspeção textual de source

- **Status:** Accepted
- **Data:** 2026-04-25
- **Autor:** A1 (Docs/ADR) — aprovado por Rodrigo
- **Contexto:** Firerange Workflow (CAC 360) — fechamento do Sprint 0
- **Supersede:** —
- **Referência primária:** descoberta no Marco 2 (captura de baseline) de que 4 arquivos de teste em `server/` falham porque procuram literais de string em código-fonte.

---

## 1. Contexto

A captura de baseline do Marco 2 expôs 14 testes falhando em 4 arquivos:

- `server/agendamento-laudo.test.ts` — procura strings como `'EmailPreview'` e `'scheduledDate={step.scheduledDate}'` no source de `client/src/pages/ClientWorkflow.tsx`.
- `server/delete-user.test.ts` — verifica existência de arquivos (ex.: `Users.tsx`) e rotas via leitura textual.
- `server/email.test.ts` — parte que valida que constantes específicas estão definidas em arquivos de configuração SMTP.
- `server/formulario-agendamento-laudo.test.ts` — procura strings como `'Salvar Agendamento'` e `'Informações de Agendamento'` no source.

Padrão comum: cada um deles abre um arquivo `.tsx`/`.ts` como string e usa `toContain` em literais. Isso configura **anti-padrão de teste**, com três consequências sérias:

1. **Frágil:** qualquer rename, refactor ou i18n quebra o teste mesmo que o comportamento esteja correto.
2. **Falso senso de segurança:** o teste passa quando o source contém a string, não quando a feature funciona.
3. **Pressão contra refactor:** A3, ao mexer em `ClientWorkflow.tsx`, vai ver testes do A2 quebrarem por mudanças cosméticas em copy de UI. Isso viola o protocolo multi-agente do ADR-000 (allowlist por diretório vira ficção quando testes em `server/` "validam" código de `client/`).

Esses testes provavelmente foram criados como scaffolding (tipo "garantir que o agente não removeu o componente") em sprints anteriores, e ficaram para trás.

## 2. Decisão

1. **Testes não podem validar código por inspeção textual de source files.** Isto é, são proibidos:
   - `fs.readFileSync(componentPath, 'utf-8')` seguido de `expect(content).toContain('...')`.
   - `expect(fs.existsSync(filePath)).toBe(true)` como prova de feature.
   - Qualquer leitura de `.ts`/`.tsx`/`.js`/`.jsx` como string para validar conteúdo.
2. **Substitutos válidos para o que esses testes tentavam validar:**
   - **Comportamento de UI:** `@testing-library/react` em `tests/frontend/` ou `client/**/__tests__/`. Renderiza, interage, observa output.
   - **Existência de schema:** `drizzle-orm` introspection (importar a tabela e checar colunas) ou query real contra DB de teste.
   - **Existência de rota tRPC:** chamar a procedure no `appRouter.createCaller(ctx)` e verificar resposta.
   - **Snapshot de copy de UI:** snapshot test (`vitest`) sobre `render(<Component />)`, não sobre source.
3. **Sanitização imediata via WP-S0-B.** Os 4 arquivos atuais são deletados. Cada caso vira issue de follow-up rastreando "o que precisa ser reescrito como teste de comportamento".
4. **Code review bloqueia novo teste deste tipo.** Reviewer deve recusar PR que reintroduza o padrão.

## 3. Consequências

**Positivas:**

- Camada `unit` de integridade volta a verde, destravando baseline.
- Refactors deixam de ter falsa contenção; A3 pode renomear strings de UI sem quebrar A2.
- Testes restantes passam a refletir comportamento, não estrutura textual.

**Negativas / trade-offs aceitos:**

- **Perda de cobertura nominal:** 14 "testes" somem da contagem. Aceito porque eles testavam errado.
- **Dívida de reescrita:** os 4 cenários (agendamento de laudo, delete user, SMTP config, formulário) ficam sem teste até alguém reescrever direito. Mitigação: cada um vira issue rotulada `tests-rewrite` com critério de aceite descrito.
- **Possível regressão silenciosa** durante a janela "deletado mas não reescrito". Aceito como risco menor que o de manter testes-grep impedindo refactor.

## 4. Alternativas descartadas

- **`.skip()` com TODO:** experiência mostra que `.skip()` vira permanente. O teste fica no codebase como ruído, e o gate `unit` nunca cobre essa lógica. Pior dos mundos.
- **Reescrever todos os 4 antes do baseline:** atrasa Sprint 0 em 3-5 dias e exige conhecimento de domínio que A2 talvez não tenha. Melhor deletar agora e priorizar reescrita por valor de negócio.
- **Considerar testes-grep como categoria especial "smoke":** legitima o anti-padrão. Inaceitável.

## 5. Ações habilitadas por este ADR

1. Execução do **WP-S0-B — Saneamento de testes frágeis** (ver `docs/wp/WP-S0-B.md`).
2. Abertura de 4 issues rotuladas `tests-rewrite`, uma por arquivo deletado, com escopo do que precisa ser reescrito.
3. Code review de novos testes passa a checar este padrão (item de checklist no `PULL_REQUEST_TEMPLATE`).

## 6. Lista dos arquivos afetados (estado em 2026-04-25)

| Arquivo                                          | Falhas | Substituto recomendado                                                              |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| `server/agendamento-laudo.test.ts`               | 3      | `tests/frontend/ClientWorkflow.spec.tsx` com `render` + assertions de comportamento |
| `server/delete-user.test.ts`                     | 5      | Teste de tRPC procedure `users.delete` + teste E2E de rota                          |
| `server/email.test.ts` (parte SMTP)              | 1      | Teste de configuração: importar `smtpConfig`, validar shape com Zod                 |
| `server/formulario-agendamento-laudo.test.ts`    | 2      | `tests/frontend/FormularioAgendamentoLaudo.spec.tsx` com `render`                   |

## 7. Revisão

Este ADR será revisitado se:

- Surgir caso de uso legítimo onde inspeção textual seja a única forma de validar (ex.: linter customizado verificando convenção de naming). Nesse caso, supersede ou exceção documentada.
- A taxa de refactors bloqueados por testes desse tipo cair abaixo de 1 por sprint após 3 sprints — sinal de que o problema sumiu sozinho e o ADR pode virar advisory.
