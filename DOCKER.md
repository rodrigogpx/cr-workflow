# 🐳 Guia Docker - CAC 360

Este documento fornece instruções completas para executar o Sistema CAC 360 localmente usando Docker Desktop. A configuração Docker simplifica significativamente o processo de implantação ao encapsular toda a aplicação e suas dependências em containers isolados.

---

## 🏗️ Visão Geral da Arquitetura Docker

O sistema utiliza uma arquitetura multi-container orquestrada pelo Docker Compose, composta por **4 serviços principais** que se comunicam através de uma rede privada:

1. **PostgreSQL 16** - Banco de dados multi-tenant com volume persistente
2. **Node.js App** - Aplicação completa (React + tRPC) com build multi-stage
3. **Nginx** - Reverse proxy com SSL/TLS e rate limiting
4. **Certbot** - Gerenciamento automático de certificados Let's Encrypt

A estratégia de build multi-stage separa a construção do frontend da imagem final de produção. No primeiro estágio, todo o código fonte é compilado e o frontend é construído usando Vite. No segundo estágio, apenas os arquivos necessários para execução são copiados, resultando em uma imagem significativamente menor e mais segura.

---

## ✅ Pré-requisitos

Antes de iniciar, certifique-se de que seu ambiente de desenvolvimento possui os seguintes componentes instalados e configurados corretamente.

### Docker Desktop

