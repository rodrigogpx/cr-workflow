#!/bin/bash
# Script de Rollback para Docker Swarm - CAC 360
# Desenvolvido por ACR Digital
#
# Uso: ./scripts/swarm-rollback.sh

set -e

# Configurações
STACK_NAME="cac360"
ROLLBACK_FILE="/opt/cac360/config/.rollback-image"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}================================================${NC}"
echo -e "${YELLOW}  CAC 360 - Rollback Docker Swarm${NC}"
echo -e "${YELLOW}================================================${NC}"

# Verificar se existe imagem de rollback
if [ ! -f "$ROLLBACK_FILE" ]; then
    echo -e "${RED}❌ Arquivo de rollback não encontrado em $ROLLBACK_FILE${NC}"
    echo "Tentando rollback via Docker Swarm..."
    docker service rollback ${STACK_NAME}_app
    exit $?
fi

PREVIOUS_IMAGE=$(cat $ROLLBACK_FILE)

if [ "$PREVIOUS_IMAGE" == "none" ] || [ -z "$PREVIOUS_IMAGE" ]; then
    echo -e "${RED}❌ Nenhuma imagem anterior registrada para rollback${NC}"
    exit 1
fi

echo -e "${YELLOW}Imagem anterior: $PREVIOUS_IMAGE${NC}"

# Confirmar rollback
echo -e "\n${YELLOW}⚠️  Isso irá reverter para a versão anterior.${NC}"
read -p "Continuar? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelado."
    exit 0
fi

# 1. Executar rollback
echo -e "\n${GREEN}1. Executando rollback para: $PREVIOUS_IMAGE${NC}"
docker service update \
    --image $PREVIOUS_IMAGE \
    --update-parallelism 1 \
    --update-delay 10s \
    ${STACK_NAME}_app

# 2. Aguardar rollback
echo -e "\n${GREEN}2. Aguardando rollback...${NC}"
sleep 10

# 3. Verificar status
echo -e "\n${GREEN}3. Status dos serviços:${NC}"
docker stack services $STACK_NAME

# 4. Verificar se o serviço está healthy
echo -e "\n${GREEN}4. Verificando saúde do serviço...${NC}"
TIMEOUT=90
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    RUNNING=$(docker service ls --filter "name=${STACK_NAME}_app" --format "{{.Replicas}}" | cut -d'/' -f1)
    DESIRED=$(docker service ls --filter "name=${STACK_NAME}_app" --format "{{.Replicas}}" | cut -d'/' -f2)
    
    if [ "$RUNNING" == "$DESIRED" ] && [ "$RUNNING" != "0" ]; then
        echo -e "${GREEN}✅ Rollback concluído! ($RUNNING/$DESIRED replicas)${NC}"
        break
    fi
    
    echo "Aguardando... ($RUNNING/$DESIRED replicas)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo -e "${RED}❌ Timeout no rollback. Verifique manualmente.${NC}"
    docker service logs ${STACK_NAME}_app --tail 50
    exit 1
fi

echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}  Rollback concluído com sucesso!${NC}"
echo -e "${GREEN}  Imagem: $PREVIOUS_IMAGE${NC}"
echo -e "${GREEN}================================================${NC}"
