#!/bin/bash

# ==============================================================================
# Script de Configuração Automatizada - CAC 360 (Docker Swarm)
# Uso: curl -sSL https://raw.githubusercontent.com/rodrigogpx/cr-workflow/main/scripts/setup-environment.sh | bash
# ==============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Iniciando configuração do ambiente CAC 360...${NC}"

# 1. Verificação de permissões
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Este script precisa ser executado como root (sudo).${NC}"
   exit 1
fi

# 2. Atualização do sistema e dependências básicas
echo -e "${GREEN}📦 Atualizando pacotes do sistema...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl git apt-transport-https ca-certificates software-properties-common gnupg lsb-release

# 3. Instalação do Docker (se não existir)
if ! command -v docker &> /dev/null; then
    echo -e "${GREEN}🐳 Instalando Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $USER
else
    echo -e "${YELLOW}🐳 Docker já instalado.${NC}"
fi

# 4. Inicialização do Docker Swarm
if [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" != "active" ]; then
    echo -e "${GREEN}🐝 Inicializando Docker Swarm...${NC}"
    # Pega o IP da interface principal
    IP_ADDR=$(hostname -I | awk '{print $1}')
    docker swarm init --advertise-addr $IP_ADDR
else
    echo -e "${YELLOW}🐝 Docker Swarm já ativo.${NC}"
fi

# 5. Criação da estrutura de diretórios
echo -e "${GREEN}📁 Criando estrutura de pastas em /opt/cac360...${NC}"
mkdir -p /opt/cac360/config/traefik
mkdir -p /opt/cac360/data/postgres
mkdir -p /opt/cac360/logs/app
touch /opt/cac360/config/traefik/acme.json
chmod 600 /opt/cac360/config/traefik/acme.json

# 6. Criação da Rede Overlay
if ! docker network ls | grep -q "cac360_public"; then
    echo -e "${GREEN}🌐 Criando rede overlay cac360_public...${NC}"
    docker network create --driver overlay --attachable cac360_public
fi

# 7. Configuração do arquivo .env inicial
if [ ! -f /opt/cac360/config/.env ]; then
    echo -e "${YELLOW}📝 Criando arquivo .env base (POR FAVOR, EDITE-O DEPOIS)...${NC}"
    cat <<EOF > /opt/cac360/config/.env
# Configurações Obrigatórias
DOMAIN=seu-dominio.com.br
ACME_EMAIL=seu-email@dominio.com
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)

# Configurações do App
GITHUB_REPOSITORY=rodrigogpx/cr-workflow
IMAGE_TAG=latest
APP_REPLICAS=2
EOF
    echo -e "${RED}⚠️ ATENÇÃO: Edite o arquivo /opt/cac360/config/.env com seus dados reais!${NC}"
else
    echo -e "${YELLOW}✅ Arquivo .env já existe.${NC}"
fi

echo -e "${GREEN}✨ Ambiente configurado com sucesso!${NC}"
echo -e "${YELLOW}Próximos passos:${NC}"
echo -e "1. Edite as variáveis: ${CYAN}nano /opt/cac360/config/.env${NC}"
echo -e "2. Faça login no GHCR: ${CYAN}docker login ghcr.io${NC}"
echo -e "3. Execute o deploy: ${CYAN}docker stack deploy -c docker-compose.swarm.yml cac360${NC}"
