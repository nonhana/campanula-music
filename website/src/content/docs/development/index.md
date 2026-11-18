---
title: 本地开发
description: 在自己的电脑启动播放器、mock 和官网，处理首次证书信任与端口问题。
---

想修改 Campanula 时，先把源码放到自己的电脑，再选要启动的部分。播放器、mock 和官网各自使用独立地址；官网只是静态介绍和隔离的示例，不接收真实账号。只想部署来听歌，请回到[部署指南](../guide/index.md)。

## 获取源码和工具

以下命令在**自己的电脑、Bash 或兼容的终端**执行。先准备 Git、Node 26.13.1 和 pnpm 12.18.0，版本以所取代码的 `.node-version` 与 `package.json` 为准。已有 Node 时可以运行 `npm install -g pnpm@12.18.0` 安装 pnpm。

```bash
git clone --branch rewrite/v1 --single-branch https://github.com/nonhana/campanula-music.git
cd campanula-music
node --version
pnpm --version
pnpm install --frozen-lockfile
```

需要连接真实账号时，把 `.env.example` 复制成 `.env`，在本机用 `openssl rand -base64 32` 生成密钥，填进 `COOKIE_SECRET`；文件留在本机，不提交。mock 和官网不需要这把密钥。写代码前可以从导航右上角的 GitHub 入口阅读仓库的编码规范和设计文件，它们跟源码一起维护。

## 播放器开发

在仓库根目录选一个命令运行：

```bash
pnpm dev
pnpm dev:mock
```

`pnpm dev` 使用真实服务，地址是 `https://local.campanula.test:8443/`；`pnpm dev:mock` 使用预置的账号、歌单和音频，地址是 `https://mock.campanula.test:8444/mock/login`。mock 的写操作只改当前内存，重启后恢复种子数据，不会修改网易云账号。

每个模式只占一个终端。启动器先准备 HTTPS，再启动 Vite；看到 Ready 后打开日志里的完整地址，终端继续运行是正常的。按 Ctrl+C 会关闭本次服务、连接和文件监听，释放端口。证书和浏览器数据会保留。

## 第一次运行

首次在交互终端启动时，按日志一步步完成准备：

