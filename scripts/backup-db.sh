#!/bin/bash

# ============================================
# Backup Script - PostgreSQL
# ============================================
# Uso: ./scripts/backup-db.sh
# Agendamento: 0 3 * * * /opt/cac360/app/scripts/backup-db.sh

set -euo pipefail

# ============================================
# Variáveis
# ============================================
APP_DIR="/opt/cac360/app"
BACKUP_DIR="/opt/cac360/backups"
CONFIG_DIR="/opt/cac360/config"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.sql"
LOG_FILE="/opt/cac360/logs/backup-$TIMESTAMP.log"
RETENTION_DAYS=30

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
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

# ============================================
# Validações
# ============================================

validate_environment() {
    log_info "Validando ambiente..."
    
    if [[ ! -d "$APP_DIR" ]]; then
        log_error "Diretório da aplicação não encontrado: $APP_DIR"
        exit 1
    fi
    
    if [[ ! -d "$CONFIG_DIR" ]]; then
        log_error "Diretório de configuração não encontrado: $CONFIG_DIR"
        exit 1
    fi
    
    # Detectar ambiente (prod ou hml)
    if [[ -f "$CONFIG_DIR/.env.prod" ]]; then
        ENV_FILE="$CONFIG_DIR/.env.prod"
        ENVIRONMENT="prod"
    elif [[ -f "$CONFIG_DIR/.env.hml" ]]; then
        ENV_FILE="$CONFIG_DIR/.env.hml"
        ENVIRONMENT="hml"
    else
        log_error "Arquivo .env não encontrado"
        exit 1
    fi
    
    log_success "Ambiente: $ENVIRONMENT"
}

# ============================================
# Preparação
# ============================================

prepare_backup_dir() {
    log_info "Preparando diretório de backup..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Verificar espaço em disco
    AVAILABLE_SPACE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=$((1024 * 1024))  # 1GB em KB
    
    if [[ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]]; then
        log_error "Espaço em disco insuficiente: ${AVAILABLE_SPACE}KB disponível"
        exit 1
    fi
    
    log_success "Diretório preparado"
}

# ============================================
# Backup
# ============================================

backup_database() {
    log_info "Iniciando backup do banco de dados..."
    
    cd "$APP_DIR"
    
    # Exportar variáveis de ambiente
    export $(grep -v "^#" "$ENV_FILE" | xargs)
    
    # Extrair credenciais
    DB_USER=${DB_USER:-cac360}
    DB_NAME=${DB_NAME:-cac360_platform}
    
    # Fazer dump
    log_info "Fazendo dump do banco: $DB_NAME"
    
    if docker-compose exec -T postgres pg_dump \
        -U "$DB_USER" \
        --format=plain \
        --verbose \
        "$DB_NAME" > "$BACKUP_FILE" 2>> "$LOG_FILE"; then
        
        log_success "Dump concluído: $BACKUP_FILE"
    else
        log_error "Erro ao fazer dump do banco"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
    
    # Verificar tamanho do arquivo
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_info "Tamanho do backup: $BACKUP_SIZE"
    
    if [[ ! -s "$BACKUP_FILE" ]]; then
        log_error "Arquivo de backup vazio"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
}

# ============================================
# Compressão
# ============================================

compress_backup() {
    log_info "Comprimindo backup..."
    
    if gzip "$BACKUP_FILE"; then
        COMPRESSED_FILE="$BACKUP_FILE.gz"
        COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
        log_success "Backup comprimido: $COMPRESSED_SIZE"
    else
        log_error "Erro ao comprimir backup"
        exit 1
    fi
}

# ============================================
# Upload (Opcional)
# ============================================

upload_to_gcs() {
    log_info "Verificando se gsutil está disponível..."
    
    if command -v gsutil &> /dev/null; then
        log_info "Fazendo upload para Google Cloud Storage..."
        
        BUCKET="gs://cac360-backups"
        
        if gsutil cp "$COMPRESSED_FILE" "$BUCKET/"; then
            log_success "Upload para GCS concluído"
        else
            log_error "Erro ao fazer upload para GCS"
            # Não falhar o script, apenas avisar
        fi
    else
        log_info "gsutil não disponível, pulando upload para GCS"
    fi
}

# ============================================
# Limpeza
# ============================================

cleanup_old_backups() {
    log_info "Limpando backups antigos (> $RETENTION_DAYS dias)..."
    
    DELETED_COUNT=0
    
    while IFS= read -r file; do
        rm -f "$file"
        ((DELETED_COUNT++))
        log_info "Deletado: $file"
    done < <(find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +$RETENTION_DAYS)
    
    if [[ $DELETED_COUNT -gt 0 ]]; then
        log_success "Deletados $DELETED_COUNT backups antigos"
    else
        log_info "Nenhum backup antigo para deletar"
    fi
}

# ============================================
# Verificação
# ============================================

verify_backup() {
    log_info "Verificando integridade do backup..."
    
    if gzip -t "$COMPRESSED_FILE" 2>> "$LOG_FILE"; then
        log_success "Integridade do backup verificada"
    else
        log_error "Backup corrompido"
        rm -f "$COMPRESSED_FILE"
        exit 1
    fi
}

# ============================================
# Notificações
# ============================================

send_notification() {
    local status=$1
    local message=$2
    
    # Integração com Slack (opcional)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"[$status] Backup: $message\"}" \
            2>> "$LOG_FILE" || true
    fi
    
    # Integração com email (opcional)
    if [[ -n "${BACKUP_EMAIL:-}" ]]; then
        echo "$message" | mail -s "Backup $status" "$BACKUP_EMAIL" || true
    fi
}

# ============================================
# Main Flow
# ============================================

main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════╗"
    echo "║  CAC 360 - Backup Script               ║"
    echo "║  Data: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Executar etapas
    validate_environment
    prepare_backup_dir
    backup_database
    compress_backup
    verify_backup
    upload_to_gcs
    cleanup_old_backups
    
    # Notificação final
    log_success "Backup concluído com sucesso!"
    send_notification "SUCCESS" "Backup criado: $COMPRESSED_FILE"
    
    # Resumo
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Backup Concluído!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    echo "Informações:"
    echo "  Arquivo: $COMPRESSED_FILE"
    echo "  Tamanho: $(du -h "$COMPRESSED_FILE" | cut -f1)"
    echo "  Ambiente: $ENVIRONMENT"
    echo "  Log: $LOG_FILE"
    echo ""
}

# ============================================
# Error Handler
# ============================================

trap 'log_error "Erro na linha $LINENO"; send_notification "FAILED" "Backup falhou"; exit 1' ERR

# ============================================
# Executar
# ============================================

main "$@"
