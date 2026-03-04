# CAC 360

**Plataforma completa de gestão de processos para Colecionadores, Atiradores e Caçadores (CAC)**

Sistema SaaS multi-tenant para clubes de tiro gerenciarem todo o ciclo de vida dos processos de seus associados: Concessão, Apostilamento, Renovação e acompanhamento junto ao Sinarm/Exército.

---

## 🎯 Visão Geral

O **CAC 360** é uma plataforma moderna que automatiza e gerencia todo o processo de obtenção e manutenção de registros de armas de fogo para membros de clubes de tiro. O sistema oferece:

- **Arquitetura Multi-Tenant**: Cada clube opera em ambiente isolado com dados, configurações e branding próprios
- **Workflow Completo**: 6 etapas do cadastro até aprovação no Sinarm
- **Automação de Emails**: Triggers configuráveis para envio automático baseado em ações
- **Gestão de Documentos**: Upload, organização e geração de "enxoval" de documentos
- **Auditoria Completa**: Rastreamento de todas as ações do sistema
- **Multi-perfil**: Admin, Operador e Despachante com permissões específicas

---

## ✨ Funcionalidades

### 🏢 Multi-Tenancy

- **Isolamento completo**: Cada clube possui banco de dados separado
- **Branding personalizado**: Logo, cores e nome do clube
- **SMTP próprio**: Configuração de servidor de email por tenant
- **Subdomínios**: `clube.cac360.com.br`
- **Planos**: Starter, Professional, Enterprise com limites configuráveis

### 👥 Gestão de Clientes

| Funcionalidade | Descrição |
|----------------|-----------|
| Cadastro completo | Dados pessoais, documentos, endereço, filiação |
| Workflow individual | 6 etapas com progresso em tempo real |
| Vínculo com operador | Cada cliente atribuído a um responsável |
| Histórico de emails | Registro de todas as comunicações |
| Dashboard visual | Cards com indicador de progresso |
| Mascaramento de dados | CPF, telefone e email mascarados por padrão com toggle Eye/EyeOff |
| Cadastrar Cliente no header | Botão "Cadastrar Cliente" disponível diretamente no menu superior |

