# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS wiki
WORKDIR /work/wiki
ENV NEXT_TELEMETRY_DISABLED=1
COPY btf-wiki/package.json ./
RUN npm install --no-audit --no-fund
COPY btf-wiki/ ./
RUN npm run build

FROM node:24-bookworm-slim AS editor
WORKDIR /work/editor
RUN corepack enable && corepack prepare pnpm@11.5.3 --activate
COPY editor/ ./
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter='@fumadocs-editor/studio...'

FROM node:24-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOME=/home/container TZ=Europe/Kyiv
WORKDIR /home/container
COPY --from=wiki --chown=node:node /work/wiki/.next/standalone /opt/btf-wiki
COPY --from=wiki --chown=node:node /work/wiki/.next/static /opt/btf-wiki/.next/static
COPY --from=wiki --chown=node:node /work/wiki/public /opt/btf-wiki/public
COPY --from=wiki --chown=node:node /work/wiki/content /opt/btf-wiki/content
COPY --from=editor --chown=node:node /work/editor /opt/editor
COPY --chown=node:node deployment /opt/btf-runtime
RUN mkdir -p /home/container && chown -R node:node /home/container
USER node
EXPOSE 3000
CMD ["node", "/opt/btf-runtime/launch.mjs"]
