# PWA Next.js — build context: raiz do monorepo (Railway: Root Directory = /, Dockerfile = apps/web/Dockerfile)
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@12.6.0
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter web...
COPY packages/ packages/
COPY apps/web/ apps/web/
# NEXT_PUBLIC_* e as rewrites de /api são fixados no build: o Railway repassa as variáveis do serviço como build args.
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_API_MOCKING=false
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_REMESSA_CONFORME=false
ARG NEXT_PUBLIC_REMESSA_CONFORME_ADE
ARG NEXT_PUBLIC_REMESSA_CONFORME_SELO
ARG NEXT_PUBLIC_REMESSA_CONFORME_CICLO
ARG API_PROXY_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_MOCKING=$NEXT_PUBLIC_API_MOCKING \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=$NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_REMESSA_CONFORME=$NEXT_PUBLIC_REMESSA_CONFORME \
    NEXT_PUBLIC_REMESSA_CONFORME_ADE=$NEXT_PUBLIC_REMESSA_CONFORME_ADE \
    NEXT_PUBLIC_REMESSA_CONFORME_SELO=$NEXT_PUBLIC_REMESSA_CONFORME_SELO \
    NEXT_PUBLIC_REMESSA_CONFORME_CICLO=$NEXT_PUBLIC_REMESSA_CONFORME_CICLO \
    API_PROXY_URL=$API_PROXY_URL
RUN pnpm --filter web build

FROM build AS run
ENV NODE_ENV=production PORT=3000
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["sh", "-c", "exec node_modules/.bin/next start -H 0.0.0.0 -p ${PORT}"]
