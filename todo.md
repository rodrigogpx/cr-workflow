# Fire Range Workflow - TODO

## Funcionalidades Principais

- [x] Layout principal com header e footer
- [x] Página inicial com workflow completo
- [x] Sistema de cards expansíveis para cada etapa do processo
- [x] Card: Processo de Venda
- [x] Card: Cadastro
- [x] Card: Boas Vindas (com subtarefas)
- [x] Card: Agendamento Psicotécnico (com subtarefas)
- [x] Card: Juntada de Documento (com subtarefas)
- [x] Card: Laudo Arma de Fogo
- [x] Card: Despachante
- [x] Card: Fim
- [x] Sistema de checklist interativo para cada card
- [x] Indicadores visuais de progresso
- [x] Persistência de dados no localStorage
- [x] Design responsivo
- [x] Identidade visual Fire Range (vermelho, preto, branco)


## Novas Funcionalidades - Sistema de Login e Gestão de Clientes

- [x] Sistema de autenticação (login/logout)
- [x] Contexto de autenticação global
- [x] Página de login
- [x] Dashboard de clientes
- [x] Lista de clientes com busca e filtros
- [x] Adicionar novo cliente
- [ ] Editar informações do cliente (próxima versão)
- [ ] Excluir cliente (próxima versão)
- [x] Workflow individual por cliente
- [x] Navegação entre clientes
- [x] Persistência de dados de múltiplos clientes
- [x] Proteção de rotas (autenticação obrigatória)


## Sistema Multi-Usuário e Administração

- [x] Upgrade para web-db-user (backend + banco de dados)
- [x] Schema do banco de dados (usuários, clientes, documentos)
- [x] Sistema de autenticação real com OAuth
- [x] Perfis de usuário (operador e administrador)
- [x] Controle de acesso por perfil
- [x] Operador vê apenas seus clientes
- [x] Área administrativa completa
- [x] Delegação de clientes entre operadores
- [x] Administrador edita todos os cadastros
- [ ] Upload de documentos por etapa
- [ ] Armazenamento de arquivos no S3
- [ ] Listagem de documentos por cliente
- [x] Download individual de documentos
- [ ] Download do enxoval completo (ZIP)
- [x] Gerenciamento de usuários (alteração de perfil)


## Implementação dos Routers tRPC

- [x] Router de clientes (list, create, update, delete)
- [x] Router de workflows (get, update steps, update subtasks)
- [x] Router de documentos (upload, list, delete)
- [x] Router de usuários (admin only - list, update role)
- [x] Controle de acesso por perfil nos routers
- [x] Endpoint de upload de arquivos
- [x] Endpoint de download de enxoval completo


## Upload de Documentos e Enxoval

- [x] Componente de upload de arquivos por etapa do workflow
- [x] Listagem de documentos anexados por cliente
- [ ] Preview de documentos (imagens, PDFs)
- [x] Exclusão de documentos
- [x] Download individual de documentos
- [x] Botão de download do enxoval completo (ZIP)
- [ ] Indicador visual de documentos anexados em cada etapa

## Melhorias de UX

- [x] Cálculo correto de progresso (em andamento/concluídos)
- [ ] Badges de notificação para etapas pendentes
- [ ] Filtros no dashboard (todos/em andamento/concluídos)
- [ ] Confirmação antes de ações destrutivas
- [x] Loading states em todas as mutações
- [ ] Mensagens de erro mais descritivas


## Correção do Workflow e Documentos

- [x] Atualizar etapas do workflow conforme processo real
- [x] Implementar lista de 16 documentos oficiais do enxoval
- [x] Cada documento deve ter área de upload individual
- [x] Reorganizar estrutura do workflow na página do cliente
- [x] Validar que todos os documentos estão corretos


## Reorganização do Workflow

- [x] Criar 8 etapas principais do processo
- [x] Adicionar 16 documentos como subtarefas da etapa "Juntada de Documento"
- [x] Migrar dados dos clientes existentes para nova estrutura
- [x] Ajustar interface para mostrar subtarefas com upload de documentos
- [x] Manter upload individual por documento dentro das subtarefas


## Melhorias do Workflow

- [x] Remover etapa "Processo de Venda"
- [x] Remover etapa "Fim"
- [x] Remover upload de arquivos das etapas sem documentos
- [x] Adicionar botão de geração de PDF personalizado em "Boas Vindas"
- [x] Transformar "Laudo Arma de Fogo" em "Agendamento de Laudo"
- [x] Adicionar campos: data do agendamento e nome do examinador
- [x] Mover botão "Baixar Enxoval" para dentro da etapa "Despachante"
- [x] Organizar cards em 3 colunas
- [x] Criar separação visual por fases do processo
- [x] Migrar clientes existentes para nova estrutura


## Bugs a Corrigir

- [x] Corrigir erro ao visualizar workflow dos clientes
- [x] Investigar problema na página ClientWorkflow


## Redesign UI/UX Moderno

- [x] Analisar identidade visual do Fire Range
- [x] Atualizar paleta de cores no design system
- [x] Aplicar tipografia oficial (usando sans-serif padrão)
- [x] Redesenhar Dashboard com layout moderno
- [x] Melhorar cards de clientes com hover effects
- [ ] Redesenhar página de Workflow
- [ ] Adicionar micro-interações e animações
- [ ] Melhorar hierarquia visual e espaçamentos
- [ ] Aplicar glassmorphism e sombras modernas
