# 🚀 Guia de Deploy no Railway

## Alterações Realizadas

- ✅ Templates de email (Exército → Polícia Federal)
- ✅ Campo de assinatura no tenant
- ✅ Rotas de admin atualizadas
- ✅ Arquivo de migração SQL

---

## 📋 Passo a Passo - Deploy no Railway

### 1️⃣ Fazer Commit das Alterações

```bash
# Verificar arquivos alterados
git status

# Adicionar todas as alterações
git add -A

# Fazer commit com mensagem descritiva
git commit -m "feat: adiciona configuração de assinatura em tenants e atualiza referências de órgãos

- Atualiza templates de email: Exército → Polícia Federal
- Adiciona campo signatureResponsibleName ao schema de tenants
- Rotas de admin (create/update) agora aceitam campo de assinatura
- Cria migração para adicionar coluna no banco
- PDF de encaminhamento usa nome de assinatura com fonte cursiva"

# Push para o repositório (git/GitHub/GitLab)
git push origin main
```

### 2️⃣ Deploy Automático no Railway

Se você tem **Auto Deploy** configurado no Railway:

- ✅ Fazer push automaticamente dispara novo deploy
- ✅ Verifique em Railway → Deployments

Se precisa fazer **Deploy Manual**:

1. Acesse [railway.app](https://railway.app)
2. Selecione seu projeto
3. Clique em **Deploy**

### 3️⃣ Executar Migração do Banco

**IMPORTANTE**: A migração do banco precisa ser executada!

#### Opção A: Via Railway Console (Recomendado)

```bash
# No console do Railway (ou via CLI)
npm run migrate
```

#### Opção B: Via CLI do Railway

```bash
# Se tiver railway CLI instalado
railway run npm run migrate
```

#### Opção C: Verificar Logs

```bash
# Ver se a migração foi executada automaticamente
railway logs
```

Procure por mensagens como:

```
✅ Migration successful: 202604141500_add_signature_responsible_name.sql
```

---

## 🔍 Verificar Deploy

### 1. Confirmar Migração

```bash
# Conectar ao banco de dados do Railway
psql <sua-connection-string>

# Verificar se coluna foi adicionada
\d tenants
```

Procure por:

```
 signature_responsible_name | character varying(255)
```

### 2. Testar Funcionamento

**A. Criar Tenant com Assinatura**

```bash
curl -X POST https://seu-dominio.railway.app/api/trpc/tenant.create \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "teste-assinatura",
    "name": "Teste Assinatura",
    "adminName": "Teste Admin",
    "adminEmail": "admin@teste.com",
    "adminPassword": "senha123",
    "signatureResponsibleName": "João Silva",
    "dbHost": "localhost",
    "dbPort": 5432,
    "dbName": "cac360_teste",
    "dbUser": "user",
    "dbPassword": "pass"
  }'
```

**B. Atualizar Assinatura**

```bash
curl -X POST https://seu-dominio.railway.app/api/trpc/tenant.update \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "signatureResponsibleName": "Maria Santos"
  }'
```

**C. Gerar PDF e Verificar**

- Crie um cliente de teste
- Gere encaminhamento para avaliação psicológica
- Verifique se o nome aparece em **letra cursiva** no PDF

---

## 📊 Timeline de Deployment

| Etapa             | Tempo       | Status    |
| ----------------- | ----------- | --------- |
| Commit e Push     | < 1 min     | ✅        |
| Deploy no Railway | 2-5 min     | 🔄        |
| Executar Migração | < 1 min     | ⚠️ Manual |
| Verificação       | 2-3 min     | 🔍        |
| **Total**         | **~10 min** |           |

---

## ⚠️ Rollback (Se Necessário)

Se algo der errado:

```bash
# Reverter commit local
git revert HEAD

# ou reverter push
git push origin +main~1:main

# Fazer rollback da migração (NO RAILWAY)
# Conectar ao banco e executar:
ALTER TABLE tenants DROP COLUMN signature_responsible_name;
```

---

## 🧪 Teste Pós-Deploy

### Checklist:

- [ ] Templates de email atualizados (verificar HTML)
- [ ] Criar novo tenant com `signatureResponsibleName`
- [ ] Atualizar tenant existente com nova assinatura
- [ ] Gerar PDF de encaminhamento
- [ ] Verificar se nome aparece em cursiva no PDF
- [ ] Verificar se Polícia Federal aparece no email (não Exército)
- [ ] Verificar se admin pode atualizar assinatura

---

## 📞 Suporte

**Problema: Migração não executada**

```bash
# Verificar status das migrações
railway logs | grep -i migration

# Ou acessar o banco e verificar
SELECT * FROM drizzle_migrations ORDER BY id DESC LIMIT 1;
```

**Problema: PDF não mostra assinatura em cursiva**

- Verificar se arquivo `server/fonts/DancingScript-Regular.ttf` existe no Railway
- Verificar logs: `railway logs | grep -i font`

**Problema: Campo não aparece no banco**

- Executar migração manualmente:
  ```bash
  railway run npm run migrate
  ```

---

## ✅ Deploy Completo

Quando tudo estiver ok:

1. ✅ Git push realizado
2. ✅ Railway deploying...
3. ✅ Migração executada
4. ✅ Coluna adicionada ao banco
5. ✅ Sistema operacional com novas features

🎉 **Sucesso!**

---

## 📝 Notas

- **Sem downtime**: As alterações são backward-compatible
- **Campo opcional**: `signatureResponsibleName` pode ser NULL
- **Fallback**: Se não configurado, usa nome do admin ou "CAC 360"
- **Seguro**: Sem exposição de dados sensíveis
