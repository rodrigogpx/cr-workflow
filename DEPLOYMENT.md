# Manual de Implantação - Sistema de Workflow CR

Este documento fornece instruções detalhadas para implantação do Sistema de Workflow CR do Firing Range em ambiente de produção.

## Pré-requisitos

Antes de iniciar a implantação, certifique-se de que o ambiente atende aos seguintes requisitos técnicos.

### Requisitos de Software

O servidor deve possuir **Node.js versão 22 ou superior** instalado. Verifique a versão executando `node --version` no terminal. O gerenciador de pacotes **pnpm** deve estar disponível globalmente, instalável via `npm install -g pnpm`. Um banco de dados **MySQL 8.0 ou superior** deve estar configurado e acessível. O servidor Git deve estar instalado para clonagem do repositório.

### Requisitos de Infraestrutura

O servidor deve ter no mínimo 2GB de RAM disponível para execução estável da aplicação. Recomenda-se 2 CPUs ou mais para melhor desempenho em ambientes de produção. O armazenamento deve ter pelo menos 5GB de espaço livre para código, dependências e banco de dados. A conexão de rede deve permitir acesso às portas 3000 (aplicação) e 3306 (MySQL).

### Credenciais Necessárias

Antes de iniciar, obtenha as seguintes credenciais: token de acesso ao repositório GitHub (fornecido pelo administrador), credenciais do banco de dados MySQL (host, porta, usuário, senha, nome do banco), credenciais OAuth Manus (client ID e client secret) e chave secreta JWT para assinatura de tokens de autenticação.

## Clonagem do Repositório

O primeiro passo é obter o código-fonte do sistema a partir do repositório GitHub.

### Configuração de Acesso

Configure o Git com suas credenciais de usuário executando os seguintes comandos no terminal:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

### Clonagem do Código

Clone o repositório usando HTTPS com o token de acesso fornecido:

```bash
git clone https://SEU_TOKEN@github.com/rodrigogpx/cr-workflow.git
cd cr-workflow
```

Alternativamente, se você possui chave SSH configurada no GitHub, pode clonar via SSH:

```bash
git clone git@github.com:rodrigogpx/cr-workflow.git
cd cr-workflow
```

## Configuração do Banco de Dados

O sistema utiliza MySQL como banco de dados relacional. Esta seção orienta a criação e configuração do banco.

### Criação do Banco de Dados

Acesse o MySQL como administrador e crie um banco de dados dedicado para o sistema:

```sql
CREATE DATABASE firerange_workflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Crie um usuário específico para a aplicação com permissões adequadas:

```sql
CREATE USER 'firerange_user'@'localhost' IDENTIFIED BY 'senha_segura_aqui';
GRANT ALL PRIVILEGES ON firerange_workflow.* TO 'firerange_user'@'localhost';
FLUSH PRIVILEGES;
```

Substitua `senha_segura_aqui` por uma senha forte e única. Se o banco de dados estiver em servidor remoto, substitua `localhost` pelo endereço IP ou hostname apropriado.

### Configuração de Conexão

A string de conexão do banco de dados será configurada através de variáveis de ambiente na próxima seção. O formato esperado é:

```
mysql://usuario:senha@host:porta/nome_banco
```

Exemplo completo:

```
mysql://firerange_user:senha_segura_aqui@localhost:3306/firerange_workflow
```

## Configuração de Variáveis de Ambiente

O sistema utiliza variáveis de ambiente para configuração sensível que não deve ser versionada no código.

### Criação do Arquivo .env

Na raiz do projeto, crie um arquivo chamado `.env` com o seguinte conteúdo:

```env
# Banco de Dados
DATABASE_URL=mysql://firerange_user:senha_segura_aqui@localhost:3306/firerange_workflow

# Autenticação JWT
JWT_SECRET=chave_secreta_jwt_muito_longa_e_aleatoria_aqui

# OAuth Manus
OAUTH_SERVER_URL=https://api.manus.im
OWNER_NAME=Nome do Administrador
OWNER_OPEN_ID=id_oauth_do_administrador

# Aplicação
NODE_ENV=production
PORT=3000

