---
title: 本地开发
description: 搭建本地环境，启动真实与 Mock 播放器（含本机 HTTPS 证书）、开发文档站及提交前检查。
---

建议在开始编码前先阅读[架构与实现概览](./architecture.md)，了解分层边界与媒体分流机制。

## 环境准备

本地开发需要 Git、Node.js（最低 24 及以上版本，推荐按仓库根目录 `.node-version` 安装）与 pnpm（版本以 `package.json` 的 `packageManager` 为准）。

```bash
git clone https://github.com/campanula-music/campanula.git
cd campanula
pnpm install --frozen-lockfile
```

若本机尚未安装 pnpm，可在进入仓库目录后按 `package.json` 声明的版本自动安装：

```bash
npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@').pop()")"
```

## 启动播放器

| 启动命令        | 默认本地地址                                  | 适用场景                           |
| --------------- | --------------------------------------------- | ---------------------------------- |
| `pnpm dev`      | `https://local.campanula.test:8443/`          | 对接真实网易云上游进行联调         |
| `pnpm dev:mock` | `https://mock.campanula.test:8444/mock/login` | 使用预置账号与曲库离线调试界面交互 |

- 运行真实模式前需将 `.env.example` 复制为 `.env`，并通过 `openssl rand -base64 32` 生成随机值填入 `COOKIE_SECRET`（`.env` 仅留在本地，不提交进 Git）。
- Mock 模式使用内存中的预置数据，重启开发服务器后恢复初始状态。
- 在交互终端按下 Ctrl+C 可停止当前开发服务。

## 首次运行与本地 HTTPS 证书

在交互式终端首次以 HTTPS 模式启动时，启动器会依次引导完成本机 TLS 环境配置（也可手动执行 `pnpm dev:setup`）：

1. 检查并按需下载 `mkcert`。
2. 授权向系统证书存储安装本机根证书（CA）。
3. 将 `local.campanula.test` 与 `mock.campanula.test` 解析至 `127.0.0.1`（macOS 与 Linux 可由向导自动追加至 `hosts`，Windows 需以管理员权限手动修改）。
4. 复制终端日志输出的完整 HTTPS 地址在浏览器打开。

启动器默认复用已存在的本机 `mkcert` CA，并在站点证书剩余有效期不足 30 天时自动续签。若 CA 变更或信任被移除，重新执行 `pnpm dev:setup` 即可；如需指定自定义路径，可通过环境变量 `CAROOT`、`CAMPANULA_MKCERT` 或 `CAMPANULA_DEV_TLS_DIR` 覆盖默认位置。

## 常用参数与排错

| 命令                      | 说明                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `pnpm dev --port 9443`    | 更换 HTTPS 监听端口（`dev:mock` 同样适用）                    |
| `pnpm dev:http`           | 启用本地 HTTP 备用入口（`http://localhost:5173/`）            |
| `pnpm dev:mock:http`      | 启用 Mock HTTP 备用入口（`http://127.0.0.1:5174/mock/login`） |
| `pnpm dev --print-config` | 仅打印当前生效的地址、域名与端口配置而不启动服务              |

- **端口冲突**：停止占用目标端口的旧进程，或通过 `--port` 指定其他可用端口。
- **Fake-IP（如 `198.18.*`）拦截**：在本地网络代理的绕过规则中排除 `local.campanula.test` 与 `mock.campanula.test`，确保域名解析到 `127.0.0.1`。
- **浏览器提示证书不受信任**：运行 `pnpm dev:setup` 重新安装信任后完全重启浏览器。
- **打开了旧入口地址**：优先使用当次终端输出的完整地址，并排查当前 shell 是否残留 `CAMPANULA_HTTPS_PORT` 或 `CAMPANULA_DEV_ORIGIN`。

## 文档站开发

官网与本套文档站位于 `website/` 目录，在仓库根目录执行以下命令：

| 命令                            | 用途                                                   |
| ------------------------------- | ------------------------------------------------------ |
| `pnpm docs:dev`                 | 构建示例模块并启动 Astro 开发服务器（默认端口 `4322`） |
| `pnpm docs:build`               | 构建示例与静态文档站至 `website/dist/`                 |
| `pnpm docs:preview --port 4322` | 本地预览 `website/dist/` 静态构建产物                  |

修改位于 `website/demo/` 的示例播放器源码或共用的 UI 组件后，需重启 `pnpm docs:dev` 以触发示例子项目重建；同时运行开发服务与静态预览时应指定不同端口。

## 提交前检查

| 改动范围     | 对应检查命令                                                         |
| ------------ | -------------------------------------------------------------------- |
| 全仓代码格式 | `pnpm fmt:check`                                                     |
| 播放器与源码 | `pnpm lint`、`pnpm check` 与受影响的测试集                           |
| 文档站与组件 | `pnpm exec tsc -p website/tsconfig.json --noEmit`、`pnpm docs:build` |
| 启动器与 TLS | `pnpm test:environment`、`pnpm test:environment:https`               |
