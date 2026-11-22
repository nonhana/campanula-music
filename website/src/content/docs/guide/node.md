---
title: Node.js 部署
description: 从源码构建播放器并以 Node.js 启动，配合 systemd 实现开机自启与后台托管。
---

开始前需准备 Git、[Node.js 26.13.1](https://nodejs.org/en/download) 与 pnpm `12.18.0`（精确版本以仓库根目录 `.node-version` 与 `package.json` 为准）。已有 Node.js 环境时可通过 `npm install -g pnpm@12.18.0` 安装对应版本的 pnpm。

## 获取并构建源码

以部署用户登录服务器并在 Bash 中拉取 `main` 分支、安装依赖并构建产物：

```bash
mkdir -p "$HOME/campanula/releases"
cd "$HOME/campanula"
git clone --branch main --single-branch https://github.com/nonhana/campanula-music.git source
cd source
pnpm install --frozen-lockfile && env -u VERCEL pnpm build
```

构建成功且生成 `build/index.js` 后，将当前版本快照复制到独立的 `releases/` 子目录并更新 `current` 软链接：

```bash
CAMPANULA_REV=$(git rev-parse HEAD)
mkdir "../releases/$CAMPANULA_REV" &&
  cp -R build package.json "../releases/$CAMPANULA_REV/" &&
  ln -s "releases/$CAMPANULA_REV" ../current
```

## 启动服务

确保已按[生成并保存密钥](./server.md#生成并保存密钥)生成 `~/campanula-config/runtime.env`，随后在前台测试启动：

```bash
cd "$HOME/campanula/current"
HOST=127.0.0.1 PORT=3000 node --env-file="$HOME/campanula-config/runtime.env" build
```

若报错 `EADDRINUSE`，需排查并释放当前占用 `3000` 端口的进程。前台测试确认无异常后，可[配置 HTTPS 反向代理](./server.md#https-反向代理)并[验证部署](./server.md#验证部署)。

## 使用 systemd 后台托管

为使服务在终端退出后继续运行并支持开机自启，先按 Ctrl+C 停止前台进程，再创建 systemd 用户服务（以下脚本要求当前用户主目录路径不含空格，并将绑定当前 `node` 二进制的绝对路径）：

```bash
mkdir -p "$HOME/.config/systemd/user"
CAMPANULA_NODE=$(node -p 'process.execPath')
cat > "$HOME/.config/systemd/user/campanula.service" <<EOF_SERVICE
[Unit]
Description=Campanula Music
After=network.target

[Service]
WorkingDirectory=$HOME/campanula/current
ExecStart=$CAMPANULA_NODE --env-file=$HOME/campanula-config/runtime.env build
Environment=HOST=127.0.0.1
Environment=PORT=3000
Restart=on-failure

[Install]
WantedBy=default.target
EOF_SERVICE
systemctl --user daemon-reload
systemctl --user enable --now campanula
sudo loginctl enable-linger "$(id -un)"
systemctl --user status campanula
```

- 服务状态显示 `active (running)` 后，再通过 HTTPS 域名访问确认登录页可用。
- 若服务启动异常，执行 `journalctl --user -u campanula -n 50 --no-pager` 查看标准输出与错误日志。
- 若使用 PM2、Supervisor 等其他进程管理器，托管上一步中的同一条 `node --env-file=...` 启动命令即可。

后续升级与回退操作见 [Node.js 升级与回退](./upgrade.md#nodejs-升级与回退)。
