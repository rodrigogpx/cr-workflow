# CAC 360

**Plataforma SaaS completa de gestão de processos para Colecionadores, Atiradores e Caçadores (CAC)**

Sistema multi-tenant para clubes de tiro gerenciarem todo o ciclo de vida dos processos de seus associados: Concessão de CR, Aquisição & CRAF, Instrução de Armamento e Tiro (IAT), Compliance & Vencimentos, e acompanhamento junto ao Sinarm/Exército.

---

## 🎯 Visão Geral

O **CAC 360** é uma plataforma moderna e modular que automatiza e gerencia todo o processo de obtenção e manutenção de registros de armas de fogo para membros de clubes de tiro. O sistema oferece:

- **Arquitetura Multi-Tenant**: Cada clube opera em ambiente isolado com banco de dados, configurações e branding próprios
- **Módulos Ativáveis por Tenant**: Workflow CR, Aquisição & CRAF, IAT, Munições & Insumos, Compliance & Vencimentos
- **Workflow Completo CR**: 6 etapas do cadastro até aprovação no Sinarm
- **Módulo IAT**: Gestão de instrutores, cursos, turmas, matrículas e exames de capacidade técnica
- **Automação de Emails**: Triggers configuráveis para envio automático baseado em ações
- **Gestão de Documentos**: Upload, organização e geração de "enxoval" de documentos
- **Auditoria Completa**: Rastreamento de todas as ações do sistema com exportação CSV
- **Multi-perfil**: Platform Admin (superadmin/admin/support), Tenant Admin, Operador e Despachante
- **Install Wizard**: Instalação guiada da plataforma com teste de DB e SMTP integrado

---

## 🧩 Módulos da Plataforma

O **Painel Principal** (`/dashboard`) apresenta cards de módulos com status ativo/desabilitado por tenant:

| Módulo | Feature Flag | Status | Descrição |
|--------|-------------|--------|-----------|
| **Workflow CR** | `featureWorkflowCR` | Produção | Cadastro de clientes, juntada de documentos e acompanhamento do processo de CR |
| **Aquisição & CRAF** | `featureApostilamento` | Planejado | Autorização de compra, upload de NF e emissão do CRAF com cofre digital |
| **IAT – Instrução de Armamento e Tiro** | `featureIAT` | Produção | Instrutores, cursos, turmas, matrículas e exames de capacidade técnica |
| **Munições & Insumos** | `featureInsumos` | Planejado | Controle de estoque pessoal, recarga e cotas legais anuais |
| **Compliance & Vencimentos** | `featureRenovacao` | Planejado | Dashboard de vencimentos (CR, Laudos, CRAFs) com cobrança automática |

---

## ✨ Funcionalidades

### 🏢 Multi-Tenancy

- **Isolamento completo**: Cada clube possui banco de dados PostgreSQL separado
- **Branding personalizado**: Logo, favicon, cores primária/secundária por tenant
- **SMTP próprio**: Configuração de servidor de email por tenant (SMTP direto ou HTTP gateway)
- **Subdomínios**: `clube.cac360.com.br` ou path-based `cac360.com.br/clube`
- **Planos**: Starter, Professional, Enterprise com limites configuráveis
- **Status de assinatura**: Active, Trial, Suspended, Cancelled com data de expiração
- **Feature flags**: Ativação/desativação de módulos por tenant
- **Limites configuráveis**: Max. usuários, max. clientes, armazenamento em GB
- **Criptografia de segredos**: Senhas de banco e SMTP criptografadas com AES-256-GCM

### 🖥️ Platform Admin (Super Administração)

Área exclusiva para gestão da plataforma (`/platform-admin`):

| Funcionalidade | Descrição |
|----------------|-----------|
| **Dashboard Global** | Estatísticas agregadas: total de tenants, usuários, clientes, tamanho do DB, armazenamento |
| **Gestão de Tenants** | CRUD completo de clubes com planos, features, limites e configuração de email |
| **Impersonação** | Acesso ao ambiente de um tenant para suporte técnico |
| **Gestão de Admins** | CRUD de platform admins com roles (superadmin, admin, support) |
| **Configurações** | Perfil do admin, troca de senha |
| **Métricas por Tenant** | Usuários, clientes, tamanho do DB (MB), armazenamento de arquivos (GB) |
| **Audit Trail** | Log de ações dos platform admins (criação/edição de tenants, impersonação) |

