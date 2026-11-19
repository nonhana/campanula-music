---
title: 部署到自己的服务器
description: 用 Docker 或 Node 启动播放器，再配置 HTTPS。
---

1. 准备域名、端口和环境文件。
2. 用 [Docker](./docker.md) 或 [Node](./node.md) 启动播放器。
3. [配置 HTTPS](#https-反向代理)，打开自己的登录页。

## 准备域名与网络

- 给播放器域名添加 A 记录，指向服务器公网 IPv4。有可达的 IPv6 时可加 AAAA 记录。
- 在防火墙和云安全组放行 TCP `80` 和 `443`，`3000` 只留给本机代理。
- 中国大陆服务器先办理域名备案。 [备案办理指南](https://hunca.miit.gov.cn/bsfw/bszn/art/2024/art_7ef0d8bd3b0d433ba4b9b277f883f74d.html)

以下示例中的 `music.example.com` 换成自己的域名。

## 生成并保留密钥

在服务器以部署用户运行（需要 Bash 和 OpenSSL）。

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

已有 `runtime.env` 时沿用原文件。备份密钥，升级保留原值。换密钥会要求所有听众重新登录。

## 环境变量

`~/campanula-config/runtime.env` 每行写一个 `名称=值`，省略 `export` 和引号。

| 变量              | 值                                            |
| ----------------- | --------------------------------------------- |
| `COOKIE_SECRET`   | 必填，至少 32 个字符。                        |
| `PROTOCOL_HEADER` | `x-forwarded-proto`                           |
| `HOST_HEADER`     | `x-forwarded-host`                            |
| `NETEASE_REAL_IP` | 可选。自己的国内公网 IP，作为参数传给网易云。 |

修改后重启 Node，或按原命令重新创建 Docker 容器。

## HTTPS 反向代理

启动播放器后，选 Caddy 或 Nginx，将流量转发到 `127.0.0.1:3000`。

### Caddy

[安装 Caddy](https://caddyserver.com/docs/install)，把以下站点追加到 `/etc/caddy/Caddyfile`。Caddy 会自动申请和续签证书。

```text
music.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile &&
  sudo systemctl reload caddy
```

### 已经在用 Nginx

先为域名签发证书。添加以下站点配置，换成实际证书路径，并保留证书工具使用的续期配置。

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

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 打开自己的登录页

1. 在服务器运行 `curl -i http://127.0.0.1:3000/api/account`，未登录时应返回 HTTP 200 和 `"account":null`。
2. 在电脑或手机打开播放器的 HTTPS 地址，确认看到网易云登录入口。

| 现象                  | 检查                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| 本机连不上            | 确认 Node 已启动，或查看 `docker logs campanula`。                    |
| 本机正常，公网报 502  | 核对代理目标和端口映射。                                              |
| Caddy 未签发证书      | 核对 DNS 和 `80`、`443` 端口，查看 `sudo journalctl -u caddy -n 50`。 |
| `cookieSecretMissing` | 检查 `COOKIE_SECRET`，修改环境文件后重启 Node 或重建容器。            |
| 短信登录报 10004      | 改用扫码，或尝试配置 `NETEASE_REAL_IP`。                              |

[安装与离线播放](./listen.md) · [升级与回退](./upgrade.md)
