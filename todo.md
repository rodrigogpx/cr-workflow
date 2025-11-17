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
- [ ] Sistema de autenticação real com JWT
- [ ] Perfis de usuário (operador e administrador)
- [ ] Controle de acesso por perfil
- [ ] Operador vê apenas seus clientes
- [ ] Área administrativa completa
- [ ] Delegação de clientes entre operadores
- [ ] Administrador edita todos os cadastros
- [ ] Upload de documentos por etapa
- [ ] Armazenamento de arquivos no S3
- [ ] Listagem de documentos por cliente
- [ ] Download individual de documentos
- [ ] Download do enxoval completo (ZIP)
- [ ] Gerenciamento de usuários (CRUD)


## Implementação dos Routers tRPC

- [x] Router de clientes (list, create, update, delete)
- [x] Router de workflows (get, update steps, update subtasks)
- [x] Router de documentos (upload, list, delete)
- [x] Router de usuários (admin only - list, update role)
- [x] Controle de acesso por perfil nos routers
- [x] Endpoint de upload de arquivos
- [x] Endpoint de download de enxoval completo
