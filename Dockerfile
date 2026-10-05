# ==============================================================================
# Dockerfile — sgrai-api (Next.js + Socket.io custom server)
# Multi-stage build: deps → build → runner
# ==============================================================================

# -- Etapa 1: Dependencias --
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -- Etapa 2: Build --
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -- Etapa 3: Runtime --
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output (pages/routes compilados)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Custom server compilado y fuentes necesarios
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./
# Dependencias de runtime para tsx y socket.io
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Asegurar permisos del directorio /app para el usuario no privilegiado
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 4001
ENV PORT=4001
ENV HOSTNAME="0.0.0.0"

CMD ["npx", "tsx", "src/server.ts"]
