FROM oven/bun:alpine AS base

WORKDIR /usr/src/app
COPY . .
RUN bun install --frozen-lockfile

CMD ["bun", "run", "src/index.ts"]
