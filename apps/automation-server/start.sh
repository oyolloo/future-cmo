#!/bin/sh
# Start the automation server in background, then Next.js in foreground.
# Both share the same DATABASE_URL + JWT_SECRET + other env vars.
cd /app/automation-server && node index.js &
exec node /app/apps/web/server.js
