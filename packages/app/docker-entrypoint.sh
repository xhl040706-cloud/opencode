#!/bin/sh
set -e

# List of environment variables to substitute
ENV_VARS='\${VITE_CLOUD_SERVER_HOST} \
\${VITE_CLOUD_SERVER_PORT} \
\${VITE_APP_PORT} \
\${VITE_API_PREFIX} \
\${VITE_APP_URL} \
\${VITE_CASDOOR_ENDPOINT} \
\${VITE_CASDOOR_CLIENT_ID} \
\${VITE_CASDOOR_APP_NAME} \
\${VITE_CASDOOR_ORG_NAME} \
\${VITE_STORE_URL} \
\${VITE_OPENCODE_CLOUD_DEVICE_ID} \
\${VITE_OPENCODE_SERVER_HOST} \
\${VITE_OPENCODE_SERVER_PORT}'

# Substitute environment variables in index.html for runtime configuration
if [ -f "/app/packages/app/dist/index.html" ]; then
  envsubst "$ENV_VARS" < /app/packages/app/dist/index.html > /tmp/index.html
  # Use cp instead of mv to avoid permission issues with directory permissions
  cp /tmp/index.html /app/packages/app/dist/index.html
  rm /tmp/index.html
  echo "Runtime environment variables injected into index.html"
fi

# Execute the CMD
exec "$@"