**Roles de Platform Admin:**
- **Superadmin**: Acesso total, gestão de outros admins
- **Admin**: Gestão de tenants e configurações
- **Support**: Acesso de leitura e suporte

### 👥 Gestão de Clientes

| Funcionalidade | Descrição |
|----------------|-----------|
| Cadastro completo | Dados pessoais, documentos, endereço residencial, endereço do acervo, filiação |
| Validação de CPF | Validação algorítmica com dígitos verificadores + constraint de unicidade por tenant |
| Workflow individual | 6 etapas com progresso em tempo real e barra percentual |
| Vínculo com operador | Cada cliente atribuído a um responsável, com delegação pelo admin |
| Histórico de emails | Registro de todas as comunicações enviadas ao cliente |
| Dashboard visual | Cards com indicador de progresso e status SINARM |
| Mascaramento de dados | CPF, telefone e email mascarados por padrão com toggle Eye/EyeOff |
| Cadastrar Cliente no header | Botão "Cadastrar Cliente" disponível diretamente no menu superior |
| Detecção de CPF duplicado | Impede cadastro de CPF já existente no mesmo tenant |
| Dados do acervo | Segundo endereço com geolocalização para declaração de segurança |

**Campos do cadastro:**
- Dados pessoais: nome, CPF, identidade, data de nascimento, naturalidade, gênero, profissão, estado civil, filiação
- Contato: email, telefone principal, telefone secundário
- Endereço residencial: CEP, logradouro, número, complemento, bairro, cidade, UF
- Endereço do acervo: CEP, logradouro, número, complemento, bairro, cidade, UF, latitude/longitude
- CAC: número CR, categoria CAC, tipo de solicitação (concessão/renovação), validades de laudos

### 📋 Workflow CR — 6 Etapas

```
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 1: INICIAL                                                    │
│  ├── 1. Central de Mensagens (Boas-Vindas automáticas)             │
│  └── 2. Cadastro (Dados pessoais completos + validação)            │
├─────────────────────────────────────────────────────────────────────┤
│  FASE 2: LAUDOS E AVALIAÇÕES                                       │
│  ├── 3. Avaliação Psicológica (Agendamento + Lembrete 24h)        │
│  └── 4. Laudo de Capacidade Técnica (Agendamento + Lembrete)      │
│       ⚠ Só pode ser concluído se a Avaliação Psicológica estiver  │
│         concluída (regra de negócio enforced no backend)           │
├─────────────────────────────────────────────────────────────────────┤
│  FASE 3: FINALIZAÇÃO                                                │
│  ├── 5. Juntada de Documentos (16 documentos obrigatórios)        │
│  │    ⚠ Só conclui se todos os 16 documentos forem anexados       │
│  └── 6. Acompanhamento Sinarm-CAC (Status + Protocolo + Histórico)│
│       Status: Solicitado → Aguardando GRU → Em Análise →          │
│               Restituído → Deferido/Indeferido                     │
│       Inclui: data de abertura, nº protocolo, comentários          │
└─────────────────────────────────────────────────────────────────────┘
```

**16 Documentos Obrigatórios da Juntada:**
1. Comprovante de Capacidade Técnica para manuseio de arma de fogo
2. Certidão de Antecedente Criminal — Justiça Federal
3. Declaração de não estar respondendo a inquérito policial ou processo criminal
4. Documento de Identificação Pessoal
5. Laudo de Aptidão Psicológica para manuseio de arma de fogo
6. Comprovante de Residência Fixa
7. Comprovante de Ocupação Lícita
8. Comprovante de filiação a entidade de caça
9. Comprovante de Segundo Endereço
10. Certidão de Antecedente Criminal — Justiça Estadual
11. Declaração de Segurança do Acervo
12. Declaração com compromisso de comprovar habitualidade
13. Comprovante de necessidade de abate de fauna invasora (Ibama)
14. Comprovante de filiação a entidade de tiro desportivo
15. Certidão de Antecedente Criminal — Justiça Militar
16. Certidão de Antecedente Criminal — Justiça Eleitoral

### 🎓 Módulo IAT — Instrução de Armamento e Tiro

