# syntax=docker/dockerfile:1

# 自己的服务器部署（ADR-0009）：Node 适配器的多阶段构建。
# 运行阶段只带 build/ 和 package.json：本项目没有 dependencies，服务端依赖都已经打包进 build/。

FROM node:26-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --global pnpm@$(node -p "require('./package.json').packageManager.split('@').pop()")
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:26-alpine
LABEL org.opencontainers.image.title="Campanula Music" \
      org.opencontainers.image.description="开源的第三方网易云音乐播放器" \
      org.opencontainers.image.source="https://github.com/nonhana/campanula-music" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 3000
CMD ["node", "build"]