O Docker Desktop é necessário para executar containers Docker em sistemas Windows, macOS e Linux. Faça o download da versão mais recente através do site oficial [docker.com](https://www.docker.com/products/docker-desktop). Após a instalação, verifique se o Docker está funcionando corretamente executando o comando `docker --version` no terminal.

O Docker Desktop inclui automaticamente o Docker Compose, ferramenta essencial para orquestrar múltiplos containers. Verifique a instalação com `docker-compose --version`. Certifique-se de que o Docker Desktop está em execução antes de prosseguir.

### Git

O Git é necessário para clonar o repositório do projeto. Caso ainda não tenha instalado, baixe a versão apropriada para seu sistema operacional através do site [git-scm.com](https://git-scm.com/downloads).

### Recursos do Sistema

O sistema requer recursos mínimos de hardware para funcionar adequadamente. Recomenda-se pelo menos **4GB de RAM disponível**, sendo que o Docker Desktop sozinho pode consumir entre 2-3GB dependendo da configuração. O espaço em disco necessário é de aproximadamente **2GB** para as imagens Docker e volumes de dados. Processadores modernos multi-core proporcionam melhor desempenho, especialmente durante o processo de build inicial.

---

## 🚀 Configuração Inicial

O processo de configuração envolve clonar o repositório, configurar variáveis de ambiente e preparar o sistema para execução.

### Clonando o Repositório

Abra o terminal e navegue até o diretório onde deseja armazenar o projeto. Execute o comando de clonagem do repositório Git:

```bash
git clone git@github.com:rodrigogpx/cr-workflow.git
cd cr-workflow
```

Este comando cria uma cópia local completa do repositório, incluindo todo o histórico de commits e branches.

### Configurando Variáveis de Ambiente

As variáveis de ambiente controlam aspectos críticos da aplicação. Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
# Banco de Dados (PostgreSQL)
DB_NAME=cac360_platform
DB_USER=cac360
DB_PASSWORD=sua_senha_forte_aqui
DB_PORT=5432

# Aplicação
NODE_ENV=development
PORT=3000

# Autenticação
JWT_SECRET=gere_uma_chave_aleatoria_com_openssl_rand_base64_32
SECRET_KEY=gere_outra_chave_aleatoria_com_openssl_rand_base64_32
INSTALL_TOKEN=cac360rodrigoparreira
INSTALL_WIZARD_ENABLED=true

# Frontend
VITE_APP_TITLE=CAC 360 – Gestão de Ciclo Completo
VITE_APP_LOGO=/logo.png

# SMTP (Email)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key
SMTP_FROM=CAC 360 <noreply@cac360.com.br>

# Storage (S3/R2)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=sa-east-1
AWS_BUCKET_NAME=firing-range-documentos

# Domínio
DOMAIN=localhost
```

**Importante:** Para gerar chaves seguras, utilize os comandos:

```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Gerar SECRET_KEY
openssl rand -base64 32
```

Nunca compartilhe o arquivo `.env` ou faça commit dele no repositório Git, pois contém informações sensíveis.

### Entendendo as Variáveis

| Variável          | Descrição                                | Exemplo                     |
| ----------------- | ---------------------------------------- | --------------------------- |
| `DB_NAME`         | Nome do banco de dados PostgreSQL        | `cac360_platform`           |
| `DB_USER`         | Usuário do PostgreSQL                    | `cac360`                    |
| `DB_PASSWORD`     | Senha do usuário PostgreSQL              | `senha_forte_123`           |
| `DB_PORT`         | Porta do PostgreSQL                      | `5432`                      |
| `JWT_SECRET`      | Chave para assinatura de tokens JWT      | `resultado_do_openssl_rand` |
| `SECRET_KEY`      | Chave para criptografia de dados         | `resultado_do_openssl_rand` |
| `INSTALL_TOKEN`   | Token para acesso ao Install Wizard      | `cac360rodrigoparreira`     |
| `SMTP_HOST`       | Servidor SMTP para envio de emails       | `smtp.sendgrid.net`         |
| `AWS_BUCKET_NAME` | Bucket S3 para armazenamento de arquivos | `firing-range-documentos`   |

---

## 🏃 Executando a Aplicação

Com a configuração concluída, o processo de execução é simples e direto através do Docker Compose.

### Build e Inicialização

Execute o seguinte comando na raiz do projeto para construir as imagens Docker e iniciar todos os serviços:

```bash
docker-compose up --build
```

Este comando irá:

1. Construir a imagem Docker da aplicação (multi-stage)
2. Baixar a imagem PostgreSQL 16
3. Baixar a imagem Nginx
4. Criar a rede privada entre containers
5. Iniciar todos os serviços

O processo pode levar alguns minutos na primeira execução. Você verá logs de cada container no terminal.

### Acessando a Aplicação

Após a conclusão do build e inicialização, a aplicação estará disponível em:

- **Frontend:** http://localhost:3000
- **API:** http://localhost:3000/api
- **Health Check:** http://localhost:3000/api/health

### Parando os Serviços

Para parar todos os containers, pressione `Ctrl+C` no terminal ou execute:

```bash
docker-compose down
```

Para remover também os volumes (dados do banco), use:

```bash
docker-compose down -v
```

---

## 🔍 Verificando Status

### Listar Containers

```bash
docker-compose ps
```

### Ver Logs de um Serviço

```bash
# Logs da aplicação
docker-compose logs -f app

# Logs do PostgreSQL
docker-compose logs -f postgres

# Logs do Nginx
docker-compose logs -f nginx

# Logs do Certbot
docker-compose logs -f certbot
```

### Acessar Container Interativamente

```bash
# Acessar shell da aplicação
docker-compose exec app sh

# Acessar PostgreSQL
docker-compose exec postgres psql -U cac360 -d cac360_platform
```

---

## 🗄️ Banco de Dados

### Conectar ao PostgreSQL

```bash
docker-compose exec postgres psql -U cac360 -d cac360_platform
```

### Comandos Úteis do PostgreSQL

```sql
-- Listar bancos de dados
\l

-- Conectar a um banco
\c cac360_platform

-- Listar tabelas
\dt

-- Ver estrutura de uma tabela
\d tenants

-- Sair
\q
```

### Backup do Banco

```bash
docker-compose exec postgres pg_dump -U cac360 cac360_platform > backup.sql
```

### Restaurar Backup

```bash
docker-compose exec -T postgres psql -U cac360 cac360_platform < backup.sql
```

---

## 🔧 Troubleshooting

### Porta 3000 já está em uso

Se a porta 3000 já está em uso, você pode mudar a porta no `.env`:

```env
PORT=3001
```

Ou parar o serviço que está usando a porta:

```bash
# Encontrar processo usando porta 3000
lsof -i :3000

# Matar processo
kill -9 <PID>
```

### Erro de conexão com banco de dados

Verifique se o container PostgreSQL está rodando:

```bash
docker-compose ps postgres

# Se não estiver rodando, reinicie
docker-compose restart postgres
```

### Erro de permissão no Docker

Se receber erro de permissão, adicione seu usuário ao grupo docker:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Limpar tudo e começar do zero

```bash
# Parar containers
docker-compose down -v

# Remover imagens
docker-compose rm -f

# Remover volumes
docker volume prune

# Reconstruir
docker-compose up --build
```

---

## 📚 Arquivos de Configuração

### docker-compose.yml

Define todos os serviços (app, postgres, nginx, certbot), volumes, networks e variáveis de ambiente.

### Dockerfile

Implementa build multi-stage:

- **Stage 1:** Build do frontend (React + Vite)
- **Stage 2:** Imagem final com backend + frontend compilado

### nginx/nginx.conf

Configuração do Nginx como reverse proxy com:

- SSL/TLS (Let's Encrypt)
- Rate limiting
- Security headers
- Compressão Gzip

---

## 🚀 Deploy em Produção

Para deploy em produção no GCP, consulte [GCP-DOCKER-DEPLOY.md](./GCP-DOCKER-DEPLOY.md).

---

## 📖 Referências

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Última atualização:** 13 de Janeiro de 2026