Gestão completa de instrutores, cursos, turmas, matrículas e exames:

**Instrutores:**
- Cadastro com nome, CPF, nº CR, telefone, email
- Flag de credenciamento pela Polícia Federal (PF) para emissão de laudos
- Número de credenciamento PF

**Cursos:**
- Tipos: Tiro Básico, Tiro Defensivo, Tiro Esportivo, PCT, Laudo Técnico PF, Laudo Técnico Exército
- Dados: título, descrição, carga horária, tipo, instituição, data de conclusão

**Turmas (Course Classes):**
- Vinculação a curso e instrutor
- Número da turma, data/horário, local, limite de alunos
- Status: agendada, em andamento, concluída, cancelada
- Controle de vagas (maxStudents) com contagem de inscritos

**Matrículas (Enrollments):**
- Inscrição multi-select de clientes em turmas
- Controle de duplicatas e limite de vagas
- Status: inscrito, confirmado, concluído, cancelado
- Emissão de certificado (URL + data)

**Exames & Provas:**
- Tipos: PCT, Laudo Técnico PF, Laudo Técnico Exército, Curso de Tiro, Avaliação de Habitualidade
- Status: agendado, realizado, aprovado, reprovado, cancelado
- Vinculação a cliente, instrutor e curso
- Campos: tipo de arma, pontuação, observações, URL do laudo PDF

**Agenda:**
- Agendamento de cursos e exames com data, horário e local
- Vinculação a instrutor e curso
- Status: agendado, realizado, cancelado

### ⚡ Automação de Emails (Email Triggers)

Sistema flexível de triggers para envio automático de emails:

**Eventos Disponíveis:**
- `CLIENT_CREATED` — Cliente cadastrado
- `STEP_COMPLETED:X` — Etapa X concluída (por stepId)
- `SCHEDULE_PSYCH_CREATED` — Agendamento psicológico criado
- `SCHEDULE_TECH_CREATED` — Agendamento de laudo técnico
- `SINARM_STATUS:X` — Mudança de status no Sinarm

**Configurações:**
- **Destinatários flexíveis**: Cliente, Operador do cliente, Usuários específicos ou combinações
- **Envio imediato**: Email enviado no momento da ação
- **Lembretes agendados**: Envio X horas antes de eventos (ex: 24h antes do agendamento)
- **Múltiplos templates**: Vincular vários templates a um trigger (N:N)
- **Ativação/desativação**: Toggle por trigger sem excluir configuração
- **Semear padrão**: Botão para carregar automações padrão pré-configuradas

**Variáveis dinâmicas:**
```
{{nome}}, {{email}}, {{cpf}}, {{telefone}}
{{data}}, {{dataAgendamento}}, {{examinador}}
{{sinarmStatus}}, {{protocolNumber}}
```

### 📄 Gestão de Documentos

- **16 tipos de documentos** obrigatórios para processo CR (subtarefas da Juntada)
- **Upload direto** com armazenamento seguro em volume persistente
- **Geração de Enxoval**: Download ZIP consolidado com todos os documentos do cliente
- **Controle por subtarefa**: Cada documento vinculado a uma subtarefa específica
- **Visualização inline**: Preview de documentos no sistema
- **Path traversal prevention**: Validação de caminhos no upload e serving
- **Armazenamento isolado**: Estrutura `tenants/<tenantId>/clients/<clientId>/<timestamp>-<filename>`

### 📧 Templates de Email

- **Editor visual** com HTML rico
- **Anexos configuráveis** por template
- **Preview em tempo real** antes do envio
- **Variáveis dinâmicas** substituídas automaticamente no momento do envio
- **Histórico de envios** por cliente com log completo
- **Templates globais e por tenant**: Defaults globais com override por clube
- **Logo personalizável**: URL de logo do clube inserida nos emails
- **Duas modalidades de envio**: SMTP direto ou HTTP Gateway (Postman GPX)

### 👤 Perfis de Acesso — Tenant

| Perfil | Clientes | Etapas | Documentos | Admin |
|--------|----------|--------|------------|-------|
| **Admin** | Todos | Todas | Upload/Delete | ✅ |
| **Operador** | Todos (lista) / Próprios (edição) | Todas | Upload/Delete | ❌ |
| **Despachante** | Com Juntada OK | Cadastro, Juntada, Sinarm | Apenas Download + Enxoval | ❌ |

