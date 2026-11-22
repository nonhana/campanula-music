---
title: 部署到自建服务器
description: 在自建服务器上配置域名、环境变量与 HTTPS 反向代理，并通过 Docker 或 Node.js 运行。
---

在自有 Linux 服务器部署分为三步：

1. 配置域名解析、服务器防火墙与环境变量文件。
2. 选择 [Docker 部署](./docker.md) 或 [Node.js 部署](./node.md) 启动应用服务。
3. 配置 [HTTPS 反向代理](#https-反向代理) 并完成上线验证。

## 准备域名与网络

- 为播放器域名添加 `A` 记录指向服务器公网 IPv4 地址（若有可用 IPv6 地址可同步添加 `AAAA` 记录）。
- 防火墙与云安全组仅需放行 TCP `80` 和 `443` 端口；应用监听的 `3000` 端口仅绑定回环地址 `127.0.0.1` 供本机反代转发，不要对外暴露。
- 若使用中国大陆境内服务器提供公网访问，需事先完成域名备案（参见[工信部备案指南](https://hunca.miit.gov.cn/bsfw/bszn/art/2024/art_7ef0d8bd3b0d433ba4b9b277f883f74d.html)）。

下文配置示例中的 `music.example.com` 均需替换为实际域名。

## 生成并保存密钥

以部署用户登录服务器并在 Bash 中执行以下脚本（依赖 OpenSSL）：

```bash
mkdir -p "$HOME/campanula-config"
chmod 700 "$HOME/campanula-config"
(
  umask 077
  set -o noclobber
  CAMPANULA_SECRET=$(openssl rand -base64 32) || exit 1
  printf 'COOKIE_SECRET=%s\nPROTOCOL_HEADER=x-forwarded-proto\nHOST_HEADER=x-forwarded-host\n' \
    "$CAMPANULA_SECRET" > "$HOME/campanula-config/runtime.env"
)
```

若 `~/campanula-config/runtime.env` 已存在，直接沿用原文件即可。升级过程中须保留原有密钥；更换 `COOKIE_SECRET` 会导致所有已登录听众的会话失效并需重新登录。

## 环境变量

`~/campanula-config/runtime.env` 采用每行一条 `KEY=VALUE` 格式，不添加 `export` 与引号：

| 变量                | 说明                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `COOKIE_SECRET`     | 必填，长度至少 32 个字符的随机密钥                                |
| `PROTOCOL_HEADER`   | 反代场景固定设为 `x-forwarded-proto`                              |
| `HOST_HEADER`       | 反代场景固定设为 `x-forwarded-host`                               |
| `NETEASE_REAL_IP`   | 可选，中国大陆公网 IP；当境外服务器短信登录受限时填入，传给网易云 |
| `LOGIN_COOKIE_NAME` | 可选，登录 Cookie 名称，默认为 `campanula_login`                  |

修改环境变量后，需重启 Node.js 进程或重建 Docker 容器使其生效。

## HTTPS 反向代理

完成 [Docker 部署](./docker.md) 或 [Node.js 部署](./node.md) 后，使用 Caddy 或 Nginx 将外部 HTTPS 流量转发至 `127.0.0.1:3000`。

### Caddy

按照 [Caddy 官方安装指南](https://caddyserver.com/docs/install) 安装 Caddy 后，在 `/etc/caddy/Caddyfile` 中追加以下站点配置（Caddy 会自动申请与续签 HTTPS 证书）：

```text
music.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

校验并重载配置：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile &&
  sudo systemctl reload caddy
```

### Nginx

提前为域名签发 TLS 证书后，在站点配置中填入证书路径与反向代理头（并保留 certbot 等证书工具生成的自动续期配置）：

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
    }
}

server {
    listen 80;
    server_name music.example.com;
    return 301 https://$host$request_uri;
}
```

校验语法并重载 Nginx：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 验证部署

1. 在服务器上执行 `curl -i http://127.0.0.1:3000/api/account`，未登录状态下应返回 HTTP `200` 及包含 `"account":null` 的 JSON。
2. 在桌面端或手机浏览器中打开目标 `https://` 地址，确认可以正常访问网易云登录页面。

| 异常现象                   | 排查方式                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| 本机 `3000` 无响应         | 检查 Node.js 进程状态或查看 `docker logs campanula` 输出                              |
| 本机正常但公网报 502       | 核对反代 `proxy_pass` 目标是否为 `127.0.0.1:3000` 及容器端口映射                      |
| Caddy 未能签发证书         | 核对域名解析是否生效、安全组是否放行 `80` / `443`，并检查 `journalctl -u caddy -n 50` |
| 返回 `cookieSecretMissing` | 检查 `runtime.env` 中的 `COOKIE_SECRET`，修正后重启进程或重建容器                     |
| 短信登录返回 10004         | 改用二维码登录，或在 `runtime.env` 中补充 `NETEASE_REAL_IP` 后重启                    |

下一步可阅读[安装与离线播放](./listen.md)与[升级与回退](./upgrade.md)。
