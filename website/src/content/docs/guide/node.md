---
title: 直接跑 Node
description: 用指定版本构建播放器，把环境文件和每次发布的程序分开保存。
---

以下在**服务器的 Bash 终端、同一个普通用户下**执行。先安装 Git、OpenSSL、Node **26.13.1** 和 pnpm **12.18.0**；版本以所取代码的 `.node-version` 和 `package.json` 中 `packageManager` 为准。Node 安装可从[官方下载页](https://nodejs.org/en/download)选择系统和架构。已有对应 Node 后可以用 `npm install -g pnpm@12.18.0` 安装 pnpm。

## 获取并构建 v1

先检查工具版本，再在自己的主目录准备独立发布目录。下面要求 `~/campanula/source` 尚不存在。

```bash
node --version
pnpm --version
mkdir -p "$HOME/campanula/releases"
cd "$HOME/campanula"
git clone --branch rewrite/v1 --single-branch https://github.com/nonhana/campanula-music.git source
cd source
cat .node-version
node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).packageManager'
pnpm install --frozen-lockfile
env -u VERCEL pnpm build
CAMPANULA_REV=$(git rev-parse HEAD)
mkdir "../releases/$CAMPANULA_REV"
cp -R build package.json "../releases/$CAMPANULA_REV/"
cd ..
ln -s "releases/$CAMPANULA_REV" current
```

`node --version` 应是 `v26.13.1`，`pnpm --version` 应是 `12.18.0`。取的是 `rewrite/v1`，不能省略分支参数去构建默认的旧 `master`。

`pnpm build` 构建播放器，输出 `build/`；`pnpm docs:build` 构建的是官网，不能用来启动实例。不要设置 `VERCEL=1`，它会改用云函数适配器。构建结束应能找到 `build/index.js`。本项目把服务端依赖打包进 `build/`，运行目录只需要 `build/` 和声明 ES 模块的 `package.json`，不需要复制 `node_modules`。

`current` 是指向本次发布目录的链接。以后先在新的目录构建成功，再切换它，避免失败的构建覆盖正在运行的程序。记下 `CAMPANULA_REV`，回退时会用到。

## 传入环境并启动

先按[服务器篇](./server.md#生成并保留密钥)生成 `~/campanula-config/runtime.env`，保留原密钥。接着在服务器执行：

```bash
cd "$HOME/campanula/current"
HOST=127.0.0.1 PORT=3000 node --env-file="$HOME/campanula-config/runtime.env" build
```

生产启动不会自动读取源码目录的 `.env`，所以这里显式使用 Node 的 `--env-file`。出现监听地址后，保留这个终端，在服务器另一个 SSH 终端检查：

```bash
curl -i http://127.0.0.1:3000/api/account
```

新实例应回 HTTP 200 和含 `"account":null` 的 JSON。若回 HTTP 500 / `cookieSecretMissing`，检查原环境文件的密钥是否完整、至少 32 个字符。在启动终端按 Ctrl+C，修好文件后用原命令重启；不需要重新构建。

报 `EADDRINUSE` 表示端口已有进程，先核对是否是之前启动的 Campanula；找不到 `build/index.js` 则检查当前目录和构建是否成功。不要为了排错删除浏览器站点数据。

本机检查正常后，按[HTTPS 反向代理](./server.md#https-反向代理)配置公网地址。在自己的浏览器打开 HTTPS 域名，看到登录页才完成部署。

## 让 Linux 在退出终端后继续运行

服务器使用 systemd 时，可以让当前普通用户的服务托管进程。先按 Ctrl+C 停掉上面的前台进程，避免占用同一端口。接着在**服务器**生成用户服务：

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

这段会填入当前用户的绝对路径，要求主目录路径不含空格，`process.execPath` 返回实际运行的 Node 文件。若用了版本管理器，先确认该路径在非交互环境也可执行，以后不要删除这份 Node。`enable-linger` 让退出 SSH 后用户服务仍可运行，需要服务器管理员权限；用户服务说明可查 [systemd 官方文档](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)与 [loginctl](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html)。

`status` 应显示 `active (running)`；失败时运行 `journalctl --user -u campanula -n 50 --no-pager` 看日志。不是 systemd 的系统请用自己已有的进程管理器托管同一启动命令，前台验证本身不会替你保持服务。

下一次更新按[Node 升级与回退](./upgrade.md#node-升级与回退)执行。