**Detalhes do Despachante:**
- Vê apenas clientes com "Juntada de Documentos" concluída
- Acesso às etapas: Cadastro, Juntada de Documentos, Acompanhamento Sinarm
- Pode gerar/baixar Enxoval, atualizar status e protocolo Sinarm
- Não pode fazer upload ou excluir documentos

**Fluxo de aprovação de usuários:**
- Novos usuários registrados ficam com `role = null` (Pendente)
- Admin aprova e atribui role (Operador, Admin ou Despachante)
- Usuários pendentes são redirecionados para página de aprovação

### 📊 Dashboard Operacional (CR Workflow)

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
- **Clique nos cards**: Abre painel lateral (Sheet) com lista filtrada de clientes
- **Mascaramento de dados**: CPF, telefone e email mascarados por padrão (toggle Eye/EyeOff)
- **Exportar Relatório PDF**: Exportação da lista de clientes por fase
- **Cadastrar Cliente**: Botão no menu superior para acesso rápido
- **Números centralizados**: Contadores alinhados ao centro em todos os cards

### 🔧 Administração do Tenant

Painel unificado em `/admin` com sidebar de navegação:

| Seção | Rota | Descrição |
|-------|------|-----------|
| **Dashboard** | `/admin` | Estatísticas do clube: usuários, clientes, em andamento, concluídos |
| **Usuários** | `/admin/users` | Gestão de usuários, aprovação de pendentes, atribuição de roles, exclusão |
| **Operadores** | `/admin/operators` | Distribuição de clientes por operador, delegação, re-atribuição |
| **Templates de Email** | `/admin/emails` | Editor visual de templates com preview, anexos e variáveis |
| **Automação de Emails** | `/admin/email-triggers` | Configuração de triggers, eventos, destinatários e templates |
| **Configurações** | `/admin/settings` | SMTP/Gateway, logo para emails, teste de conexão |
| **Auditoria** | `/admin/audit` | Log de ações com filtros avançados e exportação CSV |

### 🔐 Privacidade e Mascaramento de Dados

Para proteção de dados sensíveis dos clientes (LGPD):

- **CPF**: Exibido como `123***456**` por padrão
- **Telefone**: Exibido como `(61)*****-4237` por padrão
- **Email**: Exibido como `abc***@dominio.com` por padrão
- **Botão Eye/EyeOff**: Alterna entre dados mascarados e completos na lista e no modal de detalhes
- **Compatível com múltiplos formatos**: Funciona com CPFs formatados (`123.456.789-00`) e dígitos puros

### 📊 Relatórios e Auditoria

- **Log de todas as ações**: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, DOWNLOAD, UPLOAD, EXPORT
- **Entidades rastreadas**: CLIENT, DOCUMENT, USER, WORKFLOW, SETTINGS, AUTH
- **Filtros avançados**: Por período, usuário, ação, entidade
- **Paginação**: Navegação por páginas no log
- **Exportação CSV**: Download do relatório completo
- **Rastreamento de IP**: Registro de origem das ações
- **Audit trail duplo**: Logs por tenant (auditLogs) + logs de platform admin (platformAdminAuditLogs)

### ⚙️ Configurações por Tenant

- **SMTP personalizado**: Host, porta, usuário, senha, SSL/TLS
- **HTTP Gateway**: Alternativa ao SMTP via Postman GPX (base URL + API Key)
- **Teste de conexão**: Verificação em tempo real com envio de email de teste
- **Logo para emails**: URL da imagem exibida nos templates
- **Branding**: Logo, favicon, cores primária e secundária
- **Limites**: Max. usuários, max. clientes, armazenamento máximo em GB

### 🚀 Install Wizard

Fluxo guiado de instalação inicial da plataforma (`/api/install`):

1. **Verificação de status**: Checa se a plataforma já está instalada
2. **Teste de DB**: Valida conexão com o PostgreSQL
3. **Teste de SMTP**: Valida configuração de email
4. **Conclusão**: Cria admin inicial, primeiro tenant e salva configurações da plataforma
5. **Proteção**: Endpoint `/complete` rejeita com 409 após instalação; gated por env var `INSTALL_WIZARD_ENABLED`

