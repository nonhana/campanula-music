# 自己的服务器部署

部署正文已迁到官网内容目录，步骤只维护一份。官网正式域名可用前，可以直接在本仓库阅读[服务器部署指南](../website/src/content/docs/guide/server.md)，然后选 [Docker](../website/src/content/docs/guide/docker.md) 或 [Node](../website/src/content/docs/guide/node.md)。

## 站长要配的

见[密钥与环境变量](../website/src/content/docs/guide/server.md#站长要配的)。

## 用 Docker（GHCR）

见 [Docker 指南](../website/src/content/docs/guide/docker.md)。当前公开的旧镜像不适用 v1，正文给出源码自建方案和 GHCR 发布前置。

## 直接跑 Node

见 [Node 指南](../website/src/content/docs/guide/node.md)。升级与回退见[对应章节](../website/src/content/docs/guide/upgrade.md#node-升级与回退)。

## HTTPS 反向代理

见[HTTPS 配置](../website/src/content/docs/guide/server.md#https-反向代理)。

### Caddy

见 [Caddy 步骤](../website/src/content/docs/guide/server.md#caddy)。

### Nginx

见 [Nginx 步骤](../website/src/content/docs/guide/server.md#已经在用-nginx)。

## 排错

见[登录页与排错](../website/src/content/docs/guide/server.md#打开自己的登录页)和[升级与回退](../website/src/content/docs/guide/upgrade.md)。

发布维护者的 `pnpm release:check`、候选验证与门禁证据仍见[测试导航](../tests/README.md)，不属于站长启动步骤。
