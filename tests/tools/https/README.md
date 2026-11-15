# 本机双 HTTPS

`pnpm dev` 默认打开 `https://local.campanula.test/`，`pnpm dev:mock` 默认打开 `https://mock.campanula.test/mock/login`。启动日志以这个 HTTPS 地址为主；后端仍只监听本机的 localhost:5173 / 127.0.0.1:5174。没有项目域名控制权证据，使用保留的 `.test` 名字。

## 首次准备

安装 Caddy 和 OpenSSL 后，显式生成短期证书：

```sh
pnpm dev:setup
openssl x509 -in .campanula/tls/ca.crt -noout -fingerprint -sha256
```

作者自行让浏览器将 `local.campanula.test`、`mock.campanula.test` 解析到 127.0.0.1，例如手动配置 hosts 或专用浏览器的 host resolver；再核对 CA 指纹，在选定的浏览器 / 系统信任范围中显式导入 `.campanula/tls/ca.crt`。脚本不改解析或系统信任，也不跳过证书校验。私钥保留在 Git 与 Docker 都忽略的 `.campanula/tls`，证书过期后重新准备、更新信任并重启代理。

随后在一个终端保持代理运行：

```sh
pnpm dev:proxy
```

另开终端按需运行普通开发和人工 mock：

```sh
pnpm dev
pnpm dev:mock
```

缺少证书时，两个常用命令会退出并提示 `dev:setup`；代理尚未启动或证书不匹配时，会提示 `dev:proxy`。准备检查只在本次 TLS 连接中信任项目 CA，不会安装系统 CA。代理使用临时工作目录，Ctrl+C 只关闭自己启动的 Caddy 并清理缓存；后端由各自命令关闭。重复占用端口会明确失败。

只做 CLI 请求时，可以独立指定信任和解析：

```sh
curl --cacert .campanula/tls/ca.crt \
  --resolve local.campanula.test:443:127.0.0.1 https://local.campanula.test/
```

出现 `bind: permission denied` 表示当前进程无权监听该端口，不需要重做证书；启动器会给出高位端口指令。443 不可用时，为代理和两个开发命令设置相同的 `CAMPANULA_HTTPS_PORT=8443`，浏览器地址也加 `:8443`。高位端口下使用浏览器工具时也显式设置 `CAMPANULA_BROWSER_ORIGIN`，例如 `CAMPANULA_BROWSER_ORIGIN=https://mock.campanula.test:8443 scripts/browser.sh reset`；真账号工具相应使用 `https://local.campanula.test:8443`。自定义证书目录用 `CAMPANULA_DEV_TLS_DIR`，所有终端保持一致。改后端 `--port` 时，代理需同时设置 `CAMPANULA_PRODUCT_UPSTREAM` / `CAMPANULA_MOCK_UPSTREAM`。代理只绑定 127.0.0.1，保留原 Host，转发页面、API 和 WSS；未知 Host 直接 421，Cookie 不添加 Domain。

## 显式 HTTP

暂时不准备 HTTPS 时运行：

```sh
pnpm dev:http        # http://localhost:5173/
pnpm dev:mock:http   # http://127.0.0.1:5174/mock/login
```

作者浏览器工具默认也使用 HTTPS；其 Node 请求仅为这两个开发域名读取项目 CA，并解析到回环，不依赖 Node 的系统信任或 DNS。浏览器本身仍需上述显式信任与解析。临时 HTTP 验证可以显式设置 `CAMPANULA_BROWSER_ORIGIN=http://127.0.0.1:5174`；真账号模式设置为 `http://localhost:5173`，仍先检查登录态。

## 自动专项

```sh
pnpm test:environment:https
```

命令准备临时源码、CA / 证书、高位端口和独立工作根；通过真实 `dev:proxy`、`dev`、`dev:mock` 入口检查代理、默认地址、就绪日志及两站响应。客户端仅为本次请求信任 CA，并在本次连接中解析 `.test` 到回环；不读作者 `.env`、修改 hosts 或安装系统 CA。

专项检查两站 HTML、缺 CA 失败、同 jar 登录 / 账号 / reset / 退出与普通匿名、Secure / HttpOnly / SameSite / host-only Cookie、错误 Host 拒绝，以及两个 WSS 客户端收到同一临时 Svelte 文件的更新。还验证证书已准备但缺代理时明确失败。随后再运行一次真实 SIGTERM 中断场景，验证命令进程组、端口与临时根同样清理。结束关闭命令进程、后端、WSS 和代理，删除证书、缓存与源码副本。结果在 `.reports/https/<本次专项>/result.json`，由 `.reports/latest-https.json` 导航。缺 CLI 或检查失败会非零退出；默认 `pnpm test` 不依赖 Caddy/OpenSSL。

没有打开浏览器，不证明渲染、IndexedDB、焦点或手机连通性。

## 地址迁移

原 HTTP `localhost:5174` 不能继续作为 mock 登录地址。默认改用双 HTTPS；显式 HTTP mock 改用 127.0.0.1。启用 HTTPS 的后端会拒绝旧别名并指出正确入口。切换主机或端口后需要重新登录；IndexedDB、下载与 Service Worker 仍属于旧 origin，不自动搬迁或清理。切换前先在旧地址导出需要保留的下载。

参考：[Caddy 显式证书](https://caddyserver.com/docs/caddyfile/directives/tls)、[Vite Host 与 HMR](https://vite.dev/config/server-options.html)。
