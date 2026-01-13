# Dockerfile - CAC 360 Sistema de Workflow CR
# Migração: Docker Swarm → Docker Puro
# Otimizado para: Node.js 22 + React 19 + PostgreSQL 16

# ============================================
# STAGE 1: Build do Frontend
# ============================================
FROM node:22-alpine AS frontend-builder

LABEL stage=builder

WORKDIR /app

# Copiar todos os arquivos (incluindo patches)
COPY . .

# Instalar pnpm e dependências
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Build do frontend (Vite)
RUN pnpm build:client

# ============================================
# STAGE 2: Imagem de Produção
# ============================================
FROM node:22-alpine

LABEL maintainer="Rodrigo Parreira <rodrigogpx@gmail.com>"
LABEL description="CAC 360 - Sistema Multi-Tenant de Gestão de Workflow CR"
LABEL version="1.0.0"

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm && \
    npm cache clean --force

# Copiar todos os arquivos (incluindo patches)
COPY . .

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod && \
    pnpm prune --prod

# Copiar build do frontend do stage anterior
COPY --from=frontend-builder /app/dist ./dist

# Criar diretório para logs (opcional)
RUN mkdir -p /app/logs && \
    chmod 755 /app/logs

# Expor porta da aplicação
EXPOSE 3000

# Health check - Validar saúde da aplicação
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Comando de inicialização
# 1. Executar migrações do banco
# 2. Iniciar aplicação
CMD ["sh", "-c", "pnpm db:push && pnpm start"]