---

## 🛠️ Tecnologias

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 19 | UI Framework |
| TypeScript | 5.x | Tipagem estática |
| Tailwind CSS | 4 | Estilização |
| shadcn/ui | - | Componentes (Dialog, Sheet, Select, Tabs, Badge, etc.) |
| TanStack Query | 5 | Estado assíncrono (via tRPC React Query) |
| Wouter | 3 | Roteamento client-side |
| Vite | 6 | Build tool + HMR |
| React Hook Form | - | Formulários com validação |
| Zod | - | Validação de schemas (compartilhado com backend) |
| JSZip | - | Geração de ZIP para enxoval de documentos |
| Sonner | - | Notificações toast |
| Lucide React | - | Ícones |

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | 22 | Runtime |
| tRPC | 11 | API type-safe end-to-end |
| Drizzle ORM | - | ORM type-safe para PostgreSQL |
| PostgreSQL | 16 | Banco de dados relacional multi-tenant |
| Nodemailer | - | Envio de emails via SMTP |
| bcryptjs | - | Hash de senhas |
| jsonwebtoken | - | Autenticação JWT |
| esbuild | - | Build do servidor para produção |
| tsx | - | Runtime TypeScript para desenvolvimento |

### Infraestrutura
| Serviço | Uso |
|---------|-----|
| Google Cloud Platform (GCP) | Compute Engine + Cloud DNS |
| Docker Compose / Swarm | Orquestração de containers |
| Nginx | Reverse proxy + SSL/TLS termination |
| Let's Encrypt (Certbot) | Certificados SSL automáticos |
| PostgreSQL 16 | Banco de dados multi-tenant (1 platform DB + N tenant DBs) |
| Volume persistente | Armazenamento de documentos (`DOCUMENTS_STORAGE_DIR`) |
| GitHub Actions | CI/CD automático com change detection |
| GitHub Container Registry (GHCR) | Registry de imagens Docker |

---

## 📁 Estrutura do Projeto

