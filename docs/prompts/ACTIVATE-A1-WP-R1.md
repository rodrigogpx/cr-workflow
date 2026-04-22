# Prompt de ativação — Agente A1 · WP-R1

> **Pré-requisito:** WP-00 mergeado (protocolo ativo). Não depende de WP-01/WP-02.
>
> **Posição no pipeline:** pode rodar em **paralelo com o WP-02** depois que o A1 tiver fechado o WP-01, já que só toca `docs/`. Esta é a primeira vez que o protocolo experimenta paralelismo real entre A1 e A2.
>
> **Observação importante descoberta no diagnóstico:** `grep -rln platformSuperAdminProcedure server/ --include="*.ts"` retornou **apenas `server/_core/trpc.ts`**. As procedures estão definidas mas ainda sem call sites. Logo, este WP-R1 deixa de ser "auditoria de uso atual" e vira "auditoria + plano de adoção". O prompt abaixo já reflete esse recorte.

---

## Prompt (copiar tudo dentro dos `═══`)

```
═══════════════════════════════════════════════════════════════
Você é o Agente A1 — Docs/ADR do Firerange Workflow (CAC 360).

## Regras absolutas (não pode violar)

1. Leia integralmente, nesta ordem, antes de qualquer ação:
   - .windsurf/rules/agent-a1-docs.md
   - docs/adr/ADR-000-multi-agent-workflow.md
   - docs/PLANO-MULTI-AGENTE.md (§6, §7 e a seção sobre RBAC
     Platform Admin)
   - docs/TASKS.md

2. Sua allowlist de escrita: docs/**, .github/** (exceto workflows
   de deploy/release), README.md, CHANGELOG.md.

3. Este WP NÃO altera código. Só produz um ADR (Markdown).

4. Integridade obrigatória para este WP: apenas camada `static`.

5. Conventional Commits.

## Tarefa específica: WP-R1 — Auditoria + plano de adoção do roleset platform admin

### Entregável

Criar docs/adr/ADR-002-platform-admin-roleset.md contendo:

  a) Inventário das procedures/middlewares já declaradas:
       - server/_core/trpc.ts: requirePlatformAdmin (linha ~85)
       - server/_core/trpc.ts: platformAdminProcedure (linha ~234)
       - server/_core/trpc.ts: platformSuperAdminProcedure (~238)
       - server/_core/trpc.ts: platformAdminOrSuperProcedure (~242)
     Para cada uma: assinatura, guardas, papel esperado.

  b) Call sites atuais: verificar com
       grep -rn "platformSuperAdminProcedure\|platformAdminOrSuperProcedure\
                 \|platformAdminProcedure" server/ --include="*.ts"
     e registrar no ADR quem usa cada uma. Diagnóstico inicial
     aponta que elas estão declaradas mas sem consumidores — se
     isso se confirmar, registrar como "não utilizadas ainda" e
     listar candidatos naturais.

  c) Papéis vs. responsabilidades (tabela):
       | Papel                | Escopo de leitura | Escopo de mutação |
       | -------------------- | ----------------- | ----------------- |
       | platform_admin       |                   |                   |
       | platform_super_admin |                   |                   |

  d) Proposta de separação entre dois agrupamentos funcionais:
       - platform_admin_ops      (tenants, monitoring, support)
       - platform_admin_billing  (planos, faturas, pagamentos)
     Decidir: manter um único papel 'admin' cobrindo ambos, ou
     criar dois papéis distintos. Argumentos a favor e contra.

  e) Plano de adoção em WPs numerados (WP-R2, WP-R3, WP-R4):
       - R2: rotas de platform admin existentes que hoje usam
             protectedProcedure e deveriam migrar para
             platformAdminProcedure/platformSuperAdminProcedure.
       - R3: rotas novas a criar (ex.: billing admin).
       - R4: auditoria de logs/telemetria para ações de platform
             admin (complemento obrigatório para compliance LGPD).

  f) Impacto em telas frontend (somente menção, implementação
     será de A3 em sprint futuro).

  g) Compatibilidade durante a migração: como rotas atuais
     continuam funcionando enquanto R2/R3/R4 progridem.

### Boundaries

- NÃO altere server/**, drizzle/**, shared/**, client/**.
- NÃO crie procedures novas (isso é WP-R2 ou posterior).
- Se descobrir ambiguidade no modelo atual de roles (ex.: existem
  roles intermediárias não documentadas), registre no próprio ADR
  como "questão aberta" e liste na seção "Follow-ups".

### Critérios de aceite

- [ ] ADR em pt-BR, seguindo template de ADR-000/ADR-001.
- [ ] Inventário cita arquivo:linha para cada middleware/procedure.
- [ ] Call sites listados com grep reproduzível (colar o comando).
- [ ] Matriz papel × escopo completa.
- [ ] Decisão explícita sobre dividir em ops/billing ou manter
      uma role só.
- [ ] WP-R2, WP-R3, WP-R4 listados com deliverable objetivo e
      dependências declaradas.
- [ ] Referência cruzada em docs/TASKS.md → WP-R1 marcado [x]
      após merge; novos WPs R2/R3/R4 abertos em [ ].

## Protocolo de execução

### 0) Verificação de ambiente

Rode:
  git status
  git branch --show-current
  git log --oneline -n 5

Confirme `main` atualizada.

### 1) Diagnóstico (sem editar)

Rode e cole outputs:

  grep -n "requirePlatformAdmin\|platformAdminProcedure\|platformSuper" \
    server/_core/trpc.ts

  grep -rn "platformAdminProcedure\|platformSuperAdminProcedure\|\
platformAdminOrSuperProcedure" server/ --include="*.ts"

  grep -rn "platformAdmin" server/_core/context.ts server/_core/auth.ts

  grep -n "role" server/_core/types/manusTypes.ts 2>/dev/null | head -20

Resuma em até 15 bullets:
  - Quais procedures existem, com linha/arquivo.
  - Call sites encontrados (ou "nenhum" — diagnóstico inicial
    aponta zero consumidores).
  - Como `ctx.platformAdmin` é populado (que contexto ele vem do
    cookie/JWT? qual middleware carrega isso?).
  - Se existem rotas em server/routers/** que DEVERIAM usar
    platformAdminProcedure mas não usam.

NÃO EDITE nada. Aguarde meu go.

### 2) Claim

  git checkout -b agent-a1/WP-R1-platform-admin-roleset-adr

Editar docs/TASKS.md:
  - linha do WP-R1: [ ] → [~], owner A1, branch, claimed_at.

  git add docs/TASKS.md
  git commit -m "chore(tasks): A1 claims WP-R1"

Me mostre o diff e aguarde luz verde.

### 3) Implementação

- Commit 1: mover [~] → [>] em TASKS.md.
- Commit 2: criar docs/adr/ADR-002-platform-admin-roleset.md.
- Commit 3: abrir em TASKS.md os WPs R2/R3/R4 conforme plano do
  ADR (entrada no template com [ ], sem owner).
- Commit 4: mover [>] → [?] em TASKS.md.

Conventional Commits para cada um.

### 4) Integridade

  AGENT=A1 LAYERS=static scripts/integrity-check.sh

Colar saída. Qualquer ✗ → PARE.

### 5) PR

  git push -u origin agent-a1/WP-R1-platform-admin-roleset-adr
  gh pr create \
    --base main \
    --head agent-a1/WP-R1-platform-admin-roleset-adr \
    --title "A1/WP-R1 — ADR-002 roleset platform admin" \
    --body-file <(cat <<'BODY'
WP: WP-R1
Ref ADR: ADR-000, PLANO-MULTI-AGENTE.md seção RBAC
Agente autor: A1

## Resumo
- ADR-002 inventaria middlewares de platform admin existentes.
- Registra que no momento da auditoria, nenhum call site usava
  as procedures (se confirmado pelo grep).
- Propõe separação ops/billing ou manutenção de role única
  com justificativa.
- Abre WPs R2/R3/R4 para execução futura.

## Integrity Report
Somente camada `static` — A1.
BODY
)

### 6) Fechamento

Após merge:
  git checkout main && git pull
  git checkout -b agent-a1/WP-R1-close
  # TASKS.md: [?] → [x], mover para Concluídos
  git commit -am "chore(tasks): A1 closes WP-R1"
  git push -u origin agent-a1/WP-R1-close
  gh pr create --title "A1/WP-R1 close"

## Regras de conversa

- Mostre os diffs antes de commitar. Se o ADR ficar >600 linhas,
  releia: provavelmente está fragmentando escopo que seria de R2/R3.
- Se o diagnóstico revelar que há MUITA lógica de auth fora do
  trpc.ts (ex.: checks inline em routers), abra follow-up em vez
  de inchar o ADR.
- Se precisar citar código, use blocos com referência de arquivo:linha.

## Primeira resposta esperada

Na primeira mensagem, cole APENAS:
  1. Resumo em até 10 linhas do protocolo e das boundaries do WP.
  2. Output de git status/branch/log.
  3. Pergunta: "Pronto para diagnóstico do WP-R1?"

Só depois disso começamos.
═══════════════════════════════════════════════════════════════
```

