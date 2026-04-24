---
name: Work Package (WP)
about: Criar um novo work package para os agentes multi-agente
title: "WP-XX — <título>"
labels: ["work-package"]
assignees: []
---

## Identidade

- **WP:** WP-XX
- **Agente alvo:** <!-- A1 / A2 / A3 -->
- **Sprint:** <!-- Sprint 1, 2, ... -->
- **Dependências:** <!-- WP-YY, WP-ZZ, ou "nenhuma" -->

## Entregável

<!--
  Descrição objetiva e verificável do que este WP produz.
  Exemplo: "Migration idempotente que adiciona o valor grace_period ao enum subscription_status,
  mais coluna grace_period_until TIMESTAMPTZ. Rollback documentado."
-->

## Escopo de arquivos

<!--
  Listar caminhos específicos que este WP vai tocar.
  Tem que estar integralmente dentro da allowlist do agente alvo.
-->

- `<path 1>`
- `<path 2>`

## Integrity layers obrigatórias

- [ ] static
- [ ] unit
- [ ] integration
- [ ] build
- [ ] smoke
- [ ] regression
- [ ] migrations (se `drizzle/` alterado)
- [ ] impact(auth) (se middleware/trpc alterado)

## Critérios de aceite

- [ ]
- [ ]
- [ ]

## Estimativa

<!-- em dias de agente: 0.5, 1, 1.5, 2 -->

## Checklist de abertura

- [ ] WP adicionado a `docs/TASKS.md` na seção do sprint correto
- [ ] Estado inicial `[ ]`
- [ ] `depends_on` preenchido
- [ ] Referência cruzada: esta issue ↔ WP em `docs/TASKS.md`