# Frontend
VITE_APP_TITLE=Firing Range - Sistema de Workflow CR
VITE_APP_LOGO=/logo.webp
```

### Descrição das Variáveis

**DATABASE_URL** contém a string de conexão completa do MySQL conforme configurado na seção anterior. **JWT_SECRET** é uma chave secreta longa e aleatória usada para assinar tokens JWT de autenticação. Gere uma chave segura usando `openssl rand -base64 64`.

**OAUTH_SERVER_URL** aponta para o servidor OAuth Manus responsável pela autenticação. **OWNER_NAME** e **OWNER_OPEN_ID** identificam o administrador principal do sistema que terá acesso total.

**NODE_ENV** define o ambiente de execução (production para produção). **PORT** especifica a porta onde a aplicação será executada (padrão 3000).

**VITE_APP_TITLE** define o título exibido no navegador e na interface. **VITE_APP_LOGO** aponta para o caminho do logo do clube (arquivo deve estar em `client/public/`).

### Segurança das Variáveis

O arquivo `.env` contém informações sensíveis e **nunca deve ser commitado** no repositório Git. Certifique-se de que `.env` está listado no arquivo `.gitignore`. Em ambientes de produção, considere usar gerenciadores de segredos como AWS Secrets Manager, Azure Key Vault ou HashiCorp Vault.

## Instalação de Dependências

Com o repositório clonado e variáveis configuradas, instale todas as dependências do projeto.

### Instalação via pnpm

Execute o comando de instalação na raiz do projeto:

```bash
pnpm install
```

Este comando instalará todas as dependências listadas em `package.json` para frontend e backend. O processo pode levar alguns minutos dependendo da velocidade da conexão de internet.

### Verificação da Instalação

Após a conclusão, verifique se não houve erros no processo. A pasta `node_modules` deve ter sido criada contendo todas as bibliotecas necessárias.

## Migração do Banco de Dados

O sistema utiliza Drizzle ORM para gerenciamento de schema e migrações do banco de dados.

### Execução das Migrações

Execute o comando que sincroniza o schema definido no código com o banco de dados:

```bash
pnpm db:push
```

Este comando criará automaticamente todas as tabelas necessárias (clients, workflowSteps, emailTemplates, emailLogs, users) com suas respectivas colunas, índices e relacionamentos.

### Verificação das Tabelas

Conecte-se ao MySQL e verifique se as tabelas foram criadas corretamente:

```sql
USE firerange_workflow;
SHOW TABLES;
DESCRIBE clients;
DESCRIBE workflowSteps;
DESCRIBE emailTemplates;
DESCRIBE emailLogs;
DESCRIBE users;
```

Todas as cinco tabelas devem estar presentes com as colunas definidas no schema.

## Seed de Dados Iniciais

Para facilitar o primeiro uso do sistema, é recomendável popular o banco com dados iniciais.

### Templates de Email Padrão

Crie os três templates de email da etapa Boas Vindas executando os seguintes comandos SQL:

```sql
INSERT INTO emailTemplates (templateKey, subject, content, createdAt, updatedAt) VALUES
('welcome', 
 'Bem-vindo ao Firing Range!', 
 'Olá {{nome}},\n\nSeja bem-vindo ao clube Firing Range! Estamos felizes em tê-lo conosco.\n\nAtenciosamente,\nEquipe Firing Range',
 NOW(), NOW()),

('cr_process', 
 'Processo de Obtenção do CR', 
 'Olá {{nome}},\n\nEste email explica o processo completo para obtenção do seu Certificado de Registro (CR).\n\nO processo consiste em 6 etapas principais:\n1. Cadastro completo\n2. Avaliação Psicológica\n3. Laudo de Capacidade Técnica\n4. Juntada de Documentos\n5. Protocolo no Sinarm-CAC\n6. Acompanhamento até deferimento\n\nNossa equipe estará ao seu lado em cada etapa.\n\nAtenciosamente,\nEquipe Firing Range',
 NOW(), NOW()),

('status_update', 
 'Atualização de Status do seu CR', 
 'Olá {{nome}},\n\nGostaríamos de informar sobre o andamento do seu processo de obtenção do CR.\n\nSeu processo está em andamento e nossa equipe está trabalhando para concluir todas as etapas necessárias.\n\nEm caso de dúvidas, entre em contato conosco.\n\nAtenciosamente,\nEquipe Firing Range',
 NOW(), NOW());
