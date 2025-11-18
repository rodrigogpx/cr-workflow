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


## Melhorias Finais

- [x] Investigar bug de tarefas concluídas sumindo (não há filtro, todas são renderizadas)
- [x] Redesenhar página de Workflow com identidade Firing Range
- [x] Reorganizar workflow em coluna única
- [x] Adicionar barra de progresso segmentada por fases
- [x] Adicionar indicadores de progresso nos cards de clientes
- [x] Redesenhar página de Login personalizada
- [x] Aplicar identidade visual completa em todas as páginas


## Implementações Finais

- [x] Implementar cálculo real de progresso nos cards de clientes
- [x] Melhorar barra de progresso do workflow (única, mais larga, animada, 3 fases)
- [x] Criar página Admin funcional com lista de usuários
- [x] Implementar alteração de perfis de usuários (operator/admin)
- [x] Implementar delegação de clientes entre operadores
- [x] Adicionar estatísticas globais na página Admin


## Correções e Funcionalidades Pendentes

- [x] Corrigir bug de etapas sumindo quando marcadas como concluídas (texto invisível por text-muted-foreground)
- [x] Implementar upload de documentos funcional com S3
- [x] Implementar download do enxoval completo (ZIP real)
- [ ] Adicionar preview de documentos (imagens, PDFs)
- [ ] Adicionar indicador visual de documentos anexados em cada etapa
- [ ] Implementar badges de notificação para etapas pendentes
- [ ] Adicionar filtros no dashboard (todos/em andamento/concluídos)
- [ ] Adicionar confirmação antes de ações destrutivas
- [ ] Melhorar mensagens de erro
- [ ] Implementar edição de informações do cliente
- [ ] Implementar exclusão de cliente com confirmação
- [ ] Corrigir cálculo de progresso nos cards (sem violar regras de hooks)


## Novas Funcionalidades - Sistema de Aprovação e Exclusão

- [x] Modificar schema do banco de dados para permitir role NULL (usuários sem perfil)
- [x] Atualizar função upsertUser para não atribuir role automaticamente
- [x] Criar endpoint tRPC para admin atribuir perfil a usuários (assignRole)
- [x] Criar endpoint tRPC para admin deletar clientes (deleteClient)
- [x] Criar página "Aguardando Aprovação" para usuários sem perfil
- [x] Atualizar proteção de rotas para redirecionar usuários sem perfil
- [x] Adicionar seção no painel Admin para aprovar novos usuários
- [x] Adicionar botão de exclusão de clientes no dashboard (apenas admin)
- [x] Corrigir bug de redirecionamento infinito na rota raiz
- [x] Testar fluxo completo de aprovação de usuário
- [x] Testar exclusão de clientes com seus workflows e documentos


## Redesign da Página de Workflow - Tema Claro

- [x] Mudar tema global de dark para light
- [x] Atualizar paleta de cores para tema claro
- [x] Reconstruir página ClientWorkflow com novo layout
- [x] Melhorar visualização de etapas do workflow
- [x] Melhorar visualização de sub-tarefas
- [x] Melhorar seção de upload de documentos
- [x] Adicionar indicadores visuais de progresso mais claros
- [x] Melhorar responsividade mobile
- [x] Testar nova página de workflow


## Ajuste de Estilo - Cards de Clientes

- [x] Ajustar background dos cards de clientes para opacity 0.95
- [x] Ajustar cor do texto dos cards para preto


## Ajuste de Background - Cards de Clientes

- [x] Mudar background dos cards de branco/95 para cinza claro


## Inversão de Cores - Dashboard

- [x] Mudar background da página para cinza claro
- [x] Retornar cards para branco com opacidade 0.95


## Ajuste de Nomenclatura - ClientWorkflow

- [x] Alterar texto da Fase 2 de "Documentação" para "Documentação/Laudos"


## Ajustes Visuais e Nomenclatura - ClientWorkflow