```
cac-360/
├── client/                          # Frontend React
│   └── src/
│       ├── components/              # Componentes reutilizáveis
│       │   ├── ui/                  # shadcn/ui (40+ componentes)
│       │   ├── TenantAdminLayout.tsx # Layout sidebar admin do tenant
│       │   ├── PlatformAdminLayout.tsx # Layout sidebar platform admin
│       │   ├── EmailEditor.tsx       # Editor visual de email
│       │   ├── EmailPreview.tsx      # Preview de email
│       │   ├── DocumentUpload.tsx    # Upload de documentos
│       │   ├── UploadModal.tsx       # Modal de upload
│       │   ├── Footer.tsx            # Rodapé
│       │   ├── ErrorBoundary.tsx     # Error boundary
│       │   ├── platform-admin/       # Componentes do platform admin
│       │   │   ├── AdminForm.tsx
│       │   │   ├── AdminList.tsx
│       │   │   └── ChangePasswordDialog.tsx
│       │   └── super-admin/          # Componentes de gestão de tenants
│       │       ├── EmailConfigPanel.tsx
│       │       ├── EmailTemplatesPanel.tsx
│       │       └── EmailTriggersPanel.tsx
│       ├── pages/                    # Páginas da aplicação
│       │   ├── Login.tsx             # Login de tenant users
│       │   ├── Register.tsx          # Auto-cadastro de usuários
│       │   ├── PendingApproval.tsx   # Tela de aprovação pendente
│       │   ├── MainDashboard.tsx     # Painel principal (seleção de módulos)
│       │   ├── Dashboard.tsx         # Dashboard CR Workflow
│       │   ├── ClientWorkflow.tsx    # Workflow individual do cliente
│       │   ├── IATModule.tsx         # Módulo IAT completo
│       │   ├── AdminDashboard.tsx    # Painel admin do tenant
│       │   ├── AdminUsers.tsx        # Gestão de usuários
│       │   ├── AdminOperators.tsx    # Gestão de operadores
│       │   ├── AdminEmails.tsx       # Templates de email
│       │   ├── AdminEmailTriggers.tsx # Automação de emails
│       │   ├── AdminAudit.tsx        # Log de auditoria
│       │   ├── TenantSettings.tsx    # Configurações SMTP/Gateway
│       │   ├── PlatformAdminLogin.tsx    # Login platform admin
│       │   ├── PlatformAdminDashboard.tsx # Dashboard platform
│       │   ├── PlatformAdminAdmins.tsx   # Gestão de admins
│       │   ├── PlatformAdminBootstrap.tsx # Setup inicial
│       │   ├── SuperAdminTenants.tsx  # Gestão de tenants
│       │   └── NotFound.tsx          # 404
│       ├── _core/                    # Hooks e utilitários
│       │   └── hooks/
│       │       ├── useAuth.ts        # Auth de tenant users
│       │       ├── usePlatformAuth.ts # Auth de platform admins
│       │       └── useTenantSlug.ts  # Resolução de tenant slug
│       ├── contexts/
│       │   └── ThemeContext.tsx       # Tema claro/escuro
│       └── lib/
│           └── trpcClient.ts         # Cliente tRPC configurado
├── server/                            # Backend Node.js
│   ├── _core/                        # Core do servidor
│   │   ├── index.ts                  # Entry point Express
│   │   ├── trpc.ts                   # Middleware tRPC (auth, tenant, roles)
│   │   ├── context.ts                # Contexto tRPC (user, tenant resolution)
│   │   ├── sdk.ts                    # JWT, session, OAuth
│   │   ├── auth.ts                   # bcrypt helpers
│   │   ├── cookies.ts                # Cookie options (HttpOnly, SameSite, Secure)
│   │   ├── env.ts                    # Variáveis de ambiente (fail-fast em produção)
│   │   ├── fileAuth.ts               # Middleware de autenticação para /files
│   │   └── tenantApi.ts              # REST API para gestão de tenants
│   ├── config/
│   │   ├── tenant.config.ts          # Resolução e cache de tenants
│   │   └── crypto.util.ts            # Criptografia AES-256-GCM
│   ├── install/
│   │   └── router.ts                 # Install wizard router
│   ├── routers/
│   │   └── iat.ts                    # Router do módulo IAT
│   ├── db.ts                         # Funções de banco (com variantes *FromDb)
│   ├── routers.ts                    # Rotas tRPC principais
│   ├── emailService.ts               # Envio de emails + triggers + scheduler
│   └── fileStorage.ts                # Upload de arquivos (com path traversal prevention)
├── drizzle/                           # Schema do banco
│   └── schema.ts                     # Definição de todas as tabelas
├── shared/                            # Código compartilhado client/server
│   └── validations.ts                # Schemas Zod, formatação CPF/CEP/telefone
├── .github/
│   └── workflows/
│       └── deploy.yml                # CI/CD com change detection
├── docker-compose.yml                 # Orquestração de containers
├── docker-compose.nginx.yml           # Stack Nginx + certs
├── Dockerfile                         # Build multi-stage
└── nginx/                             # Configuração Nginx
```

---

## 🗄️ Banco de Dados

### Modelo Multi-Tenant

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│     PLATFORM DATABASE        │     │      TENANT DATABASE (×N)    │
│  ┌────────────────────────┐  │     │  ┌────────────────────────┐  │
│  │ tenants                │  │     │  │ users                  │  │
│  │ platformAdmins         │  │     │  │ clients                │  │
│  │ platformSettings       │  │     │  │ workflowSteps          │  │
│  │ platformAdminAuditLogs │  │     │  │ subTasks               │  │
│  │ tenantActivityLogs     │  │     │  │ documents              │  │
│  └────────────────────────┘  │     │  │ emailTemplates         │  │
└──────────────────────────────┘     │  │ emailLogs              │  │
                                     │  │ emailTriggers          │  │
                                     │  │ emailTriggerTemplates  │  │
                                     │  │ emailScheduled         │  │
                                     │  │ auditLogs              │  │
                                     │  │ sinarmCommentsHistory  │  │
                                     │  │ iat_instructors        │  │
                                     │  │ iat_courses            │  │
                                     │  │ iat_schedules          │  │
                                     │  │ iat_exams              │  │
                                     │  │ iat_course_classes     │  │
                                     │  │ iat_class_enrollments  │  │
                                     │  └────────────────────────┘  │
                                     └──────────────────────────────┘
