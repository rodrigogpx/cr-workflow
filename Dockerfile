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

# Copiar manifestos de dependências
COPY package.json pnpm-lock.yaml ./

# Copiar patches antes da instalação para que pnpm os encontre
COPY patches ./patches

# Instalar pnpm com versão fixada (alinhado com packageManager no package.json)
ARG PNPM_VERSION=10.15.1
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force

# Instalar dependências (com fallback quando o lock estiver ausente/desatualizado)
RUN set -eux; \
    if [ -f pnpm-lock.yaml ] && [ -s pnpm-lock.yaml ]; then \
      if ! pnpm install --frozen-lockfile; then \
        echo "pnpm-lock.yaml desatualizado. Reinstalando sem travamento"; \
        pnpm install --no-frozen-lockfile; \
      fi; \
    else \
      echo "pnpm-lock.yaml ausente. Instalando dependências sem travamento"; \
      pnpm install --no-frozen-lockfile; \
    fi

# Copiar código-fonte completo
# ARG abaixo invalida o cache desta layer a cada rebuild
ARG REBUILD_AT=20260415a
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

# Copiar manifestos de dependências e patches necessários
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar pnpm com versão fixada
ARG PNPM_VERSION=10.15.1
# cache-bust: 2026-04-07
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force

# Instalar todas as dependências com fallback remoto
RUN set -eux; \
    if [ -f pnpm-lock.yaml ] && [ -s pnpm-lock.yaml ]; then \
      if ! pnpm install --frozen-lockfile; then \
        echo "pnpm-lock.yaml desatualizado. Reinstalando sem travamento"; \
        pnpm install --no-frozen-lockfile; \
      fi; \
    else \
      echo "pnpm-lock.yaml ausente. Instalando dependências sem travamento"; \
      pnpm install --no-frozen-lockfile; \
    fi

# Copiar código-fonte completo
# ARG abaixo invalida o cache desta layer a cada rebuild
ARG REBUILD_AT=20260415a
COPY . .

# Baixar fonte cursiva DancingScript para assinatura nos PDFs
# Tenta múltiplas URLs (variável e estática) com fallback para Lora-Italic já no repo
RUN apk add --no-cache curl \
    && mkdir -p /app/server/fonts \
    && (curl --retry 3 --retry-delay 2 --max-time 20 -L \
         "https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf" \
         -o /app/server/fonts/DancingScript-Regular.ttf \
         && file /app/server/fonts/DancingScript-Regular.ttf | grep -q "TrueType\|OpenType\|font" \
         && echo "[font] DancingScript baixado com sucesso (variável)" \
    ) || (curl --retry 3 --retry-delay 2 --max-time 20 -L \
         "https://github.com/google/fonts/raw/main/ofl/dancingscript/static/DancingScript-Regular.ttf" \
         -o /app/server/fonts/DancingScript-Regular.ttf \
         && file /app/server/fonts/DancingScript-Regular.ttf | grep -q "TrueType\|OpenType\|font" \
         && echo "[font] DancingScript baixado com sucesso (estático)" \
    ) || echo "[font] Download falhou — Lora-Italic (repo) será usada como fallback cursivo"

# Build do backend
RUN pnpm run build:server

# Remover dependências de desenvolvimento e manter apenas o necessário para produção
RUN pnpm prune --prod

# ============================================
# STAGE 3: Imagem de Produção
# ============================================
FROM node:22-alpine

LABEL maintainer="Rodrigo Parreira <rodrigogpx@gmail.com>"
LABEL description="CAC 360 - Sistema Multi-Tenant de Gestão de Workflow CR"
LABEL version="1.0.0"

WORKDIR /app

# Instalar pnpm com versão fixada
ARG PNPM_VERSION=10.15.1
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force

# Copiar manifestos para referência em runtime
COPY package.json ./
COPY --from=backend-builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Reutilizar node_modules já podado do estágio de backend
COPY --from=backend-builder /app/node_modules ./node_modules

# Copiar build do frontend
COPY --from=frontend-builder /app/dist ./dist

# Copiar build do backend
COPY --from=backend-builder /app/dist ./dist

# Copiar configurações necessárias
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
COPY email-templates ./email-templates
COPY scripts ./scripts

# Copiar fontes para os PDFs
COPY --from=backend-builder /app/server/fonts ./server/fonts

# Criar diretório para logs
RUN mkdir -p /app/logs && chmod 755 /app/logs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "const port = process.env.PORT || 3000; require('http').get('http://localhost:' + port + '/health', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })" || exit 1

# Comando de inicialização
# O comando de inicialização é gerenciado pelo railway.json/toml em produção.
# Este CMD serve como fallback para execução local via Docker.
CMD ["sh", "-c", "echo '[Startup] Running database migrations (drizzle-kit push)...' && pnpm db:push && echo '[Startup] Starting server...' && pnpm start"]