1. 找不到 mkcert 时，启动器会询问是否下载官方 v1.4.4 程序到 `.campanula/tools/`，也可以先自行安装。[mkcert](https://github.com/FiloSottile/mkcert)用来给本机开发域名签证书。
2. 确认后执行 `mkcert -install`，安装或复核本机证书颁发机构的系统信任。系统可能要求密码，直接在本终端或系统窗口完成授权。
3. 启动器给两个开发域名签发证书，并检查它们是否解析到 `127.0.0.1`。macOS、Linux 缺映射时会询问是否追加 `/etc/hosts`，已有冲突则需要自己修正；Windows 按提示手动配置 hosts。
4. 准备完成后，启动所选模式，打开日志里显示的 HTTPS 地址。

每次修改系统设置前都有确认，可以取消；取消或失败后修好原因再重跑，不需要先删 CA。想只做准备、不启动播放器，运行 `pnpm dev:setup`。没有交互终端时，首次准备会退出并给出提示，需要回自己的终端完成。

系统密码直接由授权命令读取，启动器不会采集它。Firefox 等浏览器可能还需要 NSS 等平台工具，以 mkcert 的提示为准。曾手动撤销信任时，重新运行 `pnpm dev:setup`，必要时重启浏览器。

## 证书如何复用

mkcert 的 CA 私钥保存在本机 `CAROOT`。项目在 `.campanula/tls/trusted.json` 记录准备时使用的 CA 路径和指纹，不会把 CA 私钥复制进仓库。站点证书剩余超过 30 天时直接复用；缺失、损坏、过期或进入续签窗口时，用同一个 CA 重签，不重复安装系统信任。

两个模式同时启动也只签发一次，完整验证成功后才切换 `current.json`，失败不会留下半套正在使用的证书。正常退出不撤销系统信任。换了 CA 路径或指纹时要重新确认；CA 到期需要自己明确更换并重新信任，启动器不会自动删掉 CA。

要使用已有的 CA 或程序，可以在启动前设置 `CAROOT`、`CAMPANULA_MKCERT`；TLS 缓存位置由 `CAMPANULA_DEV_TLS_DIR` 指定。这些目录含私钥，留在本机，不提交或分享。证书的具体有效期以文件为准。

## 端口、HTTP 与排错

以下命令仍在本机仓库根执行，按需要选一条：

```bash
pnpm dev --port 9443
pnpm dev:mock --port 9444
pnpm dev:http
pnpm dev:mock:http
pnpm dev --print-config
```

HTTP 备用地址分别是 `http://localhost:5173/` 和 `http://127.0.0.1:5174/mock/login`。`--print-config` 只输出地址配置，不准备证书或启动服务。开发的 HTTPS 高位端口不需要为监听提权。

普通模式和 mock 使用不同主机，因为 Cookie 不能靠端口隔离。浏览器的曲库、下载和 Service Worker 则属于完整站点地址，换端口或主机后会使用另一份存储。普通模式读产品 `.env`，mock 使用独立的 Kit、缓存和身份目录 `.campanula/mock`。

- 端口或工作根被占用：先确认原服务，在它的终端按 Ctrl+C 再重试；启动器不会终止别人的进程。
- 提示 `198.18.*` 等 Fake-IP：检查本机 VPN、TUN 或代理的域名排除规则，放行两个开发域名；日志里会显示实际解析结果。
- 浏览器说连接已关闭：确认命令仍在运行，完整输入日志里的协议、域名和端口，不带端口的 HTTPS 会访问 443。
- 浏览器不信任证书：运行 `pnpm dev:setup` 复核信任，按提示处理后重启浏览器，不要反复删除 CA。
- 改端口后还在查旧地址：清理 shell 中遗留的 `CAMPANULA_HTTPS_PORT`、`CAMPANULA_DEV_ORIGIN`，优先用各命令的 `--port`。需要旧式手工浏览器工具时显式指定 `CAMPANULA_BROWSER_ORIGIN`，例如 `https://mock.campanula.test:9444`；仓库独立自动回归会自己启动环境。

## 从旧版代理迁移

先在原终端按 Ctrl+C 停止旧 `dev:proxy` 和后端，再运行新的 `pnpm dev` 或 `pnpm dev:mock`。现在不需要另开 Caddy 或 OpenSSL 代理终端；新的引导使用本机 mkcert CA，第一次需要确认信任。旧 CA 是否撤销由你自己决定。

普通入口为 8443，mock 为 8444。原下载留在旧站点地址下，不自动迁移。同主机 Cookie 可跨端口沿用，但换主机、密钥变化或会话过期仍需重新登录。

## 官网与部署指南

在本机仓库根安装一次依赖后，按需要执行：

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview --host 127.0.0.1 --port 4322
```

开发站默认 `http://localhost:4322/`；构建产物在 `website/dist/`。开发与静态预览不能同时占 4322，先退出一个再启动另一个，或用 `--port` 指定空闲端口。本地原型使用的 4321 保留。

首页提供部署、安装与离线播放、升级与回退和本地开发四个文档入口。要检查示例播放器，可以直接打开 `/demo/?screen=player`，或打开 `/demo/playlists/502/` 检查歌单深链。示例只读取本站素材。

`docs:dev` 和 `docs:build` 都会先运行 `docs:demo`，用 `website/demo/` 的独立 Kit 配置生成示例，再构建 Astro。修改示例或共用组件后，需要重新执行构建才能更新已启动的网站中的示例。生成目录是 `website/demo/.kit/`、`website/public/demo/`、`website/.astro/` 和 `website/dist/`，都不提交，也不会覆盖播放器的 `.svelte-kit/`。

手工终端按 Ctrl+C 退出。Codex 中 Astro 可能自动转后台，可在仓库根用 `pnpm docs:dev status`、`pnpm docs:preview status` 查看，或用各自的 `stop` 命令停止。不要停止别人在预览的服务。

网站使用根目录的依赖、catalog 和唯一锁文件，不读播放器 `.env`，不依赖 `_notes/` 或相邻仓库。播放器仍用 `pnpm build`，产物在 `build/`；Vercel 与 Docker 构建播放器，不能把项目根改成 `website/`。

## 检查改动

在本机仓库根运行适合本次改动的检查：

```bash
pnpm fmt
pnpm fmt:check
pnpm lint
pnpm check
pnpm exec tsc -p website/tsconfig.json --noEmit
pnpm docs:build
```

`check` 检查播放器和示例的 Svelte 源码；网站配置和数据由单独的 TypeScript 命令检查。涉及播放器时，还要按仓库测试导航运行受影响的套件，不能只靠官网构建判断应用正常。

改了开发入口、证书或隔离时，用 `pnpm test:environment` 检查真实 CLI、缓存、取消和重试；显式 HTTPS 专项是 `pnpm test:environment:https`，需要 mkcert 和 OpenSSL，但使用临时 CA，不安装系统信任、不改 hosts，也不连接个人浏览器或账号。系统授权、真实浏览器信任仍要本人确认。

已有独立证书的受控环境可以同时传 `--cert`、`--key`、`--ca`；`--skip-dns-check` 只跳过系统解析预检，不会跳过证书校验，需要客户端自行解析开发域名。开发入口源码、测试接入细节和验收记录继续随仓库维护。
