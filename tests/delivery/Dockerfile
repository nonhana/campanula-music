FROM node:26-alpine
LABEL org.opencontainers.image.title="Campanula Music" \
      org.opencontainers.image.description="开源的第三方网易云音乐播放器" \
      org.opencontainers.image.source="https://github.com/nonhana/campanula-music" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --chown=node:node build ./build
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "build"]
