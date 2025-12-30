#!/bin/sh
# entrypoint.sh

export TRUSTED_PROXY_RANGE=${TRUSTED_PROXY_RANGE:-0.0.0.0/0}
envsubst '${TRUSTED_PROXY_RANGE}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -g 'daemon off;'