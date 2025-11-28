# 🚂 Guia de Implantação no Railway

**Sistema de Workflow CR - Firing Range**  
**Versão:** 1.0  
**Data:** Novembro/2025

---

## 📋 Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criando o Projeto no Railway](#2-criando-o-projeto-no-railway)
3. [Configurando o Banco de Dados PostgreSQL](#3-configurando-o-banco-de-dados-postgresql)
4. [Configurando Variáveis de Ambiente](#4-configurando-variáveis-de-ambiente)
5. [Deploy da Aplicação](#5-deploy-da-aplicação)
6. [Configurando Domínio Personalizado](#6-configurando-domínio-personalizado)
7. [Configurando Armazenamento S3](#7-configurando-armazenamento-s3)
8. [Configurando SMTP para Emails](#8-configurando-smtp-para-emails)
9. [Monitoramento e Logs](#9-monitoramento-e-logs)
10. [Troubleshooting](#10-troubleshooting)
11. [Custos Estimados](#11-custos-estimados)

---

## 1. Pré-requisitos

### 1.1 Contas Necessárias

| Serviço | Finalidade | Link |
|---------|------------|------|
| **Railway** | Hospedagem da aplicação e banco de dados | [railway.app](https://railway.app) |
| **GitHub** | Repositório do código (para deploy automático) | [github.com](https://github.com) |
| **AWS S3** ou **Cloudflare R2** | Armazenamento de arquivos (documentos) | Opcional |
| **Provedor SMTP** | Envio de emails | Gmail, SendGrid, etc. |

### 1.2 Requisitos do Projeto

✅ Código fonte no GitHub  
✅ Dockerfile configurado (já existe no projeto)  
✅ Porta da aplicação: **3000**  
✅ Banco de dados: **PostgreSQL**

---

## 2. Criando o Projeto no Railway

### Passo 1: Acessar o Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em **"Start a New Project"**
3. Faça login com sua conta GitHub

### Passo 2: Conectar Repositório GitHub

1. Selecione **"Deploy from GitHub repo"**
2. Autorize o Railway a acessar seus repositórios
3. Selecione o repositório `CR-workflow`
4. O Railway detectará automaticamente o `Dockerfile`

### Passo 3: Configuração Inicial

O Railway irá:
- Detectar o Dockerfile automaticamente
- Criar um ambiente de deploy
- Aguardar configuração das variáveis de ambiente

> ⚠️ **IMPORTANTE**: Não inicie o deploy ainda! Primeiro configure o banco de dados.

---

## 3. Configurando o Banco de Dados PostgreSQL

### Passo 1: Adicionar PostgreSQL

1. No painel do projeto Railway, clique em **"+ New"**
2. Selecione **"Database"** → **"Add PostgreSQL"**
3. O Railway criará uma instância PostgreSQL automaticamente

### Passo 2: Obter URL de Conexão

1. Clique no serviço PostgreSQL criado
2. Vá na aba **"Variables"**
3. Copie o valor de `DATABASE_URL`

Formato da URL:
```
postgresql://postgres:SENHA@containers-us-west-XXX.railway.app:PORTA/railway
```

### Passo 3: Conectar ao Serviço da Aplicação

1. Volte ao serviço da aplicação (não o PostgreSQL)
2. Vá em **"Variables"**
3. Clique em **"Add Variable Reference"**
4. Selecione `DATABASE_URL` do PostgreSQL

> ✅ Isso conecta automaticamente a aplicação ao banco de dados.

---

## 4. Configurando Variáveis de Ambiente

### Variáveis Obrigatórias

No serviço da aplicação, vá em **Settings** → **Variables** e adicione:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `DATABASE_URL` | *(referência do PostgreSQL)* | URL de conexão com o banco |
| `JWT_SECRET` | `sua_chave_secreta_muito_longa_aqui_123!` | Chave para tokens JWT (mín. 32 caracteres) |
| `ADMIN_EMAIL` | `admin@seudominio.com` | Email do administrador inicial |
| `ADMIN_PASSWORD` | `senha_forte_admin` | Senha do administrador inicial |
| `NODE_ENV` | `production` | Ambiente de execução |
| `PORT` | `3000` | Porta da aplicação (Railway usa $PORT) |

### Variáveis Opcionais (Frontend)

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `VITE_APP_TITLE` | `CAC 360 – Gestão de Ciclo Completo` | Título da aplicação |
| `VITE_APP_LOGO` | `/logo.png` | Caminho do logo |

### Variáveis para Envio de Email (SMTP)

| Variável | Valor Exemplo | Descrição |
|----------|---------------|-----------|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor SMTP |
| `SMTP_PORT` | `587` | Porta SMTP (587 para TLS, 465 para SSL) |
| `SMTP_USER` | `seu-email@gmail.com` | Usuário SMTP |
| `SMTP_PASS` | `sua-senha-app` | Senha ou App Password |
| `SMTP_FROM` | `Firing Range <noreply@firingrange.com>` | Remetente dos emails |
| `SMTP_SECURE` | `false` | `true` para SSL, `false` para TLS |

### Variáveis para S3 (Armazenamento de Arquivos)

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `AWS_ACCESS_KEY_ID` | `AKIAXXXXXXXX` | Chave de acesso AWS |
| `AWS_SECRET_ACCESS_KEY` | `xxxxx` | Chave secreta AWS |
| `AWS_REGION` | `us-east-1` | Região do bucket |
| `AWS_BUCKET_NAME` | `firing-range-docs` | Nome do bucket S3 |

### Exemplo de Configuração Completa

```bash
# Banco de Dados (referência automática)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Autenticação
JWT_SECRET=Xk9#mP2$vL5@nQ8wR1tY4uZ7aB0cD3eF6gH
ADMIN_EMAIL=admin@firingrange.com.br
ADMIN_PASSWORD=SenhaForte@2025!

# Aplicação
NODE_ENV=production
PORT=3000

# Frontend
VITE_APP_TITLE=CAC 360 – Gestão de Ciclo Completo
VITE_APP_LOGO=/logo.png

# SMTP (Gmail como exemplo)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=firingrange.sistema@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=Firing Range <firingrange.sistema@gmail.com>
SMTP_SECURE=false

# S3 (se usar armazenamento externo)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=sa-east-1
AWS_BUCKET_NAME=firing-range-documentos
```

---

## 5. Deploy da Aplicação

### Passo 1: Iniciar Deploy

1. Após configurar todas as variáveis, vá em **"Deployments"**
2. Clique em **"Deploy"** ou **"Redeploy"**
3. Aguarde o build do Docker (pode levar 3-5 minutos)

### Passo 2: Verificar Build

O Railway executará:
```
1. Build do frontend (Vite)
2. Build do backend (esbuild)
3. Criação da imagem Docker
4. Execução: pnpm db:push && pnpm db:seed && pnpm start
```

### Passo 3: Verificar Logs

1. Vá na aba **"Deployments"**
2. Clique no deploy ativo
3. Verifique os logs de inicialização

Logs esperados:
```
[drizzle-kit] Push complete
[seed] Admin user created
[server] Server running on port 3000
```

### Passo 4: Acessar a Aplicação

1. Vá na aba **"Settings"**
2. Na seção **"Domains"**, clique em **"Generate Domain"**
3. O Railway criará uma URL como: `cr-workflow-production.up.railway.app`

---

## 6. Configurando Domínio Personalizado

### Passo 1: Adicionar Domínio

1. No Railway, vá em **Settings** → **Domains**
2. Clique em **"Custom Domain"**
3. Digite seu domínio: `workflow.firingrange.com.br`

### Passo 2: Configurar DNS

No seu provedor de DNS, adicione:

| Tipo | Nome | Valor |
|------|------|-------|
| CNAME | `workflow` | `cr-workflow-production.up.railway.app` |

Ou para domínio raiz:
| Tipo | Nome | Valor |
|------|------|-------|
| A | `@` | IP fornecido pelo Railway |

### Passo 3: Aguardar Propagação

- O SSL é gerado automaticamente (Let's Encrypt)
- Propagação DNS pode levar até 48h (geralmente minutos)

---

## 7. Configurando Armazenamento S3

### Opção A: AWS S3

1. Acesse o console AWS → S3
2. Crie um bucket: `firing-range-documentos`
3. Configure CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://workflow.firingrange.com.br"],
    "ExposeHeaders": ["ETag"]
  }
]
```

4. Crie um usuário IAM com política:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::firing-range-documentos",
        "arn:aws:s3:::firing-range-documentos/*"
      ]
    }
  ]
}
```

### Opção B: Cloudflare R2 (Mais Barato)

1. Acesse Cloudflare Dashboard → R2
2. Crie um bucket
3. Gere API tokens com permissão de leitura/escrita
4. Use as mesmas variáveis de ambiente (compatível com S3)

---

## 8. Configurando SMTP para Emails

### Opção A: Gmail (Desenvolvimento/Baixo Volume)

1. Ative "Verificação em 2 etapas" na conta Google
2. Gere uma "Senha de App" em: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Use a senha de app como `SMTP_PASS`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # Senha de App (16 caracteres)
SMTP_SECURE=false
```

### Opção B: SendGrid (Produção)

1. Crie conta em [sendgrid.com](https://sendgrid.com)
2. Gere uma API Key
3. Configure:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxx  # Sua API Key
```

### Opção C: Amazon SES (Produção AWS)

1. Configure SES no console AWS
2. Verifique domínio de envio
3. Gere credenciais SMTP

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIAXXXXXXXX
SMTP_PASS=xxxxxx
```

---

## 9. Monitoramento e Logs

### Logs em Tempo Real

1. No Railway, vá em **"Deployments"**
2. Clique em **"View Logs"**
3. Use filtros: `error`, `warn`, `info`

### Métricas

O Railway fornece métricas de:
- **CPU Usage**
- **Memory Usage**
- **Network I/O**

### Alertas (Opcional)

Configure webhooks para Discord/Slack:
1. Vá em **Project Settings** → **Integrations**
2. Adicione webhook de notificação

---

## 10. Troubleshooting

### Erro: "Database connection failed"

**Causa**: `DATABASE_URL` não configurada corretamente.

**Solução**:
1. Verifique se PostgreSQL está rodando
2. Use referência de variável: `${{Postgres.DATABASE_URL}}`
3. Redeploy a aplicação

### Erro: "Port already in use"

**Causa**: Conflito de porta.

**Solução**:
1. Certifique-se que `PORT=3000` está configurado
2. O Railway injeta `$PORT` automaticamente

### Erro: "pnpm: command not found"

**Causa**: Dockerfile não instalou pnpm.

**Solução**: O Dockerfile atual já instala pnpm. Se persistir, rebuilde sem cache:
1. Vá em **Deployments** → **Settings**
2. Clique em **"Clear Build Cache"**
3. Redeploy

### Erro: "JWT_SECRET is required"

**Causa**: Variável de ambiente não definida.

**Solução**:
1. Adicione `JWT_SECRET` nas variáveis
2. Use uma string longa e aleatória (32+ caracteres)

### Erro: "Email sending failed"

**Causa**: Credenciais SMTP incorretas.

**Solução**:
1. Verifique todas as variáveis SMTP
2. Para Gmail, use "Senha de App", não senha normal
3. Verifique se a porta está correta (587 para TLS)

### Deploy Travado

**Causa**: Build demorando muito ou falhou.

**Solução**:
1. Cancele o deploy atual
2. Limpe cache: **Settings** → **Clear Build Cache**
3. Redeploy

---

## 11. Custos Estimados

### Railway Pricing (Nov/2025)

| Plano | Custo | Recursos |
|-------|-------|----------|
| **Trial** | $5 crédito grátis | Teste inicial |
| **Hobby** | $5/mês | 512MB RAM, 1 vCPU |
| **Pro** | $20/mês base + uso | Recursos escaláveis |

### Estimativa Mensal (Produção Pequena)

| Serviço | Custo Estimado |
|---------|----------------|
| Railway App | $5-10/mês |
| Railway PostgreSQL | $5-10/mês |
| Cloudflare R2 (1GB) | ~$0.15/mês |
| SendGrid (100 emails/dia) | Grátis |
| **Total** | **~$10-25/mês** |

---

## 12. Checklist de Deploy

```
□ Conta Railway criada
□ Repositório GitHub conectado
□ PostgreSQL adicionado ao projeto
□ DATABASE_URL configurada (referência)
□ JWT_SECRET definida
□ ADMIN_EMAIL e ADMIN_PASSWORD definidos
□ NODE_ENV=production
□ Deploy executado com sucesso
□ Domínio gerado/personalizado
□ SSL ativo (automático)
□ SMTP configurado e testado
□ S3/R2 configurado (se necessário)
□ Primeiro login como admin testado
□ Criação de cliente testada
□ Envio de email testado
```

---

## 13. Comandos Úteis

### Forçar Redeploy
```bash
# Via Railway CLI
railway up --detach
```

### Acessar Logs
```bash
railway logs
```

### Conectar ao Banco (Debug)
```bash
railway connect postgres
```

### Variáveis de Ambiente
```bash
railway variables
```

---

## 14. Suporte

- **Documentação Railway**: [docs.railway.app](https://docs.railway.app)
- **Discord Railway**: [discord.gg/railway](https://discord.gg/railway)
- **Status Railway**: [status.railway.app](https://status.railway.app)

---

**Desenvolvido por ACR Digital para Firing Range**  
**© 2025 Todos os direitos reservados**