```

### Tabelas — Platform Database

| Tabela | Descrição |
|--------|-----------|
| `tenants` | Configuração dos clubes: DB connection, branding, features, plano, limites, SMTP |
| `platformAdmins` | Administradores da plataforma (superadmin, admin, support) |
| `platformSettings` | Configurações key/value do install wizard |
| `platformAdminAuditLogs` | Audit trail de ações dos platform admins |
| `tenantActivityLogs` | Log de atividades por tenant (criação, suspensão, backup) |

### Tabelas — Tenant Database

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema (admin, operador, despachante) |
| `clients` | Clientes/Associados dos clubes com dados completos |
| `workflowSteps` | 6 etapas do workflow CR por cliente |
| `subTasks` | 16 subtarefas (documentos da Juntada) |
| `documents` | Arquivos enviados com metadados |
| `sinarmCommentsHistory` | Histórico de comentários e mudanças de status SINARM |
| `emailTemplates` | Templates de email configuráveis (global + tenant) |
| `emailLogs` | Histórico de emails enviados |
| `emailTriggers` | Regras de automação de email |
| `emailTriggerTemplates` | Vínculo N:N trigger ↔ templates |
| `emailScheduled` | Fila de emails agendados (lembretes) |
| `auditLogs` | Log de auditoria completo |
| `iat_instructors` | Instrutores de armamento e tiro |
| `iat_courses` | Cursos e formações |
| `iat_schedules` | Agenda de cursos e exames |
| `iat_exams` | Exames e provas de capacidade técnica |
| `iat_course_classes` | Turmas de cursos |
| `iat_class_enrollments` | Matrículas de alunos em turmas |

---

## 🚀 Deploy

### Google Cloud Platform (GCP) com Docker

**Deployment Automático via GitHub Actions (CI/CD):**

```bash
# Branch hml → Deploy em Homologação
git push origin hml

# Branch main → Deploy em Produção
git push origin main
```

**Pipeline CI/CD com change detection:**
1. **detect-changes** — Identifica se houve alterações em nginx ou app
2. **build** — Build da imagem Docker multi-stage (apenas se app mudou)
3. **deploy-hml-nginx** — Deploy do stack Nginx (apenas se nginx mudou)
4. **issue-le-hml** — Emissão/renovação de certificados Let's Encrypt
5. **deploy-hml** — Deploy da aplicação + migrations (apenas se app mudou)

**Cada deploy inclui:**
- Build da imagem Docker (multi-stage)
- Push para GitHub Container Registry (GHCR)
- Deploy em GCP Compute Engine via SSH
- Backup do banco (produção)
- Health checks pós-deploy (`/health` e `/api/health`)
- Notificação de sucesso/erro

### Variáveis de Ambiente

```env
# Banco de Dados (PostgreSQL — Platform)
DB_NAME=cac360_platform
DB_USER=cac360
DB_PASSWORD=senha_forte_32_chars
DATABASE_URL=postgresql://cac360:senha@postgres:5432/cac360_platform

# Autenticação & Segurança
JWT_SECRET=chave_aleatoria_32_chars          # OBRIGATÓRIO em produção
COOKIE_SECRET=chave_aleatoria_32_chars       # Fallback: JWT_SECRET
SECRET_KEY=chave_aleatoria_32_chars          # Criptografia AES-256-GCM

# Install Wizard
INSTALL_TOKEN=token_para_instalacao
INSTALL_WIZARD_ENABLED=false                 # true apenas na primeira instalação

# Storage de Documentos
DOCUMENTS_STORAGE_DIR=/data/documents        # Volume persistente para arquivos

# CORS & Domínio
DOMAIN=cac360.com.br
CORS_ORIGINS=https://cac360.com.br,https://hml.cac360.com.br  # Opcional

# Desenvolvimento (NÃO usar em produção)
DEV_AUTO_LOGIN=true                          # Auto-login sem sessão (dev only)
ADMIN_EMAIL=admin@example.com                # Email do admin para auto-login

