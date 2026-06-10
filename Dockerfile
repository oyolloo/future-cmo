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

# Dokploy exposes Environment-tab variables as build args when declared via ARG.
# NEXT_PUBLIC_* must exist at build time (baked into the client bundle).
ARG DATABASE_URL
ARG JWT_SECRET
ARG SESSION_MAX_AGE=604800
ARG GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV DATABASE_URL=$DATABASE_URL \
    JWT_SECRET=$JWT_SECRET \
    SESSION_MAX_AGE=$SESSION_MAX_AGE \
    GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["pnpm", "--filter", "@future-cmo/web", "start"]
