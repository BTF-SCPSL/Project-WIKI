#!/bin/sh
set -eu

export HOSTNAME="0.0.0.0"
export PORT="${SERVER_PORT:-${PORT:-3000}}"
export NODE_ENV=production

cd /home/container

# Wings supplies the egg's startup command through STARTUP. Docker CLI
# uses CMD instead; both paths launch the same packaged standalone server.
if [ -n "${STARTUP:-}" ]; then
  exec /bin/sh -c "$STARTUP"
fi
exec "$@"
