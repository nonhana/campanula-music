# 测试启动器拥有独立工作根，人工开发使用两个主机

2026-11-15，Spec #96 / #98 要求普通开发、人工 mock 与自动化同时运行，不能互相改登录密钥、生成类型、缓存或曲库。产品会话、HTTP 路由与 SDK 调用继续遵守 ADR-0003/0004/0013/0018。

## 决策

- 产品 Vite 配置只装产品实现。mock SDK、控制接口、媒体、token 替身和开发标记由 `tests/_kit/mock` 从外部装配，状态属于同一个 SSR runner 模块实例；不挂进程全局对象。
- `tests/_kit/workspace.ts` 为每个环境创建自己的 node_modules 目录，只链接已安装的包，`$app`、Kit、env 与 Vite 缓存留在各自工作根。src/static 指回同一源码。World 每个 Vitest worker 也拥有独占工作根；受控时钟和 SSR 覆盖率仍串行执行。
- 人工 mock 工作根为 `.campanula/mock`，密钥保存在权限受限的 identity 文件，重启沿用；曲库在进程内，重启回种子。临时环境默认生成新密钥；旧版 Cookie 兼容样本单独声明其原合成密钥，不改写历史 header。临时环境拥有独立子进程、端口和根，结束删除。锁是带唯一 token 的非空目录，通过原子 rename 占用，拒绝重复启动。只在拥有者 PID 已消失时删除读到的旧 token、回收空目录；迟到的回收不能删掉新拥有者。关闭也只释放自己的 token，不终止其他进程。
- 作者补充决定后，普通 dev / dev:mock 默认双 HTTPS 域名；dev:http / dev:mock:http 保留 localhost:5173 / 127.0.0.1:5174。Cookie 按主机隔离，保留产品默认名称及 LOGIN_COOKIE_NAME 兼容；不能靠不同端口隔离 Cookie。reset 只还原模拟上游；新设备由新 jar/context 建立。
- 未取得项目域名控制权证据，HTTPS 固定使用保留名 `local.campanula.test` 与 `mock.campanula.test`。显式配置外部 origin 后，Kit 请求 origin、Vite 客户端与 WSS 都使用这个地址；错误主机在登录和写入前回 421。Caddy 只监听回环，不自动申请公共证书或安装 CA。
- HTTPS 专项自行准备临时源码、CA、证书、高位端口与代理，客户端只为本次请求信任该 CA。默认套件不依赖 Caddy、OpenSSL、系统信任、hosts 或作者账号。HTML/HTTP/WSS 探针不当作浏览器 UI 证据。

## Consequences

入口、生命周期证据与迁移方法见 `tests/README.md`、`tests/tools/https/README.md` 和 mock 指南。切换主机会重新登录；IndexedDB、下载与 Service Worker 仍属于旧 origin，不自动搬迁。真实浏览器和设备存储由后续浏览器票验证，真账号、Android、系统选择器和真实读屏由作者验收。领域语言没有新增概念，GLOSSARY 不变。

测试与覆盖率报告也按运行独占目录，latest JSON 仅作导航；原 src 阈值在迁移前文件集合继续执行，产品各分区阈值不变。子进程正常关闭时先保存执行数据，故意杀进程的故障场景不伪造执行次数。

作者试运行后确认默认 HTTPS：显式 dev:setup 准备证书和人工解析 / 信任，dev:proxy 单独运行代理；两个常用命令先验证受信代理，再启动后端并以 HTTPS 显示入口。缺准备明确失败，不自动回退 HTTP。普通产品配置不装 mock，开发启动工具归 tests/tools。
