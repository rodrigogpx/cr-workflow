# Guia de Execução Local com Docker

Este documento fornece instruções completas para executar o Sistema de Workflow CR do Firing Range localmente usando Docker Desktop. A configuração Docker simplifica significativamente o processo de implantação ao encapsular toda a aplicação e suas dependências em containers isolados.

## Visão Geral da Arquitetura Docker

O sistema utiliza uma arquitetura multi-container orquestrada pelo Docker Compose, composta por dois serviços principais que se comunicam através de uma rede privada. O serviço **mysql** executa o banco de dados MySQL 8.0 com volume persistente para garantir que os dados não sejam perdidos entre reinicializações dos containers. O serviço **app** contém a aplicação Node.js completa, incluindo frontend React e backend tRPC, construída através de um processo de build multi-stage que otimiza o tamanho final da imagem.

A estratégia de build multi-stage separa a construção do frontend da imagem final de produção. No primeiro estágio, todo o código fonte é compilado e o frontend é construído usando Vite. No segundo estágio, apenas os arquivos necessários para execução são copiados, resultando em uma imagem significativamente menor e mais segura. Esta abordagem também permite que o build do frontend utilize todas as ferramentas de desenvolvimento sem incluí-las na imagem final.

## Pré-requisitos

Antes de iniciar, certifique-se de que seu ambiente de desenvolvimento possui os seguintes componentes instalados e configurados corretamente.

### Docker Desktop

