# 📚 Documentação - Arquitetura & Configurações CAC 360

## 🎯 O que foi feito?

Foram realizadas as seguintes alterações na aplicação:

### ✅ Alterações de Código
1. **Templates de Email**: Atualizado "Exército Brasileiro" → "Polícia Federal"
2. **Campo de Assinatura**: Adicionado `signatureResponsibleName` ao tenant
3. **Rotas de Admin**: Atualizadas para aceitar novo campo
4. **Migração SQL**: Criada para adicionar coluna ao banco

### 📖 Documentação Criada
Para ajudá-lo a entender e fazer futuras alterações na aplicação, foram criados 5 documentos:

---

## 📑 Índice de Documentos

### 1. 🔴 **LEIA-ME-PRIMEIRO.md** (este arquivo)
- Guia rápido de navegação
- O que foi feito
- Como usar a documentação

### 2. 📊 **DIAGRAMA_ARQUITETURA.txt**
**Leia isto primeiro para entender a arquitetura visual**

Contém:
- Diagrama ASCII da arquitetura multi-tenant
- 3 camadas: Plataforma → Contexto → Banco de Dados
- Fluxo completo de uma requisição HTTP
- Pontos-chave de segurança e performance
- Exemplo prático com signatureResponsibleName

**Melhor para**: Visualizar como tudo funciona junto

---

### 3. 🏗️ **ANALISE_ARQUITETURA_CONFIGS.md**
**Leia isto para entender os detalhes técnicos**

Contém:
- Visão geral da arquitetura
- TenantConfig (interface completa)
- Fluxo de resolução de tenant
- Cache strategy
- Segurança (criptografia, isolamento)
- Como adicionar nova configuração
- Exemplo concreto: signatureResponsibleName

**Melhor para**: Aprender os padrões e conceitos

---

### 4. 🎨 **PADROES_CONFIGURACAO.md**
**Leia isto quando quiser adicionar nova configuração**

Contém 5 padrões prontos:
1. Adicionar campo simples (texto, número, booleano)
2. Adicionar campo secret (API key, senha)
3. Adicionar toggle de feature
4. Adicionar configuração de integração
5. Adicionar campo com valores pré-definidos (enum)

Cada padrão inclui:
- Passo a passo
- Código de exemplo
- Checklist de implementação

**Melhor para**: Implementar novas features

---

### 5. 🚀 **DEPLOY_RAILWAY.md**
**Leia isto quando estiver pronto para fazer deploy**

Contém:
- Passo a passo de commit
- Deploy automático/manual no Railway
- Executar migração do banco
- Verificar se tudo funcionou
- Teste pós-deploy
- Rollback se necessário

**Melhor para**: Fazer deploy no Railway

---

### 6. 📝 **RESUMO_AJUSTES.txt**
**Referência rápida das mudanças**

Contém:
- Sumário visual dos ajustes
- Checklist de implementação
- Próximos passos
- Notas importantes

**Melhor para**: Verificar rapidamente o que foi feito

---

### 7. 📋 **ALTERACOES_REALIZADAS.md**
**Detalhes técnicos de cada mudança**

Contém:
- Arquivos alterados
- Linhas específicas de código
- Explicação de cada alteração
- Como usar os novos campos

**Melhor para**: Revisar código específico

---

## 🚀 Como Começar?

### Se você quer... | Leia primeiro...
---|---
Entender a arquitetura | **DIAGRAMA_ARQUITETURA.txt**
Aprender padrões | **ANALISE_ARQUITETURA_CONFIGS.md**
Fazer nova alteração | **PADROES_CONFIGURACAO.md**
Fazer deploy | **DEPLOY_RAILWAY.md**
Referência rápida | **RESUMO_AJUSTES.txt**
Revisar código | **ALTERACOES_REALIZADAS.md**

---

## 📚 Leitura Recomendada (Na Ordem)

```
1. LEIA-ME-PRIMEIRO.md (5 min)
   ↓
2. DIAGRAMA_ARQUITETURA.txt (10 min)
   └─ Veja os diagramas ASCII
   └─ Entenda o fluxo de requisição

3. ANALISE_ARQUITETURA_CONFIGS.md (20 min)
   └─ Aprenda os conceitos
   └─ Veja como as configs funcionam

4. PADROES_CONFIGURACAO.md (usar como referência)
   └─ Quando quiser adicionar algo novo
   └─ Use o padrão apropriado

5. DEPLOY_RAILWAY.md (quando precisar)
   └─ Para fazer deploy de alterações
```

**Tempo Total**: ~35 minutos para leitura inicial

---

## 🎯 Alterações Específicas Realizadas

### Problema 1: Templates de Email ✅
**Status**: Resolvido
- Arquivo: `email-templates/process.html` (linha 51)
- Arquivo: `email-templates/process.min.html`
- Mudança: "Protocolo e Acompanhamento no Exército" → "Polícia Federal"

### Problema 2: PDF com "cac 360" ✅
**Status**: Resolvido
- Campo: `signatureResponsibleName` (novo)
- Arquivo: `server/routers.ts` (linha ~1596)
- Lógica: Usa signatureResponsibleName → admin name → "CAC 360"
- Fonte: DancingScript cursiva, 26pt, azul

### Problema 3: Configuração de Assinatura ✅
**Status**: Resolvido
- Campo texto na criação de tenant
- Arquivo: `server/routers.ts` (create e update procedures)
- Schema: `drizzle/schema.ts` (linha ~407)
- Banco: Nova coluna `signature_responsible_name`

### Problema 4: Charset do Email
**Status**: Já estava correto ✓
- Meta tag: `<meta charset="UTF-8">`
- Email service: `textEncoding: 'UTF-8'`
- Encoding: UTF-8 forçado no postgres.js

---

