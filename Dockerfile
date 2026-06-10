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

# NEXT_PUBLIC_* values are baked into the client bundle at build time.
# Dokploy passes "Build-time Arguments" as --build-arg.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# Build without real server env vars — env.ts and the db client relax
# validation during the build phase (NEXT_PHASE scoped to this command only).
# Dokploy injects the real env vars at container runtime.
RUN NEXT_PHASE=phase-production-build pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["pnpm", "--filter", "@future-cmo/web", "start"]
