---
title: 用 Docker 运行
description: 从当前 v1 源码构建容器，配置环境文件和本机端口，再接上 HTTPS。
---

这条路径在服务器上用 Docker 运行播放器。先安装 [Docker Engine](https://docs.docker.com/engine/install/) 和 Git，确认 `docker version` 能连接服务。以下命令在**服务器的 Bash 终端**执行；没有 Docker 权限时给 `docker` 命令加 `sudo`。

## 先确认镜像版本

**当前 v1 请从源码构建。** 2026-11-18 核对时，GHCR 公开标签只有 `v0.0.1` 和 `latest`，两者都属于旧提交 `6886a015edad082490b23c6079428827e88db9bb`，不对应 `rewrite/v1`。不要用这两个标签照本篇启动新版。

旧镜像清单 digest 是 `sha256:c8c2d16c61d24881dee3374c8f6e3107b88c14281b066d2cb38010fffdf1c549`，含 `linux/amd64`、`linux/arm64`；另外的 `unknown/unknown` 项是证明材料。你可以只读核对：

```bash
docker buildx imagetools inspect ghcr.io/nonhana/campanula-music:v0.0.1
docker buildx imagetools inspect ghcr.io/nonhana/campanula-music:latest
```

可拉取不等于适用于本教程。项目还需要发布与 v1 对应、经过交付检查的版本镜像；本篇不要求你创建项目发布标签或上传镜像。

## 从 v1 源码构建

在服务器一个尚无 `campanula-source` 的目录执行。显式选 `rewrite/v1`，因为仓库默认分支仍是旧的 `master`。

```bash
git clone --branch rewrite/v1 --single-branch https://github.com/nonhana/campanula-music.git campanula-source
cd campanula-source
CAMPANULA_REV=$(git rev-parse HEAD)
docker build --pull \
  --label "org.opencontainers.image.revision=$CAMPANULA_REV" \
  --tag "campanula-local:$CAMPANULA_REV" .
docker image inspect "campanula-local:$CAMPANULA_REV" \
  --format '{{.Os}}/{{.Architecture}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
```

记下完整提交编号和输出的镜像编号。这里构建的是服务器本机架构，源码中的 Dockerfile 使用 `node:26-alpine` 基础镜像，程序以非 root 的 `node` 用户运行。

**源码构建会访问 Docker Hub 和 npm。** Docker Hub 基础镜像拉取慢时，按所在云服务商的说明配置可用的镜像加速，或换能访问的构建环境；拉 GHCR 成品镜像是另一条网络路径，不能用它是否可访问来判断 Docker Hub。不要把密钥写入 Dockerfile 或传给构建步骤。

## 配置并启动

先完成[生成密钥和环境文件](./server.md#生成并保留密钥)。以下命令接着在刚才的源码目录执行，`CAMPANULA_REV` 是上一步记录的完整提交编号；若重开过终端，先执行 `CAMPANULA_REV=$(git rev-parse HEAD)` 恢复它。

```bash
docker run -d \
  --name campanula \
  --restart unless-stopped \
  --env-file "$HOME/campanula-config/runtime.env" \
  -p 127.0.0.1:3000:3000 \
  "campanula-local:$CAMPANULA_REV"
docker logs --tail 50 campanula
curl -i http://127.0.0.1:3000/api/account
```

看到 HTTP 200 和含 `"account":null` 的 JSON，说明未登录实例已经响应。端口只映射到服务器本机，下一步照[HTTPS 反向代理](./server.md#https-反向代理)开放自己的域名。

环境文件没传进去或密钥太短时，容器仍可能保持运行，但日志会报告缺少 `COOKIE_SECRET`，接口回 HTTP 500 / `cookieSecretMissing`。修好原环境文件后，在服务器重建容器：

```bash
docker stop campanula
docker rm campanula
```

再执行上面的 `docker run`。若名称已存在，先检查 `docker ps -a --filter name=campanula`，不要直接删掉不确定用途的容器。检查端口占用可用 `docker ps` 查看已有映射。

## 以后使用 GHCR 发布镜像

等项目发布明确支持 v1 的镜像后，先对照发布说明核对标签、两种架构和 `org.opencontainers.image.revision`，并记录清单 digest。下面的 `V1_TAG` 是**发布说明中真实存在的标签**，不是让你照抄的现成版本：

```bash
CAMPANULA_IMAGE=ghcr.io/nonhana/campanula-music:V1_TAG
docker buildx imagetools inspect "$CAMPANULA_IMAGE"
docker buildx imagetools inspect "$CAMPANULA_IMAGE" --format '{{json .Image}}'
```

把占位标签换好再执行，确认 revision 属于对应的 v1 发布提交。拉取时使用记录的 `ghcr.io/nonhana/campanula-music@sha256:…` 完整引用，再用它替换启动命令最后一行。按 [GitHub 容器仓库说明](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)，公开镜像可以匿名拉取；遇到拒绝访问时先核对包地址和公开状态，不要把自己的令牌贴进文档。

换版前保留旧镜像，具体步骤见[Docker 升级与回退](./upgrade.md#docker-升级与回退)。
