# 🐳 CAC 360 - Docker Puro (Sem Docker Swarm)

**Versão:** 1.0  
**Data:** 13 de Janeiro de 2026  
**Status:** ✅ Pronto para Produção

Este repositório contém a migração completa do **CAC 360** de Docker Swarm para **Docker Puro** com Nginx e PostgreSQL em container.

---

## 📋 Conteúdo

### Arquivos Principais
- **`Dockerfile`** - Multi-stage build otimizado (frontend + backend)
- **`docker-compose.yml`** - Orquestração com 4 serviços
- **`nginx/nginx.conf`** - Reverse proxy + SSL + Security headers
- **`.env.gcp.example`** - Template de variáveis de ambiente

### Scripts
- **`scripts/deploy-gcp.sh`** - Deploy automatizado no GCP
- **`scripts/backup-db.sh`** - Backup automático do PostgreSQL
- **`scripts/setup-gcp-instance.sh`** - Setup inicial da instância GCP

### Documentação
- **`GCP-DOCKER-DEPLOY.md`** - Guia completo de deployment
- **`DOCKER-PURE-README.md`** - Este arquivo

### GitHub Actions
- **`.github/workflows/deploy-docker-pure.yml`** - CI/CD automático

---

## 🚀 Quick Start

### 1. Desenvolvimento Local

```bash
# Clonar repositório
git clone https://github.com/rodrigogpx/cr-workflow.git
cd cr-workflow

# Copiar .env
cp .env.gcp.example .env.local

# Preencher variáveis
nano .env.local

# Build e start
docker-compose up --build

# Acessar
# http://localhost:3000
```

### 2. Deploy no GCP (Produção)

```bash
# SSH na instância
gcloud compute ssh rodrigogpx@dockerserver01 \
  --zone=us-west1-a \
  --project=YOUR_PROJECT_ID

# Executar deploy
cd /opt/cac360/app
./scripts/deploy-gcp.sh prod

# Validar
curl https://cac360.com.br/api/health
```

---

## 📦 Serviços Docker

### 1. PostgreSQL 16
- **Container:** `cac360-postgres`
- **Port:** 5432 (interno)
- **Volume:** `postgres_data:/var/lib/postgresql/data`
- **Health Check:** `pg_isready`

### 2. Node.js App
- **Container:** `cac360-app`
- **Port:** 3000 (interno)
- **Build:** Multi-stage (frontend + backend)
- **Health Check:** `GET /api/health`

### 3. Nginx
- **Container:** `cac360-nginx`
- **Ports:** 80 (HTTP), 443 (HTTPS)
- **Features:** Reverse proxy, SSL/TLS, Rate limiting, Security headers
- **Health Check:** `wget /health`

### 4. Certbot
- **Container:** `cac360-certbot`
- **Feature:** Let's Encrypt automático
- **Renovação:** A cada 12 horas

---

## 🔧 Configuração

### Variáveis de Ambiente

Copie `.env.gcp.example` para `.env.prod` ou `.env.hml` e preencha:

```bash
# Banco de Dados
DB_NAME=cac360_platform
DB_USER=cac360
DB_PASSWORD=ALTERAR_SENHA_FORTE

# Autenticação
JWT_SECRET=GERE_CHAVE_ALEATORIA_32_CHARS
SECRET_KEY=GERE_OUTRA_CHAVE_ALEATORIA_32_CHARS

# SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.YOUR_SENDGRID_KEY

# Storage (S3)
AWS_ACCESS_KEY_ID=YOUR_AWS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET
AWS_BUCKET_NAME=firing-range-documentos

# Domínio
DOMAIN=cac360.com.br
ACME_EMAIL=admin@cac360.com.br
```

---

## 📊 Arquitetura

```
┌─────────────────────────────────────────┐
│         Cliente (Browser)               │
└────────────────┬────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────┐
│         Nginx (Reverse Proxy)           │
│  ├─ SSL/TLS (Let's Encrypt)            │
│  ├─ Rate Limiting                       │
│  └─ Security Headers                    │
└────────────────┬────────────────────────┘
                 │ HTTP
                 ▼
┌─────────────────────────────────────────┐
│    Node.js App (tRPC + Express)        │
│  ├─ Frontend (React 19)                │
│  ├─ Backend (tRPC 11)                  │
│  └─ Health Check (/api/health)         │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│   PostgreSQL 16 (Multi-Tenant)         │
│  ├─ Platform Database                  │
│  └─ Tenant Databases (isolados)        │
└─────────────────────────────────────────┘
```

