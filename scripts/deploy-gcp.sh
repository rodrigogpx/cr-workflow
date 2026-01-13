#!/bin/bash

# ============================================
# Deploy Script - CAC 360 no GCP
# ============================================
# Uso: ./scripts/deploy-gcp.sh [hml|prod]
# Exemplo: ./scripts/deploy-gcp.sh prod

set -euo pipefail

# ============================================
# Cores para Output
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# Variáveis
# ============================================
ENVIRONMENT=${1:-hml}
BRANCH=${ENVIRONMENT}
APP_DIR="/opt/cac360/app"
CONFIG_DIR="/opt/cac360/config"
BACKUP_DIR="/opt/cac360/backups"
LOG_FILE="/opt/cac360/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# ============================================
# Funções
# ============================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

# ============================================
# Validações Iniciais
# ============================================

validate_environment() {
    log_info "Validando ambiente..."
    
    # Verificar se é root ou tem sudo
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script deve ser executado como root ou com sudo"
        exit 1
    fi
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado"
        exit 1
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não está instalado"
        exit 1
    fi
    
    # Verificar Git
    if ! command -v git &> /dev/null; then
        log_error "Git não está instalado"
        exit 1
    fi
    
    log_success "Ambiente validado"
}

validate_environment_type() {
    if [[ "$ENVIRONMENT" != "hml" && "$ENVIRONMENT" != "prod" ]]; then
        log_error "Ambiente inválido: $ENVIRONMENT (use 'hml' ou 'prod')"
        exit 1
    fi
    
    log_info "Ambiente: $ENVIRONMENT"
    log_info "Branch: $BRANCH"
}

validate_config_files() {
    log_info "Validando arquivos de configuração..."
    
    ENV_FILE="$CONFIG_DIR/.env.$ENVIRONMENT"
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Arquivo de configuração não encontrado: $ENV_FILE"
        exit 1
    fi
    
    # Validar variáveis obrigatórias
    required_vars=("DB_PASSWORD" "JWT_SECRET" "SECRET_KEY" "SMTP_HOST" "AWS_ACCESS_KEY_ID")
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$ENV_FILE"; then
            log_error "Variável obrigatória não encontrada: $var"
            exit 1
        fi
    done
    
    log_success "Arquivos de configuração validados"
}

# ============================================
# Preparação do Repositório
# ============================================

prepare_repository() {
    log_info "Preparando repositório..."
    
    # Criar diretório se não existir
    mkdir -p "$APP_DIR"
    
    # Clonar ou atualizar
    if [[ ! -d "$APP_DIR/.git" ]]; then
        log_info "Clonando repositório..."
        cd /opt/cac360
        rm -rf app
        git clone -b "$BRANCH" https://github.com/rodrigogpx/cr-workflow.git app
        cd "$APP_DIR"
    else
        log_info "Atualizando repositório..."
        cd "$APP_DIR"
        git fetch origin
        git checkout "$BRANCH"
        git pull origin "$BRANCH"
    fi
    
    log_success "Repositório preparado"
}

# ============================================
# Backup (Produção)
# ============================================

backup_database() {
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        log_info "Fazendo backup do banco de dados..."
        
        mkdir -p "$BACKUP_DIR"
        
        BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
        
        cd "$APP_DIR"
        
        # Exportar variáveis de ambiente
        export $(grep -v "^#" "$CONFIG_DIR/.env.$ENVIRONMENT" | xargs)
        
        # Fazer dump
        docker-compose exec -T postgres pg_dump \
            -U "${DB_USER:-cac360}" \
            "${DB_NAME:-cac360_platform}" > "$BACKUP_FILE"
        
        # Comprimir
        gzip "$BACKUP_FILE"
        
        log_success "Backup criado: $BACKUP_FILE.gz"
    fi
}

# ============================================
# Deploy
# ============================================

