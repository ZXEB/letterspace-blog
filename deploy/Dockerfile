FROM node:22-alpine AS build
WORKDIR /site
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
COPY scripts/prepare-static.mjs ./scripts/prepare-static.mjs
COPY scripts/setup-selfhost.mjs ./scripts/setup-selfhost.mjs
ARG SITE_ORIGIN
RUN node scripts/prepare-static.mjs && NODE_OPTIONS=--max-old-space-size=512 pnpm build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /site/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
