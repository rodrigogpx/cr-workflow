# CAC 360 — Estado Real do Projeto

> Última atualização: 17/03/2026 — verificado por leitura direta de cada arquivo de código (3 rodadas de análise)

---

## 🏗️ Infraestrutura e Arquitetura

- [x] Stack fullstack: React 19 + TypeScript + Vite + TailwindCSS 4 + shadcn/ui
- [x] Backend: Express + tRPC + Drizzle ORM
- [x] Banco de dados: PostgreSQL (produção) / SQLite (dev) / MySQL (suporte)
- [x] Multi-tenancy com isolamento real por tenantId no banco
- [x] Feature flags por tenant (featureWorkflowCR, featureIAT, featureApostilamento, etc.)
- [x] Docker: Dockerfile + docker-compose (dev, prod, nginx, swarm, traefik, multi-tenant)
- [x] Deploy Railway: railway.json + railway.toml configurados
- [x] Deploy GCP documentado (GCP-DOCKER-DEPLOY.md)
- [x] Prettier configurado
- [x] Vitest configurado (118 testes passando)

---

## 🔐 Autenticação e Controle de Acesso

- [x] Login com email/senha (bcrypt)
- [x] OAuth (login legado)
- [x] Sessão via JWT/cookie (1 ano de expiração)
- [x] Sistema de aprovação: novos usuários ficam com role NULL até admin aprovar
- [x] Página "Aguardando Aprovação" para usuários pendentes
- [x] Proteção de rotas (autenticação obrigatória)
- [x] Perfis: operator, admin, despachante, platformAdmin
- [x] Isolamento de acesso: operador vê apenas seus próprios clientes
- [x] Admin vê e edita todos os cadastros
- [x] Audit log: LOGIN, CREATE, UPDATE rastreados com timestamp

---

## 👥 Gestão de Clientes

- [x] Criar novo cliente
- [x] Editar informações do cliente (formulário completo na etapa Cadastro)
- [x] Excluir cliente com cascade (workflow + documentos)
- [x] Listar clientes com busca
- [x] Delegação de clientes entre operadores (admin)
- [x] Mascaramento de CPF, telefone e email (toggle Eye/EyeOff)
- [x] Filtro por operador no dashboard (todos / não atribuídos / operador específico)
- [x] Agrupamento por fase do workflow (cadastro, agendamento, juntada, etc.)
- [x] Filtragem por perfil: despachante vê apenas clientes com juntada-documento concluída
- [ ] Importação em massa via CSV

---

## ⚙️ Workflow (Processo CR)

- [x] 6 etapas implementadas no banco e na interface:
  1. Central de Mensagens
  2. Cadastro / On-Boarding
  3. Encaminhamento Avaliação Psicológica
  4. Agendamento de Laudo de Capacidade Técnica (com data, hora e examinador)
  5. Juntada de Documentos (com 16 subtarefas/documentos)
  6. Acompanhamento Sinarm-CAC (com status dropdown + número de protocolo)
- [x] Separação visual em 3 fases (Cadastro | Documentação/Laudos | Juntada-Sinarm-CAC)
- [x] Barra de progresso segmentada por fases
- [x] Cards de clientes com percentual de conclusão correto
- [x] Status Sinarm: Solicitado, Aguardando Baixa GRU, Em Análise, Correção Solicitada, Deferido, Indeferido
- [x] Histórico de comentários no Sinarm (tabela sinarmCommentsHistory)
- [ ] Visualização Kanban (arrastar clientes entre etapas)
- [ ] Timeline visual de atividades por cliente
- [ ] Alertas de prazos (documentos próximos do vencimento)

---

## 📄 Documentos e Enxoval

- [x] Upload de documentos por etapa e por subtarefa
- [x] Listagem de documentos por cliente
- [x] Download individual de documentos
- [x] Download do enxoval completo (ZIP)
- [x] Exclusão de documentos
- [x] Validação de tipos de arquivo (PDF, JPG, DOC, DOCX)
- [x] Armazenamento: **Railway Volume** (`DOCUMENTS_STORAGE_DIR=/data`) com fallback `./documents` em dev
- [x] Estrutura multi-tenant: `tenants/<tenantId>/clients/<clientId>/<timestamp>-<filename>`
- [x] Servido via endpoint Express `/files/` (static middleware)
- [ ] Migração para S3/cloud storage (hoje usa filesystem no Railway Volume — funcional, mas sem redundância)
- [ ] Preview de documentos (imagens e PDFs) no navegador
- [ ] Indicador visual de "tem documentos" em cada subtarefa do workflow

---

## ✉️ Sistema de Emails

- [x] Envio via SMTP (Nodemailer) por tenant
- [x] Envio via HTTP Gateway PostmanGPX (opcional — ativo apenas se `USE_EMAIL_GATEWAY=true`)
- [x] 3 templates padrão: Boas-Vindas, Processo CR, Atualização de Status
- [x] Editor rico de templates (TipTap — React 19 compatível)
- [x] Preview HTML renderizado ao lado do editor
- [x] Variáveis dinâmicas: {{nome}}, {{cpf}}, {{email}}, {{data}}, {{status}}, etc.
- [x] Suporte a anexos PDF nos templates
- [x] Criar / editar / excluir templates personalizados
- [x] Página de administração de templates (/admin/email-templates)
- [x] Triggers de email automáticos por evento (CLIENT_CREATED, STEP_COMPLETED, etc.)
- [x] Painel de gerenciamento de triggers no Super Admin
- [x] Emails agendados / com delay (emailScheduled)
- [x] Log de envios (emailLogs)
- [x] Configuração SMTP por tenant (host, port, user, pass, from)
- [x] Teste de conexão SMTP no painel admin
- [x] Email com dados do agendamento de laudo (data + hora)
- [ ] Email incluir nome do examinador no agendamento de laudo
- [ ] Testes automatizados de envio real de email