```

### Usuário Administrador Inicial

O primeiro usuário administrador será criado automaticamente no primeiro login via OAuth Manus. Certifique-se de que as variáveis `OWNER_NAME` e `OWNER_OPEN_ID` no arquivo `.env` estão configuradas corretamente com os dados do administrador principal.

## Build da Aplicação

Antes de executar em produção, é necessário compilar o código TypeScript e gerar os assets otimizados do frontend.

### Build do Frontend

Execute o comando de build do Vite:

```bash
pnpm build:client
```

Este comando compilará todo o código React/TypeScript do frontend, aplicará otimizações de produção (minificação, tree-shaking, code splitting) e gerará os arquivos estáticos na pasta `dist/client`.

### Build do Backend

O backend TypeScript é compilado em tempo de execução pelo `tsx`. Não é necessário build separado, mas certifique-se de que o `tsx` está instalado nas dependências.

## Execução da Aplicação

Com tudo configurado, inicie a aplicação em modo de produção.

### Modo de Produção

Execute o comando de start:

```bash
pnpm start
```

A aplicação iniciará e ficará disponível na porta configurada (padrão 3000). Você verá mensagens no console indicando que o servidor está rodando:

```
[OAuth] Initialized with baseURL: https://api.manus.im
Server running on http://localhost:3000/
```

### Verificação de Funcionamento

Abra um navegador e acesse `http://localhost:3000` (ou o endereço do seu servidor). A tela de login deve aparecer. Faça login com uma conta Manus autorizada e verifique se o Dashboard carrega corretamente.

## Configuração de Processo Persistente

Para manter a aplicação rodando continuamente em produção, utilize um gerenciador de processos.

### Usando PM2

O PM2 é um gerenciador de processos robusto para aplicações Node.js. Instale-o globalmente:

```bash
npm install -g pm2
```

Inicie a aplicação com PM2:

```bash
pm2 start pnpm --name "firerange-workflow" -- start
```

Configure o PM2 para iniciar automaticamente no boot do servidor:

```bash
pm2 startup
pm2 save
```

### Comandos Úteis do PM2

Visualize o status da aplicação com `pm2 status`. Veja os logs em tempo real com `pm2 logs firerange-workflow`. Reinicie a aplicação com `pm2 restart firerange-workflow`. Pare a aplicação com `pm2 stop firerange-workflow`.

## Configuração de Proxy Reverso

Para expor a aplicação na porta 80/443 (HTTP/HTTPS) e adicionar SSL, configure um proxy reverso.

### Usando Nginx

Instale o Nginx no servidor:

```bash
sudo apt update
sudo apt install nginx
```

Crie um arquivo de configuração em `/etc/nginx/sites-available/firerange-workflow`:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative a configuração:

