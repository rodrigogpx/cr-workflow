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

# Railway injeta a variável PORT automaticamente
# Fallback para 3000 se não estiver definida
ENV PORT=3000

# Expor porta da aplicação
EXPOSE $PORT

# Healthcheck para Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Comando de inicialização
# Ao subir o container, aplica as migrações (db:push) e o seed (db:seed)
# antes de iniciar o servidor HTTP.
CMD ["sh", "-c", "pnpm db:push && pnpm db:seed && pnpm start"]
