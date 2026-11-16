# 测试导航

新检出仓库先用 `.node-version` 的 Node 和 `package.json` 的 pnpm 版本运行 `pnpm install --frozen-lockfile`。下列命令自己启动本机 HTTP 和 Kit，只用合成设备与脱敏录制，不需要正在运行的 dev、浏览器、全局浏览器 CLI 或账号凭据。控制终端回归在 macOS/Linux 使用 Python 3.9+ 标准库的 pty；这是测试依赖，`pnpm dev` 本身不依赖 Python。

## 从一个文件开始

```sh
pnpm test:unit tests/unit/selection-core.test.ts
pnpm test:behavior tests/behavior/playback.test.ts
pnpm test:behavior tests/behavior/playback.test.ts -t '换到还不知道时长'
pnpm test:contract tests/contract/api.test.ts
pnpm test
```

同一条播放用例既在单文件命令中运行，也在默认套件中运行。`-t` 过滤用例全名；Vitest 的其他运行参数也可以追加。文件或全名选不到用例时会失败。受控套件提供 `test:unit`、`test:behavior`、`test:contract` 和 `test:environment`；浏览器与 a11y 见下节；候选生产产物使用 test:delivery 的显式 SHA、adapter 和 candidate，见下节。

| 目录                           | 输入与可观察输出                                                | 证据范围                                                                              |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `unit/`                        | 操作序列、音频样本 → 规则结果、新文件                           | 手势、多选、浮层栈、会话轮次、歌曲标签；不运行页面                                    |
| `behavior/`                    | 听众操作、时间/网络/设备事件 → App 状态、请求、Cookie、本机保存 | World 经过产品客户端、真实本机 HTTP 和独立 Vite SSR；浏览器外部能力与网易云由替身提供 |
| `contract/api.test.ts`         | HTTP 合同 → 请求方法、载荷和 keepalive 边界                     | 客户端消费者合同；不连真实 HTTP                                                       |
| `contract/mock-*.test.ts`      | 录制索引、mock SDK 与状态 → 数据和合同检查                      | 录制 / 替身自检，不算产品听众行为或真实上游证据                                       |
| `delivery/mock-server.test.ts` | 实际 HTTP 请求 → mock 装配后的响应                              | 既有开发环境自检，随默认套件运行；不证明 Node/Vercel 候选产物                         |
| `_kit/`、`fixtures/`、`tools/` | 设备、时钟、严格 SDK 替身；有来源的录制；启动和诊断             | 共用测试基础设施，产品覆盖率单独计算                                                  |

`tests/suites.ts` 是 Vitest、runner 和 CI 共用的文件选择。它检查每个必需套件非空、每个发现的文件恰好归属一层、迁移基线中的必需文件都存在。新增测试放进对应目录即可；根目录漏放、目录重叠或删掉必需文件会直接失败。单用例时限为 15 秒，容纳 V8 精准采集下真实 HTTP 和本机保存的开销；业务等待仍用受控时钟验证。Vitest 自身及每个 World 都有独占临时工作根，`$app`、env、Kit 和缓存不再写回产品根。每个 worker 内串行运行文件。日常 CI 的独立 runner 可同时做类型检查、运行不同的测试文件和构建候选。

## 迁移清单与回归结果

[baselines/migration.json](baselines/migration.json) 来自开工提交 `9c2ec71b6cbf025f6f25fdb1a84cbd8584d94cec` 的实际 JSON 测试报告：42 文件、755 用例，全部 passed，跳过 0。每条都保留原路径、全名、原结果及迁入路径。`session-round` 中 3 条纯核心用例迁入 `unit`，其余继续走 `behavior`，用例全名不改。

`pnpm test` 全量成功后逐项核对基线，漏用例、重复执行或从 passed 改为跳过都会失败；新增用例单独列出。产物在 `.reports/runs/<本次运行>/all/`：`tests.json` 是 Vitest 真实结果，`suites.json` 按证据层列文件，`migration.json` 列保留与新增。按文件 / 全名运行时只报告所选用例，不冒充全量迁移通过。

## 覆盖率：先确认采集到了什么

```sh
pnpm test:coverage
pnpm test:coverage:calibrate
```

第一个命令运行同一份默认回归并核对迁移，产物在 `.reports/runs/<本次运行>/coverage/`；第二个只跑“未登录打开 App”的既有行为，用独立目录 本次校准运行的 `coverage/` 校准。它要求账号 `GET` 处理函数实际执行、未请求的歌单改名路由计数为零，任一不符就失败。完整验收与覆盖率专项保留这两个校验及原阈值。

