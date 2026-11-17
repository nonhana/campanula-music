---
title: 部署到自己的服务器
description: 选择 Docker 或 Node，准备密钥，再给播放器配置 HTTPS。
---

先选服务器上怎么运行播放器，再回来配置 HTTPS。两种方式运行的是同一个 Campanula，都只需要一个进程，不用另装网易云 API 服务或数据库。

- [用 Docker](./docker.md)：把程序和运行环境一起装进容器。服务器需要 Docker，当前 v1 需要先从源码构建镜像。
- [直接跑 Node](./node.md)：在服务器安装指定的 Node 和 pnpm，构建后由 Node 运行。

下面以你管理的 `music.example.com` 为例。出现这个域名时，都换成自己的播放器域名。服务器命令在 SSH 登录后的终端执行，浏览器检查则在自己的电脑或手机上进行。Linux 命令以常见的 Bash 环境为例。

## 准备域名与网络

在域名服务商的 DNS 控制台，把播放器子域名的 A 记录指向服务器公网 IPv4；只有服务器的 IPv6 确实可达时才加 AAAA。放行服务器和云平台安全组的 TCP 80、443，给申请证书和 HTTPS 访问使用。不要向公网开放播放器的 3000 端口。

服务器在中国大陆时，先通过接入服务商办理域名备案，再开放网站；要求可查[工信部备案管理办法](https://wap.miit.gov.cn/zcfg/xxtxl/art/2024/art_7e48434c08c24131b4b7eecfca5b2b6c.html)。备案没完成时，换端口并不能替代这一步。

## 生成并保留密钥

首次部署时，在**服务器上、以后运行 Campanula 的同一个普通用户下**执行以下命令。它把随机密钥写进只有自己能读的文件，不会把密钥打印到终端。需要先安装 OpenSSL。

```bash
mkdir -p "$HOME/campanula-config"
chmod 700 "$HOME/campanula-config"
(
  umask 077
  set -o noclobber
  {
    printf 'COOKIE_SECRET='
    openssl rand -base64 32
    printf 'PROTOCOL_HEADER=x-forwarded-proto\nHOST_HEADER=x-forwarded-host\n'
  } > "$HOME/campanula-config/runtime.env"
)
```

如果提示文件已存在，先打开原文件检查，**不要覆盖重生成**。把文件里的密钥另存到自己的密码管理器，升级时继续用这一把。不要把文件提交到 Git 或放进公开镜像。

`COOKIE_SECRET` 至少 32 个字符，用来加密浏览器保存的网易云登录凭据。服务器每次请求临时解密使用，不在服务器建立凭据库。换密钥后旧 Cookie 无法解密，听众需要重新登录。

## 站长要配的

两种运行方式都使用上面的 `runtime.env`。每行写一个 `名称=值`，不写 `export`，也不在值外面加引号。修改环境文件后，要重启 Node；Docker 则要按原启动命令重新创建容器，单纯 `docker restart` 不会重读文件。

| 名称              | 怎么填                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `COOKIE_SECRET`   | 必填，上一步生成的随机密钥，至少 32 个字符。升级保留原值。                                                                                       |
| `PROTOCOL_HEADER` | 本教程填 `x-forwarded-proto`，让程序知道外面的请求使用 HTTPS。                                                                                   |
| `HOST_HEADER`     | 本教程填 `x-forwarded-host`，让程序知道听众访问的域名。                                                                                          |
| `NETEASE_REAL_IP` | 可选。填自己实际可确认的国内公网 IP，作为请求参数交给网易云；它不会改变服务器真正的网络出口。不确定就不添加。                                    |
| `HOST` / `PORT`   | Node 命令指定 `127.0.0.1` / `3000`；Docker 内部使用 `0.0.0.0` / `3000`，由端口映射限制外部访问。不要把 Node 的 `HOST=127.0.0.1` 复制进容器环境。 |

本教程用转发头还原外部地址，不需要另外设置 `ORIGIN`。这些头只应由自己的代理写入，因此程序只监听本机，不能让公网请求绕过代理。配置含义可对照 [SvelteKit Node 部署说明](https://svelte.dev/docs/kit/adapter-node)。

先照 [Docker](./docker.md) 或 [Node](./node.md) 篇启动，再继续下面的配置。

## HTTPS 反向代理

反向代理负责接收浏览器的 HTTPS 请求、提供证书，再把请求转交本机 `127.0.0.1:3000`。Campanula 本身不申请证书。登录 Cookie、安装和离线功能需要安全连接；公网 HTTP 地址会显示「需要用 HTTPS 打开」。本机 `localhost` 可以用 HTTP 做检查。

下面选一种代理即可。如果机器已有网站，先保存现有配置，只加自己的播放器站点，不要覆盖别人的站点。

### Caddy

按 [Caddy 官方安装说明](https://caddyserver.com/docs/install)安装系统服务。以下使用其常见的 `/etc/caddy/Caddyfile` 路径；在服务器用 `sudoedit /etc/caddy/Caddyfile` 加入这段，把域名换成自己的：

```caddyfile
music.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

在服务器检查并加载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 50 --no-pager
```

Caddy 会[自动申请和续期证书](https://caddyserver.com/docs/automatic-https)，并在[转交请求时设置协议和域名头](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers)。如果证书申请失败，先看日志，核对 DNS、80/443 端口和已有服务占用，再重试。

### 已经在用 Nginx

先为自己的域名取得有效证书。下面假设证书已由 Certbot 等工具放在 `/etc/letsencrypt/live/music.example.com/`；证书尚不存在时不能直接加载这段。申请步骤按证书工具对应的系统教程完成，也要保留它的续期任务。

在服务器的 Nginx 站点配置中加入 HTTPS 站点，把所有域名及证书路径换成自己的：

```nginx
server {
    listen 443 ssl;
    server_name music.example.com;
    ssl_certificate /etc/letsencrypt/live/music.example.com/fullchain.pem;
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
server {
    listen 80;
    server_name music.example.com;
    return 301 https://$host$request_uri;
}
```

保留证书工具需要的验证路径。然后在服务器执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

检查失败时先修复报告的配置行，继续用原来运行中的配置；不要反复重启整个服务。转发头的含义见 [Nginx 代理说明](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header)。

## 打开自己的登录页

先在**服务器**检查本机进程：

```bash
curl -i http://127.0.0.1:3000/api/account
```

新实例没有登录时应得到 HTTP 200 和含 `"account":null` 的 JSON。然后在**自己的电脑或手机**打开 `https://music.example.com`，应看到登录入口。也可在自己的电脑终端运行 `curl -I https://music.example.com/` 检查证书和 HTTP 响应。

- 本机请求连接失败：先查 Node 日志或 `docker logs campanula`，确认进程、监听端口与启动路径。
- 本机正常，外面显示 502：代理没有连到程序，核对代理目标与容器的本机端口映射。
- 显示「需要配置加密密钥」，接口回 HTTP 500 / `cookieSecretMissing`：检查环境文件里的 `COOKIE_SECRET` 是否完整、至少 32 个字符，然后重新启动进程或重新创建容器。启动日志也会说明缺密钥。
- 显示「需要用 HTTPS 打开」：检查浏览器地址和证书，不能只给转发头写 `https` 就继续用公网 HTTP。
- 短信报 10004：可以改用扫码，或尝试配置真实国内公网 IP 后重启。此前改配置后成功过，但两次尝试相隔 19 分钟，不能保证是改 IP 解除了限制。

正常登录页是配置成功的标志；账号登录和设备上的安装、下载还要自己照[安装与离线播放](./listen.md)试。以后更新程序看[升级与回退](./upgrade.md)。
