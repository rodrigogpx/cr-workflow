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
| Railway | Hospedagem e CI/CD |
| Cloudflare R2 | Armazenamento de arquivos |
| PostgreSQL | Banco por tenant |

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

### Railway (Produção)

```bash
# Branch hml → Deploy automático
git push origin hml
```

O Railway executa automaticamente:
1. Build do frontend (Vite)
2. Build do backend (esbuild)
3. Migration do banco (Drizzle)
4. Deploy da aplicação

### Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL=postgresql://...

# Autenticação
JWT_SECRET=...
SESSION_SECRET=...

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Email (fallback)
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
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

---

## 📄 Licença

Sistema desenvolvido pela **ACR Digital**. Todos os direitos reservados © 2025.

---

<div align="center">

**CAC 360** - Gestão completa para clubes de tiro

Desenvolvido com ❤️ por [ACR Digital](https://acrdigital.com.br)

</div>
