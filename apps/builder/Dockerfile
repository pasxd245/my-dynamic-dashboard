FROM node:22-alpine

WORKDIR /workspace

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/builder ./apps/builder

RUN pnpm install --filter builder... --frozen-lockfile

WORKDIR /workspace/apps/builder

EXPOSE 3000

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]
