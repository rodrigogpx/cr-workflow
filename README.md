# Fire Range - Sistema de Workflow CR

Sistema completo de acompanhamento do processo de obtenção do Certificado de Registro (CR) para armas de fogo, desenvolvido para otimizar o gerenciamento de clientes e documentação.

## 📋 Sobre o Projeto

O **Fire Range Workflow CR** é uma aplicação web moderna que facilita o gerenciamento do processo burocrático de obtenção do CR, permitindo que administradores e operadores acompanhem cada etapa do workflow de forma organizada e eficiente.

### Principais Funcionalidades

- **Dashboard Intuitivo**: Visualização clara de estatísticas, clientes ativos e progresso geral
- **Gerenciamento de Clientes**: Cadastro completo com mais de 20 campos de informação
- **Workflow em 8 Etapas**: Processo estruturado desde venda até finalização
- **Sistema de Aprovação**: Controle de acesso com aprovação de novos usuários por administradores
- **Gestão de Documentos**: Upload e organização de documentos por etapa
- **Múltiplos Perfis**: Administradores e operadores com permissões diferenciadas

## 🚀 Tecnologias Utilizadas

### Frontend
- **React 19** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset JavaScript com tipagem estática
- **Tailwind CSS 4** - Framework CSS utility-first
- **Wouter** - Roteamento leve para React
- **shadcn/ui** - Componentes UI acessíveis e customizáveis
- **TanStack Query** - Gerenciamento de estado assíncrono
- **tRPC** - Type-safe API calls

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web minimalista
- **tRPC** - API type-safe end-to-end
- **Drizzle ORM** - ORM TypeScript-first
- **MySQL** - Banco de dados relacional
- **JWT** - Autenticação via JSON Web Tokens
- **OAuth** - Integração com Manus OAuth

### DevOps & Tools
- **Vite** - Build tool e dev server
- **pnpm** - Gerenciador de pacotes rápido
- **ESBuild** - Bundler JavaScript extremamente rápido
- **AWS S3** - Armazenamento de arquivos

## 📦 Instalação

### Pré-requisitos

- Node.js 22.x ou superior
- pnpm 10.x ou superior
- MySQL 8.x ou superior
- Conta AWS (para S3)

### Passo a Passo

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/firerange-workflow.git
cd firerange-workflow
```

2. **Instale as dependências**
```bash
pnpm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL=mysql://usuario:senha@localhost:3306/firerange

# JWT
JWT_SECRET=sua-chave-secreta-super-segura

# OAuth (Manus)
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=seu-open-id
OWNER_NAME=Seu Nome

# AWS S3
AWS_ACCESS_KEY_ID=sua-access-key
AWS_SECRET_ACCESS_KEY=sua-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=seu-bucket

# App
VITE_APP_TITLE=Fire Range - Workflow CR
VITE_APP_LOGO=/logo.svg
```

4. **Execute as migrações do banco de dados**
```bash
pnpm db:push
```

5. **Inicie o servidor de desenvolvimento**
```bash
pnpm dev
```

O aplicativo estará disponível em `http://localhost:3000`

## 🏗️ Estrutura do Projeto

```
firerange-workflow/
├── client/                 # Frontend React
│   ├── public/            # Arquivos estáticos
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── contexts/      # Contextos React
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── lib/           # Utilitários
│   │   └── App.tsx        # Componente raiz
├── server/                # Backend Node.js
│   ├── _core/            # Core do servidor
│   └── index.ts          # Entry point
├── drizzle/              # Schema e migrações do banco
├── shared/               # Código compartilhado
└── patches/              # Patches de dependências
```

## 🎯 Workflow do Sistema

O sistema gerencia 8 etapas principais:

1. **Processo de Venda** - Registro inicial do cliente
2. **Cadastro** - Coleta de dados pessoais completos (20+ campos)
3. **Boas Vindas** - Envio de mensagens e checklist
   - Enviar mensagem de boas-vindas
   - Enviar checklist de documentos
   - Criar pasta digital do cliente
4. **Agendamento Psicotécnico** - Gestão do exame psicológico
   - Enviar encaminhamento para clínica
   - Cliente agendar exame
   - Confirmar realização do exame
   - Receber laudo aprovado
5. **Juntada de Documento** - Upload de 8 documentos obrigatórios
6. **Laudo Arma de Fogo** - Exame de capacidade técnica
7. **Despachante** - Envio para despachante
8. **Fim** - Conclusão do processo

## 👥 Perfis de Usuário

### Administrador
- Visualiza todos os clientes
- Cria e deleta clientes
- Aprova novos usuários
- Delega clientes para operadores
- Acessa painel administrativo completo

### Operador
- Visualiza apenas clientes delegados
- Gerencia workflow dos seus clientes
- Faz upload de documentos
- Atualiza status das etapas

### Novo Usuário (Pendente)
- Aguarda aprovação do administrador
- Sem acesso ao sistema até receber perfil

## 🔒 Segurança

- Autenticação via OAuth (Manus)
- Tokens JWT para sessões
- Controle de acesso baseado em roles
- Validação de permissões em todas as rotas
- Armazenamento seguro de arquivos no S3

## 📱 Scripts Disponíveis

```bash
# Desenvolvimento
pnpm dev              # Inicia servidor de desenvolvimento

# Build
pnpm build            # Compila para produção

# Produção
pnpm start            # Inicia servidor de produção

# Database
pnpm db:push          # Executa migrações do banco

# Qualidade de Código
pnpm check            # Verifica tipos TypeScript
pnpm format           # Formata código com Prettier
pnpm test             # Executa testes
```

## 🎨 Design

O sistema utiliza um tema claro moderno com:
- Paleta de cores profissional
- Cards com sombras suaves
- Layout responsivo
- Componentes acessíveis (WCAG)
- Feedback visual em todas as ações

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, entre em contato através de:
- Email: suporte@firerange.com.br
- Website: https://firerange.com.br

---

Desenvolvido com ❤️ pela equipe Fire Range
