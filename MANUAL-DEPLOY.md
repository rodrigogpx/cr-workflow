# Guia de Deploy Manual - CAC 360

Este documento descreve os passos necessários para realizar o deploy manual do sistema CAC 360 em um ambiente Docker Swarm, caso o CI/CD (GitHub Actions) não esteja disponível ou seja necessário um deploy emergencial.

---

## 📋 Pré-requisitos

1.  **Acesso ao Servidor**: Conexão SSH com o Manager do cluster.
2.  **Imagens Docker**: As imagens devem estar disponíveis no GitHub Container Registry (GHCR).
3.  **Variáveis de Ambiente**: Arquivo `/opt/cac360/config/.env` configurado no servidor.

---

## 🚀 Passo a Passo (Manual)

### 1. Conectar ao Servidor
```bash
ssh deploy@<IP_DO_SERVIDOR>
```

### 2. Login no Registro de Imagens
Caso ainda não tenha feito login no GHCR no servidor:
```bash
echo "SEU_GITHUB_PAT" | docker login ghcr.io -u SEU_USUARIO --password-stdin
```

### 3. Atualizar o Código Local (Opcional)
Se houver mudanças nos arquivos de configuração (`docker-compose.swarm.yml`, scripts):
```bash
cd /opt/cac360/cr-workflow
git pull origin hml
```

### 4. Pull das Imagens Mais Recentes
```bash
# Para Homologação
docker pull ghcr.io/rodrigogpx/cr-workflow:hml

# Para Produção
docker pull ghcr.io/rodrigogpx/cr-workflow:latest
```

### 5. Executar o Deploy da Stack

#### Ambiente de Homologação (HML)
```bash
docker stack deploy \
  -c docker-compose.swarm.yml \
  --with-registry-auth \
  cac360-hml
```

#### Ambiente de Produção (PROD)
```bash
docker stack deploy \
  -c docker-compose.swarm.yml \
  --with-registry-auth \
  cac360
```

---

## 🛠️ Comandos de Verificação

### Verificar status dos serviços
```bash
docker stack services cac360-hml
```

### Verificar logs em tempo real
```bash
docker service logs cac360-hml_app -f --tail 100
```

### Forçar a reinicialização de um serviço específico
```bash
docker service update --force cac360-hml_app
```

---

## 🔄 Procedimento de Rollback Manual

Se o deploy apresentar erros, retorne para a imagem estável anterior:

1.  **Identificar imagem anterior**:
    ```bash
    cat /opt/cac360/config/.rollback-image
    ```

2.  **Executar rollback**:
    ```bash
    docker service update --image <URL_DA_IMAGEM_ANTERIOR> cac360-hml_app
    ```

---

## ⚠️ Observações Importantes

*   **Persistência**: Nunca remova os volumes em `/opt/cac360/data/postgres` manualmente, pois isso apagará os dados do banco.
*   **Segredos**: Se alterar segredos no `.env`, é necessário reiniciar os serviços para que as mudanças surtam efeito.
