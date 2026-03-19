#!/bin/sh
set -e

# Substitute environment variables in nginx config
envsubst '${CLOUD_SERVER_HOST} ${CLOUD_SERVER_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute the CMD
exec "$@"
