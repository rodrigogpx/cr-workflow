# 📋 Guia de Deployment: CAC 360 no GCP com Docker Puro

**Versão:** 1.0  
**Data:** 13 de Janeiro de 2026  
**Ambiente:** Google Cloud Platform (GCP) Compute Engine

---

## 📑 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Arquitetura](#arquitetura)
3. [Setup Inicial do GCP](#setup-inicial-do-gcp)
4. [Configuração da Instância](#configuração-da-instância)
5. [Deployment Manual](#deployment-manual)
6. [Deployment Automático (GitHub Actions)](#deployment-automático-github-actions)
7. [Monitoramento](#monitoramento)
8. [Troubleshooting](#troubleshooting)
9. [Rollback](#rollback)

---

## 🔧 Pré-requisitos

### Conta GCP
- ✅ Projeto GCP criado
- ✅ Billing habilitado
- ✅ APIs ativadas:
  - Compute Engine API
  - Cloud DNS API
  - Cloud Logging API

### Ferramentas Locais
- ✅ Google Cloud SDK (`gcloud`)
- ✅ Docker + Docker Compose
- ✅ Git
- ✅ SSH client

### Repositório
- ✅ Fork de https://github.com/rodrigogpx/cr-workflow
- ✅ Branch `main` (produção) e `hml` (homolog)
- ✅ Secrets configurados no GitHub

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    GCP PROJECT                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Compute Engine Instance (dockerserver01)            │  │
│  │  ├─ Machine: e2-standard-2 (2 vCPU, 8GB RAM)       │  │
│  │  ├─ OS: Ubuntu 22.04 LTS                           │  │
│  │  ├─ Disk: 50GB SSD                                 │  │
│  │  └─ Zone: us-west1-a                               │  │
│  │                                                     │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Docker Engine                                 │ │  │
│  │  ├─────────────────────────────────────────────── │ │  │
│  │  │  Container: app (Node.js)                     │ │  │
│  │  │  Container: postgres (PostgreSQL 16)          │ │  │
│  │  │  Container: nginx (Reverse Proxy + SSL)       │ │  │
│  │  │  Container: certbot (Let's Encrypt)           │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │                                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cloud DNS                                          │  │
│  │  ├─ cac360.com.br → Compute Engine IP             │  │
│  │  └─ hml.cac360.com.br → Compute Engine IP         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Setup Inicial do GCP

### 1. Criar Compute Engine Instance

```bash
# Autenticar no GCP
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Criar instância
gcloud compute instances create dockerserver01 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --machine-type=e2-standard-2 \
  --zone=us-west1-a \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-ssd \
  --tags=http-server,https-server \
  --scopes=cloud-platform

# Abrir firewall
gcloud compute firewall-rules create allow-http \
  --allow=tcp:80 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server

gcloud compute firewall-rules create allow-https \
  --allow=tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=https-server

gcloud compute firewall-rules create allow-ssh \
  --allow=tcp:22 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=ssh-server
```

### 2. Obter IP Externo

```bash
gcloud compute instances describe dockerserver01 \
  --zone=us-west1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

### 3. Configurar Cloud DNS

```bash
# Criar zona DNS
gcloud dns managed-zones create cac360 \
  --dns-name=cac360.com.br. \
  --description="CAC 360 Zone"

# Obter nameservers
gcloud dns managed-zones describe cac360 --format="value(nameServers)"

# Adicionar A records
gcloud dns record-sets create cac360.com.br. \
  --rrdatas=YOUR_EXTERNAL_IP \
  --ttl=300 \
  --type=A \
  --zone=cac360

gcloud dns record-sets create www.cac360.com.br. \
  --rrdatas=YOUR_EXTERNAL_IP \
  --ttl=300 \
  --type=A \
  --zone=cac360

gcloud dns record-sets create hml.cac360.com.br. \
  --rrdatas=YOUR_EXTERNAL_IP \
  --ttl=300 \
  --type=A \
  --zone=cac360

gcloud dns record-sets create www.hml.cac360.com.br. \
  --rrdatas=YOUR_EXTERNAL_IP \
  --ttl=300 \
  --type=A \
  --zone=cac360
```

---

## 🔧 Configuração da Instância

### 1. SSH na Instância

```bash
gcloud compute ssh rodrigogpx@dockerserver01 \
  --zone=us-west1-a \
  --project=YOUR_PROJECT_ID
```

### 2. Executar Setup Script

```bash
# Copiar script de setup
gcloud compute scp scripts/setup-gcp-instance.sh \
  rodrigogpx@dockerserver01:/tmp/ \
  --zone=us-west1-a

# Executar
gcloud compute ssh rodrigogpx@dockerserver01 \
  --zone=us-west1-a \
  --command='bash /tmp/setup-gcp-instance.sh'
```

### 3. Criar Estrutura de Diretórios

```bash
sudo mkdir -p /opt/cac360/{app,config,backups,logs}
sudo chown -R rodrigogpx:rodrigogpx /opt/cac360
```

### 4. Preparar Arquivos de Configuração

```bash
# Criar .env files
cat > /opt/cac360/config/.env.prod << 'EOF'
# Copiar conteúdo de .env.gcp.example
# Preencher valores específicos
EOF

cat > /opt/cac360/config/.env.hml << 'EOF'
# Copiar conteúdo de .env.gcp.example
# Preencher valores específicos
EOF

# Proteger arquivos
chmod 600 /opt/cac360/config/.env.*
```

---

## 📦 Deployment Manual

### 1. SSH na Instância

```bash
gcloud compute ssh rodrigogpx@dockerserver01 \
  --zone=us-west1-a \
  --project=YOUR_PROJECT_ID
```

### 2. Clonar Repositório

```bash
cd /opt/cac360
git clone -b main https://github.com/rodrigogpx/cr-workflow.git app
cd app
```

### 3. Executar Deploy Script

```bash
# Para produção
./scripts/deploy-gcp.sh prod

# Para homolog
./scripts/deploy-gcp.sh hml
```

### 4. Validar Deployment

```bash
# Verificar containers
docker-compose ps

# Verificar logs
docker-compose logs -f app

# Health check
curl https://cac360.com.br/api/health
```

---

## 🤖 Deployment Automático (GitHub Actions)

### 1. Configurar Secrets no GitHub

```bash
# Gerar Personal Access Token (GHCR)
# https://github.com/settings/tokens

# Adicionar secrets no repositório:
# - GCP_SA_KEY (Service Account JSON)
# - GCP_PROJECT_ID
# - GHCR_DEPLOY_PAT
```

### 2. Criar Service Account no GCP

```bash
# Criar service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Gerar key
gcloud iam service-accounts keys create /tmp/sa-key.json \
  --iam-account=github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Adicionar permissões
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/compute.osLogin

# Copiar conteúdo de /tmp/sa-key.json para GCP_SA_KEY secret
```

### 3. Workflow Automático

O workflow `.github/workflows/deploy-docker-pure.yml` é acionado automaticamente:

- **Push para `main`** → Deploy em produção
- **Push para `hml`** → Deploy em homolog
- **Manual** → Workflow dispatch

---

## 📊 Monitoramento

### 1. Verificar Status dos Containers

```bash
docker-compose ps
docker-compose logs app
docker-compose logs nginx
docker-compose logs postgres
```

### 2. Monitorar Performance

```bash
# CPU e Memory
docker stats

# Disco
df -h

# Conexões de rede
netstat -an | grep ESTABLISHED | wc -l
```

### 3. Verificar Logs

```bash
# Logs da aplicação
docker-compose logs -f app

# Logs do Nginx
docker-compose logs -f nginx

# Logs do PostgreSQL
docker-compose logs -f postgres
```

### 4. Health Checks

```bash
# API health
curl https://cac360.com.br/api/health

# Database
docker-compose exec postgres pg_isready -U cac360

# Nginx
curl -I https://cac360.com.br
```

---

## 🔍 Troubleshooting

### Problema: Containers não iniciam

**Solução:**
```bash
# Verificar logs
docker-compose logs app

# Verificar .env
cat /opt/cac360/config/.env.prod

# Verificar variáveis
docker-compose config
```

### Problema: Erro de conexão com banco

**Solução:**
```bash
# Verificar PostgreSQL
docker-compose exec postgres pg_isready -U cac360

# Verificar credenciais
docker-compose exec postgres psql -U cac360 -d cac360_platform -c "SELECT 1"
```

### Problema: SSL/TLS não funciona

**Solução:**
```bash
# Verificar certificados
ls -la /opt/cac360/app/nginx_certs/live/

# Renovar certificado manualmente
docker-compose exec certbot certbot renew --dry-run

# Verificar Nginx
docker-compose logs nginx
```

### Problema: Aplicação lenta

**Solução:**
```bash
# Verificar recursos
docker stats

# Aumentar limite de memória (docker-compose.yml)
# Verificar queries lentas no banco

# Limpar cache
docker-compose exec app npm cache clean --force
```

---

## 🔄 Rollback

### Rollback Manual

```bash
# 1. Parar containers
docker-compose down

# 2. Restaurar backup do banco
docker-compose up -d postgres
docker-compose exec postgres psql -U cac360 < /opt/cac360/backups/backup-YYYYMMDD-HHMMSS.sql

# 3. Checkout versão anterior
git checkout COMMIT_HASH

# 4. Reiniciar
docker-compose up -d --build
```

### Rollback via GitHub

```bash
# 1. Revert commit
git revert COMMIT_HASH
git push origin main

# 2. GitHub Actions dispara novo deploy automaticamente
```

---

## 📋 Checklist de Operações

### Diário
- [ ] Verificar health checks
- [ ] Monitorar logs de erro
- [ ] Validar performance

### Semanal
- [ ] Revisar backups
- [ ] Verificar espaço em disco
- [ ] Atualizar dependências

### Mensal
- [ ] Rotacionar secrets
- [ ] Revisar logs de auditoria
- [ ] Testar disaster recovery

---

## 📞 Suporte

**Responsável:** Rodrigo Parreira  
**Email:** rodrigogpx@gmail.com  
**Repositório:** https://github.com/rodrigogpx/cr-workflow

---

## 📚 Referências

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Google Cloud Compute Engine](https://cloud.google.com/compute)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Última atualização:** 13 de Janeiro de 2026