O Docker Desktop é necessário para executar containers Docker em sistemas Windows, macOS e Linux. Faça o download da versão mais recente através do site oficial [docker.com](https://www.docker.com/products/docker-desktop). Após a instalação, verifique se o Docker está funcionando corretamente executando o comando `docker --version` no terminal, que deve retornar a versão instalada.

O Docker Desktop inclui automaticamente o Docker Compose, ferramenta essencial para orquestrar múltiplos containers. Verifique a instalação do Compose com o comando `docker-compose --version`. Certifique-se de que o Docker Desktop está em execução antes de prosseguir com os próximos passos.

### Git

O Git é necessário para clonar o repositório do projeto. Caso ainda não tenha instalado, baixe a versão apropriada para seu sistema operacional através do site [git-scm.com](https://git-scm.com/downloads). Após a instalação, configure suas credenciais do GitHub se planeja fazer alterações no código.

### Recursos do Sistema

O sistema requer recursos mínimos de hardware para funcionar adequadamente. Recomenda-se pelo menos 4GB de RAM disponível, sendo que o Docker Desktop sozinho pode consumir entre 2-3GB dependendo da configuração. O espaço em disco necessário é de aproximadamente 2GB para as imagens Docker e volumes de dados. Processadores modernos multi-core proporcionam melhor desempenho, especialmente durante o processo de build inicial.

## Configuração Inicial

O processo de configuração envolve clonar o repositório, configurar variáveis de ambiente e preparar o sistema para execução.

### Clonando o Repositório

Abra o terminal e navegue até o diretório onde deseja armazenar o projeto. Execute o comando de clonagem do repositório Git:

```bash
git clone git@github.com:rodrigogpx/cr-workflow.git
cd cr-workflow
```

Este comando cria uma cópia local completa do repositório, incluindo todo o histórico de commits e branches. O diretório `cr-workflow` conterá todos os arquivos necessários para executar a aplicação.

### Configurando Variáveis de Ambiente

As variáveis de ambiente controlam aspectos críticos da aplicação, incluindo credenciais de banco de dados, chaves de segurança e configurações de autenticação. Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo mínimo:

```env
# Banco de Dados
MYSQL_ROOT_PASSWORD=senha_root_segura_aqui
MYSQL_DATABASE=firerange_workflow
MYSQL_USER=firerange_user
MYSQL_PASSWORD=senha_usuario_segura_aqui
MYSQL_PORT=3306

# Aplicação
APP_PORT=3000
NODE_ENV=production

# Autenticação JWT
JWT_SECRET=chave_jwt_muito_longa_e_aleatoria_gerada_com_openssl

# OAuth Manus (necessário para autenticação)
OAUTH_SERVER_URL=https://api.manus.im
OWNER_NAME=Seu Nome Completo
OWNER_OPEN_ID=seu_id_oauth_manus

# Frontend
VITE_APP_TITLE=Firing Range - Sistema de Workflow CR
VITE_APP_LOGO=/logo.webp
```

**Importante:** Substitua todos os valores placeholder por credenciais reais e seguras. Para gerar uma chave JWT forte, utilize o comando `openssl rand -base64 64` no terminal. Nunca compartilhe o arquivo `.env` ou faça commit dele no repositório Git, pois contém informações sensíveis.

### Entendendo as Variáveis

A tabela abaixo descreve cada variável de ambiente e seu propósito no sistema:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `MYSQL_ROOT_PASSWORD` | Senha do usuário root do MySQL | `minha_senha_root_123` |
| `MYSQL_DATABASE` | Nome do banco de dados a ser criado | `firerange_workflow` |
| `MYSQL_USER` | Usuário do MySQL para a aplicação | `firerange_user` |
| `MYSQL_PASSWORD` | Senha do usuário da aplicação | `senha_usuario_456` |
| `MYSQL_PORT` | Porta externa do MySQL | `3306` |
| `APP_PORT` | Porta externa da aplicação web | `3000` |
| `JWT_SECRET` | Chave secreta para assinatura de tokens JWT | `resultado_do_openssl_rand` |
| `OAUTH_SERVER_URL` | URL do servidor OAuth Manus | `https://api.manus.im` |
| `OWNER_NAME` | Nome do administrador principal | `João Silva` |
| `OWNER_OPEN_ID` | ID OAuth do administrador | `abc123xyz` |

## Executando a Aplicação

Com a configuração concluída, o processo de execução é simples e direto através do Docker Compose.

### Build e Inicialização

Execute o seguinte comando na raiz do projeto para construir as imagens Docker e iniciar todos os serviços:

```bash
docker-compose up --build
```

O parâmetro `--build` força a reconstrução das imagens, garantindo que todas as alterações recentes sejam incluídas. Este processo pode levar alguns minutos na primeira execução, pois precisa baixar as imagens base do Node.js e MySQL, instalar todas as dependências npm e compilar o código fonte.

Durante a inicialização, você verá logs de ambos os containers no terminal. O container MySQL será iniciado primeiro e executará seu processo de inicialização, criando o banco de dados especificado. Após o MySQL estar saudável (health check aprovado), o container da aplicação iniciará, executará as migrações do banco de dados automaticamente através do comando `pnpm db:push` e finalmente iniciará o servidor web.

### Verificando a Execução

Quando a aplicação estiver pronta, você verá mensagens indicando que o servidor está rodando. Abra seu navegador e acesse `http://localhost:3000` para visualizar a interface do sistema. A primeira tela deve ser a página de login, onde você pode autenticar usando suas credenciais OAuth configuradas.

Para verificar o status dos containers em execução, abra um novo terminal e execute:

```bash
docker-compose ps
```

Este comando lista todos os containers do projeto, mostrando seus nomes, status e portas expostas. Ambos os containers devem estar com status "Up".

### Executando em Background

Para executar os containers em background (modo detached), permitindo que você continue usando o terminal, utilize o parâmetro `-d`:

```bash
docker-compose up -d
```

Neste modo, os logs não são exibidos automaticamente no terminal. Para visualizar os logs de um serviço específico, use:

```bash
docker-compose logs -f app
docker-compose logs -f mysql
```

O parâmetro `-f` (follow) mantém o terminal conectado aos logs, exibindo novas mensagens conforme são geradas.

## Gerenciamento de Containers

O Docker Compose fornece diversos comandos para gerenciar o ciclo de vida dos containers.

### Parando a Aplicação

Para parar todos os containers sem removê-los, execute:

```bash
docker-compose stop
```

Este comando preserva o estado dos containers, permitindo reiniciá-los rapidamente com `docker-compose start`. Os dados no volume do MySQL são mantidos intactos.

### Removendo Containers

Para parar e remover completamente os containers, execute:

```bash
docker-compose down
```

Este comando remove os containers e a rede criada, mas **preserva os volumes de dados**. O banco de dados MySQL não será perdido. Para remover também os volumes (apagando todos os dados), adicione o parâmetro `-v`:

```bash
docker-compose down -v
```

**Atenção:** O comando acima apaga permanentemente todos os dados do banco de dados. Use apenas quando quiser começar do zero.

### Reiniciando Serviços

Para reiniciar um serviço específico sem afetar os outros:

```bash
docker-compose restart app
docker-compose restart mysql
```

Este comando é útil após fazer alterações em variáveis de ambiente ou quando um serviço apresenta problemas.

## Acessando o Banco de Dados

Durante o desenvolvimento, pode ser necessário acessar diretamente o banco de dados MySQL para inspeção ou depuração.

### Via Linha de Comando

Para abrir um shell MySQL dentro do container, execute:

```bash
docker-compose exec mysql mysql -u firerange_user -p firerange_workflow
```

Quando solicitado, digite a senha configurada em `MYSQL_PASSWORD`. Você terá acesso completo ao banco de dados através do cliente MySQL interativo.

### Via Ferramentas Externas

Ferramentas gráficas como MySQL Workbench, DBeaver ou phpMyAdmin podem conectar ao banco de dados usando as seguintes configurações:

- **Host:** `localhost`
- **Porta:** `3306` (ou valor de `MYSQL_PORT`)
- **Usuário:** valor de `MYSQL_USER`
- **Senha:** valor de `MYSQL_PASSWORD`
- **Banco de Dados:** valor de `MYSQL_DATABASE`

## Desenvolvimento com Docker

Para desenvolvimento ativo com hot-reload, o Docker pode não ser a melhor opção devido à latência na sincronização de arquivos. Considere executar a aplicação diretamente no host durante o desenvolvimento e usar Docker apenas para o banco de dados:

```bash
# Iniciar apenas o MySQL
docker-compose up mysql

# Em outro terminal, executar a aplicação localmente
pnpm install
pnpm dev
```

Esta abordagem híbrida oferece a conveniência do Docker para o banco de dados enquanto mantém a velocidade de desenvolvimento local para o código da aplicação.

## Troubleshooting

Esta seção aborda problemas comuns e suas soluções.

### Porta Já em Uso

Se você receber erro indicando que a porta 3000 ou 3306 já está em uso, outro processo está utilizando essas portas. Identifique o processo com:

```bash
# Windows
netstat -ano | findstr :3000

# macOS/Linux
lsof -i :3000
```

Você pode encerrar o processo conflitante ou alterar as portas no arquivo `.env` modificando `APP_PORT` e `MYSQL_PORT`.

### Erro de Conexão com Banco de Dados

Se a aplicação não conseguir conectar ao MySQL, verifique se o container do banco de dados está saudável:

```bash
docker-compose ps
docker-compose logs mysql
```

O health check do MySQL pode levar alguns segundos para aprovar. Se o problema persistir, verifique as credenciais no arquivo `.env` e certifique-se de que correspondem às configuradas no `docker-compose.yml`.

### Erro de Build

Se o build falhar, verifique se há espaço em disco suficiente e se todas as dependências do `package.json` estão corretas. Limpe o cache do Docker e tente novamente:

```bash
docker system prune -a
docker-compose build --no-cache
```

### Permissões no Linux

Em sistemas Linux, pode ser necessário executar comandos Docker com `sudo` ou adicionar seu usuário ao grupo docker:

```bash
sudo usermod -aG docker $USER
```

Após executar este comando, faça logout e login novamente para que as alterações tenham efeito.

## Backup e Restauração

O volume do MySQL contém todos os dados críticos do sistema. Para fazer backup:

```bash
docker-compose exec mysql mysqldump -u firerange_user -p firerange_workflow > backup.sql
```

Para restaurar um backup:

```bash
docker-compose exec -T mysql mysql -u firerange_user -p firerange_workflow < backup.sql
```

Recomenda-se realizar backups regulares, especialmente antes de atualizações importantes ou mudanças no schema do banco de dados.

## Atualizações

Para atualizar a aplicação com novas versões do código:

```bash
# Parar containers
docker-compose down

# Atualizar código
git pull origin main

# Rebuild e reiniciar
docker-compose up --build
```

As migrações de banco de dados são executadas automaticamente durante a inicialização do container da aplicação.

## Segurança

Ao executar em ambiente de produção, considere as seguintes práticas de segurança:

O arquivo `.env` deve ter permissões restritas (chmod 600) e nunca ser commitado no repositório Git. Use senhas fortes e únicas para todas as credenciais, especialmente `MYSQL_ROOT_PASSWORD` e `JWT_SECRET`. Configure um firewall para restringir acesso às portas expostas apenas a IPs confiáveis. Considere usar Docker Secrets ou ferramentas de gerenciamento de segredos como HashiCorp Vault para ambientes de produção.

Atualize regularmente as imagens base do Docker para incluir patches de segurança. Execute `docker-compose pull` periodicamente para baixar versões atualizadas das imagens do MySQL e Node.js.

## Recursos Adicionais

Para informações mais detalhadas sobre implantação em produção, consulte o arquivo `DEPLOYMENT.md` incluído no repositório. A documentação oficial do Docker está disponível em [docs.docker.com](https://docs.docker.com), oferecendo guias aprofundados sobre todos os aspectos do Docker e Docker Compose.

---

**Guia elaborado pela ACR Digital para facilitar o desenvolvimento local do Sistema de Workflow CR**

© 2025 ACR Digital - Todos os direitos reservados
