<!--
  Corpo do PR do Sprint 0 — Fundação do protocolo multi-agente.
  Apagar este arquivo após o merge (não faz parte da história do protocolo).
-->

## WP associado

WP-00 — Fundação do protocolo multi-agente (já marcado `[x]` em `docs/TASKS.md`)

**Agente autor:** humano (@rodrigogpx) · o próprio protocolo está sendo institucionalizado neste PR, portanto escapa da allowlist de agentes por design.

**Dependências resolvidas:** nenhuma (é a primeira entrega do Sprint 0).

## Resumo da mudança

- Institui o workflow de coordenação entre os 3 agentes (A1 Docs/ADR, A2 Backend/DB, A3 Frontend/UX) via Windsurf Cascade.
- Define fonte de verdade única (`docs/TASKS.md`) com git-based distributed locking e estados canônicos (`[ ] [~] [>] [?] [x] [!]`).
- Enforcement mecânico via `.github/CODEOWNERS` + `.windsurf/rules/agent-*.md`.
- Gate de integridade de 8 camadas via `scripts/integrity-check.sh` + workflow CI que infere o agente pela branch e aplica a matriz de obrigatoriedade do §7 do plano.
- Baseline de regressão (placeholder neste PR; será congelado no PR seguinte `sprint-0/baseline-freeze`).

## Escopo

- [x] Todos os arquivos alterados estão em `docs/`, `.github/`, `.windsurf/` e `scripts/` — compatível com o escopo de fundação.
- [x] `docs/TASKS.md` já reflete WP-00 como `[x]` completed.
- [x] Nenhum WP foi fragmentado.

## Integrity Report

Este PR **institui** o gate de integridade — o próprio workflow `integrity.yml` está sendo introduzido aqui, então a primeira execução no CI vai rodar de dentro deste PR. Como `docs/integrity-baseline.json` ainda não existe, o step `Regression gate` retorna `status=pending` (não `fail`). Isso é o comportamento esperado para o PR de fundação.

Após o merge, o PR seguinte (`sprint-0/baseline-freeze`) vai congelar o baseline e habilitar o gate de regressão completo.

**Camadas executadas manualmente antes de abrir o PR:**

- [x] `static` (sintaxe bash validada com `bash -n`, YAML validado com `python3 -c "import yaml; yaml.safe_load(...)"`)
- [x] `build` N/A (apenas docs + config neste PR)
- [x] `unit` N/A

## Risco e mitigação

- **Risco:** CODEOWNERS aponta para teams `@a1-docs`, `@a2-backend`, `@a3-frontend` que ainda não existem na organização → PRs podem ficar bloqueados esperando revisão de team inexistente.
  - **Mitigação:** o fallback `@rodrigogpx` está em todas as regras, então você pode sempre aprovar. Criar os teams logo após o merge (ver `docs/SPRINT-0-DIA-2.md` §5).
- **Risco:** workflow `integrity.yml` falha em dependências que não têm script (`pnpm run lint` ausente, por exemplo).
  - **Mitigação:** o script trata scripts ausentes como `skip_layer`, não `fail`. Verificado no dry-run.
- **Rollback:** `git revert` do merge commit reverte tudo de uma vez; nada persiste em DB ou serviços externos.

## Checklist pré-merge

- [x] Conventional Commit no commit desta branch (`chore(sprint-0): fundação do protocolo multi-agente`).
- [x] Documentação completa: plano + ADR + guias operacionais.
- [ ] Revisão aprovada (auto-merge possível até os teams serem criados).
- [ ] Após merge: seguir para o Dia 2 conforme `docs/SPRINT-0-DIA-2.md`.

## Referências

- `docs/PLANO-MULTI-AGENTE.md` §6 e §7
- `docs/adr/ADR-000-multi-agent-workflow.md`
- `docs/SPRINT-0-DIA-2.md`