- `partitions.json`：完整 `src`、扣除 mock / 开发页的产品、App、服务端、API 路由、Svelte UI、测试基建分别列文件数、命中数和分母。
- `summary.md`：各分区行与分支的命中数、分母和百分比。
- `coverage-final.json`、`index.html`：合并后的逐文件源码位置与执行次数。
- `ssr.json`：独立 SSR 的映射结果；`ssr-raw/` 保留 V8 计数和执行时的代码 / 源码映射，便于定位漏采或映射错误。
- `calibration.json`：账号处理函数命中和未请求路由的零值对照，仅校准命令产生。

采集使用 Vitest / V8 5.1.0，产品分母纳入 `src/**/*.ts` 和 `src/**/*.svelte`、排除声明，保留未运行文件。mock 已由 `src/lib/server/mock/` 移入 `tests/_kit/mock/`；`src/lib/dev/` 与 `tests/` 工具归测试基建，`product` 扣除开发页。`src` 的减少来自目录迁移及删除 mock-flag，不能写成新增行为覆盖。保留原始分区基线与阈值，并用相同 App / API 路由分区和 SSR 校准作可比较证据。独立 Vite module runner 的脚本使用绝对路径 `sourceURL`，标准采集器只收 `file://` 而漏掉它；测试采集器从同一次 V8 快照保留这些脚本，以当次内联源码映射转换后合并，不靠“请求过”人工填命中。

157 个 `.svelte` 文件没有浏览器执行记录，报告明确标为未采集。它们仍在全 `src` 分母内，零值不证明界面行为；`.svelte.ts` 中的浏览器适配、Service Worker、安装和系统行为也不能由纯规则或 App 的替身证明。浏览器旅程 / a11y 已独立接入默认回归，但没有并入这份 V8 覆盖率；真实账号、Android 系统与真实读屏仍由作者验收。

基线复测、校准前后分母、风险排序和新增回归的对照见 [baselines/coverage.md](baselines/coverage.md)。覆盖率数值只比较同口径分区；修正 SSR 漏采带来的增加与新增断言带来的增加分别记录。

## 独立开发环境

```sh
pnpm dev:setup                    # 可选：只复核 CA 信任和解析，不启动应用
pnpm dev                          # https://local.campanula.test:8443，产品实现
pnpm dev:mock                     # https://mock.campanula.test:8444，稳定人工 mock
pnpm dev:http                     # localhost:5173，显式 HTTP
pnpm dev:mock:http                # 127.0.0.1:5174，显式 HTTP mock
pnpm test:environment             # delivery 环境回归，默认 pnpm test 也会运行
pnpm test:environment tests/delivery/environment.test.ts
pnpm test:environment:https       # 显式专项，需要 mkcert/OpenSSL；临时 CA 与高位端口
```

`scripts/dev.mts` 统一管理模式、地址、CLI 与启动策略，`tests/_kit/environment.ts` 仅转出其接口：baseURL、internalURL（实际监听地址）、root、PID、reset、close。HTTPS 的 reset 使用外部 origin，调用方提供只信任本次 CA 的 request 客户端。临时环境有自己的子进程和新密钥，不读取作者 `.env`；人工 mock 使用 `.campanula/mock` 稳定根与身份。node_modules 本身不链接，只逐个链接已安装的包；可写缓存和 `$app` 留在自己的根。启动失败、取消或关闭释放自己的端口和锁；临时根删除，稳定根保留密钥，重复启动明确失败。World 的严格队列在所属 Vitest worker 中运行，环境变量经该根的 `.env` 生成，受控时钟/日志保持原断言。

`tests/delivery/environment.test.ts` 验证两种启动顺序、同 Cookie jar 的合成会话、普通生成文件和缓存、并发改名、reset、退出、重启、空 jar、端口冲突和取消后重试。普通环境的合成 Cookie 由产品凭据函数生成，时间固定到需要续期，HTTP 返回续期要求，避免调用真实网易云。mock HTTP 合同保留在 mock-server 回归。结果在 本次运行的 `delivery/`；每个 fixture 结束留下 `.reports/environments/*.json`，含实际地址、根、PID、退出、阶段与日志，不记录密钥或会话。

reset 只操作模拟上游，不删 Cookie、IndexedDB 或下载；新设备另建 jar/context。HTTPS 的临时源码与证书、正常校验和 WSS/HMR 结果在 `.reports/https/<本次专项>/result.json`，人工配置和迁移见 [本地开发](../docs/development.md)。环境网络探针不证明页面渲染、IndexedDB、焦点或新路由；这些由 #100 接手。真账号、Android、系统选择器和真实读屏仍由作者试用。

