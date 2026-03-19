FROM oven/bun:1-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace root config files
COPY package.json bunfig.toml ./
COPY packages/app/package.json ./packages/app/

# Copy workspace packages that app depends on
COPY packages/sdk/js/package.json ./packages/sdk/js/
COPY packages/ui/package.json ./packages/ui/
COPY packages/util/package.json ./packages/util/

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 2: Build the Vite app
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/app/node_modules ./packages/app/node_modules
COPY --from=deps /app/packages/sdk/js/node_modules ./packages/sdk/js/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/util/node_modules ./packages/util/node_modules

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

ENV VITE_CLOUD_SERVER_HOST=$VITE_CLOUD_SERVER_HOST
ENV VITE_CLOUD_SERVER_PORT=$VITE_CLOUD_SERVER_PORT
ENV VITE_APP_PORT=$VITE_APP_PORT

RUN bun run build

# Stage 3: Production runner with nginx
FROM nginx:alpine AS runner
WORKDIR /app

# Environment variables for backend proxy (can be overridden at runtime)
ENV CLOUD_SERVER_HOST=localhost
ENV CLOUD_SERVER_PORT=18080

# Copy nginx template and entrypoint script
COPY --from=builder /app/packages/app/nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY --from=builder /app/packages/app/docker-entrypoint.sh /docker-entrypoint.sh

# Copy built assets
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html

RUN chmod +x /docker-entrypoint.sh && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
