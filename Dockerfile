# syntax=docker/dockerfile:1
FROM node:22-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Install dependencies first (better layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json components.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY tooling/tsconfig/package.json tooling/tsconfig/package.json
RUN pnpm install --frozen-lockfile

COPY . .

# Build without real env vars — the app uses lazy validation so
# DATABASE_URL etc. aren't required until the first request.
# Dokploy injects real env vars at container runtime.
ENV NEXT_PHASE=phase-production-build
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["pnpm", "--filter", "@future-cmo/web", "start"]
