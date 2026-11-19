---
title: 用 Docker 运行
description: 从源码构建镜像并启动播放器。
---

- 在服务器安装 Git 和 [Docker Engine](https://docs.docker.com/engine/install/)。用 `docker version` 确认能连接 Docker。
- 先[生成运行环境文件](./server.md#生成并保留密钥)。
- **v1 从源码构建。** 旧版 GHCR 标签 `latest` 和 `v0.0.1` 不适用于本指南。

## 从 v1 源码构建

在服务器的 Bash 终端执行。构建需要访问 Docker Hub 和 npm。

```bash
git clone --branch master --single-branch https://github.com/nonhana/campanula-music.git campanula-source
cd campanula-source
CAMPANULA_REV=$(git rev-parse HEAD)
docker build --pull \
  --label "org.opencontainers.image.revision=$CAMPANULA_REV" \
  --tag "campanula-local:$CAMPANULA_REV" .
```

## 配置并启动

在同一个源码目录启动。端口只映射到服务器本机。

```bash
CAMPANULA_REV=$(git rev-parse HEAD)
docker run -d \
  --name campanula \
  --restart unless-stopped \
  --env-file "$HOME/campanula-config/runtime.env" \
  -p 127.0.0.1:3000:3000 \
  "campanula-local:$CAMPANULA_REV"
```

- 启动失败时，用 `docker logs --tail 50 campanula` 查日志，用 `docker ps -a` 检查容器名和端口。
- 改环境文件后，确认是本实例的容器，再执行 `docker stop campanula && docker rm campanula`，然后重跑上面的启动命令。

接下来[配置 HTTPS](./server.md#https-反向代理)并[验证登录页](./server.md#打开自己的登录页)。更新时见 [Docker 升级与回退](./upgrade.md#docker-升级与回退)。
