# ============================================
# Dockerfile - CAC 360 Sistema Multi-Tenant
# Arquitetura: Docker Puro (sem Swarm)
# Stack: Node.js 22 + React 19 + PostgreSQL 16
# ============================================

# ============================================
# STAGE 1: Build Frontend (Vite)
# ============================================
FROM node:22-alpine AS frontend-builder

LABEL stage=builder
LABEL description="Frontend builder stage"

WORKDIR /app

# Copiar apenas arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm globalmente
RUN npm install -g pnpm && npm cache clean --force

# Instalar dependências (incluindo patches)
RUN pnpm install --frozen-lockfile

# Copiar código-fonte completo
COPY . .

# Build do frontend
RUN pnpm build:client

# ============================================
# STAGE 2: Build Backend (esbuild)
# ============================================
FROM node:22-alpine AS backend-builder

LABEL stage=builder
LABEL description="Backend builder stage"

WORKDIR /app

# Copiar apenas arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm globalmente
RUN npm install -g pnpm && npm cache clean --force

# Instalar todas as dependências
RUN pnpm install --frozen-lockfile

# Copiar código-fonte completo
COPY . .

# Build do backend
RUN pnpm run build

# ============================================
# STAGE 3: Imagem de Produção
# ============================================
FROM node:22-alpine

LABEL maintainer="Rodrigo Parreira <rodrigogpx@gmail.com>"
LABEL description="CAC 360 - Sistema Multi-Tenant de Gestão de Workflow CR"
LABEL version="1.0.0"

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm && npm cache clean --force

# Copiar apenas arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod && \
    pnpm prune --prod

# Copiar build do frontend
COPY --from=frontend-builder /app/dist ./dist

# Copiar build do backend
COPY --from=backend-builder /app/dist ./dist

# Copiar configurações necessárias
COPY drizzle ./drizzle
COPY email-templates ./email-templates

# Criar diretório para logs
RUN mkdir -p /app/logs && chmod 755 /app/logs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Comando de inicialização
CMD ["sh", "-c", "pnpm db:push && pnpm start"]
