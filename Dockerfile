# Dockerfile para Sistema de Workflow CR - Firing Range
# Desenvolvido por ACR Digital

# Stage 1: Build do frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Variáveis de ambiente para o build do frontend (Vite)
ARG VITE_APP_TITLE="Firing Range - Sistema de Workflow CR"
ARG VITE_APP_LOGO="/logo.webp"
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_APP_LOGO=$VITE_APP_LOGO

# Copiar arquivos de dependências e patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar pnpm e dependências (sem frozen-lockfile para aceitar lockfile levemente desatualizado)
RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

# Copiar código fonte
COPY . .

# Build do frontend (usa script "build" do package.json)
RUN pnpm build

# Stage 2: Imagem de produção
FROM node:22-alpine

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Copiar arquivos de dependências e patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Reutilizar node_modules do stage de build (já com pnpm install executado)
COPY --from=frontend-builder /app/node_modules ./node_modules

# Copiar código fonte do servidor
COPY server ./server
COPY drizzle ./drizzle
COPY shared ./shared
COPY drizzle.config.ts ./

# Copiar build do frontend do stage anterior
COPY --from=frontend-builder /app/dist ./dist

# Expor porta da aplicação
EXPOSE 3000

# Comando de inicialização
CMD ["pnpm", "start"]
