---
title: Docker 部署
description: 在自建服务器上从源码构建容器镜像，挂载环境变量并以后台容器方式运行。
---

部署前请先在服务器安装 Git 与 [Docker Engine](https://docs.docker.com/engine/install/)（通过 `docker version` 确认守护进程连接正常），并按[自建服务器指南](./server.md#生成并保存密钥)生成 `runtime.env`。当前不分发预构建远程镜像，需直接在服务器上从源码构建。

## 从源码构建镜像

在服务器 Bash 终端中克隆 `main` 分支并构建镜像（构建过程需拉取基础镜像与 npm 依赖）：

```bash
git clone --branch main --single-branch https://github.com/nonhana/campanula-music.git campanula-source
cd campanula-source
CAMPANULA_REV=$(git rev-parse HEAD)
docker build --pull \
  --label "org.opencontainers.image.revision=$CAMPANULA_REV" \
  --tag "campanula-local:$CAMPANULA_REV" .
```

## 启动容器

在同一源码目录下创建并启动容器，仅向服务器回环地址映射 `3000` 端口：

```bash
CAMPANULA_REV=$(git rev-parse HEAD)
docker run -d \
  --name campanula \
  --restart unless-stopped \
  --env-file "$HOME/campanula-config/runtime.env" \
  -p 127.0.0.1:3000:3000 \
  "campanula-local:$CAMPANULA_REV"
```

- **排查启动失败**：执行 `docker logs --tail 50 campanula` 查看运行日志，或运行 `docker ps -a` 排查同名容器与端口占用冲突。
- **更新环境变量**：编辑 `runtime.env` 后，先停止并移除旧容器（`docker stop campanula && docker rm campanula`），再重新执行上述 `docker run` 命令重建容器。

容器就绪后，继续[配置 HTTPS 反向代理](./server.md#https-反向代理)并[验证部署](./server.md#验证部署)；后续版本维护见 [Docker 升级与回退](./upgrade.md#docker-升级与回退)。