# Let's Encrypt
ACME_EMAIL=admin@cac360.com.br
```

---

## 📖 Fluxo de Uso

### 0. Instalação Inicial
1. Configurar variáveis de ambiente e `INSTALL_WIZARD_ENABLED=true`
2. Acessar `/api/install/status` para verificar estado
3. Testar conexão DB e SMTP via endpoints do wizard
4. Completar instalação — cria admin e primeiro tenant
5. Desabilitar wizard: `INSTALL_WIZARD_ENABLED=false`

### 1. Configuração do Clube (Admin do Tenant)
1. Acessar `/admin/settings` para configurar SMTP ou Gateway de email
2. Configurar logo para emails
3. Criar templates de email em `/admin/emails`
4. Configurar triggers de automação em `/admin/email-triggers`
5. Cadastrar e aprovar operadores em `/admin/users`

### 2. Operação Diária (Operador)
1. Acessar `/dashboard` → selecionar módulo **Workflow CR**
2. Cadastrar novo cliente no Dashboard (botão no header)
3. Preencher dados completos na etapa "Cadastro"
4. Agendar avaliação psicológica (etapa 3)
5. Agendar laudo de capacidade técnica (etapa 4) — requer psicológica concluída
6. Fazer upload dos 16 documentos na "Juntada" (etapa 5)
7. Acompanhar status no Sinarm (etapa 6)

### 3. Finalização (Despachante)
1. Acessar clientes com Juntada concluída
2. Gerar Enxoval (ZIP com todos os documentos)
3. Atualizar status e protocolo Sinarm
4. Registrar comentários no histórico
5. Marcar processo como concluído (Deferido)

### 4. IAT — Instrução de Armamento e Tiro
1. Cadastrar instrutores com credenciamento PF
2. Cadastrar cursos (tipo, carga horária, instituição)
3. Criar turmas com limite de alunos
4. Inscrever clientes nas turmas
5. Registrar exames e provas de capacidade técnica
6. Acompanhar status das matrículas e certificados

### 5. Platform Admin
1. Acessar `/platform-admin` com credenciais de super admin
2. Visualizar estatísticas globais da plataforma
3. Gerenciar tenants: criar, editar, suspender, ativar features
4. Configurar email por tenant (SMTP ou Gateway)
5. Gerenciar platform admins e roles
6. Impersonar tenant para suporte técnico

---

## 🔒 Segurança

### Autenticação & Sessões
- **JWT HttpOnly cookies** com assinatura HMAC (app_session_id + platform_session_id)
- **Senhas hasheadas** com bcrypt (salt rounds padrão)
- **Fail-fast** em produção se `COOKIE_SECRET` não está configurado
- **SameSite=Lax** para prevenção de CSRF
- **Secure flag** automático quando HTTPS detectado
- **Logout completo**: Limpa ambos os cookies (tenant + platform)

### Isolamento de Dados
- **Bancos separados** por tenant (PostgreSQL)
- **Filtro tenantId** em todas as queries `*FromDb` (clients, users, documents, workflow steps)
- **Validação de x-tenant-slug**: Rejeitado quando sessão já possui tenant (previne header injection)
- **Bloqueio de auto-associação**: Usuários sem tenant não são automaticamente atribuídos

### Proteção de Arquivos
- **Autenticação JWT** obrigatória para acessar `/files`
- **Verificação de ownership**: Tenant users acessam apenas arquivos do seu tenant
- **Path traversal prevention**: Validação no upload e no serving (resolve + startsWith)
- **Platform admins**: Acesso total a todos os arquivos

### Headers & CORS
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Strict-Transport-Security**: Em produção (HSTS max-age 1 ano)
- **CORS restritivo**: Origens configuradas via `CORS_ORIGINS` ou `DOMAIN`

### Criptografia
- **AES-256-GCM** para senhas de banco e SMTP armazenadas
- **bcrypt** para senhas de usuários e admins
- **Mascaramento de dados sensíveis**: CPF, telefone e email mascarados por padrão na interface

### Auditoria
- **Audit trail completo** por tenant (auditLogs)
- **Audit trail de platform admins** (platformAdminAuditLogs)
- **Tenant activity logs** (tenantActivityLogs)
- **Validação de entrada** com Zod em todas as mutations

---

## 📄 Licença

Sistema desenvolvido pela **ACR Digital**. Todos os direitos reservados © 2025.

---

<div align="center">

**CAC 360** — Gestão completa para clubes de tiro

Desenvolvido com ❤️ por [ACR Digital](https://acrdigital.com.br)

</div>