历史加密 Cookie 的兼容回归保留原始 header，并在 `credentials.test.ts` 显式使用样本中声明的合成测试密钥；这份只用于兼容检查的密钥不作为其他 World 或开发环境的默认值。

每个测试命令都打印独占的 `.reports/runs/run-*/`，测试 JSON、迁移、套件和覆盖率报告保存在该目录。`.reports/latest-all.json`、`latest-delivery.json`、`latest-calibration.json` 只是原子更新的导航，含本次目录与状态；并发命令不会清空对方的结果。HTTPS 同样使用独占报告目录，由 `latest-https.json` 指向结果。旧 `.reports/all` / `coverage` 目录不再写入，不能作为本次证据。

覆盖率同时采集 World 所属 worker 和环境子进程的真实 V8 数据，按各自执行时的源码映射合并。`sourceBeforeMove` 按 `baselines/environment-source-map.json` 纳入原来位于 src 的十份 mock 文件，继续执行原 src 的 47% 行 / 39% 分支阈值；当前 src 单列，产品、App、服务端和 API 路由保持原阈值。源码逐文件完整性门禁保留全部未运行文件。这样可以区分目录迁移和实际断言变化，不拿搬目录制造提升。

默认开发命令按需引导首次系统准备，复用同一 mkcert CA，站点证书进入 30 天窗口自动续签，再用 Vite 原生 HTTPS 启动。HTTPS 专项在临时 CAROOT 实际签发并续签，验证 HTTP/1.1、HTTP/2、错误域名、Cookie、WSS/HMR、Ctrl+C 和中断清理；不执行 mkcert -install 或修改 hosts。普通离线回归使用合成证书和受控签发器，检查缓存、并发、无效证书、取消与重试，以及无交互首次引导，不依赖 mkcert/OpenSSL。旧 Caddy 443 权限诊断用例随代理移除；替代验证是统一 CLI 的非特权默认端口与实际 TLS 启动。

`tests/delivery/dev-terminal.test.ts` 在真实伪终端运行实际 CLI 和 `pnpm dev`，受控 mkcert 替身按上游方式关闭内层 stdin，再从 `/dev/tty` 读取固定测试标记。授权后主动以 42 停止，避免触及系统信任；另验证拒绝、Ctrl+C、SIGTERM、忽略 SIGINT 的后代被强制终止、工作锁与自有进程清理。会话在断言后才关闭，防止挂断终端替实现收尾。Python 只负责 PTY 转发，不计入 V8 覆盖率；本项不代表已经完成本人系统密码和钥匙串授权。

开发基础设施迁入 `scripts/dev.mts` 与 `scripts/dev/` 后仍显式纳入 infrastructure 覆盖率分区；产品与 sourceBeforeMove 的阈值及文件集合保持原口径。

## SDK 合同与场景