---

## 🔄 Deployment Flow

### Desenvolvimento Local

```
git push → docker-compose up → http://localhost:3000
```

### Homolog (HML)

```
git push hml → GitHub Actions → Build image → SSH deploy → https://hml.cac360.com.br
```

### Produção (PROD)

```
git push main → GitHub Actions → Build image → SSH deploy → Backup → https://cac360.com.br
```

---

## 📋 Operações Comuns

### Verificar Status

```bash
docker-compose ps
docker-compose logs app
docker-compose logs nginx
docker-compose logs postgres
```

### Fazer Backup

```bash
./scripts/backup-db.sh
```

### Restaurar Backup

```bash
docker-compose exec postgres psql -U cac360 < /opt/cac360/backups/backup-YYYYMMDD-HHMMSS.sql
```

### Atualizar Aplicação

```bash
git pull origin main
docker-compose up -d --build
```

### Parar Serviços

```bash
docker-compose down
```

### Limpar Tudo

```bash
docker-compose down -v  # Remove volumes também
```

---

## 🔐 Segurança

### SSL/TLS
- ✅ Let's Encrypt automático
- ✅ Renovação automática a cada 12 horas
- ✅ HTTP → HTTPS redirect

### Headers de Segurança
- ✅ HSTS (Strict-Transport-Security)
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block

### Rate Limiting
- ✅ Geral: 10 req/s
- ✅ API: 100 req/min
- ✅ Login: 5 req/min

### Database
- ✅ Senha forte (32+ chars)
- ✅ Isolamento por tenant
- ✅ Backups automáticos (30 dias)
- ✅ Auditoria de ações

---

## 📊 Monitoramento

### Health Checks

```bash
# API Health
curl https://cac360.com.br/api/health

# Database
docker-compose exec postgres pg_isready -U cac360

# Nginx
curl -I https://cac360.com.br
```

### Métricas

```bash
# CPU e Memory
docker stats

# Disco
df -h /opt/cac360

# Conexões
netstat -an | grep ESTABLISHED | wc -l
```

### Logs

```bash
# Aplicação
docker-compose logs -f app

# Nginx
docker-compose logs -f nginx

# PostgreSQL
docker-compose logs -f postgres
```

---

## 🔄 Rollback

### Rollback Manual

```bash
# 1. Parar containers
docker-compose down

# 2. Restaurar backup
docker-compose up -d postgres
docker-compose exec postgres psql -U cac360 < /opt/cac360/backups/backup-YYYYMMDD-HHMMSS.sql

# 3. Checkout versão anterior
git checkout COMMIT_HASH

# 4. Reiniciar
docker-compose up -d --build
```

### Rollback via GitHub

```bash
# Revert commit
git revert COMMIT_HASH
git push origin main

# GitHub Actions dispara novo deploy automaticamente
```

---

## 📚 Documentação Completa

Para mais detalhes, consulte:
- **`GCP-DOCKER-DEPLOY.md`** - Guia completo de deployment no GCP
- **`README.md`** - Documentação do projeto CAC 360
- **`.github/workflows/deploy-docker-pure.yml`** - Workflow de CI/CD

---

## 🆘 Troubleshooting

### Containers não iniciam

```bash
docker-compose logs app
cat /opt/cac360/config/.env.prod
```

### Erro de conexão com banco

```bash
docker-compose exec postgres pg_isready -U cac360
docker-compose exec postgres psql -U cac360 -d cac360_platform -c "SELECT 1"
```

### SSL/TLS não funciona

```bash
ls -la /opt/cac360/app/nginx_certs/live/
docker-compose exec certbot certbot renew --dry-run
docker-compose logs nginx
```

### Aplicação lenta

```bash
docker stats
docker-compose logs app
# Verificar queries lentas no banco
```

---

## 📞 Suporte

**Responsável:** Rodrigo Parreira  
**Email:** rodrigogpx@gmail.com  
**GitHub:** https://github.com/rodrigogpx/cr-workflow

---

## 📝 Changelog

### v1.0 (13 de Janeiro de 2026)
- ✅ Migração de Docker Swarm para Docker Puro
- ✅ Nginx como reverse proxy + SSL
- ✅ PostgreSQL em container
- ✅ Let's Encrypt automático
- ✅ GitHub Actions CI/CD
- ✅ Scripts de deploy e backup
- ✅ Documentação completa

---

## 📄 Licença

Este projeto é proprietário. Todos os direitos reservados.

---

**Última atualização:** 13 de Janeiro de 2026
