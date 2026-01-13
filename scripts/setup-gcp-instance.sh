#!/bin/bash

# ============================================
# Setup Script - GCP Compute Engine Instance
# ============================================
# Uso: bash setup-gcp-instance.sh
# Executar como: sudo bash setup-gcp-instance.sh

set -euo pipefail

# ============================================
# Cores
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# Funções
# ============================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================
# Verificações Iniciais
# ============================================

if [[ $EUID -ne 0 ]]; then
    log_error "Este script deve ser executado como root"
    exit 1
fi

log_info "Iniciando setup da instância GCP..."

# ============================================
# Atualizar Sistema
# ============================================

log_info "Atualizando sistema..."
apt-get update
apt-get upgrade -y
apt-get install -y curl wget git htop net-tools

log_success "Sistema atualizado"

# ============================================
# Instalar Docker
# ============================================

log_info "Instalando Docker..."

# Remover versões antigas
apt-get remove -y docker docker.io containerd runc || true

# Instalar Docker
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
bash /tmp/get-docker.sh

# Adicionar usuário ao grupo docker
usermod -aG docker rodrigogpx

log_success "Docker instalado"

# ============================================
# Instalar Docker Compose
# ============================================

log_info "Instalando Docker Compose..."

DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)

curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

log_success "Docker Compose instalado"

# ============================================
# Instalar Ferramentas Adicionais
# ============================================

log_info "Instalando ferramentas adicionais..."

apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql-client \
    jq \
    unzip

log_success "Ferramentas instaladas"

# ============================================
# Configurar Firewall
# ============================================

log_info "Configurando firewall..."

ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

log_success "Firewall configurado"

# ============================================
# Criar Estrutura de Diretórios
# ============================================

log_info "Criando estrutura de diretórios..."

mkdir -p /opt/cac360/{app,config,backups,logs}
chown -R rodrigogpx:rodrigogpx /opt/cac360
chmod -R 755 /opt/cac360

log_success "Diretórios criados"

# ============================================
# Configurar Swap (Opcional)
# ============================================

log_info "Configurando swap..."

if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log_success "Swap configurado (2GB)"
else
    log_info "Swap já existe"
fi

# ============================================
# Configurar Limits
# ============================================

log_info "Configurando limites do sistema..."

cat >> /etc/security/limits.conf << 'EOF'
# Docker limits
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536
EOF

log_success "Limites configurados"

# ============================================
# Configurar Sysctl
# ============================================

log_info "Configurando sysctl..."

cat >> /etc/sysctl.conf << 'EOF'
# Docker optimization
vm.max_map_count=262144
net.core.somaxconn=65535
net.ipv4.tcp_max_syn_backlog=65535
EOF

sysctl -p > /dev/null

log_success "Sysctl configurado"

# ============================================
# Configurar Cron para Backups
# ============================================

log_info "Configurando cron para backups..."

# Criar cron job
cat > /tmp/cron-backup << 'EOF'
# Backup diário às 3 da manhã
0 3 * * * /opt/cac360/app/scripts/backup-db.sh >> /opt/cac360/logs/cron-backup.log 2>&1
EOF

# Adicionar ao crontab do rodrigogpx
crontab -u rodrigogpx /tmp/cron-backup || true

log_success "Cron configurado"

# ============================================
# Configurar Logrotate
# ============================================

log_info "Configurando logrotate..."

cat > /etc/logrotate.d/cac360 << 'EOF'
/opt/cac360/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 rodrigogpx rodrigogpx
    sharedscripts
}
EOF

log_success "Logrotate configurado"

# ============================================
# Configurar Timezone
# ============================================

log_info "Configurando timezone..."

timedatectl set-timezone America/Sao_Paulo

log_success "Timezone configurado"

# ============================================
# Verificações Finais
# ============================================

log_info "Executando verificações finais..."

# Verificar Docker
if docker --version > /dev/null; then
    log_success "Docker: $(docker --version)"
else
    log_error "Docker não está funcionando"
    exit 1
fi

# Verificar Docker Compose
if docker-compose --version > /dev/null; then
    log_success "Docker Compose: $(docker-compose --version)"
else
    log_error "Docker Compose não está funcionando"
    exit 1
fi

# Verificar Git
if git --version > /dev/null; then
    log_success "Git: $(git --version)"
else
    log_error "Git não está funcionando"
    exit 1
fi

# ============================================
# Resumo
# ============================================

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup Concluído com Sucesso!      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Próximas etapas:"
echo "  1. Criar arquivos .env em /opt/cac360/config/"
echo "  2. Clonar repositório em /opt/cac360/app"
echo "  3. Executar: ./scripts/deploy-gcp.sh prod"
echo ""
echo "Informações do sistema:"
echo "  OS: $(lsb_release -ds)"
echo "  Kernel: $(uname -r)"
echo "  Docker: $(docker --version)"
echo "  Docker Compose: $(docker-compose --version)"
echo "  Timezone: $(timedatectl | grep 'Time zone')"
echo ""
echo "Diretórios criados:"
echo "  - /opt/cac360/app (aplicação)"
echo "  - /opt/cac360/config (configurações)"
echo "  - /opt/cac360/backups (backups)"
echo "  - /opt/cac360/logs (logs)"
echo ""
