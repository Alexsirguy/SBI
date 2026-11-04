# syntax=docker/dockerfile:1.7
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

FROM deps AS migrate
ENV NODE_ENV=production NODE_OPTIONS=--import=/app/infra/docker/database-url.mjs
USER node
CMD ["pnpm", "db:migrate"]

FROM deps AS api-build
RUN pnpm --filter @sbi/api build

# The bundle leaves npm packages external, so a flat install lets dist resolve them.
FROM base AS api-modules
COPY . .
RUN pnpm install --prod --frozen-lockfile --config.node-linker=hoisted --filter @sbi/api...

FROM node:22-slim AS api
ENV NODE_ENV=production PORT=4000 NODE_OPTIONS=--import=/app/infra/docker/database-url.mjs
WORKDIR /app
COPY --from=api-modules /app/node_modules ./node_modules
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/package.json
COPY infra/docker/database-url.mjs ./infra/docker/database-url.mjs
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]

FROM deps AS web-build
# Next inlines public variables into the bundle, so they must be known at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FEATURE_FLAGS
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_MIXPANEL_TOKEN
ARG NEXT_PUBLIC_CAPTURE_MAX_DIMENSION
ARG NEXT_PUBLIC_CAPTURE_JPEG_QUALITY
ARG NEXT_PUBLIC_CAPTURE_MAX_UPLOAD_MB
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @sbi/web build

FROM node:22-slim AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
