FROM oven/bun:1-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace root config files
COPY package.json bunfig.toml bun.lock ./
COPY patches ./patches

# Copy workspace packages for dependency resolution
COPY packages/app/package.json ./packages/app/
COPY packages/sdk/js/package.json ./packages/sdk/js/
COPY packages/ui/package.json ./packages/ui/
COPY packages/util/package.json ./packages/util/
COPY packages/slack/package.json ./packages/slack/
COPY packages/plugin/package.json ./packages/plugin/
COPY packages/script/package.json ./packages/script/

# Install dependencies
RUN bun install

# Stage 2: Build the Vite app
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/app/node_modules ./packages/app/node_modules
COPY --from=deps /app/packages/sdk/js/node_modules ./packages/sdk/js/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/util/node_modules ./packages/util/node_modules
COPY --from=deps /app/packages/slack/node_modules ./packages/slack/node_modules
COPY --from=deps /app/packages/plugin/node_modules ./packages/plugin/node_modules
COPY --from=deps /app/packages/script/node_modules ./packages/script/node_modules

# Copy source code
COPY package.json bunfig.toml ./
COPY packages/app ./packages/app
COPY packages/sdk/js ./packages/sdk/js
COPY packages/ui ./packages/ui
COPY packages/util ./packages/util

WORKDIR /app/packages/app

# Build arguments for environment variables
ARG VITE_CLOUD_SERVER_HOST=localhost
ARG VITE_CLOUD_SERVER_PORT=18080
ARG VITE_APP_PORT=3000
ARG VITE_API_PREFIX=

ENV VITE_CLOUD_SERVER_HOST=$VITE_CLOUD_SERVER_HOST
ENV VITE_CLOUD_SERVER_PORT=$VITE_CLOUD_SERVER_PORT
ENV VITE_APP_PORT=$VITE_APP_PORT
ENV VITE_API_PREFIX=$VITE_API_PREFIX

RUN bun run build

# Stage 3: Production runner with bun
FROM base AS runner
WORKDIR /app

# Environment variables for backend proxy (can be overridden at runtime)
ENV VITE_CLOUD_SERVER_HOST=localhost
ENV VITE_CLOUD_SERVER_PORT=18080
ENV VITE_APP_PORT=3000
ENV VITE_API_PREFIX=

# Copy workspace config files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bunfig.toml ./bunfig.toml
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/patches ./patches

# Copy workspace packages package.json files
COPY --from=builder /app/packages/app/package.json ./packages/app/
COPY --from=builder /app/packages/sdk/js/package.json ./packages/sdk/js/
COPY --from=builder /app/packages/ui/package.json ./packages/ui/
COPY --from=builder /app/packages/util/package.json ./packages/util/

# Copy source code
COPY --from=builder /app/packages/app ./packages/app
COPY --from=builder /app/packages/sdk/js ./packages/sdk/js
COPY --from=builder /app/packages/ui ./packages/ui
COPY --from=builder /app/packages/util ./packages/util

# Install dependencies in runner stage
RUN bun install

WORKDIR /app/packages/app

EXPOSE 3000

CMD ["bun", "run", "start"]
