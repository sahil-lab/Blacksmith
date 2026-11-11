FROM node:22-bookworm-slim AS build
WORKDIR /build
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV UV_THREADPOOL_SIZE=2
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,id=blacksmith-npm,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY packages/contracts packages/contracts
COPY apps/web apps/web
COPY tests/e2e tests/e2e
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY infra/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /build/apps/web/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
