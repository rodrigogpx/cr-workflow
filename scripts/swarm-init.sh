#!/bin/bash
# Script de inicialização do Docker Swarm - CAC 360
# Desenvolvido por ACR Digital
#
# Uso: ./scripts/swarm-init.sh

set -e

echo "================================================"
echo "  CAC 360 - Inicialização Docker Swarm"
echo "================================================"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Recomendado executar como root ou com sudo${NC}"
fi

# 1. Verificar Docker
echo -e "\n${GREEN}1. Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não instalado. Instalando...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi
docker --version

# 2. Inicializar Swarm (se não estiver ativo)
echo -e "\n${GREEN}2. Verificando Docker Swarm...${NC}"
if ! docker info | grep -q "Swarm: active"; then
    echo "Inicializando Swarm..."
    ADVERTISE_ADDR=$(hostname -I | awk '{print $1}')
    docker swarm init --advertise-addr $ADVERTISE_ADDR || true
    echo -e "${GREEN}✅ Swarm inicializado!${NC}"
else
    echo -e "${GREEN}✅ Swarm já está ativo${NC}"
fi

# 3. Criar rede do Traefik
echo -e "\n${GREEN}3. Criando rede traefik-public...${NC}"
if ! docker network ls | grep -q "traefik-public"; then
    docker network create --driver=overlay --attachable traefik-public
    echo -e "${GREEN}✅ Rede criada!${NC}"
else
    echo -e "${GREEN}✅ Rede já existe${NC}"
fi

# 4. Criar diretórios necessários
echo -e "\n${GREEN}4. Criando diretórios...${NC}"
mkdir -p /opt/cac360/{config,data,logs}
mkdir -p /opt/cac360/config/traefik
chmod 600 /opt/cac360/config/traefik

# 5. Criar arquivo .env se não existir
echo -e "\n${GREEN}5. Verificando arquivo .env...${NC}"
ENV_FILE="/opt/cac360/config/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Criando arquivo .env de exemplo..."
    cat > $ENV_FILE << 'EOF'
# CAC 360 - Variáveis de Ambiente
# Preencha os valores antes do deploy

# Domínio
DOMAIN=cac360.com.br
ACME_EMAIL=admin@cac360.com.br

# Banco de Dados
POSTGRES_DB=cac360
POSTGRES_USER=cac360
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# Aplicação
JWT_SECRET=CHANGE_ME_JWT_SECRET_MIN_32_CHARS
APP_REPLICAS=2

# GitHub Container Registry
GITHUB_REPOSITORY=rodrigogpx/cr-workflow
IMAGE_TAG=latest

# Cloudflare R2 (Storage)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Traefik Dashboard Auth (gerar com: htpasswd -nb admin senha)
TRAEFIK_DASHBOARD_AUTH=admin:$$apr1$$xyz...

# App Branding
VITE_APP_TITLE=CAC 360
VITE_APP_LOGO=/logo.png
EOF
    echo -e "${YELLOW}⚠️  Edite o arquivo $ENV_FILE antes de continuar!${NC}"
else
    echo -e "${GREEN}✅ Arquivo .env já existe${NC}"
fi

# 6. Login no GitHub Container Registry
echo -e "\n${GREEN}6. Configurando GitHub Container Registry...${NC}"
echo -e "${YELLOW}Para fazer login no GHCR, execute:${NC}"
echo "echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"

# 7. Informações do cluster
echo -e "\n${GREEN}7. Informações do Cluster${NC}"
echo "================================================"
docker node ls
echo ""
docker network ls | grep -E "NAME|overlay"

echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}  Inicialização concluída!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Edite /opt/cac360/config/.env"
echo "  2. Deploy Traefik: docker stack deploy -c docker-compose.traefik.yml traefik"
echo "  3. Deploy App:     docker stack deploy -c docker-compose.swarm.yml --env-file /opt/cac360/config/.env cac360"
echo ""
