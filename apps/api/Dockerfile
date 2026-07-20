# Multi-stage build for the API.
#
# The same image runs on Render today and on AWS Fargate later — which is the
# whole point of containerising rather than relying on a platform's own build
# system. Moving hosts becomes an infrastructure change, not a code change.

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json       ./apps/api/
COPY packages/db/package.json    ./packages/db/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/rules/package.json ./packages/rules/

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

RUN pnpm --filter @rms/api build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user. If the process is ever compromised, it has no
# privileges inside the container to escalate with.
RUN addgroup -S app && adduser -S app -G app

RUN corepack enable

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages

USER app

EXPOSE 4000

# Render overrides PORT at runtime; the default keeps local `docker run` working.
ENV PORT=4000

CMD ["node", "apps/api/dist/server.js"]
