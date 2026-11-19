---
title: 本地开发
description: 启动播放器、mock 或 Astro 文档站。
---

## 获取源码和工具

准备 Git、Node **26.13.1** 和 pnpm **12.18.0**。版本以源码的 `.node-version`、`package.json` 为准。
已有 Node 时，可用 `npm install -g pnpm@12.18.0` 安装 pnpm。

```bash
git clone --branch rewrite/v1 --single-branch https://github.com/nonhana/campanula-music.git
cd campanula-music
pnpm install --frozen-lockfile
```

## 官网与部署指南

在仓库根目录按需运行。

| 命令                            | 用途                           |
| ------------------------------- | ------------------------------ |
| `pnpm docs:dev`                 | 开发预览，默认端口 `4322`。    |
| `pnpm docs:build`               | 构建静态站到 `website/dist/`。 |
| `pnpm docs:preview --port 4322` | 预览构建产物。                 |

修改示例播放器或共用组件后，重启 `docs:dev` 以重建示例。开发与预览同时运行时使用不同端口。

## 播放器开发

| 命令            | 默认地址                                      |
| --------------- | --------------------------------------------- |
| `pnpm dev`      | `https://local.campanula.test:8443/`          |
| `pnpm dev:mock` | `https://mock.campanula.test:8444/mock/login` |

- 真实模式先将 `.env.example` 复制为 `.env`，用 `openssl rand -base64 32` 生成并填入 `COOKIE_SECRET`。密钥留在本机。
- Mock 使用预置账号和曲库，重启恢复初始数据。
- 按 Ctrl+C 停止当前服务。

## 第一次运行

首次在交互终端运行 HTTPS 模式，按提示完成以下操作。可单独运行 `pnpm dev:setup`。

1. 安装或确认下载 mkcert。
2. 授权安装本机证书信任。
3. 将 `local.campanula.test` 和 `mock.campanula.test` 指向 `127.0.0.1`。macOS 和 Linux 可按提示追加 hosts，Windows 需手动配置。
4. 打开日志里的完整 HTTPS 地址。

## 证书如何复用

- 启动器复用本机 mkcert CA，站点证书剩余 30 天以内时用同一 CA 续签。
- CA 变更或信任被移除后，运行 `pnpm dev:setup`，按提示重新确认。
- 用 `CAROOT`、`CAMPANULA_MKCERT` 或 `CAMPANULA_DEV_TLS_DIR` 指定已有 CA、mkcert 或 TLS 缓存位置。

## 端口、HTTP 与排错

| 命令                      | 用途                                                 |
| ------------------------- | ---------------------------------------------------- |
| `pnpm dev --port 9443`    | 换 HTTPS 端口，mock 同样支持 `--port`。              |
| `pnpm dev:http`           | HTTP 备用，`http://localhost:5173/`。                |
| `pnpm dev:mock:http`      | Mock HTTP 备用，`http://127.0.0.1:5174/mock/login`。 |
| `pnpm dev --print-config` | 只显示地址配置。                                     |

- **端口已占用**：停止原进程或换端口。
- **Fake-IP（如 `198.18.*`）**：在 VPN 或代理中排除两个本地域名，确认它们解析到 `127.0.0.1`。
- **证书不受信任**：运行 `pnpm dev:setup` 后重启浏览器。
- **打开旧地址**：使用日志里的完整地址，检查环境里是否还设置了 `CAMPANULA_HTTPS_PORT` 或 `CAMPANULA_DEV_ORIGIN`。

## 从旧版代理迁移

停止旧的 `dev:proxy` 和后端，再运行 `pnpm dev` 或 `pnpm dev:mock`。换主机后需重新登录，原下载仍在旧地址下。

## 检查改动

| 改动         | 检查命令                                                             |
| ------------ | -------------------------------------------------------------------- |
| 格式         | `pnpm fmt:check`                                                     |
| 播放器       | `pnpm lint`、`pnpm check` 和受影响的测试。                           |
| 文档站       | `pnpm exec tsc -p website/tsconfig.json --noEmit`、`pnpm docs:build` |
| 启动器与证书 | `pnpm test:environment`、`pnpm test:environment:https`               |