`pnpm sdk:report` 从生产 SDK 值导入生成 `.reports/sdk/contract.json`，列 action、辅助函数、浏览器能力、绑定、关键输入、样本与失败缺口。`pnpm test:sdk [--candidate /本地候选包]` 在公开文件副本离线重跑合同、类型、代表行为和真实保存页面跨层操作；维护步骤见 [录制与维护](fixtures/netease/README.md#录制与维护)。日常 CI 检查索引，SDK 专项与完整验收保存合同报告。

默认 `small` 为从现有脱敏样本组合的构造曲库：我喜欢的音乐、自建 poems、4 首可播放歌单，共 6 首歌；统一关联测试专辑 3149073、测试歌手 33927412。歌单形状来自 sync/before，歌曲来自 liked-page 与 album-artist；专辑/歌手形状来自 album-artist 的 008/004/012，关系与数量为构造，媒体由 assets.ts 可再生。歌词复用 playback/lyric_new.all-forms.json，不代表这些歌的真实歌词。运行时写入归当前实例，reset 还原种子。`large`、`after`、`deleted` 保留 4,984 首及历史差异，用于规模、分页，不承诺所有收藏导航完整。

具名诊断用现有 `/api/mock/scenario` 选择 `POST /api/mock/scenario` 的 JSON `{ "name": "场景" }` 选择：`qr-confirm` 为 801→802→803，`qr-expired` 为 801→800（原始登录样本）；`empty-search` 合法空态、`tracks-512` 明确 initial 拒绝后 fallback（构造）；`missing-relation` 故意移除测试专辑关系。原 login-expired、rate-limited、partial-sync、slow、offline、空/删歌单继续保留。reset 回默认，只重置上游，不删除听众设备存储。

`mock-library.test.ts` 遍历所有声明的收藏和歌单、读媒体/歌词、改名读回、reset 及规模。`sdk-contract.test.ts` 用错误 body、缺失败元数据、错歌单 ID、遗漏和乱序证明门禁；严格队列收尾保留被产品吞掉的意外调用。模板回退的来源见 coverage.templates，World 不回退。扫码 Cookie、空搜索与 512、失败恢复由合同和 HTTP 回归负责；真实控件/焦点由本页的 browser/a11y 套件负责。

## 真实页面与无障碍

先 `pnpm test:browser:install`（Linux `pnpm exec playwright install --with-deps chromium`）。`pnpm test` 顺序运行全部 Vitest、journeys 和 accessibility 文件；`pnpm test:browser <文件> --grep <名称> --project=desktop|phone --headed` 单独重跑。无参数的 `pnpm test:a11y` 跑全部 accessibility 文件，核对每个文件在桌面、手机实际执行且未跳过，并核验全部对比度组和必测状态；完整通过才输出 passed。单文件、grep、project 或其他自定义参数执行仍输出 partial，不代表完整专项。journeys 在菜单、弹窗、失败状态也扫描相同 page。`pnpm smoke:mock` 复用保存用例，`pnpm test:browser:faults` 依次检出保存、名称、焦点归还、播放页和手机队列的焦点循环故障再恢复。来源与目录在 tests/suites.ts；Vitest 只运行 .test.ts，Playwright 运行 .spec.ts，缺失套件/空选择失败。

浏览器报告在 `.reports/browser/run-*`，含 JSON/HTML、每例 trace/截图、环境与网络附件、逐状态完整 axe JSON；故障报告在 `.reports/browser-faults/`。截图和逐帧诊断见 docs/agents/browser.md 与 tests/tools/browser/sweep.ts。零 violations 门禁不自动放宽；incomplete 的人工判断及历史首扫见 docs/acceptance/issue-100.md。

搜索历史与建议的弹层关联、键盘选择/离开在 `accessibility/search.spec.ts`；从页首到歌曲与播放器的真实 Tab 路径、编辑弹窗和播放页/手机队列的具体顺序及双向边界在 `journeys/keyboard.spec.ts`。`accessibility/low-vision.spec.ts` 固定验证 320 CSS px、规范文字间距、200% 文字模拟与强制颜色下的关键操作；200% 模拟放大文字和行高，不冒充系统浏览器缩放。范围、独立复核的 axe incomplete 和作者读屏清单见 [无障碍修复验收](../docs/acceptance/issue-104.md)。

fixture 使用真实 App/HTTP 和 #99 小曲库，每例新上游、独立根、空 context、高位端口；数据准备不替代目标按钮。执行期阻止非自有 origin；服务端 mock 不回退真实网易云。reset 只还原上游；另建 context 才是新设备。删除临时根、PID 与端口关闭有附件。真实账号、Android、系统选择器和 TalkBack 仍由作者验收；生产 PWA 断网重开由交付层验证。

Linux CI 先安装配套浏览器和系统库，再用 `sh tests/tools/offline.sh pnpm test --coverage` 在无外网路由的临时网络命名空间运行（需要该 CI 的 sudo/unshare/ip/runuser）。普通 macOS 本地命令仍是同一 runner/fixture，并在 Chromium 请求层拒绝非自有 origin；没有声称在 macOS 修改或切断作者网络。

## 候选产物、生产 PWA 与发布

日常门禁和完整验收分别使用 `.github/workflows/ci.yml` 与 `.github/workflows/acceptance.yml`。本地查看某个基准到 HEAD 的计划可运行 `node tests/tools/daily-plan.mts <完整基准SHA>`。每个分片用 `pnpm exec tsx tests/tools/daily-run.mts '<计划中该项的 JSON>'` 重放。

| 时机           | 执行内容                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 每次推送或 PR  | static 做 lint、格式、类型、端点、录制索引和同 SHA 的 Vercel 候选构建／扫描。所有 unit、behavior、contract 文件按历史用时分给五个独立 runner。桌面真实保存、键盘操作和手机播放器在另外两台 runner 上验证。 |
| 改动影响专项   | UI 变更补对应旅程及页面扫描，组件样式和公共令牌补双视口对比度并汇总规定状态。SDK／录制、开发环境、离线和构建改动分别补候选 SDK、环境与双 HTTPS、生产 PWA 及双目标产物。改动 CI 或工具链时全部专项执行。    |
| 开发和工具验收 | 用 `pnpm test:browser:faults` 验证故意破坏控件能被检出。改诊断工具时执行逐帧、截图、重试与清理专项。改覆盖率采集时执行完整 Vitest／SSR 覆盖率及校准。                                                      |
| 完整验收与发布 | Full acceptance 执行全量 Vitest、桌面和手机旅程、axe、覆盖率、双 HTTPS、SDK、Node／Vercel 和两版本生产 PWA。Docker 在标签和手动发布时调用这份工作流，按返回的 artifact ID 下载并核对 SHA-256 后准备镜像。  |

推送时先找本分支最近成功且仍是祖先的 CI 提交。新任务分支还没有这样的记录时，再查集成分支 `rewrite/v1` 的成功祖先。PR 比较目标基准和受测合并提交。查不到可靠基准时会执行全部专项。`ci` 汇总本次计划的报告，拒绝缺失、重复、失败或错误 SHA。浏览器和 Vitest 分片核对枚举与实际执行的用例。失败的日志与 trace 在对应 job 的附件里。

Full acceptance 支持手动、每日定时及显式推送 `acceptance/**` 的分支。GitHub 从默认分支读取定时配置；工作流只存在于开发分支时，可推送同一 SHA 到验收分支来验证。

```sh
pnpm delivery:verify --sha "$(git rev-parse HEAD)"
pnpm build:delivery --sha <完整SHA> --adapter node --out /尚不存在的目录
pnpm test:delivery --sha <完整SHA> --adapter node --candidate /本次候选
pnpm test:pwa --sha <完整SHA> --candidate /本次node --next /本次next
pnpm release:check --sha <完整SHA>
pnpm sdk:latest
```

`check:mock-isolation` 保留为 test:delivery 同参数的薄兼容入口，不再猜默认目录。候选必须非空、目标/SHA 正确且文件摘要一致；Vercel 的 v3 路由、函数 handler、静态资源与 Node 实际入口/HTTP 各自核验。内部相对软链可保留，越界链接失败；普通/gzip/Brotli 的 mock、录制、工具与合成媒体均阻断。tar.gz 留住软链，发布重新下载同 run 的包复核。Docker 使用核验后的 Node 输出，发布后不重新构建另一份。

生产 PWA 显式允许 SW，两个视口都测安装/控制、真正离线关闭重开、缓存账号/下载及 Blob 音频、联网恢复、两旧页等待和关完后的激活。产品 Node 在自有回环服务运行；测试代理只在产品进程外拒绝会连接真实网易云的 API，实际匿名 account API 仍经过生产入口。请求拒绝证据与 setOffline 的真实离线分别记录，不把 503 当断网。`.reports/pwa/run-*/` 包含 JSON/HTML、trace、截图、缓存键和进程清理；候选及构建报告在 `.reports/candidates/`，HTTP 检查在 `.reports/delivery/`。测试规则、敏感性和人工边界见 [#101 验收](../docs/acceptance/issue-101.md)。

Vercel production 继续等待日常工作流的 `ci`。完整验收的本地入口是 `pnpm test:ci verify|https|sdk|delivery`。独立完整验收成功后，可用 `pnpm release:check --sha <完整SHA>` 对该运行做只读复核。

## 对比度专项

`pnpm test:a11y` 包含 contrast 四个文件，也可用 `pnpm test:browser tests/browser/accessibility/contrast-lyrics.spec.ts` 单独复跑。页面使用真实背景像素、CSS 指定字色及黑白字形探针测量，排除字体抗锯齿但保留遮罩/透明度，文字统一至少4.5:1。校准覆盖已知色对、同色、半透明、图像/渐变、父层透明度与mask叠加、细数字及完全隐藏；裸对照保留不透明mask，维持相同字形绘制条件。歌词仅在采图期间暂停受控时钟，避免三秒恢复跟随跨过一组对照；通用测量仍拒绝持续移动的文字并检查清理。

完整 `pnpm test` 的页面阶段另外生成本次 `contrast-summary.json`，把原329条观测和13条历史额外项映射至26个原组件组，并补音译，共27组；缺组、缺登记状态、不可测或不达标均失败。单文件只写partial/not-run，不冒充全专项。原始axe仍保留incomplete；a11y-manual.json的contrastGroup指向已测回归，不再表示要作者手工处理342条记录。方法、红绿和组表见 docs/acceptance/issue-103.md。