### 📋 Workflow de 6 Etapas

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: INICIAL                                                │
│  ├── 1. Central de Mensagens (Boas-Vindas)                     │
│  └── 2. Cadastro (Dados pessoais completos)                    │
├─────────────────────────────────────────────────────────────────┤
│  FASE 2: LAUDOS E AVALIAÇÕES                                   │
│  ├── 3. Avaliação Psicológica (Agendamento + Lembrete 24h)     │
│  └── 4. Laudo de Capacidade Técnica (Agendamento + Lembrete)   │
├─────────────────────────────────────────────────────────────────┤
│  FASE 3: FINALIZAÇÃO                                           │
│  ├── 5. Juntada de Documentos (16 documentos obrigatórios)     │
│  └── 6. Acompanhamento Sinarm-CAC (Status + Protocolo)         │
└─────────────────────────────────────────────────────────────────┘
```

### ⚡ Automação de Emails (Email Triggers)

Sistema flexível de triggers para envio automático de emails:

**Eventos Disponíveis:**
- `CLIENT_CREATED` - Cliente cadastrado
- `STEP_COMPLETED:X` - Etapa X concluída
- `SCHEDULE_PSYCH_CREATED` - Agendamento psicológico criado
- `SCHEDULE_TECH_CREATED` - Agendamento de laudo técnico
- `SINARM_STATUS:X` - Mudança de status no Sinarm

**Configurações:**
- **Destinatários flexíveis**: Cliente, Operador, Usuários específicos ou combinações
- **Envio imediato**: Email enviado no momento da ação
- **Lembretes agendados**: Envio X horas antes de eventos (ex: 24h antes do agendamento)
- **Múltiplos templates**: Vincular vários templates a um trigger

**Variáveis dinâmicas:**
```
{{nome}}, {{email}}, {{cpf}}, {{telefone}}
{{data}}, {{dataAgendamento}}, {{examinador}}
{{sinarmStatus}}, {{protocolNumber}}
```

### 📄 Gestão de Documentos

- **16 tipos de documentos** obrigatórios para processo CR
- **Upload direto** com armazenamento seguro (S3/R2)
- **Geração de Enxoval**: PDF consolidado com todos os documentos
- **Controle de status**: Pendente, Enviado, Aprovado
- **Visualização inline**: Preview de documentos no sistema

### 📧 Templates de Email

- **Editor visual** com HTML rico
- **Anexos configuráveis** por template
- **Preview em tempo real**
- **Variáveis dinâmicas** substituídas automaticamente
- **Histórico de envios** por cliente

### 👤 Perfis de Acesso

| Perfil | Clientes | Etapas | Documentos | Admin |
|--------|----------|--------|------------|-------|
| **Admin** | Todos | Todas | Upload/Delete | ✅ |
| **Operador** | Próprios | Todas | Upload/Delete | ❌ |
| **Despachante** | Com Juntada OK | 1,2,6 | Apenas Download | ❌ |

**Detalhes do Despachante:**
- Vê apenas clientes com "Juntada de Documentos" concluída
- Acesso às etapas: Cadastro, Juntada, Acompanhamento Sinarm
- Pode gerar/baixar Enxoval, atualizar status Sinarm
- Não pode fazer upload ou excluir documentos

### 📊 Dashboard Inteligente

O Dashboard foi completamente reorganizado para melhor acompanhamento operacional:

**Primeira linha — Visão Geral:**
| Card | Descrição |
|------|-----------|
| Todos os Clientes | Total de clientes cadastrados no sistema |
| Aguardando Abertura do Processo | Clientes sem número de protocolo registrado |
| Workflow Concluído | Clientes que finalizaram todas as etapas |

**Segunda linha — Fases do Workflow:**
- Cadastro Pendente, Avaliação Psicológica Pendente, Laudo Técnico Pendente, Juntada de Documentos Pendente

**Terceira linha — Acompanhamento SINARM CAC:**
- Solicitado, Aguardando Baixa GRU, Em Análise, Restituído, Deferido, Indeferido

**Funcionalidades do Dashboard:**
- **Filtro global**: Busca por nome, CPF ou email em tempo real
- **Filtro por operador**: Visualização segmentada por responsável
- **Clique nos cards**: Abre painel lateral com lista filtrada de clientes
- **Mascaramento de dados**: CPF, telefone e email mascarados por padrão (toggle Eye/EyeOff)
- **Exportar Relatório PDF**: Exportação da lista de clientes por fase
- **Cadastrar Cliente**: Botão no menu superior para acesso rápido
- **Números centralizados**: Contadores alinhados ao centro em todos os cards

### 🔐 Privacidade e Mascaramento de Dados

Para proteção de dados sensíveis dos clientes:

- **CPF**: Exibido como `123***456**` por padrão
- **Telefone**: Exibido como `(61)*****-4237` por padrão
- **Email**: Exibido como `abc***@dominio.com` por padrão
- **Botão Eye/EyeOff**: Alterna entre dados mascarados e completos na lista e no modal de detalhes
- **Compatível com múltiplos formatos**: Funciona com CPFs formatados (`123.456.789-00`) e dígitos puros

### 📊 Relatórios e Auditoria

- **Log de todas as ações**: CREATE, UPDATE, DELETE, LOGIN
- **Filtros avançados**: Por período, usuário, ação, entidade
- **Exportação CSV**: Download do relatório completo
- **Rastreamento de IP**: Registro de origem das ações

### ⚙️ Configurações por Tenant

- **SMTP personalizado**: Host, porta, usuário, senha, SSL
- **Teste de conexão**: Verificação em tempo real
- **Logo e branding**: Personalização visual
- **Limites**: Usuários, clientes, armazenamento

---

## 🛠️ Tecnologias

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 19 | UI Framework |
| TypeScript | 5.x | Tipagem estática |
| Tailwind CSS | 4 | Estilização |
| shadcn/ui | - | Componentes |
| TanStack Query | 5 | Estado assíncrono |
| Wouter | 3 | Roteamento |
| Vite | 6 | Build tool |

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | 22 | Runtime |
| tRPC | 11 | API type-safe |
| Drizzle ORM | - | Database |
| PostgreSQL | 16 | Banco de dados |
| Nodemailer | - | Envio de emails |

### Infraestrutura
| Serviço | Uso |
|---------|-----|
| Google Cloud Platform (GCP) | Compute Engine + Cloud DNS |
| Docker Compose | Orquestração de containers |
| Nginx | Reverse proxy + SSL/TLS |
| Let's Encrypt | Certificados SSL automáticos |
| PostgreSQL 16 | Banco de dados multi-tenant |
| Cloudflare R2 | Armazenamento de arquivos (S3-compatible) |

---

## 📁 Estrutura do Projeto

```
cac-360/
├── client/                     # Frontend React
│   └── src/
│       ├── components/         # Componentes reutilizáveis
│       │   ├── ui/            # shadcn/ui
│       │   ├── TenantAdminLayout.tsx
│       │   └── EmailEditor.tsx
│       ├── pages/             # Páginas da aplicação
│       │   ├── Dashboard.tsx
│       │   ├── ClientWorkflow.tsx
│       │   ├── AdminDashboard.tsx
│       │   ├── AdminUsers.tsx
│       │   ├── AdminOperators.tsx
│       │   ├── AdminEmails.tsx
│       │   ├── AdminEmailTriggers.tsx
│       │   ├── AdminAudit.tsx
│       │   └── TenantSettings.tsx
│       └── _core/             # Hooks e utilitários
├── server/                     # Backend Node.js
│   ├── _core/                 # Core (auth, trpc, cookies)
│   ├── config/                # Configurações
│   │   └── tenant.config.ts   # Resolução de tenants
│   ├── db.ts                  # Funções de banco
│   ├── routers.ts             # Rotas tRPC
│   ├── emailService.ts        # Envio de emails + triggers
│   └── fileStorage.ts         # Upload de arquivos
├── drizzle/                    # Schema do banco
│   └── schema.ts              # Definição das tabelas
└── shared/                     # Código compartilhado
```

---

## 🗄️ Banco de Dados

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `tenants` | Configuração dos clubes (multi-tenant) |
| `users` | Usuários do sistema (admin, operador, despachante) |
| `clients` | Clientes/Associados dos clubes |
| `workflowSteps` | Etapas do workflow por cliente |
| `subTasks` | Subtarefas (documentos da Juntada) |
| `documents` | Arquivos enviados |
| `emailTemplates` | Templates de email configuráveis |
| `emailLogs` | Histórico de emails enviados |
| `emailTriggers` | Regras de automação de email |
| `emailTriggerTemplates` | Vínculo trigger ↔ templates |
| `emailScheduled` | Fila de emails agendados |
| `auditLogs` | Log de auditoria do sistema |

---

## 🚀 Deploy

### Google Cloud Platform (GCP) com Docker Puro

**Deployment Automático via GitHub Actions:**

```bash
# Branch hml → Deploy em Homolog
git push origin hml

