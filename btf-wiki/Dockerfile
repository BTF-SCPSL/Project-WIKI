# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HOME=/home/container
WORKDIR /home/container

# Pterodactyl mounts the server directory at /home/container.
# Keep the packaged Next.js standalone app outside that mount.
COPY --from=builder --chown=node:node /app/.next/standalone /opt/btf-wiki
COPY --from=builder --chown=node:node /app/.next/static /opt/btf-wiki/.next/static
COPY --from=builder --chown=node:node /app/public /opt/btf-wiki/public
COPY --from=builder --chown=node:node /app/content /opt/btf-wiki/content
COPY --from=builder --chown=node:node /app/next.config.mjs /opt/btf-wiki/next.config.mjs
COPY --chmod=755 docker-entrypoint.sh /entrypoint.sh
RUN mkdir -p /home/container && chown -R node:node /home/container /opt/btf-wiki
USER node
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "/opt/btf-wiki/server.js"]
