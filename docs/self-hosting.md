# 自己的服务器部署

Campanula 可以跑在自己的服务器上：一个 Node 进程（SvelteKit 的 `adapter-node`），或者用发布在 GHCR 的 Docker 镜像。两种方式都要求前面有一个 HTTPS 反向代理：Service Worker、安装成应用、离线播放和后台下载都只在 HTTPS 下可用（`localhost` 除外）。HTTPS 证书由站长自己的反向代理负责，Campanula 不处理证书。

本文以 `https://music.example.com` 为例，换成自己的域名。

## 站长要配的

| 环境变量 | 必填 | 作用 |
|---|---|---|
| `COOKIE_SECRET` | 是 | 加密听众登录 Cookie 的密钥，至少 32 个字符。生成：`openssl rand -base64 32`。**要一直保留**：升级时也用同一个，换了密钥所有听众都要重新登录（ADR-0003）。 |
| `PROTOCOL_HEADER` | 建议 | 反向代理传协议的头名，填 `x-forwarded-proto`。不填时 adapter-node 默认按 `https` 算。 |
| `HOST_HEADER` | 建议 | 反向代理传域名的头名，填 `x-forwarded-host`。不填时用请求的 `Host`；Nginx 默认会把 `Host` 改成上游地址，这时要么保留原来的 `Host`，要么填这一项。 |
| `NETEASE_REAL_IP` | 否 | 真实的国内 IP（例如 `203.0.113.7`），调网易云时作为 `realIP` 传入。实例在境外、短信登录被网易云风控拦下（返回 10004）时建议配置（验证关卡①）。 |
| `HOST` | 建议 | Node 监听的地址。直接跑 Node 时设成 `127.0.0.1`，只让反向代理访问；Docker 镜像里是 `0.0.0.0`，靠 `-p 127.0.0.1:3000:3000` 限制在外面。 |
| `PORT` | 否 | Node 监听的端口，默认 `3000`。Docker 镜像里也是默认值；改了它，`docker run -p` 的容器端口要跟着改。 |

adapter-node 不看 `ORIGIN` 环境变量：SvelteKit 3 里那是构建时的 `paths.origin`，本站没有配置，请求的地址由上面两个头和 `Host` 拼出来。

没配 `COOKIE_SECRET`（或少于 32 个字符）时，进程照常启动，但接口一律回 `cookieSecretMissing`，页面显示「需要配置加密密钥」；`docker logs` 或 Node 的启动日志里也会写同一句说明。

## 用 Docker（GHCR）

镜像在打 `v*` 标签时由 CI 构建并发布（`linux/amd64` 和 `linux/arm64`）。镜像标签就是标签名（例如 `v0.0.1`）和 `latest`：

```bash
docker run -d \
  --name campanula \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e COOKIE_SECRET='把 openssl rand -base64 32 的结果贴在这里' \
  -e PROTOCOL_HEADER='x-forwarded-proto' \
  -e HOST_HEADER='x-forwarded-host' \
  ghcr.io/nonhana/campanula-music:latest
```

只把端口绑在 `127.0.0.1`，让反向代理来访问，不要把 `3000` 直接开到公网。容器里的进程以非 root 的 `node` 用户运行。

- 拉不到镜像时先确认包是公开的：仓库的 Packages 页面里把 `campanula-music` 的可见性改成 public。还是私有的话，先 `docker login ghcr.io`（用有 `read:packages` 的令牌）。
- 国内拉 GHCR 一般没问题；**自己构建**镜像时基础镜像来自 Docker Hub，拉不动就给 Docker 配镜像加速。
- 升级：`docker pull ghcr.io/nonhana/campanula-music:latest`，`docker rm -f campanula`，再用同样的命令重新 `docker run`（`COOKIE_SECRET` 保持原值）。浏览器里的曲库副本、播放队列和下载在升级后照样能用。

## 直接跑 Node

需要 `.node-version` 里的 Node 版本和 `package.json` 里的 pnpm 版本。

```bash
git clone https://github.com/nonhana/campanula-music.git
cd campanula-music
npm install -g pnpm@12.16.1   # 版本以 package.json 的 packageManager 为准
pnpm install --frozen-lockfile
pnpm build

COOKIE_SECRET='...' \
PROTOCOL_HEADER='x-forwarded-proto' \
HOST_HEADER='x-forwarded-host' \
HOST=127.0.0.1 \
PORT=3000 \
node build
```

生产环境不会自动读 `.env`；想用文件就 `node --env-file=.env build`。

`pnpm build` 不要设 `VERCEL=1`（那是 Vercel 适配器）。构建产物 `build/` 自带服务端依赖，运行时不需要 `node_modules`。

用 systemd 托管时，`/etc/systemd/system/campanula.service` 可以写成：

```ini
[Unit]
Description=Campanula Music
After=network.target

[Service]
WorkingDirectory=/srv/campanula
Environment=COOKIE_SECRET=...
Environment=PROTOCOL_HEADER=x-forwarded-proto
Environment=HOST_HEADER=x-forwarded-host
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node build
Restart=always
User=campanula

[Install]
WantedBy=multi-user.target
```

改完 `systemctl daemon-reload && systemctl enable --now campanula`。升级时重新 `pnpm install --frozen-lockfile && pnpm build`，再 `systemctl restart campanula`。

## HTTPS 反向代理

### Caddy

```caddyfile
music.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy 会自动申请证书，并带上 `X-Forwarded-*`。

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name music.example.com;

    ssl_certificate     /etc/letsencrypt/live/music.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/music.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

证书可以用 certbot 申请。国内服务器的域名要先备案，否则 80、443 端口会被拦截。

## 排错

- 页面一直停在「需要用 HTTPS 打开」：浏览器打开的不是 HTTPS 地址，或者反向代理没有把 HTTPS 请求转进来。
- 页面显示「需要配置加密密钥」：`COOKIE_SECRET` 没设或少于 32 个字符，按上面重新配。
- 反向代理回 502：`proxy_pass` 的地址不对，或者容器/进程没起来；先在服务器上 `curl http://127.0.0.1:3000/` 确认 Campanula 自己在响应。
- 登录收不到短信验证码、报 10004：给 `NETEASE_REAL_IP` 配上服务器的真实国内 IP，再试一次。
- 升级后所有人都要重新登录：`COOKIE_SECRET` 换了。换回原来的密钥即可恢复；已经换过就只能让听众重新登录。