# Branch main → Deploy em Produção
git push origin main
```

O GitHub Actions executa automaticamente:
1. Build da imagem Docker (multi-stage)
2. Push para GitHub Container Registry (GHCR)
3. Deploy em GCP Compute Engine via SSH
4. Backup do banco (produção)
5. Health checks pós-deploy
6. Notificação de sucesso/erro

**Deployment Manual:**

Veja GCP-DOCKER-DEPLOY.md para instruções detalhadas de deploy manual no GCP.

### Variáveis de Ambiente

```env
# Banco de Dados (PostgreSQL)
DB_NAME=cac360_platform
DB_USER=cac360
DB_PASSWORD=senha_forte_32_chars
DATABASE_URL=postgresql://cac360:senha@postgres:5432/cac360_platform

# Autenticação
JWT_SECRET=chave_aleatoria_32_chars
SECRET_KEY=chave_aleatoria_32_chars
INSTALL_TOKEN=cac360rodrigoparreira
INSTALL_WIZARD_ENABLED=false

# Storage (AWS S3 ou Cloudflare R2)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=sa-east-1
AWS_BUCKET_NAME=firing-range-documentos

# Email (SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_key
SMTP_FROM=CAC 360 <noreply@cac360.com.br>

# Domínio
DOMAIN=cac360.com.br
ACME_EMAIL=admin@cac360.com.br
```

---

## 📖 Fluxo de Uso

### 1. Configuração Inicial (Admin)
1. Acessar `/admin/settings` para configurar SMTP
2. Criar templates de email em `/admin/emails`
3. Configurar triggers em `/admin/email-triggers`
4. Cadastrar operadores em `/admin/users`

### 2. Operação Diária (Operador)
1. Cadastrar novo cliente no Dashboard
2. Preencher dados na etapa "Cadastro"
3. Agendar avaliações (psicológica e técnica)
4. Acompanhar documentos na "Juntada"
5. Atualizar status do Sinarm

### 3. Finalização (Despachante)
1. Acessar clientes com Juntada concluída
2. Gerar Enxoval de documentos
3. Atualizar status e protocolo Sinarm
4. Marcar processo como concluído

---

## 🔒 Segurança

- **Autenticação JWT** com refresh tokens
- **Senhas hasheadas** com bcrypt
- **HTTPS obrigatório** em produção
- **Isolamento de dados** por tenant
- **Auditoria completa** de ações
- **Rate limiting** em endpoints sensíveis
- **Validação de entrada** com Zod
- **Mascaramento de dados sensíveis**: CPF, telefone e email mascarados por padrão na interface
- **Controle de visibilidade**: Usuário decide quando revelar dados completos via botão Eye/EyeOff

---

## 📄 Licença

Sistema desenvolvido pela **ACR Digital**. Todos os direitos reservados © 2025.

---

<div align="center">

**CAC 360** - Gestão completa para clubes de tiro

Desenvolvido com ❤️ por [ACR Digital](https://acrdigital.com.br)

</div>
