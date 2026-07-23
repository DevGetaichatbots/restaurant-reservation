# Two-stage build for the API: install once, then run the TypeScript source
# directly with tsx — the same way `pnpm dev` already does locally.
#
# @rms/db, @rms/contracts, and @rms/rules are deliberately never compiled to
# JS (see each package.json: "main"/"exports" point straight at src/index.ts,
# consumed via tsx + NodeNext .js-extension imports). A tsc build of apps/api
# alone produces a dist/ that imports those packages' raw .ts source at
# runtime under plain `node`, which cannot load it — this image sidesteps
# that mismatch entirely by running the whole app under tsx, in dev and in
# production alike, rather than maintaining two different ways of resolving
# the same workspace packages.
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

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user. If the process is ever compromised, it has no
# privileges inside the container to escalate with.
RUN addgroup -S app && adduser -S app -G app

# Each workspace package's own node_modules holds its direct dependencies as
# symlinks (pnpm's isolated install) — the root node_modules alone is not
# enough; @fastify/autoload, drizzle-orm, zod, temporal-polyfill etc. all
# live under their consuming package's own node_modules.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/rules/node_modules ./packages/rules/node_modules

# Source only — no dist. tsx compiles on the fly, exactly like local dev.
COPY apps/api/package.json  ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src           ./apps/api/src
COPY packages/db/package.json        ./packages/db/
COPY packages/db/src                 ./packages/db/src
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/contracts/src          ./packages/contracts/src
COPY packages/rules/package.json     ./packages/rules/
COPY packages/rules/src              ./packages/rules/src

USER app

EXPOSE 4000

# Render overrides PORT at runtime; the default keeps local `docker run` working.
ENV PORT=4000

CMD ["node", "apps/api/node_modules/tsx/dist/cli.mjs", "apps/api/src/server.ts"]
