# Sistema de Workflow CR - Firing Range

Sistema completo de gerenciamento de workflow para obtenção de Certificado de Registro (CR) de armas de fogo, desenvolvido para o clube de tiro **Firing Range**.

## Visão Geral

O Sistema de Workflow CR é uma aplicação web moderna que automatiza e gerencia todo o processo de obtenção do Certificado de Registro (CR) para membros do clube Firing Range. O sistema oferece controle completo sobre cada etapa do processo, desde o cadastro inicial até o acompanhamento final no sistema Sinarm-CAC da Polícia Federal.

## Funcionalidades Principais

### Gestão de Clientes

O sistema permite o cadastro completo de clientes com informações essenciais como nome, CPF, telefone e email. Cada cliente possui um workflow individual que acompanha todas as etapas do processo de obtenção do CR. O Dashboard apresenta cards visuais para cada cliente com indicador de progresso em tempo real, mostrando a porcentagem de conclusão baseada nas etapas completadas.

### Workflow de 6 Etapas

O processo de obtenção do CR é dividido em seis etapas sequenciais organizadas em três fases principais:

**Fase 1: Cadastro e Boas-Vindas**
- **Cadastro**: Coleta de dados pessoais do cliente através de formulário completo com campos para documentos de identificação, endereço, filiação e informações profissionais
- **Boas Vindas**: Envio automatizado de três emails personalizáveis (boas-vindas ao clube, explicação do processo CR e atualização de status)

**Fase 2: Documentação e Laudos**
- **Agendamento Avaliação Psicológica**: Organização da avaliação psicológica obrigatória para concessão de registro e porte de arma de fogo
- **Agendamento Laudo de Capacidade Técnica**: Coordenação do exame de capacidade técnica necessário para obtenção do Certificado de Registro

**Fase 3: Finalização**
- **Juntada de Documentos**: Compilação e organização de toda documentação necessária para submissão ao Sinarm
- **Acompanhamento Sinarm-CAC**: Monitoramento do processo junto à Polícia Federal com campos específicos para número de protocolo e status (Solicitado, Aguardando Baixa GRU, Em Análise, Correção Solicitada, Deferido, Indeferido)

Cada etapa pode ser marcada como concluída individualmente, permitindo controle granular do progresso. O sistema calcula automaticamente o percentual de conclusão tanto por fase quanto geral.

### Sistema de Templates de Email

A área administrativa oferece editor completo para personalização dos três templates de email da etapa Boas Vindas. Os administradores podem editar assunto e conteúdo de cada email, com suporte a variáveis dinâmicas como `{{nome}}` que são substituídas automaticamente pelos dados do cliente. Os templates são salvos no banco de dados e aplicados a todos os novos envios.

No workflow do cliente, os operadores visualizam os emails com conteúdo já preenchido e podem enviá-los com um clique. O sistema registra automaticamente data e horário de envio, impedindo envios duplicados e mantendo histórico completo de comunicações.

### Controle de Acesso e Permissões

O sistema implementa dois níveis de acesso com funcionalidades diferenciadas:

**Administradores** possuem acesso completo ao sistema, incluindo visualização de todos os clientes independente do operador responsável, gestão de templates de email, acesso a estatísticas globais e ferramentas administrativas avançadas.

**Operadores** visualizam apenas os clientes sob sua responsabilidade, podem gerenciar workflows individuais, enviar emails e atualizar status das etapas, mas não têm acesso a configurações administrativas.

A autenticação é realizada via OAuth integrado com contas Manus, garantindo segurança e facilidade de acesso sem necessidade de gerenciar senhas adicionais.

### Dashboard Administrativo

A página administrativa centraliza ferramentas de gestão e oferece visão estratégica do sistema através de estatísticas globais (total de clientes, clientes em andamento e concluídos). Administradores acessam rapidamente a edição de templates de email e podem expandir funcionalidades conforme necessidade do negócio.

### Interface Moderna e Responsiva

O sistema utiliza design moderno com paleta de cores personalizada (azul, verde e laranja), cards visuais para organização de informações e barras de progresso animadas. A interface é totalmente responsiva, adaptando-se perfeitamente a desktops, tablets e smartphones. Todas as etapas do workflow são expansíveis/recolhíveis para melhor organização visual.

## Tecnologias Utilizadas

### Frontend
- **React 19**: Biblioteca JavaScript moderna para construção de interfaces de usuário
- **TypeScript**: Superset do JavaScript que adiciona tipagem estática
- **Tailwind CSS 4**: Framework CSS utility-first para estilização rápida e consistente
- **shadcn/ui**: Coleção de componentes React reutilizáveis e acessíveis
- **Wouter**: Roteador leve para navegação entre páginas
- **TanStack Query (React Query)**: Gerenciamento de estado assíncrono e cache de dados
- **Vite**: Build tool ultrarrápido para desenvolvimento e produção

### Backend
- **Node.js 22**: Runtime JavaScript server-side
- **tRPC**: Framework para criação de APIs type-safe sem necessidade de schemas
- **Drizzle ORM**: ORM TypeScript-first para interação com banco de dados
- **MySQL**: Banco de dados relacional para persistência de dados

### Infraestrutura
- **Manus Platform**: Plataforma de hospedagem e deploy automatizado
- **OAuth Manus**: Sistema de autenticação integrado
- **pnpm**: Gerenciador de pacotes eficiente

## Estrutura do Projeto