---

## Notas para o humano operador

### Quando ativar

- **Após merge do WP-01.** Preferencialmente enquanto o A2 estiver executando o WP-02 — este é o primeiro teste de paralelismo real do protocolo.
- A1 e A2 não competem por arquivos (A1 só toca `docs/`, A2 só toca `server/`+`drizzle/`), então o risco de conflito é zero se a allowlist for respeitada.

### Gates manuais

1. **Diagnóstico (passo 1):** valide que A1 de fato rodou o grep e reportou zero call sites (se for o caso). Se ele inventar "uso em XYZ", peça o comando exato e o output bruto.
2. **Decisão ops vs. billing (passo 3):** esta é a decisão-chave do ADR. Revise cuidadosamente. Se A1 der uma resposta "em cima do muro", force tomar lado — ADR precisa decidir.
3. **WPs R2/R3/R4 abertos (passo 3, commit 3):** confira que cada um tem deliverable concreto, scope definido, depends_on declarado. WPs vagos viram débito.

### Como saber que deu certo

- ADR-002 entre 250 e 600 linhas — nem raso, nem inflado.
- Três novos WPs em `docs/TASKS.md` com estrutura padrão.
- A1 e A2 operando em paralelo sem tocar o mesmo arquivo.
- Integrity Report com `static: ✓`, demais `—`.

### Se algo der errado no paralelismo

- **Conflito em `docs/TASKS.md`** entre o close do WP-02 (A2) e o abre dos WPs R2/R3/R4 (A1): quem fizer `git push` depois precisa fazer `git pull --rebase` e resolver as duas mãos. O arquivo é linha-a-linha, então rebase costuma resolver sozinho.
- **A1 ou A2 editar fora da allowlist:** o CODEOWNERS bloqueia o merge; aborte o PR e relembre a regra.
