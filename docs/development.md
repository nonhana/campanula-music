# 本地开发

准备好 Node、pnpm 和产品 `.env` 后，直接运行：

```sh
pnpm dev         # https://local.campanula.test:8443/
pnpm dev:mock    # https://mock.campanula.test:8444/mock/login
```

每个命令只占一个终端。启动器准备 HTTPS，再启动 Vite；看到 `Ready` 后打开日志中的完整地址，终端保持运行是正常的。Ctrl+C 关闭本次 Vite、连接和文件监听，释放端口与工作锁。证书、CA、mock 身份和浏览器数据会保留，重启可以继续使用。

## 第一次运行

`pnpm dev` 和 `pnpm dev:mock` 都会检查准备情况，交互终端中按需引导：

1. 检查已有 mkcert；找不到时询问是否下载官方 v1.4.4 二进制到项目的 `.campanula/tools/`，也可以自行安装 mkcert。
2. 说明将使用本机 mkcert CA，确认后运行 `mkcert -install` 安装或复核系统信任。系统可能要求密码。CA 私钥留在 mkcert 的 `CAROOT`，不会复制进仓库。
3. 为两个开发域名签发同一张站点证书，并检查系统是否把域名解析到 `127.0.0.1`。macOS/Linux 缺映射时询问是否向 `/etc/hosts` 追加缺少的条目，macOS 随后刷新 DNS 缓存；已有冲突映射会要求手动修正。Windows 按提示手动配置 hosts。
4. 启动当前选择的模式，输出实际 HTTPS 地址。

每次系统修改前都有确认，可以选择取消；只有需要这些步骤时才询问。`pnpm dev:setup` 可以单独完成或复核准备，不启动应用。无交互终端遇到首次准备会退出并给出指引。

mkcert 的部分浏览器信任库还依赖平台工具，例如 Firefox 使用的 NSS。以 mkcert 输出为准；系统授权窗口、浏览器证书信任和首次访问仍需本人确认。曾手动移除系统信任时，重新运行 `pnpm dev:setup`，本地记录不能证明系统信任后来没有改变。

## 证书如何复用

本机 CA 长期保存在 mkcert 的 `CAROOT`，项目在 `.campanula/tls/trusted.json` 记录准备时的 CA 路径和指纹。每次启动检查 CA、站点证书、私钥及两个域名是否一致，站点证书剩余有效期超过 30 天就直接复用。缺失、损坏、过期或进入 30 天续签窗口时，用同一个 CA 重新签发，不重复安装系统信任。mkcert v1.4.4 的 CA 为 10 年、站点证书约 2 年 3 个月；具体到期时间以文件为准，参见 [mkcert](https://github.com/FiloSottile/mkcert)。

签发过程有工作锁，两个模式同时启动只会签发一次；新证书整组验证通过后才原子切换 `current.json`，取消或失败不会发布半套文件。旧证书组保留，避免另一个刚启动的进程读到被删除的文件。CA 路径或指纹变化会重新请求确认；CA 失效或临近到期时，需要显式更换并重新信任，启动器不会自动删除或重建 CA。正常退出不撤销系统信任。

`CAROOT` 和 `CAMPANULA_MKCERT` 可选择已有的 CA 目录与 mkcert 程序；改变 `CAROOT` 会触发新的信任确认。TLS 缓存可以用 `CAMPANULA_DEV_TLS_DIR` 指定。以上目录含私钥，应留在本机，勿提交或分享。

## 端口、HTTP 与排错

```sh
pnpm dev --port 9443
pnpm dev:mock --port 9444
pnpm dev:http                  # http://localhost:5173/
pnpm dev:mock:http             # http://127.0.0.1:5174/mock/login
pnpm dev --print-config        # 只输出 JSON 地址配置，不启动或准备环境
```

8443/8444 不需要为监听端口提权；端口冲突或工作根已经占用时明确失败，先在原终端 Ctrl+C，再重试。启动器只收尾自己创建的进程，不会终止占用端口的其他服务。HTTPS 准备失败会给出原因和下一步；使用 HTTP 请显式选择上述入口。

普通和 mock 使用不同主机，因为 Cookie 不能靠端口隔离。IndexedDB、下载和 Service Worker 属于完整 origin，换端口或主机会使用另一份浏览器存储，不会自动搬迁。普通模式读取产品 `.env`；mock 的 Kit、缓存与身份保存在独立的 `.campanula/mock`，不读取产品密钥，重启内存曲库回种子。

- 启动器提示 `198.18.*` 等 Fake-IP：检查 TUN/VPN 的域名排除规则；hosts 正确但解析仍被接管时，需要在代理工具中放行这两个域名。日志会显示实际解析地址。
- 浏览器报连接关闭：确认命令还在运行，使用日志中的完整 `https://…:8443` 或 `:8444`，检查本机代理是否转发了 `.test` 域名。没有端口的 HTTPS 会访问 443。
- 浏览器不信任证书：重新运行 `pnpm dev:setup` 复核平台信任，并重启浏览器；无需反复删除 CA。
- 改端口后运行浏览器工具：显式设置 `CAMPANULA_BROWSER_ORIGIN`，例如 `https://mock.campanula.test:9444`。浏览器工具默认地址同样读取启动器配置。兼容 `CAMPANULA_HTTPS_PORT` 与 `CAMPANULA_DEV_ORIGIN`，但两个模式共用同一个端口覆盖值会冲突；优先用各命令的 `--port`。

## 从旧版代理迁移

先在原终端 Ctrl+C 停止旧的 `dev:proxy` 和后端，再运行新的 `pnpm dev` 或 `pnpm dev:mock`。旧 Caddy 和 OpenSSL 不再是人工开发的依赖，也没有额外代理终端。旧的短期 CA 不会继续用来签发，新引导会使用本机 mkcert CA，第一次需要确认信任。旧 CA 是否撤销由本人决定。

普通入口改为 8443、mock 改为 8444，原浏览器存储留在旧 origin，旧下载不会自动迁移。同一主机的 Cookie 可以跨端口沿用；Cookie 仍有效且密钥未变时，登录可以保留，换主机或会话失效时再登录。检查 shell 中遗留的 `CAMPANULA_HTTPS_PORT` / `CAMPANULA_DEV_ORIGIN` 覆盖值，避免继续访问旧端口。

## 实现与自动化边界

`scripts/dev.mts` 是 CLI、模式、地址与生命周期策略的唯一入口，私有模块 `scripts/dev/` 实现工作根、证书文件与 HTTP 操作。`tests/_kit` 只转出共享接口，mock 插件仍在测试装配层；产品配置不装 mock。

`pnpm test:environment` 覆盖真实 CLI、隔离、缓存、取消和重试，不需要系统 mkcert/OpenSSL。显式 `pnpm test:environment:https` 需要 mkcert 与 OpenSSL，使用临时 CAROOT、源码和高位端口，验证真实签发、复用续签、HTTP/1.1、HTTP/2、Cookie、域名门禁、WSS/HMR 和退出；不安装 CA 或修改 hosts，也不连接作者浏览器、账号。报告见 [测试导航](../tests/README.md)。

受控客户端可用 `--cert / --key / --ca` 三项传入独立证书，并用 `--skip-dns-check` 显式跳过系统解析预检；证书仍正常校验，客户端必须自己解析开发域名。这些参数用于自动化或已有证书的环境。
