# 测试启动器拥有独立工作根，人工开发使用两个主机

2026-11-15，Spec #96 / #98 要求普通开发、人工 mock 与自动化同时运行，不能互相改登录密钥、生成类型、缓存或曲库。产品会话、HTTP 路由与 SDK 调用继续遵守 ADR-0003/0004/0013/0018。

## 决策

- 产品 Vite 配置只装产品实现。mock SDK、控制接口、媒体、token 替身和开发标记由 `tests/_kit/mock` 从外部装配，状态属于同一个 SSR runner 模块实例；不挂进程全局对象。
- `scripts/dev/environment.mts`（由 `tests/_kit/workspace.ts` 转出）为每个环境创建自己的 node_modules 目录，只链接已安装的包，`$app`、Kit、env 与 Vite 缓存留在各自工作根。src/static 指回同一源码。World 每个 Vitest worker 也拥有独占工作根；受控时钟和 SSR 覆盖率仍串行执行。
- 人工 mock 工作根为 `.campanula/mock`，密钥保存在权限受限的 identity 文件，重启沿用；曲库在进程内，重启回种子。临时环境默认生成新密钥；旧版 Cookie 兼容样本单独声明其原合成密钥，不改写历史 header。临时环境拥有独立子进程、端口和根，结束删除。锁是带唯一 token 的非空目录，通过原子 rename 占用，拒绝重复启动。只在拥有者 PID 已消失时删除读到的旧 token、回收空目录；迟到的回收不能删掉新拥有者。关闭也只释放自己的 token，不终止其他进程。
- 作者补充决定后，普通 dev / dev:mock 默认双 HTTPS 域名；dev:http / dev:mock:http 保留 localhost:5173 / 127.0.0.1:5174。Cookie 按主机隔离，保留产品默认名称及 LOGIN_COOKIE_NAME 兼容；不能靠不同端口隔离 Cookie。reset 只还原模拟上游；新设备由新 jar/context 建立。
- 未取得项目域名控制权证据，HTTPS 固定使用保留名 `local.campanula.test` 与 `mock.campanula.test`，端口分别为 8443 与 8444。显式配置外部 origin 后，Kit 请求 origin、Vite 客户端与 WSS 都使用这个地址；错误主机在登录和写入前回 421。Vite 原生 HTTPS 只监听回环，HTTP/1.1 Host 与 HTTP/2 :authority 都经过同一域名门禁。
- HTTPS 专项自行准备临时源码、mkcert CAROOT、证书与高位端口，客户端只为本次请求信任该 CA。默认套件不依赖 mkcert、OpenSSL、系统信任、hosts 或作者账号。HTML/HTTP/WSS 探针不当作浏览器 UI 证据。

## Consequences

入口、生命周期证据与迁移方法见 `tests/README.md`、`docs/development.md` 和 mock 指南。切换主机会重新登录；IndexedDB、下载与 Service Worker 仍属于旧 origin，不自动搬迁。真实浏览器和设备存储由后续浏览器票验证，真账号、Android、系统选择器和真实读屏由作者验收。领域语言没有新增概念，GLOSSARY 不变。

测试与覆盖率报告也按运行独占目录，latest JSON 仅作导航；原 src 阈值在迁移前文件集合继续执行，产品各分区阈值不变。子进程正常关闭时先保存执行数据，故意杀进程的故障场景不伪造执行次数。

2026-11-15 作者试运行后更新：`scripts/dev.mts` 是 dev / dev:mock 的 SSOT，统一模式配置、首次引导、证书策略与 Vite 生命周期；私有模块 `scripts/dev/` 承担工作根、证书文件和 HTTP。`tests/_kit` 只转出接口，mock 仍从外部装配。移除人工 Caddy 代理和分散在 tests/tools 的启动命令。

直接 dev 按需确认 mkcert 下载、系统 CA 安装与 hosts 追加；系统修改必须先在交互终端确认。成功准备后保存 CA 路径与指纹，正常启动复用本机长期 CA，不重新安装信任；叶证书检查有效期、SAN、签名和私钥，剩余不超过 30 天自动用原 CA 续签。并发签发加锁，完整新证书组校验后原子发布；失败或取消不覆盖可用缓存。失效 CA 的更换与重新信任需明确操作，不静默删除。Ctrl+C / SIGTERM 关闭自己派生的 Vite、释放端口与锁，保留 CA、证书和稳定身份；不终止占用端口的其他进程。HTTP 备用保持显式选择。

2026-11-16 作者首次授权复现 sudo 无法读取终端：Unix 上 execa 的 killDescendants 会隐式 detached，继承 stdio 不能保留控制终端。mkcert -install、hosts 追加和 DNS 刷新统一走前台终端执行器，取消时用 pidtree 定位本命令的后代后转发信号；不向启动器所在的整个进程组广播。主信号监听保留到异步收尾完成，避免 signal-exit 在 once 监听移除后重新发送信号。非交互的版本探测、CAROOT 和签发继续使用独立进程组。伪终端回归关闭内层 stdin 验证真实控制终端读取，同时保持会话到断言之后；自动化仍不安装系统 CA 或修改 hosts。

同日最终收敛：Vite worker 复用 execaNode 的 ipcInput / getOneMessage、gracefulCancel 和五秒 forceKillAfterDelay，替代手写 fork、消息等待和 TERM/KILL 定时器。worker 收到取消后关闭 Vite、保存覆盖率，父进程等待退出后释放工作根。前台授权命令保持原终端，用 pidtree 取得取消时的后代快照，p-wait-for 等待 SIGINT 后的退出；一秒后向仍存活的自有后代发送 SIGKILL，再等待一秒。权限拒绝或超时明确报告，不隐式再次提权；不保证回收已经脱离父子关系或操作系统不允许终止的进程。命令、域名、证书与身份策略不变，完成后继续暂停接力。

2026-11-16：独立 Playwright Test / 配套 Chromium 与同 page axe 已落地，按 tests/suites.ts 选择，默认全量顺序运行 Vitest 与页面用例。临时服务和空 context 不依赖作者浏览器；真实 page 的 Cookie、IndexedDB/Cache Storage、HMR/新增路由和清理分别留证。诊断归 tests/tools/browser，移除旧 attach/profile 桥接。具体范围、首扫和人工边界见 #100 验收文档。

独立根的 Svelte 编译以实际源码根作为 rootDir，让 CSS scope 按源码相对路径生成，与检出目录和临时根的绝对地址无关。axe 人工清单仍逐场景/规则/精确 target 匹配；旧 scope 逐组件映射，原始观测保留，不按机器另增别名或排除组件。
