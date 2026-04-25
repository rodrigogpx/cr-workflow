# Prompt de ativação — Agente A3 · WP-S0-C (client) — saúde de tipos

> **Pré-requisito obrigatório:** WP-S0-B mergeado em `hml`.
>
> **Fluxo de branches:** `feature → hml → main`. PR mira `hml`.
>
> **Posição no plano:** terceiro WP do Sprint 0.5, frente A3. Roda **em paralelo** com `ACTIVATE-A2-WP-S0-C-server.md` (frente A2). Cada agente abre seu próprio PR. Não há conflito de path entre os dois.

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o Agente A3 — Frontend/UX do Firerange Workflow (CAC 360).

## Regras absolutas

1. Leia, nesta ordem, antes de qualquer ação:
   - docs/adr/ADR-000-multi-agent-workflow.md
   - docs/wp/WP-S0-C.md (especialmente §2.2 — sua frente)
   - .windsurf/rules/agent-a3-frontend.md

2. Sua allowlist neste WP: client/**, public/**, tests/frontend/**.
   NÃO toque em server/**, shared/**, drizzle/** — A2 cuida disso
   em PR paralelo.

3. Não suprima erro com @ts-expect-error / @ts-ignore. Se algum
   erro exigir refactor maior do que correção pontual, PARE e
   me consulte.

4. Não refatore o componente. Apenas correções pontuais de tipo.
   Se sentir que precisa quebrar SuperAdminTenants em subcomponentes,
   pare — abra follow-up, esse não é o WP.

5. Conventional Commits.

## Tarefa: WP-S0-C frente A3 — client/src/pages/SuperAdminTenants.tsx

### Entregável

1. SuperAdminTenants.tsx: zero erros de tsc.
2. Componente renderiza idêntico ao antes (smoke manual).
3. PR aberto contra `hml` com 1 commit.

## Execução

### 0) Verificação de ambiente

  git checkout hml
  git pull --ff-only origin hml
  git log --oneline -n 3

Confirme que os últimos commits incluem WP-S0-A e WP-S0-B.

  pnpm install --frozen-lockfile
  pnpm prettier --check .

Esperado: prettier --check exit 0.

  git checkout -b agent-a3/WP-S0-C-client-types

NÃO prossiga sem luz verde.

### 1) Diagnóstico atual

  pnpm tsc --noEmit 2>&1 | grep "SuperAdminTenants" | head -20

Cole o output completo. Esperado: ~8 erros, mistura de TS2769,
TS2322, TS2345, TS2339.

  wc -l client/src/pages/SuperAdminTenants.tsx
  grep -n "isLoading\|primaryColor\|backgroundColor\|new Date" \
    client/src/pages/SuperAdminTenants.tsx | head -20

Reporte tamanho do arquivo e localização das linhas mencionadas.

### 2) Mapeamento de cada erro

Para cada erro do diagnóstico, abra a linha em chat e proponha
uma correção mínima. Use a tabela do docs/wp/WP-S0-C.md §2.2 como
guia.

Tipos típicos de fix:
  - `string | null` → `value ?? ''` ou `value ?? '#fallback'`
  - `{}` → narrowing com `typeof` ou cast explícito justificado
  - `isLoading` → trocar por `isPending` (TanStack Query v5)

NÃO EDITE NADA AINDA. Cole as ~8 propostas e aguarde luz verde
geral. Posso aceitar todas, ajustar algumas, ou refazer.

### 3) Aplicar fixes

Após luz verde, edite SuperAdminTenants.tsx aplicando as fixes
acordadas. Mantenha o resto do arquivo intocado — diff mínimo.

Cole o diff completo do arquivo.

### 4) Validação automática

  pnpm tsc --noEmit client/src/pages/SuperAdminTenants.tsx 2>&1
  pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l

Esperado:
  - Linha 1: zero erros em SuperAdminTenants.tsx.
  - Linha 2: 0 (se A2 já mergeou) ou ~40 (se A2 ainda não mergeou,
    erros remanescentes em iat.ts/validations.ts).

  pnpm test 2>&1 | tail -10

Esperado: verdes.

  pnpm prettier --check .

Esperado: exit 0. Se algum arquivo desformatado, rode
`pnpm prettier --write client/src/pages/SuperAdminTenants.tsx`
isolado e comite junto.

### 5) Smoke manual

Inicie o app:

  pnpm run dev

Em outra aba, abra o navegador e navegue até a tela de tenants
(super admin). Verifique:
  - Página renderiza sem crash.
  - Listagem de tenants aparece (ou estado de loading correto).
  - Cores e badges aparecem normalmente (não-null fallback funcionou).
  - Console do navegador sem novos warnings/errors comparado ao
    antes do fix.

Tire um print mental e confirme em chat: "smoke manual OK".

Pare o `pnpm run dev` (Ctrl+C) antes do commit.

### 6) Commit

  git add client/src/pages/SuperAdminTenants.tsx
  git commit -m "fix(tenants): corrigir tipos em SuperAdminTenants

Aplica narrowing e fallbacks em campos string|null do tipo Tenant,
substitui isLoading deprecated por isPending (TanStack Query v5),
corrige passagem de {} para Date.

Comportamento visual preservado (smoke manual em /super-admin/tenants).

Ref: docs/wp/WP-S0-C.md §2.2

Co-Authored-By: Cascade"

### 7) Push e PR

  git push -u origin agent-a3/WP-S0-C-client-types

  gh pr create \
    --base hml \
    --head agent-a3/WP-S0-C-client-types \
    --title "A3/WP-S0-C — saúde de tipos no client" \
    --body-file <(cat <<'BODY'
WP: WP-S0-C frente A3 — Saúde de tipos (client)
Spec: docs/wp/WP-S0-C.md §2.2
Agente autor: A3
Sprint: 0.5 (fechamento)

## Resumo

- client/src/pages/SuperAdminTenants.tsx: ~8 erros de tsc
  eliminados (narrowing, fallbacks, isPending).
- Frente A2 (iat.ts + validations.ts) está em PR paralelo.

## Integrity Report

- typecheck: erros remanescentes apenas em server/ (escopo A2)
  — ou zero, se A2 já mergeou.
- unit tests: verdes.
- build: verde.
- prettier: verde.

## Smoke

- /super-admin/tenants renderiza igual ao antes.
- Console do navegador limpo.

## Riscos e rollback

Risco: baixo. Apenas narrowing e fallback string-null.
Rollback: git revert simples.
BODY
)

Cole o URL.

### 8) Verificação final

  gh pr view <URL> --json mergeable
  gh pr checks <URL>

## Condição de parada

Pare e me notifique em:
  - Algum erro de tipo exigir refactor de componente
    (ex.: extrair subcomponente, mudar contrato de prop).
  - Smoke manual revelar regressão visual.
  - Aparecer erro de tipo em outro arquivo client/ não-listado.

## Primeira resposta esperada

Cole APENAS:
  1. Output da seção 0 (git log, prettier --check).
  2. Pergunta: "Ambiente pronto. Prossigo para diagnóstico de
     typecheck em SuperAdminTenants.tsx?"

═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Quando pausar manualmente

- **Após seção 2 (mapeamento dos ~8 erros):** A3 vai propor fix para cada um. Olhe cada proposta criticamente:
  - **Fallbacks `?? '#fallback'`:** confira que o fallback faz sentido visualmente. `primaryColor ?? '#000000'` pode ficar estranho — talvez `?? '#3b82f6'` (cor padrão do tema) seja melhor.
  - **`isLoading` → `isPending`:** verifique se a UI condicional muda comportamento. Em TanStack Query v5, `isPending` é true só na primeira fetch; `isLoading` antigo era equivalente. Se houver retry/refetch, comportamento pode diferir sutilmente.
  - **`{}` → `new Date()`:** nunca aceite cast cego para `as Date`. Tem que ter narrowing ou conversão explícita.
- **Após seção 5 (smoke manual):** A3 vai te dizer "smoke OK". Idealmente você abre você mesmo a tela e confirma — A3 não tem olhos.

### Coordenação com frente A2

- PRs paralelos. Não há conflito.
- Quando ambos mergeados, a camada `static` (typecheck) fica verde em `hml`.

### Próximo passo após merge de **ambos** (A2 e A3)

Igual ao prompt de A2:

1. Verificar `pnpm run check && pnpm test && pnpm run build && pnpm prettier --check .` em `hml` — tudo verde.
2. Disparar workflow `.github/workflows/baseline-freeze.yml` (workflow_dispatch).
3. Merge do PR `sprint-0/baseline-freeze` automático.
4. **Marco 2 concluído.**