- [x] Mudar header para fundo escuro (#1c1c1c)
- [x] Ajustar cores dos textos do header para tons claros
- [x] Renomear "Cadastro" para "Cadastro/On-Boarding"
- [x] Renomear "Finalização" para "Dispachante/PF"
- [x] Renomear "Agendamento Psicotécnico" para "Avaliação Psicológica para Porte/Posse de Armas"
- [x] Renomear "Agendamento de Laudo" para "Exame de Capacidade Técnica"
- [x] Remover seção "Progresso Total" do header
- [x] Remover botão "Baixar Enxoval" do header


## Ajustes Visuais - Dashboard

- [x] Ajustar cor do botão Administração para cinza claro (#c2c1c1)
- [x] Ajustar cores dos números nas estatísticas para tons escuros
- [x] Centralizar alinhamento dos números nas estatísticas
- [x] Ajustar background do botão Excluir Cliente para vermelho claro (#feecec)
- [x] Ajustar margens do botão Excluir Cliente


## Formulário de Dados do Cliente - Etapa Cadastro

- [x] Adicionar novos campos ao schema de clientes no banco de dados
- [x] Criar endpoint tRPC para atualizar dados completos do cliente
- [x] Implementar formulário completo na etapa Cadastro do ClientWorkflow
- [x] Adicionar validação de campos obrigatórios
- [x] Testar salvamento e edição dos dados do cliente


## Bugs a Corrigir

- [x] Operador não consegue ver formulário de cadastro - etapa Cadastro agora expande automaticamente
- [x] Título de atividade desaparece ao marcar/desmarcar - corrigido endpoint updateStep para preservar stepTitle


## Bug - Títulos Vazios

- [x] Restaurar títulos vazios no banco de dados
- [x] Adicionar fallback no frontend para exibir título baseado em stepId


## Ajuste - Primeira Atividade

- [x] Verificar nome da primeira atividade no banco de dados - já está "Cadastro"
- [x] Garantir que o nome seja "Cadastro" - correto no código
- [x] Verificar se formulário de cadastro está presente e funcional - implementado e expande automaticamente


## Bug - Primeira Etapa sem Título

- [x] Investigar stepId da primeira etapa no banco de dados - encontradas 2 etapas vazias
- [x] Corrigir stepId e stepTitle para 'cadastro' e 'Cadastro' - atualizado no banco


## Sistema de Emails - Boas Vindas

- [x] Criar schema de emailTemplates no banco de dados
- [x] Criar schema de emailLogs para rastrear envios
- [x] Criar endpoint tRPC para salvar template de email
- [x] Criar endpoint tRPC para enviar email
- [x] Implementar editor de email no frontend (3 emails)
- [x] Adicionar botão de envio individual para cada email
- [x] Adicionar indicador de email já enviado
- [x] Testar envio de emails


## Correção - Erro ao Cadastrar Cliente

- [x] Investigar campos do schema de clientes que estão como notNull mas deveriam aceitar NULL
- [x] Atualizar schema para permitir NULL em campos opcionais de cadastro (já estava correto)
- [x] Executar migração do banco de dados (pnpm db:push) - não necessário, schema já estava correto
- [x] Testar cadastro de novo cliente com apenas campos básicos
- [x] Criar checkpoint com correção


## Correção Persistente - Erro ao Cadastrar Cliente (Drizzle inserindo "default")

- [x] Verificar se o código da correção foi carregado no servidor
- [x] Investigar por que o Drizzle ainda está gerando SQL com "default"
- [x] Implementar solução alternativa - construção manual do objeto de inserção
- [x] Testar cadastro de cliente - pronto para teste pelo usuário
- [x] Criar checkpoint com correção definitiva


## Correção Final - Usar SQL Bruto

- [x] Reescrever createClient usando SQL bruto (execute) ao invés do query builder
- [x] Testar cadastro de cliente - pronto para teste
- [x] Criar checkpoint


## Tratamento de Erro - CPF Duplicado

- [x] Adicionar try-catch no router create de clientes
- [x] Detectar erro de unique constraint (CPF duplicado)
- [x] Retornar mensagem amigável ao usuário
- [x] Testar e criar checkpoint


## Correção - Editores de Email Não Aparecem em Boas Vindas

- [x] Investigar por que os EmailEditors não estão sendo renderizados
- [x] Verificar condição de renderização no ClientWorkflow
- [x] Corrigir e testar
- [x] Criar checkpoint


## Correção - Nome do Clube (Fire Range → Firing Range)

- [x] Buscar todas as ocorrências de "Fire Range" no código
- [x] Substituir por "Firing Range" em todos os arquivos
- [x] Verificar se não há ocorrências perdidas
- [x] Criar checkpoint


## Refatoração - Templates de Email

- [ ] Criar página de administração de templates (/admin/email-templates)
- [ ] Adicionar rota no App.tsx
- [ ] Criar componente de edição de templates para admin
- [ ] Atualizar ClientWorkflow para mostrar apenas preview e botão de envio
- [ ] Testar fluxo completo
- [ ] Criar checkpoint


## Ajuste de Ordem das Etapas

- [x] Corrigir EmailPreview no ClientWorkflow (remover props defaultSubject e defaultContent)
- [x] Atualizar ordem das etapas no router:
  1. Cadastro
  2. Boas Vindas
  3. Agendamento Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo
  4. Agendamento de Laudo de Capacidade Técnica para a Obtenção do CR
  5. Juntada de Documentos
  6. Acompanhamento Sinarm-CAC
- [x] Testar e criar checkpoint


## Link para Templates de Email no Dashboard

- [x] Adicionar botão/link para /admin/email-templates no menu de administração
- [x] Testar navegação
- [x] Criar checkpoint


## Mover Link de Templates para Página Admin

- [x] Remover botão "Templates de Email" do Dashboard
- [x] Adicionar card/link para Templates de Email na página /admin
- [x] Testar navegação
- [x] Criar checkpoint


## Correções e Melhorias no Workflow

- [x] Corrigir cálculo de percentual de conclusão no card do Dashboard
- [x] Reorganizar etapas em 4 fases (já está correto):
  1. Cadastro
  2. Boas Vindas
  3. Documentação/Laudos (Avaliação Psicológica + Laudo Capacidade Técnica)
  4. Finalização (Juntada Documentos + Acompanhamento Sinarm-CAC)
- [x] Adicionar campo "Status" na etapa Acompanhamento Sinarm-CAC (dropdown: Solicitado, Aguardando Baixa GRU, Em Análise, Correção Solicitada, Deferido, Indeferido)
- [x] Adicionar campo "Número de Protocolo" na etapa Acompanhamento Sinarm-CAC
- [x] Expandir todas as atividades por padrão ao abrir página
- [x] Testar e criar checkpoint


## Correção - Remover Expansão Automática

- [x] Remover expansão automática de todas as etapas
- [x] Deixar todas as atividades recolhidas por padrão
- [x] Criar checkpoint


## Ajustes no Workflow e Dashboard

- [x] Verificar se progresso geral está sendo exibido corretamente no card do cliente no Dashboard (já está correto)
- [x] Corrigir contagem de etapas nos cards superiores (Cadastro/On-Boarding, Documentação/Laudos, Juntada-Sinarm-CAC)
- [x] Renomear "Dispachante/PF" para "Juntada-Sinarm-CAC"
- [x] Testar e criar checkpoint


## Correção - Percentual no Dashboard

- [x] Investigar por que o percentual não está sendo exibido no Dashboard
- [x] Verificar se a query está retornando o campo progress
- [x] Corrigir campo isCompleted para completed
- [x] Testar
- [x] Criar checkpoint


## Push para GitHub

- [x] Configurar credenciais Git
- [x] Adicionar remote do GitHub
- [x] Fazer commit de todas as mudanças
- [x] Push para repositório remoto
- [x] Verificar no GitHub


## Documentação do Sistema

- [x] Criar README.md com descrição completa do sistema
- [x] Criar DEPLOYMENT.md com manual de implantação
- [x] Commit e push para GitHub