---

## 📊 Dashboard e Admin

- [x] Dashboard com cards de clientes e progresso
- [x] Cards superiores: total, em andamento, concluídos
- [x] Área Admin: usuários, operadores, templates, triggers, auditoria
- [x] Aprovação de novos usuários pelo admin
- [x] Exclusão de usuários (com proteção: não pode excluir a si mesmo)
- [x] Estatísticas globais (operadores com stats)
- [x] Logs de auditoria (/admin/audit)
- [x] Super Admin: gerenciamento de tenants, feature flags, SMTP por tenant
- [x] Plataforma Admin: login separado, gestão de usuários e templates globais
- [ ] Badges de notificação para etapas pendentes
- [ ] Gráficos / métricas visuais no dashboard (Recharts já instalado)
- [ ] Filtro por período (data de criação / última atualização)

---

## 🎨 UI / UX

- [x] Identidade visual CAC 360 (vermelho #C41E3A, preto, branco)
- [x] Tema claro global
- [x] Header escuro (#1c1c1c) com textos claros
- [x] Design responsivo
- [x] Loading states em todas as mutações
- [x] Toasts com Sonner
- [x] shadcn/ui com 30+ componentes
- [x] Ícones Lucide React
- [x] Framer Motion instalado
- [ ] Micro-interações e animações de transição entre etapas
- [~] Skeleton loaders — `DashboardLayoutSkeleton` existe mas maioria das telas usa spinner `Loader2`; substituir spinners restantes
- [ ] Wizard multi-step no formulário de cadastro
- [x] Confirmação antes de excluir cliente (`window.confirm()` no Dashboard)
- [x] Confirmação antes de excluir usuário (`AlertDialog` completo em Users.tsx)
- [x] Confirmação antes de excluir documento (`confirm()` em DocumentUpload)
- [x] Mensagens de erro descritivas: CPF duplicado, email duplicado, campos inválidos com mensagem específica (`getFriendlyErrorMessage()`)
- [ ] Glassmorphism e sombras modernas
- [~] Dark/Light mode — ThemeContext e next-themes implementados, mas `switchable=false` por padrão e sem botão de alternância na UI

---

## 🧪 Qualidade e Testes

- [x] 118 testes automatizados passando (Vitest)
- [x] Testes para: agendamento, emails, workflow, correções, autenticação
- [ ] Testes de integração end-to-end
- [ ] Testes de carga multi-tenant

---

## 🚀 Funcionalidades Futuras (Backlog)

- [x] Módulo IAT (Instrução de Armamento e Tiro) — **totalmente implementado** (~700 linhas):
  - [x] CRUD de instrutores (credenciamento PF)
  - [x] Catálogo de cursos (tipo, carga horária, instituição)
  - [x] Agendamento de exames (tipo, status, pontuação)
  - [x] Gestão de turmas (matrícula, frequência)
  - [x] Router tRPC `iat.*` com endpoints completos
- [ ] Módulo Apostilamento (feature flag existe, implementação pendente)
- [ ] Módulo Renovação (feature flag existe, implementação pendente)
- [ ] Módulo Insumos (feature flag existe, implementação pendente)
- [ ] Notificações push / PWA
- [ ] Busca global (Cmd+K)
- [x] Geração de PDF: Welcome PDF + Client Data PDF (PDFKit), acessível via botões na UI
- [x] Exportação de lista de clientes em PDF no Dashboard (`exportPDF()`)
- [ ] PDF completo e detalhado por cliente (versão expandida com histórico do workflow)
- [ ] Integração com calendário para agendamentos
- [ ] Alertas de documentos próximos do vencimento
- [x] Campos do schema presentes **no banco E no formulário de cadastro**:
  - [x] Estado civil (maritalStatus) — Select com opções na UI
  - [x] Tipo de solicitação (requestType) — Select com opções na UI
  - [x] Número CAC (cacNumber) — Input na UI
  - [x] Categoria CAC (cacCategory) — Input na UI
  - [x] CR anterior (previousCrNumber) — Input na UI
  - [x] Validade do Laudo Psicológico (psychReportValidity) — Input na UI
  - [x] Validade do Laudo Técnico (techReportValidity) — Input na UI
  - [x] UF de residência (residenceUf) — Input na UI
  - [ ] Nacionalidade (nationality) — campo NÃO tem input na UI (só birthCountry existe)

---

## ⚠️ Código legado Manus (não afeta Railway)

O projeto foi originalmente criado na plataforma Manus. Os seguintes arquivos contêm referências ao Manus, mas são **opcionais** e **não impedem** o funcionamento no Railway:

- `server/storage.ts` — proxy de storage Manus (só ativa se `DOCUMENTS_STORAGE_DIR` NÃO estiver definido)
- `server/_core/imageGeneration.ts` — geração de imagem via Forge API (não usado no workflow)
- `server/_core/voiceTranscription.ts` — transcrição de voz (não usado no workflow)
- `server/_core/map.ts` — proxy Google Maps (não usado no workflow)
- `server/_core/llm.ts` — endpoint LLM (não usado no workflow)
- `client/src/components/ManusDialog.tsx` — login via Manus OAuth (ignorado, login padrão funciona)
- `vite-plugin-manus-runtime` — dependência dev-only, não afeta build de produção

**Nenhuma variável de ambiente Manus é obrigatória.** O app funciona 100% no Railway com: `DATABASE_URL`, `SMTP_*`, `DOCUMENTS_STORAGE_DIR`, `PORT`.
