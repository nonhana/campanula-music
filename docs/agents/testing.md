# 测试与回归范围

本文件规定测试分层、回归盘点流程、七个测试接入点以及录制与替身边界；具体目录索引与报告路径见 [tests/README.md](../../tests/README.md)。

## 先盘点影响范围，再动手

1. **列行为矩阵**：从需求/验收标准和调用链列出正常结果、输入边界、失败、重试、取消、异步竞态、账号切换、远端副作用与本机保存结果。
2. **用 `rg` 查齐调用方**：覆盖 App、服务端路由、SDK 适配、测试、mock 与脚本。修改 HTTP 头、Cookie、token 或失败合同时，同步检查绕过 `api-client.ts` 直调 `fetch` 的消费者（如 `tests/delivery/mock-server.test.ts`）。
3. **写进开工清单**：把每条需求、调用方与对应测试文件逐项对应；有缺口先补测（修 bug 先在对应接入点复现失败）；自动化无法证明的边界明确写进作者试用清单。
4. **验证 CI 计划**：需确认日常 CI 是否触发某专项时，运行 `node tests/tools/daily-plan.mts <完整基准SHA>` 复现计划，并用 `pnpm exec tsx tests/tools/daily-run.mts '<单项JSON>'` 本地重放。

## 分层与命令

`tests/suites.ts` 是 Vitest、runner 与 CI 的唯一文件选择源；空选择、文件未归层或遗漏迁移基线用例都会直接失败。

| 证据层           | 目录              | 命令                                                                | 证明什么                                                                                |
| ---------------- | ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 纯规则           | `tests/unit/`     | `pnpm test:unit [文件]`                                             | 手势、多选、浮层栈、会话轮次、歌曲元数据、下载面板核心                                  |
| App 行为         | `tests/behavior/` | `pnpm test:behavior [文件] [-t 名称]`                               | 听众操作经产品客户端、真实本机 HTTP 与独立 Vite SSR 的状态与持久化                      |
| 合同与录制自检   | `tests/contract/` | `pnpm test:contract [文件]`                                         | 客户端 HTTP 合同、录制索引、mock SDK 自检（不算产品行为证据）                           |
| 开发环境与交付   | `tests/delivery/` | `pnpm test:environment` / `pnpm test:environment:https`             | 隔离工作根、双 HTTPS 证书与终端提权、mock HTTP 装配、生产候选与 PWA                     |
| 真实页面与无障碍 | `tests/browser/`  | `pnpm test:browser` / `pnpm test:a11y` / `pnpm test:browser:faults` | 独立 Chromium 真实交互旅程、键盘焦点、低视力/强制颜色、axe 零违规与 27 组对比度         |
| 官网静态站       | `tests/website/`  | `pnpm docs:test` / `pnpm docs:test:dev`                             | 静态产物与 dev 的链接/锚点/开场动效/独立试听 Demo/axe 零违规（不在默认 `pnpm test` 中） |

- 全量离线回归：`pnpm test`（顺序跑 Vitest 全部层 + `journeys/` + `accessibility/`）；覆盖率与 SSR 校准：`pnpm test:coverage`、`pnpm test:coverage:calibrate`。
- 推送前至少跑 `pnpm check`、`pnpm fmt:check`、`pnpm lint` 以及开工清单里的全部受影响测试文件。

## 七个测试接入点

1. **去掉界面的整个 App（主接入点）**：`tests/_kit/world.ts`（`World` / `Device` / `Tab`，共享场景见 `tests/_kit/listener.ts`），走真实本机 HTTP 和独立 Vite SSR，不测 DOM/真实焦点/系统行为。
2. **拖动手势核心**：`player/drawer-core.ts`、`player/wheel-core.ts`、`shared/drag-sort.ts`、`shared/slider-core.ts`、`shared/drag-scroll-core.ts`、`playlist/cover-crop-core.ts`（含 `shared/press.ts` 的 `touchClaim` 规则）。不测 DOM 测量与浏览器指针捕获接线（改 `shared/press.ts` 走 [delivery.md](./delivery.md) 浏览器例外）。
3. **浮层栈核心**：`overlay/overlay-stack.ts` 配内存历史适配器（`tests/_kit/overlay-history.ts`）；改 `overlay-history.svelte.ts` 走浏览器例外。
4. **多选规则核心**：`library/selection-core.ts`（勾选、Shift 连选、筛选下跨全表勾选、换列表退出）。
5. **会话轮次与保存队列核心**：`app/session-round.ts`、`app/saved-queue.ts`（并发 `needsLogin` 去重、他页退出停播不打卡）。
6. **音频元数据写入核心**：`app/song-info-core.ts`（用 `tests/fixtures/audio/` 静音样本校验 MP3 ID3v2.3 与 FLAC Vorbis/PICTURE 读写，字节级核对音频不失真）。
7. **下载面板视图核心**：`downloads/download-panel-core.ts` 与 `speed.ts`（排序截断上限 50、显隐、完成帧与速率采样窗口）。

**自动化与人工边界**：以上七个接入点不证明 DOM、真实焦点、指针捕获、安装包、Android 系统与真实读屏；`tests/browser/` 验证可控浏览器行为但不能替代真实网易云账号、Android 真机手势/系统选择器与 TalkBack，后者由作者按 [delivery.md](./delivery.md) 试用清单验收。

## 录制、严格队列与专项回归

- **World 严格队列**：`world.netease.reply()` 默认必需匹配，`when` 声明关键查询；跨模块有序传 `ordered: true`，合法并发用 `anyOrder()`；条件调用才标 `required: false` 并说明原因。原始录制不含 Cookie，最终登录回复须配新 `MUSIC_U`（缺 Cookie 负例显式设 `expectedMissingLoginCookie`）；服务器异常用具名 exception；会话用例暂停后台同步显式调用 `pauseSync()`。
- **SDK 替身与校验**：World 与 mock 共享 `sdk-input.ts`、`sdk-contract.ts` 与失败转换，区分成功 schema、专用错误 schema 与失败归一化；不从真实网易云静默回退。缺少浏览器能力替身时同步补充产品能力与 `tests/_kit/browser.ts`。
- **会话续期与写入幂等**：只读请求遇业务 301 最多续期一次；写入默认不自动重放，带“写 + 读”的流程（如新建歌单）须验证写入只执行一次、重读沿用原编号、失败不留本地成功；带 token 的写入失败后不隐式重放。不要按 HTTP GET/POST 猜测读写。
- **开发环境与终端回归**：改启动器、Cookie 主机、证书或工作根时跑 `pnpm test:environment`（真 mkcert/HTTP2/WSS 专项跑 `pnpm test:environment:https`）；改交互子进程或首次提权引导时跑 `tests/delivery/dev-terminal.test.ts`（基于 PTY 替身，不触碰系统 CA 或 hosts）。
- **生产 PWA 专项**：`pnpm test:browser` 默认禁用 SW；离线重开、缓存账号/Blob 播放与双旧页延迟激活由 `pnpm delivery:verify --sha <SHA>` 与 `pnpm test:pwa` 在生产 Node 候选上用真实 `setOffline` 验证（不用 503 冒充断网）。
