# ADR-003 — Prettier como fonte da verdade de formatação

- **Status:** Accepted
- **Data:** 2026-04-25
- **Autor:** A1 (Docs/ADR) — aprovado por Rodrigo
- **Contexto:** Firerange Workflow (CAC 360) — fechamento do Sprint 0
- **Supersede:** —
- **Referência primária:** descoberta no Marco 2 (captura de baseline) de que >50 arquivos do repo divergem do `.prettierrc` configurado.

---

## 1. Contexto

Durante a tentativa de congelar o baseline de integridade (Marco 2 do Sprint 0), a camada `static` do `scripts/integrity-check.sh` rodou `pnpm prettier --check .` e encontrou divergência em mais de 50 arquivos espalhados por `client/`, `server/`, `.github/`, `.windsurf/` e raiz do repo.

A causa-raiz é que o projeto adotou o `prettier` (versão `^3.6.2` em `devDependencies`) e definiu um `.prettierrc`, mas nunca passou um `prettier --write .` global de forma definitiva. Cada commit anterior carregou um pequeno desvio de formatação que se acumulou.

Sem uma decisão formal, qualquer um dos três cenários abaixo pode ocorrer:

1. PRs futuros encostam acidentalmente em arquivos não-formatados (ao salvar com IDE configurado), produzindo diffs gigantes que misturam intenção com cosmético.
2. Cada agente "corrige" formatação ao seu modo, gerando guerra de estilo.
3. O CI (camada `static` da matriz de integridade) bloqueia merges por motivo cosmético, e a saída fácil é desabilitar o check, o que mata o gate.

## 2. Decisão

1. **Prettier é a única autoridade de formatação do repo.** Configuração em `.prettierrc`. Editores devem ser configurados para "Format on Save" usando o prettier do workspace.
2. **CI roda `prettier --check`** dentro da camada `static` do `scripts/integrity-check.sh`. Falha bloqueia merge.
3. **Dev roda `prettier --write`** localmente antes de commit. O comando é `pnpm run format` (já existe em `package.json`).
4. **Normalização inicial via WP-S0-A.** Antes de qualquer outro WP, A2 executa `pnpm run format` em uma branch isolada e abre PR cosmético (`chore(format): normalizar repo com prettier`). Esse PR mergeia em `hml` zerando a dívida.
5. **Não vamos versionar `.prettierrc.local` por agente.** Configuração única.
6. **Não vamos rodar `prettier --write` automaticamente em PRs dos agentes** (ex.: GitHub Action que comita formatação). Formatar é responsabilidade do autor; o CI só verifica.

## 3. Consequências

**Positivas:**

- Diffs dos agentes ficam limpos — só mudança intencional, sem ruído.
- Baseline de integridade pode ser congelado sem `[static]` falhando em prettier.
- Onboarding de novos agentes/contribuidores fica claro: rode `pnpm run format`.

**Negativas / trade-offs aceitos:**

- O PR de WP-S0-A vai ser gigante (50+ arquivos). Aceito porque é único, mecânico, e zera a dívida de uma vez.
- Devs que esquecerem de formatar perdem ciclo de CI. Mitigação: documentar `pnpm run format` no `CONTRIBUTING` (via WP futuro de A1) e configurar pre-commit hook (fora deste ADR — proposta para WP futuro).

## 4. Alternativas descartadas

- **Formatar via GitHub Action automática:** comita por cima do autor; conflita com proteção de branch e com o protocolo "primeiro push vence" do ADR-000.
- **Aceitar deriva atual e desligar prettier no CI:** mata o gate `static`. Inaceitável dado que o ADR-000 trata `static` como obrigatório para todos os agentes.
- **Adotar outro formatter (biome, dprint):** custo de migração desproporcional ao benefício. `prettier` já está instalado e funcional.

## 5. Ações habilitadas por este ADR

1. Execução do **WP-S0-A — Portabilidade + Formatação** (ver `docs/wp/WP-S0-A.md`).
2. Documentar `pnpm run format` no fluxo de contribuição (escopo de A1, fora deste ADR).
3. Tornar a camada `static` do baseline um gate ativo a partir do merge do WP-S0-A.

## 6. Revisão

Este ADR será revisitado se:

- O custo cumulativo de "esqueci de formatar" virar fonte recorrente de retrabalho (>10% dos PRs).
- Surgir necessidade de regras de formatação que `prettier` não suporta (ex.: alinhamento vertical de imports). Nesse caso, supersede com ADR novo discutindo `biome` ou `eslint-plugin` complementar.
