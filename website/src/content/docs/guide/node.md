---
title: 直接跑 Node
description: 构建播放器、启动 Node，并用 systemd 托管进程。
---

- 在服务器以部署用户使用 Bash。准备 Git、[Node 26.13.1](https://nodejs.org/en/download) 和 pnpm 12.18.0。
- 已有 Node 时，可用 `npm install -g pnpm@12.18.0` 安装 pnpm。版本以源码的 `.node-version`、`package.json` 为准。

## 获取并构建 v1

```bash
mkdir -p "$HOME/campanula/releases"
cd "$HOME/campanula"
git clone --branch master --single-branch https://github.com/nonhana/campanula-music.git source
cd source
pnpm install --frozen-lockfile && env -u VERCEL pnpm build
```

构建成功且存在 `build/index.js` 后，在源码目录保存发布版本。

```bash
CAMPANULA_REV=$(git rev-parse HEAD)
mkdir "../releases/$CAMPANULA_REV" &&
  cp -R build package.json "../releases/$CAMPANULA_REV/" &&
  ln -s "releases/$CAMPANULA_REV" ../current
```

## 传入环境并启动

先[生成运行环境文件](./server.md#生成并保留密钥)，再启动并保留终端。

```bash
cd "$HOME/campanula/current"
HOST=127.0.0.1 PORT=3000 node --env-file="$HOME/campanula-config/runtime.env" build
```

报 `EADDRINUSE` 时检查谁占了 `3000`。启动后[配置 HTTPS](./server.md#https-反向代理)并[验证登录页](./server.md#打开自己的登录页)。

## 让 Linux 在退出终端后继续运行

用 systemd 时，先按 Ctrl+C 停掉前台进程，再创建用户服务。示例要求主目录路径不含空格，服务使用当前 Node 的绝对路径。

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

- 看到 `active (running)` 后，用 HTTPS 地址再检查一次。
- 启动失败时，运行 `journalctl --user -u campanula -n 50 --no-pager`。
- 用其他进程管理器时，托管上一节的同一条启动命令。

[Node 升级与回退](./upgrade.md#node-升级与回退)
