# 📤 Guia de Envio para GitHub

Este guia te ajudará a enviar o projeto Fire Range Workflow para o GitHub passo a passo.

## 🔐 Pré-requisitos

1. **Conta no GitHub**: Se ainda não tem, crie em [github.com](https://github.com)
2. **Git instalado**: Verifique com `git --version`
3. **Acesso SSH ou Token**: Configure autenticação no GitHub

## 📝 Passo a Passo

### 1. Criar Repositório no GitHub

1. Acesse [github.com/new](https://github.com/new)
2. Preencha os dados:
   - **Repository name**: `firerange-workflow` (ou nome de sua preferência)
   - **Description**: "Sistema de gerenciamento de workflow para obtenção de CR"
   - **Visibility**: Private (recomendado) ou Public
   - **NÃO marque**: "Initialize this repository with a README" (já temos um)
3. Clique em **"Create repository"**

### 2. Configurar Git Local

No terminal, execute os seguintes comandos:

```bash
# Navegue até o diretório do projeto
cd /home/ubuntu/firerange-workflow

# Configure seu nome e email (se ainda não configurou)
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

### 3. Preparar Commit

```bash
# Adicione todos os arquivos ao staging
git add .

# Crie um commit com mensagem descritiva
git commit -m "feat: Sistema completo Fire Range Workflow CR

- Dashboard com estatísticas e busca
- Gerenciamento de clientes com CRUD completo
- Workflow em 8 etapas com sub-tarefas
- Sistema de aprovação de usuários
- Formulário de cadastro com 20+ campos
- Upload de documentos por etapa
- Controle de acesso por perfil (admin/operador)
- Tema claro moderno e responsivo"
```

### 4. Conectar ao Repositório Remoto

Substitua `SEU-USUARIO` pelo seu nome de usuário do GitHub:

```bash
# Adicione o repositório remoto
git remote add origin https://github.com/SEU-USUARIO/firerange-workflow.git

# Ou, se preferir SSH:
git remote add origin git@github.com:SEU-USUARIO/firerange-workflow.git

# Verifique se foi adicionado corretamente
git remote -v
```

### 5. Enviar para o GitHub

```bash
# Envie o código para o GitHub
git push -u origin main

# Se der erro de branch, tente:
git branch -M main
git push -u origin main
```

## 🔑 Autenticação

### Opção 1: HTTPS com Token (Recomendado)

1. Vá em GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Clique em "Generate new token (classic)"
3. Dê um nome (ex: "Fire Range Workflow")
4. Marque o escopo `repo` (acesso completo a repositórios privados)
5. Clique em "Generate token"
6. **Copie o token** (você não verá ele novamente!)
7. Quando o Git pedir senha, use o **token** ao invés da senha

### Opção 2: SSH

```bash
# Gere uma chave SSH (se ainda não tem)
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"

# Copie a chave pública
cat ~/.ssh/id_ed25519.pub

# Adicione no GitHub:
# Settings → SSH and GPG keys → New SSH key
# Cole a chave e salve
```

## ✅ Verificar Envio

Após o push, acesse seu repositório no GitHub:
```
https://github.com/SEU-USUARIO/firerange-workflow
```

Você deverá ver:
- ✅ Todos os arquivos do projeto
- ✅ README.md renderizado na página inicial
- ✅ Histórico de commits

## 📦 Próximos Passos

### Adicionar Badge de Status

Adicione ao README.md:
```markdown
![GitHub last commit](https://img.shields.io/github/last-commit/SEU-USUARIO/firerange-workflow)
![GitHub issues](https://img.shields.io/github/issues/SEU-USUARIO/firerange-workflow)
```

### Proteger Branch Main

1. Vá em Settings → Branches
2. Adicione regra para `main`:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging

### Configurar GitHub Actions (CI/CD)

Crie `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    - uses: pnpm/action-setup@v2
      with:
        version: 10
    - uses: actions/setup-node@v3
      with:
        node-version: '22'
        cache: 'pnpm'
    
    - run: pnpm install
    - run: pnpm check
    - run: pnpm build
```

## 🚨 Importante: Segurança

### ⚠️ NUNCA commite:
- ❌ Arquivo `.env` (já está no .gitignore)
- ❌ Credenciais AWS
- ❌ Tokens ou senhas
- ❌ Chaves privadas

### ✅ Use GitHub Secrets para CI/CD:
1. Settings → Secrets and variables → Actions
2. Adicione:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

## 🤝 Colaboração

### Adicionar Colaboradores

1. Settings → Collaborators
2. Adicione por username ou email
3. Escolha permissão (Read, Write, Admin)

### Workflow de Contribuição

```bash
# 1. Crie uma branch para nova feature
git checkout -b feature/nome-da-feature

# 2. Faça suas alterações e commit
git add .
git commit -m "feat: descrição da feature"

# 3. Envie a branch
git push origin feature/nome-da-feature

# 4. Abra Pull Request no GitHub
# 5. Aguarde review e merge
```

## 📞 Problemas Comuns

### Erro: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/SEU-USUARIO/firerange-workflow.git
```

### Erro: "failed to push some refs"
```bash
# Puxe as mudanças primeiro
git pull origin main --rebase
git push origin main
```

### Erro: "Permission denied (publickey)"
```bash
# Verifique se a chave SSH está adicionada
ssh -T git@github.com
# Deve retornar: "Hi SEU-USUARIO! You've successfully authenticated"
```

---

## 🎉 Pronto!

Seu projeto está agora no GitHub e pronto para ser compartilhado, colaborado e versionado!

Para mais informações, consulte a [documentação oficial do GitHub](https://docs.github.com).
