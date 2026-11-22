---
title: Node.js 部署
description: 从源码构建生产产物，通过仓库标准 PM2 配置后台运行并设置开机自启。
---

开始前需准备 Git、[Node.js](https://nodejs.org/en/download)（24 及以上版本，推荐按仓库根目录 `.node-version` 安装）与 pnpm（版本以仓库 `package.json` 的 `packageManager` 为准），并先按[生成并保存密钥](./server.md#生成并保存密钥)创建 `~/campanula-config/runtime.env`。

## 获取并构建源码

以部署用户登录服务器，拉取 `main` 分支并构建生产产物：

```bash
git clone --branch main --single-branch https://github.com/campanula-music/campanula.git "$HOME/campanula"
cd "$HOME/campanula"
pnpm install --frozen-lockfile && env -u VERCEL pnpm build
```

若服务器尚未安装 pnpm，可在进入仓库目录后按 `package.json` 声明的版本自动安装：

```bash
npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@').pop()")"`
```

## 使用 PM2 启动与后台托管

安装 PM2（若尚未安装）：

```bash
npm install -g pm2
```

在仓库根目录通过标准配置 `ecosystem.config.cjs` 一键启动服务并保存进程列表：

```bash
cd "$HOME/campanula"
pm2 start ecosystem.config.cjs
pm2 save
```

配置服务器重启后自动恢复进程（按 `pm2 startup` 输出的命令执行一次即可）：

```bash
pm2 startup
pm2 save
```

`ecosystem.config.cjs` 默认采用单进程 `fork` 模式，监听 `127.0.0.1:3000`，并交由 Node 原生读取 `~/campanula-config/runtime.env`（不将密钥写入仓库文件或 PM2 进程配置，修改 `runtime.env` 后直接重启即可生效）。

### 常用管理与自定义选项

- **查看状态与日志**：执行 `pm2 status` 查看运行状态，执行 `pm2 logs campanula --lines 50` 排查启动或运行异常。
- **修改环境变量后重启**：编辑 `~/campanula-config/runtime.env` 后运行 `pm2 restart campanula` 即可重新加载。
- **覆盖监听地址、端口或环境文件路径**：无需直接改动仓库内的 `ecosystem.config.cjs`，通过环境变量覆盖即可（已启动的实例变更参数时加上 `--update-env`）：

```bash
PORT=3001 pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

支持覆盖的变量包括 `HOST`（默认 `127.0.0.1`）、`PORT`（默认 `3000`）与 `CAMPANULA_ENV_FILE`（默认 `~/campanula-config/runtime.env`）。

## 前台验证与其他托管方式

若需临时在前台调试启动（不使用 PM2），可在仓库根目录执行：

```bash
HOST=127.0.0.1 PORT=3000 node --env-file="$HOME/campanula-config/runtime.env" build
```

若报错 `EADDRINUSE`，请排查并释放占用 `3000` 端口的进程。

- 若使用 1Panel、宝塔面板等 Node 项目管理功能，或偏好系统级 `systemd`、Supervisor 等进程管理器，直接托管上述启动命令（或在已注入环境变量的环境中运行 `pnpm start`）即可。

服务就绪后，继续[配置 HTTPS 反向代理](./server.md#https-反向代理)并[验证部署](./server.md#验证部署)；后续升级与回退见 [Node.js 升级与回退](./upgrade.md#nodejs-升级与回退)。