```bash
sudo ln -s /etc/nginx/sites-available/firerange-workflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Configuração de SSL com Let's Encrypt

Instale o Certbot para obter certificados SSL gratuitos:

```bash
sudo apt install certbot python3-certbot-nginx
```

Obtenha e configure o certificado automaticamente:

```bash
sudo certbot --nginx -d seu-dominio.com
```

O Certbot configurará automaticamente o Nginx para usar HTTPS e renovará os certificados automaticamente.

## Backup e Recuperação

Estabeleça rotinas de backup para proteger os dados do sistema.

### Backup do Banco de Dados

Crie um script de backup automático do MySQL:

```bash
#!/bin/bash
DATA=$(date +%Y%m%d_%H%M%S)
mysqldump -u firerange_user -p'senha_segura_aqui' firerange_workflow > /backups/firerange_$DATA.sql
find /backups -name "firerange_*.sql" -mtime +7 -delete
```

Salve o script como `/usr/local/bin/backup-firerange.sh`, torne-o executável com `chmod +x /usr/local/bin/backup-firerange.sh` e agende execução diária via cron:

```bash
0 2 * * * /usr/local/bin/backup-firerange.sh
```

### Backup de Arquivos

Faça backup regular da pasta do projeto (exceto `node_modules`) e do arquivo `.env`:

```bash
tar -czf /backups/firerange-files_$(date +%Y%m%d).tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    /caminho/para/cr-workflow
```

### Recuperação de Backup

Para restaurar o banco de dados a partir de um backup:

```bash
mysql -u firerange_user -p'senha_segura_aqui' firerange_workflow < /backups/firerange_20250118_020000.sql
```

## Monitoramento e Logs

Configure monitoramento adequado para detectar problemas rapidamente.

### Logs da Aplicação

Os logs do PM2 ficam em `~/.pm2/logs/`. Visualize logs em tempo real:

```bash
pm2 logs firerange-workflow --lines 100
```

Configure rotação de logs para evitar crescimento excessivo:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Monitoramento de Recursos

Use ferramentas como `htop` para monitorar uso de CPU e memória. Configure alertas de disco cheio e memória insuficiente. Monitore a disponibilidade do banco de dados MySQL.

### Logs de Acesso

O Nginx registra todos os acessos em `/var/log/nginx/access.log`. Analise logs regularmente para identificar padrões de uso e possíveis problemas.

## Atualizações do Sistema

Mantenha o sistema atualizado com as últimas melhorias e correções.

### Processo de Atualização

Faça backup completo antes de qualquer atualização. Navegue até a pasta do projeto e obtenha as últimas mudanças do repositório:

```bash
cd /caminho/para/cr-workflow
git pull github main
```

Instale novas dependências se houver:

```bash
pnpm install
```

Execute migrações de banco de dados se necessário:

```bash
pnpm db:push
```

Faça rebuild do frontend:

```bash
pnpm build:client
```

Reinicie a aplicação:

```bash
pm2 restart firerange-workflow
```

### Rollback em Caso de Problemas

Se a atualização causar problemas, reverta para a versão anterior:

```bash
git log --oneline  # Identifique o hash do commit anterior
git checkout HASH_DO_COMMIT_ANTERIOR
pnpm install
pnpm build:client
pm2 restart firerange-workflow
```

Restaure o backup do banco de dados se necessário.

## Troubleshooting

Soluções para problemas comuns durante implantação e operação.

### Erro de Conexão com Banco de Dados

Verifique se o MySQL está rodando com `sudo systemctl status mysql`. Confirme que as credenciais em `.env` estão corretas. Teste a conexão manualmente:

```bash
mysql -u firerange_user -p'senha_segura_aqui' -h localhost firerange_workflow
```

Verifique se o firewall permite conexões na porta 3306.

### Aplicação Não Inicia

Verifique os logs do PM2 com `pm2 logs firerange-workflow`. Confirme que todas as variáveis de ambiente estão configuradas. Verifique se a porta 3000 não está sendo usada por outro processo com `lsof -i :3000`.

### Erro 502 Bad Gateway no Nginx

Confirme que a aplicação está rodando com `pm2 status`. Verifique se o proxy_pass no Nginx aponta para a porta correta. Revise os logs do Nginx em `/var/log/nginx/error.log`.

### Problemas de Autenticação OAuth

Verifique se `OAUTH_SERVER_URL` está correto no `.env`. Confirme que o servidor tem acesso à internet para comunicar com `api.manus.im`. Verifique se as credenciais OAuth estão válidas.

## Segurança em Produção

Implemente medidas de segurança adicionais para proteger o sistema.

### Firewall

Configure firewall para permitir apenas portas necessárias:

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### Atualizações de Segurança

Mantenha o sistema operacional atualizado:

```bash
sudo apt update
sudo apt upgrade -y
```

Configure atualizações automáticas de segurança:

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Proteção contra Ataques

Configure fail2ban para proteger contra ataques de força bruta:

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Limite taxa de requisições no Nginx adicionando à configuração:

```nginx
limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;
limit_req zone=one burst=20;
```

## Suporte

Para assistência adicional durante implantação, consulte a documentação oficial das tecnologias utilizadas ou entre em contato com a equipe de desenvolvimento através do repositório GitHub.

---

**Manual elaborado pela ACR Digital para garantir implantação segura e estável do Sistema de Workflow CR**

© 2025 ACR Digital - Todos os direitos reservados
