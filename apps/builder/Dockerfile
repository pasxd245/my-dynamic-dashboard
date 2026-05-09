FROM node:22-alpine AS build

WORKDIR /workspace

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/builder ./apps/builder

RUN pnpm install --filter builder... --frozen-lockfile

WORKDIR /workspace/apps/builder
RUN pnpm build

FROM nginx:1.27-alpine AS runtime

COPY apps/builder/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/builder/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
