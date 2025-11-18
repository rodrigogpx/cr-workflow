# Dockerfile para Sistema de Workflow CR - Firing Range
# Desenvolvido por ACR Digital

# Stage 1: Build do frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm e dependências
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build do frontend
RUN pnpm build:client

# Stage 2: Imagem de produção
FROM node:22-alpine

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Copiar código fonte do servidor
COPY server ./server
COPY drizzle ./drizzle
COPY shared ./shared

# Copiar build do frontend do stage anterior
COPY --from=frontend-builder /app/dist ./dist

# Expor porta da aplicação
EXPOSE 3000

# Comando de inicialização
CMD ["pnpm", "start"]
