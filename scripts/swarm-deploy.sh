#!/bin/bash
# Script de Deploy para Docker Swarm - CAC 360
# Desenvolvido por ACR Digital
#
# Uso: ./scripts/swarm-deploy.sh [tag]
# Exemplo: ./scripts/swarm-deploy.sh latest
#          ./scripts/swarm-deploy.sh v1.2.3

set -e

# Configurações
STACK_NAME="cac360"
ENV_FILE="/opt/cac360/config/.env"
COMPOSE_FILE="docker-compose.swarm.yml"
IMAGE_TAG="${1:-latest}"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  CAC 360 - Deploy Docker Swarm${NC}"
echo -e "${BLUE}  Tag: ${IMAGE_TAG}${NC}"
echo -e "${BLUE}================================================${NC}"

# Verificar arquivo .env
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado em $ENV_FILE${NC}"
    exit 1
fi

# Carregar variáveis
export $(grep -v '^#' $ENV_FILE | xargs)
export IMAGE_TAG=$IMAGE_TAG

# Verificar se o compose file existe
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${YELLOW}⚠️  Compose file não encontrado localmente, baixando do repo...${NC}"
    curl -sL "https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/docker-compose.swarm.yml" -o /tmp/docker-compose.swarm.yml
    COMPOSE_FILE="/tmp/docker-compose.swarm.yml"
fi

# 1. Pull da nova imagem
echo -e "\n${GREEN}1. Baixando imagem ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG}...${NC}"
docker pull ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG}

# 2. Salvar estado atual para rollback
echo -e "\n${GREEN}2. Salvando estado atual para rollback...${NC}"
CURRENT_IMAGE=$(docker service inspect ${STACK_NAME}_app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || echo "none")
echo "$CURRENT_IMAGE" > /opt/cac360/config/.rollback-image
echo "Imagem atual: $CURRENT_IMAGE"

# 3. Deploy da stack
echo -e "\n${GREEN}3. Deployando stack ${STACK_NAME}...${NC}"
docker stack deploy \
    -c $COMPOSE_FILE \
    --with-registry-auth \
    $STACK_NAME

# 4. Aguardar deploy
echo -e "\n${GREEN}4. Aguardando deploy...${NC}"
sleep 5

# 5. Verificar status dos serviços
echo -e "\n${GREEN}5. Status dos serviços:${NC}"
docker stack services $STACK_NAME

# 6. Verificar se o serviço está healthy
echo -e "\n${GREEN}6. Verificando saúde do serviço...${NC}"
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    RUNNING=$(docker service ls --filter "name=${STACK_NAME}_app" --format "{{.Replicas}}" | cut -d'/' -f1)
    DESIRED=$(docker service ls --filter "name=${STACK_NAME}_app" --format "{{.Replicas}}" | cut -d'/' -f2)
    
    if [ "$RUNNING" == "$DESIRED" ] && [ "$RUNNING" != "0" ]; then
        echo -e "${GREEN}✅ Serviço healthy! ($RUNNING/$DESIRED replicas)${NC}"
        break
    fi
    
    echo "Aguardando... ($RUNNING/$DESIRED replicas) - ${ELAPSED}s"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo -e "${RED}❌ Timeout aguardando deploy. Executando rollback...${NC}"
    ./scripts/swarm-rollback.sh
    exit 1
fi

# 7. Logs recentes
echo -e "\n${GREEN}7. Logs recentes:${NC}"
docker service logs ${STACK_NAME}_app --tail 20 --no-trunc 2>/dev/null || true

echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}  Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}  Stack: ${STACK_NAME}${NC}"
echo -e "${GREEN}  Image: ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG}${NC}"
echo -e "${GREEN}================================================${NC}"
