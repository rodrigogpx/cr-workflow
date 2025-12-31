# CAC 360 - Deploy com Docker Swarm

Guia completo para deploy do CAC 360 em cluster Docker Swarm com CI/CD via GitHub Actions.

---

## 📋 Visão Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                           GITHUB                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  Push    │───▶│  Build   │───▶│  Push    │───▶│  Deploy  │      │
│  │  Code    │    │  Docker  │    │  GHCR    │    │  SSH     │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DOCKER SWARM CLUSTER                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                        TRAEFIK                                │  │
│  │  - Reverse Proxy / Load Balancer                             │  │
│  │  - SSL/TLS (Let's Encrypt)                                   │  │
│  │  - Wildcard para multi-tenant (*.cac360.com.br)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │   App #1     │ │   App #2     │ │   App #3     │                │
│  │   (replica)  │ │   (replica)  │ │   (replica)  │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│              │               │               │                      │
│              └───────────────┼───────────────┘                      │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      POSTGRESQL                               │  │
│  │  - Persistência em volume local                              │  │
│  │  - Backups automáticos (opcional)                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Requisitos

- VM com Ubuntu 22.04+ (mínimo 2 vCPU, 4GB RAM)
- Docker 24+
- Acesso SSH configurado
- Domínio apontando para o IP da VM

### 2. Setup Inicial (na VM)

```bash
# Clonar repositório
git clone https://github.com/rodrigogpx/cr-workflow.git
cd cr-workflow

# Tornar scripts executáveis
chmod +x scripts/*.sh

# Executar setup inicial
sudo ./scripts/swarm-init.sh
```

### 3. Configurar Variáveis

```bash
# Editar arquivo de configuração
sudo nano /opt/cac360/config/.env
```

### 4. Deploy Traefik

```bash
# Deploy do reverse proxy
docker stack deploy -c docker-compose.traefik.yml traefik

# Verificar
docker stack services traefik
```

### 5. Deploy Aplicação

```bash
# Deploy da stack CAC 360
docker stack deploy \
  -c docker-compose.swarm.yml \
  --with-registry-auth \
  cac360

# Verificar
docker stack services cac360
```

---

## ⚙️ Configuração

### Secrets no GitHub

Configure em **Settings → Secrets and variables → Actions**:

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `SWARM_HOST` | IP do manager do Swarm | `34.95.123.45` |
| `SSH_USER` | Usuário SSH | `deploy` |
| `SSH_PRIVATE_KEY` | Chave privada SSH | `-----BEGIN OPENSSH...` |
| `GITHUB_TOKEN` | Automático | - |

### Variáveis de Ambiente (.env)

```env
# Domínio
DOMAIN=cac360.com.br
ACME_EMAIL=admin@cac360.com.br

# Banco de Dados
POSTGRES_DB=cac360
POSTGRES_USER=cac360
POSTGRES_PASSWORD=SENHA_FORTE_AQUI

# Aplicação
JWT_SECRET=SEGREDO_JWT_32_CARACTERES_MIN
APP_REPLICAS=2

# GitHub Container Registry
GITHUB_REPOSITORY=rodrigogpx/cr-workflow
IMAGE_TAG=latest

# Cloudflare R2 (Storage)
R2_ACCOUNT_ID=seu_account_id
R2_ACCESS_KEY_ID=sua_access_key
R2_SECRET_ACCESS_KEY=sua_secret_key
R2_BUCKET_NAME=cac360-files

# Traefik Dashboard
# Gerar com: htpasswd -nb admin sua_senha
TRAEFIK_DASHBOARD_AUTH=admin:$apr1$...

# Branding
VITE_APP_TITLE=CAC 360
VITE_APP_LOGO=/logo.png
```

---

## 📁 Estrutura de Arquivos

```
/opt/cac360/
├── config/
│   ├── .env                    # Variáveis de ambiente
│   ├── .rollback-image         # Imagem para rollback
│   └── traefik/
│       └── acme.json           # Certificados Let's Encrypt
├── data/
│   └── postgres/               # Dados do PostgreSQL
└── logs/
    └── app/                    # Logs da aplicação
```

---

## 🔄 Pipeline CI/CD

### Fluxo

```
1. Push para branch `hml` ou `main`
           │
           ▼
2. GitHub Actions: Build Docker image
           │
           ▼
3. Push imagem para ghcr.io
           │
           ▼
4. SSH para Swarm Manager
           │
           ▼
5. docker service update (rolling update)
           │
           ▼
6. Verificação de saúde
           │
    ┌──────┴──────┐
    ▼             ▼
 Sucesso      Falha → Rollback automático
```

### Branches

| Branch | Ambiente | URL |
|--------|----------|-----|
| `hml` | Homologação | https://hml.cac360.com.br |
| `main` | Produção | https://cac360.com.br |

### Tags de Imagem

| Tag | Descrição |
|-----|-----------|
| `hml` | Última versão de homologação |
| `main` | Última versão de main |
| `latest` | Última versão de produção |
| `hml-<sha>` | Versão específica HML |
| `prod-<sha>` | Versão específica Prod |

---

## 🛠️ Comandos Úteis

### Gerenciamento do Swarm

```bash
# Ver serviços
docker stack services cac360

# Ver tasks/containers
docker service ps cac360_app

# Logs do serviço
docker service logs cac360_app -f --tail 100

# Escalar replicas
docker service scale cac360_app=3

# Atualizar imagem manualmente
docker service update --image ghcr.io/rodrigogpx/cr-workflow:latest cac360_app
```

### Rollback

```bash
# Rollback automático (última versão estável)
docker service rollback cac360_app

# Rollback manual com script
./scripts/swarm-rollback.sh
```

### Banco de Dados

```bash
# Acessar PostgreSQL
docker exec -it $(docker ps -q -f name=cac360_postgres) psql -U cac360 -d cac360

# Backup
docker exec $(docker ps -q -f name=cac360_postgres) pg_dump -U cac360 cac360 > backup.sql

# Restore
cat backup.sql | docker exec -i $(docker ps -q -f name=cac360_postgres) psql -U cac360 -d cac360
```

### Troubleshooting

```bash
# Ver estado do cluster
docker node ls

# Ver redes
docker network ls

# Inspecionar serviço
docker service inspect cac360_app --pretty

# Ver eventos
docker events --filter 'scope=swarm' --since 1h

# Forçar re-deploy
docker service update --force cac360_app
```

---

## 🔒 Segurança

### Checklist

- [ ] Alterar `POSTGRES_PASSWORD` para senha forte
- [ ] Alterar `JWT_SECRET` (mínimo 32 caracteres)
- [ ] Configurar `TRAEFIK_DASHBOARD_AUTH` com senha forte
- [ ] Restringir acesso SSH (apenas chaves, não senha)
- [ ] Configurar firewall (apenas portas 80, 443, 22)
- [ ] Habilitar backups automáticos do PostgreSQL

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 📊 Monitoramento

### Health Check

A aplicação expõe endpoint de saúde:

```bash
curl https://cac360.com.br/api/health
```

### Métricas do Swarm

```bash
# Uso de recursos
docker stats

# Informações do cluster
docker info

# Logs centralizados
docker service logs cac360_app --timestamps
```

---

## 🔄 Atualizações

### Rolling Update

O Swarm faz rolling updates por padrão:

```yaml
update_config:
  parallelism: 1        # Uma replica por vez
  delay: 10s            # Delay entre updates
  failure_action: rollback  # Rollback automático em falha
  order: start-first    # Inicia nova antes de parar antiga
```

### Zero Downtime

Com `order: start-first` e múltiplas replicas, não há downtime durante deploys.

---

## 💾 Backups

### Script de Backup

```bash
#!/bin/bash
# /opt/cac360/scripts/backup.sh

BACKUP_DIR="/opt/cac360/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec $(docker ps -q -f name=cac360_postgres) \
  pg_dump -U cac360 cac360 | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Manter últimos 7 dias
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup concluído: $BACKUP_DIR/db_$DATE.sql.gz"
```

### Cron para Backup Diário

```bash
# Adicionar ao crontab
0 3 * * * /opt/cac360/scripts/backup.sh >> /var/log/cac360-backup.log 2>&1
```

---

## 📞 Suporte

- **Documentação Docker Swarm**: https://docs.docker.com/engine/swarm/
- **Traefik Docs**: https://doc.traefik.io/traefik/
- **GitHub Actions**: https://docs.github.com/en/actions

---

**Desenvolvido por ACR Digital** | Última atualização: Dezembro 2025