deploy_application() {
    log_info "Iniciando deploy..."
    
    cd "$APP_DIR"
    
    # Exportar variáveis de ambiente
    export $(grep -v "^#" "$CONFIG_DIR/.env.$ENVIRONMENT" | xargs)
    
    # Login no GHCR (se disponível)
    if [[ -n "${GHCR_TOKEN:-}" ]]; then
        log_info "Fazendo login no GHCR..."
        echo "$GHCR_TOKEN" | docker login ghcr.io -u rodrigogpx --password-stdin
    fi
    
    # Parar containers antigos
    log_info "Parando containers antigos..."
    docker-compose -f docker-compose.yml down || true
    
    # Build e start
    log_info "Fazendo build e iniciando containers..."
    docker-compose -f docker-compose.yml up -d --build
    
    log_success "Containers iniciados"
}

# ============================================
# Health Checks
# ============================================

wait_for_services() {
    log_info "Aguardando serviços ficarem saudáveis..."
    
    cd "$APP_DIR"
    
    # Aguardar PostgreSQL
    log_info "Aguardando PostgreSQL..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U "${DB_USER:-cac360}" &> /dev/null; then
            log_success "PostgreSQL respondendo"
            break
        fi
        if [[ $i -eq 30 ]]; then
            log_error "PostgreSQL não respondeu após 30 tentativas"
            return 1
        fi
        echo -n "."
        sleep 2
    done
    
    # Aguardar App
    log_info "Aguardando aplicação..."
    for i in {1..30}; do
        if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Aplicação respondendo"
            break
        fi
        if [[ $i -eq 30 ]]; then
            log_error "Aplicação não respondeu após 30 tentativas"
            docker-compose logs app
            return 1
        fi
        echo -n "."
        sleep 2
    done
    
    echo ""
}

health_check() {
    log_info "Executando health checks..."
    
    # Health check da aplicação
    if curl -sf http://localhost:3000/api/health > /dev/null; then
        log_success "Health check da aplicação: OK"
    else
        log_error "Health check da aplicação falhou"
        return 1
    fi
    
    # Verificar status dos containers
    log_info "Status dos containers:"
    docker-compose ps
    
    log_success "Health checks concluídos"
}

# ============================================
# Limpeza
# ============================================

cleanup_old_backups() {
    if [[ -d "$BACKUP_DIR" ]]; then
        log_info "Limpando backups antigos (> 30 dias)..."
        find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +30 -delete
        log_success "Limpeza concluída"
    fi
}

cleanup_docker() {
    log_info "Limpando imagens e volumes não utilizados..."
    docker system prune -f --volumes
    log_success "Limpeza concluída"
}

# ============================================
# Notificações
# ============================================

send_notification() {
    local status=$1
    local message=$2
    
    # Aqui você pode integrar com Slack, email, etc.
    log_info "Notificação: [$status] $message"
}

# ============================================
# Main Flow
# ============================================

main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════╗"
    echo "║  CAC 360 - Deploy Script (GCP)         ║"
    echo "║  Ambiente: $ENVIRONMENT"
    echo "║  Data: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Criar diretório de logs
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Executar etapas
    validate_environment
    validate_environment_type
    validate_config_files
    prepare_repository
    backup_database
    deploy_application
    wait_for_services
    health_check
    cleanup_old_backups
    cleanup_docker
    
    # Notificação final
    log_success "Deploy concluído com sucesso!"
    send_notification "SUCCESS" "Deploy $ENVIRONMENT concluído"
    
    # Informações finais
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Deploy Concluído!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    echo "Informações:"
    echo "  Ambiente: $ENVIRONMENT"
    echo "  URL: https://$DOMAIN"
    echo "  Log: $LOG_FILE"
    echo ""
    echo "Próximos passos:"
    echo "  1. Validar aplicação em https://$DOMAIN"
    echo "  2. Verificar logs: docker-compose logs -f app"
    echo "  3. Monitorar performance"
    echo ""
}

# ============================================
# Error Handler
# ============================================

trap 'log_error "Erro na linha $LINENO"; send_notification "FAILED" "Deploy $ENVIRONMENT falhou"; exit 1' ERR

# ============================================
# Executar
# ============================================

main "$@"