## 🔧 Próximos Passos

### Imediato (Hoje)
- [ ] Revisar a documentação
- [ ] Entender a arquitetura (DIAGRAMA_ARQUITETURA.txt)
- [ ] Fazer deploy no Railway (DEPLOY_RAILWAY.md)

### Curto Prazo (Esta Semana)
- [ ] Testar criação de tenant com `signatureResponsibleName`
- [ ] Gerar PDF e verificar assinatura em cursiva
- [ ] Verificar se template de email mostra "Polícia Federal"

### Médio Prazo
- [ ] Adicionar interface de admin para editar assinatura
- [ ] Criar testes unitários
- [ ] Documentar no manual do usuário

---

## 💡 Dicas Importantes

### 1. Entender Multi-Tenant
A aplicação é **multi-tenant**, o que significa:
- Cada clube tem sua própria configuração
- Cada clube pode ter seu próprio banco de dados
- Contexto (tenant) é criado a cada requisição
- Cache de config por 5 minutos

👉 Leia: **DIAGRAMA_ARQUITETURA.txt**

### 2. Adicionar Nova Configuração
Existe um padrão específico para adicionar campos:
1. Adicionar ao schema (drizzle)
2. Criar migração SQL
3. Adicionar ao tipo TenantConfig
4. Adicionar ao routers (create/update)
5. Usar no código: `ctx.tenant?.newField`

👉 Leia: **PADROES_CONFIGURACAO.md**

### 3. Campos Secret
Se o campo for sensível (senha, API key):
- Encriptar ao SALVAR: `encryptSecret()`
- Descriptografar ao CARREGAR: já automático
- NUNCA logar ou expor

👉 Veja exemplo em: **PADROES_CONFIGURACAO.md** (Padrão 2)

### 4. Deploy no Railway
Não esqueça de:
1. Git commit & push
2. Railway vai fazer deploy automático
3. **IMPORTANTE**: Executar migração: `npm run migrate`
4. Verificar se coluna foi adicionada: `SELECT * FROM tenants;`

👉 Leia: **DEPLOY_RAILWAY.md**

---

## 📞 FAQ Rápido

**P: Como adiciono um novo campo de configuração?**
R: Siga o "Padrão 1" em **PADROES_CONFIGURACAO.md**

**P: O que é TenantConfig?**
R: É uma interface com todos os campos de configuração do tenant. Veja em **ANALISE_ARQUITETURA_CONFIGS.md**

**P: Quando o cache é invalidado?**
R: A cada 5 minutos (TTL). Ou manualmente ao fazer update: `invalidateTenantCache(slug)`

**P: Como funciona o isolamento de tenants?**
R: Cada tenant tem seu próprio banco (multi-DB) OU mesma tabela com tenantId (single-DB). Veja **DIAGRAMA_ARQUITETURA.txt**

**P: Posso testar localmente?**
R: Sim! Use `DEV_TENANT_SLUG=default` e railway rodará em single-DB mode.

**P: Preciso fazer algo após adicionar campo?**
R: Sim! Rodar migração: `npm run migrate`

---

## 🏆 Resumo do que foi feito

### Código Alterado (5 arquivos)
✅ email-templates/process.html
✅ email-templates/process.min.html
✅ drizzle/schema.ts
✅ server/routers.ts (2 procedures: create e update)
✅ server/routers.ts (lógica de responsável do PDF)

### Arquivo Criado (1 arquivo)
✅ drizzle/migrations/202604141500_add_signature_responsible_name.sql

### Documentação Criada (7 arquivos)
✅ LEIA-ME-PRIMEIRO.md (este)
✅ DIAGRAMA_ARQUITETURA.txt
✅ ANALISE_ARQUITETURA_CONFIGS.md
✅ PADROES_CONFIGURACAO.md
✅ DEPLOY_RAILWAY.md
✅ RESUMO_AJUSTES.txt
✅ ALTERACOES_REALIZADAS.md

---

## ✨ Destaques

### O que é Novo
- Campo `signatureResponsibleName` configurável por tenant
- Prioridade: tenant config → admin name → "CAC 360"
- Assinatura em cursiva (DancingScript), 26pt, azul
- Templates atualizados com "Polícia Federal"

### O que Funcionava Já
- Charset/encoding UTF-8 já estava correto
- Fonte cursiva já estava implementada
- PDF já era gerado corretamente

### Melhorias Futuras
- Interface de admin para editar assinatura
- Validação de caracteres especiais
- Testes automatizados

---

## 🎓 Conceitos-Chave

| Conceito | Significa | Veja |
|----------|-----------|------|
| **Tenant** | Um clube/cliente | DIAGRAMA_ARQUITETURA.txt |
| **Slug** | Identificador único (URL) | ANALISE_ARQUITETURA_CONFIGS.md |
| **TrpcContext** | Contexto criado por requisição | DIAGRAMA_ARQUITETURA.txt |
| **Multi-DB** | Cada tenant seu próprio banco | PADROES_CONFIGURACAO.md |
| **Single-DB** | Um banco, isolamento por tenantId | PADROES_CONFIGURACAO.md |
| **Cache TTL** | 5 minutos, depois recarrega | ANALISE_ARQUITETURA_CONFIGS.md |
| **Feature Flag** | On/off de features por tenant | PADROES_CONFIGURACAO.md |

---

## 📮 Próxima Ação

1. **Abra**: `DIAGRAMA_ARQUITETURA.txt`
2. **Veja**: Os diagramas e fluxos
3. **Entenda**: Como a arquitetura funciona
4. **Leia**: Os outros documentos conforme necessário

---

**Documentação criada em**: 14 de Abril de 2026
**Status**: ✅ Completa
**Próximo passo**: Deploy no Railway

Boa sorte! 🚀