```
firerange-workflow/
├── client/                    # Frontend React
│   ├── public/               # Arquivos estáticos
│   └── src/
│       ├── components/       # Componentes reutilizáveis
│       │   ├── ui/          # Componentes shadcn/ui
│       │   ├── EmailEditor.tsx
│       │   └── EmailPreview.tsx
│       ├── contexts/         # Contextos React
│       │   └── ThemeContext.tsx
│       ├── hooks/            # Custom hooks
│       ├── lib/              # Utilitários
│       ├── pages/            # Páginas da aplicação
│       │   ├── Dashboard.tsx
│       │   ├── ClientWorkflow.tsx
│       │   ├── Admin.tsx
│       │   ├── EmailTemplates.tsx
│       │   └── PendingApproval.tsx
│       ├── App.tsx           # Roteamento principal
│       ├── main.tsx          # Entry point
│       └── index.css         # Estilos globais
├── server/                    # Backend Node.js
│   ├── _core/                # Core do servidor
│   ├── db.ts                 # Funções de banco de dados
│   ├── routers.ts            # Rotas tRPC
│   └── generate-pdf.ts       # Geração de PDFs
├── drizzle/                   # Schemas e migrações
│   └── schema.ts             # Definição das tabelas
├── shared/                    # Código compartilhado
│   └── const.ts              # Constantes
└── package.json              # Dependências e scripts
```

## Banco de Dados

O sistema utiliza MySQL com as seguintes tabelas principais:

### clients
Armazena informações completas dos clientes incluindo dados pessoais (nome, CPF, telefone, email), documentos de identificação (RG, data de nascimento, naturalidade), endereço completo, filiação (nome do pai e mãe) e informações profissionais (profissão, registro profissional, atividades atuais). Cada cliente está vinculado a um operador responsável.

### workflowSteps
Gerencia todas as etapas do workflow de cada cliente com campos para título da etapa, status de conclusão, data de conclusão, agendamentos de laudos (data, nome do examinador) e acompanhamento Sinarm (status e número de protocolo). O relacionamento com a tabela clients permite rastreamento completo do progresso individual.

### emailTemplates
Armazena os templates personalizáveis de email com chave única (templateKey), assunto e conteúdo. Suporta variáveis dinâmicas que são substituídas no momento do envio.

### emailLogs
Mantém histórico completo de todos os emails enviados, registrando cliente destinatário, template utilizado, endereço de email, data e horário de envio. Permite auditoria e impede envios duplicados.

### users
Gerencia usuários do sistema com autenticação OAuth, armazenando informações de perfil, role (admin/operator) e timestamps de criação e último acesso.

## Fluxo de Uso

O administrador acessa a área administrativa para configurar os templates de email personalizados conforme a comunicação padrão do clube. Um operador realiza login no sistema e cadastra um novo cliente através do formulário completo no Dashboard. O sistema cria automaticamente o workflow com as seis etapas para o cliente.

O operador acessa o workflow do cliente e expande a etapa "Cadastro" para preencher informações detalhadas do formulário. Após completar o cadastro, marca a etapa como concluída. Na etapa "Boas Vindas", o operador visualiza os três emails pré-configurados e envia cada um com um clique. O sistema registra automaticamente os envios.

O operador agenda as avaliações psicológica e técnica nas respectivas etapas, preenchendo datas e informações dos examinadores. Após realização dos exames, marca as etapas como concluídas. Na etapa "Juntada de Documentos", organiza toda documentação necessária e marca como concluída quando pronta para submissão.

Na etapa final "Acompanhamento Sinarm-CAC", o operador registra o número de protocolo da solicitação junto à Polícia Federal e atualiza o status conforme andamento do processo (Solicitado → Aguardando Baixa GRU → Em Análise → Deferido/Indeferido). O Dashboard atualiza automaticamente o percentual de conclusão conforme as etapas são completadas.

## Segurança

O sistema implementa múltiplas camadas de segurança para proteção de dados sensíveis. A autenticação via OAuth Manus elimina necessidade de gerenciar senhas localmente e oferece login seguro com contas existentes. O controle de acesso baseado em roles garante que operadores visualizem apenas seus próprios clientes enquanto administradores têm visão completa.

Todas as comunicações entre cliente e servidor utilizam HTTPS para criptografia de dados em trânsito. O banco de dados armazena informações sensíveis com proteção adequada e o sistema registra logs de auditoria para rastreamento de ações críticas como envio de emails e alterações de status.

## Personalização

O sistema foi projetado com flexibilidade para adaptação às necessidades específicas do Firing Range. A paleta de cores pode ser ajustada através do arquivo `client/src/index.css` modificando as variáveis CSS customizadas. O logo do clube é configurável através da constante `APP_LOGO` em `client/src/const.ts`.

Os templates de email são completamente editáveis pela interface administrativa sem necessidade de alteração de código. Novas etapas podem ser adicionadas ao workflow modificando o arquivo `server/routers.ts` na função de criação de cliente. Campos adicionais no formulário de cadastro podem ser incluídos atualizando o schema em `drizzle/schema.ts` e a interface em `client/src/pages/ClientWorkflow.tsx`.

## Suporte e Manutenção

Para dúvidas sobre funcionalidades do sistema, consulte este README e o manual de implantação (DEPLOYMENT.md). Problemas técnicos ou bugs devem ser reportados através das issues do repositório GitHub. Sugestões de melhorias e novas funcionalidades são bem-vindas via pull requests.

## Licença

Sistema desenvolvido pela **ACR Digital** exclusivamente para Firing Range. Todos os direitos reservados © 2025 ACR Digital.

---

**Desenvolvido por ACR Digital para Firing Range**
