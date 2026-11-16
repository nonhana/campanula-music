# 测试

`delivery.md` 第 2 步的细则：确定回归范围、写测试、补录制数据、加浏览器能力的替身时读。

## 先查齐影响范围，再开发

测试必须符合 `CODING_STANDARDS.md` 和下面的接入点、录制、替身规矩，并完整覆盖本次需求及改动涉及的行为。按以下顺序执行：

1. 从票的验收标准和实际调用链列出要验证的行为：适用的正常结果、输入边界、失败、重试、取消、异步先后、账号切换，以及远端副作用和本机保存结果。
2. 用 `rg` 查齐受影响的定义和调用方，包括 App、服务端路由、SDK 适配、测试与 mock、脚本。改 HTTP 请求头、Cookie、token 或失败合同时，既查统一 API 客户端，也查绕过它直接 `fetch` 的消费者；例如 `tests/delivery/mock-server.test.ts` 必须独立同步请求合同并回归。
3. 在开工清单里把每条需求、受影响行为、调用方和对应测试文件逐项对上。复用下面约定的接入点和已有场景；有缺口就补测试。自动化证明不了的浏览器或真实上游行为，明确列进作者试用清单。
4. 实现过程中随合同和行为变更同步更新测试、录制及替身；修 bug 先在正确接入点复现失败，再修到通过。测试断言可观察的结果，替身按真实依赖的行为和失败路径工作。
5. 推送前运行清单中的全部受影响测试，逐项检查实际断言是否覆盖需求和行为分支。reviewer 同时核对覆盖清单、改动和测试结果；补齐遗漏的调用方或分支并重跑回归后，再复核通过。

开发时先跑能重现改动的测试。例如改 App 搜索，先跑 `pnpm test:behavior tests/behavior/search.test.ts`。推送后，五台 runner 分摊全部规则、App 行为和契约测试，其他 runner 同时检查静态规则、Vercel 构建和桌面、手机上的关键操作。改播放器界面还会跑相关页面操作和双视口对比度，改 Service Worker 则会构建生产候选，验证断网重开和版本切换。

需要确认某个专项会不会跑时，打开本次 CI 的 `plan`，看它选的比较基准和任务。在本地切到同一提交，运行 `node tests/tools/daily-plan.mts <完整基准SHA>` 可以重现这份计划。每条改动都要有对应的测试证据或明确的作者试用项，推送后按 `delivery.md` 跟进最终提交。

## 套件、报告与浏览器边界

入口、目录归属、单文件重跑和覆盖率口径以 [tests/README.md](../../tests/README.md) 为准。`tests/suites.ts` 同时供 runner、Vitest 和 CI 选择用例；默认回归逐项核对开工基线。纯核心归 `unit`，World/App 归 `behavior`，消费者合同及既有录制 / mock 自检归 `contract`，现有 mock HTTP 装配自检归 `delivery`。按所证明的行为归类，不能用 mock 自检数量充当产品行为证据。

Spec #96 增加受控浏览器旅程和 a11y 层，使用自行启动的 Chromium 与同一个 page 上的 axe；入口为 `pnpm test:browser`、`pnpm test:a11y`；真实输入/导航/焦点/可访问状态在 tests/browser，报告与重跑见 tests/README。下面七个接入点继续承担规则和 App 行为断言，不能证明 DOM、真实焦点、指针捕获、安装包、Android 系统和真实读屏。真实账号与设备仍由作者按 `delivery.md` 第 6 步试用；实现者默认不开作者浏览器。

## 七个接入点

业务测试写在主要接入点“去掉界面的整个 App”上（`tests/_kit/world.ts`，用法看 `World`、`Device`、`Tab` 的注释）。纯逻辑另有六个接入点（第二到第七个，和主要接入点合起来共七个）：

- 第二个是“拖动手势核心”，包括抽屉 `src/lib/components/player/drawer-core.ts`（`tests/unit/drawer-core.test.ts`）、手机播放页封面转盘 `src/lib/components/player/wheel-core.ts`（`tests/unit/wheel-core.test.ts`）、拖动排序 `src/lib/components/shared/drag-sort.ts`（`tests/unit/drag-sort.test.ts`）、进度条 / 滚动条的线性核心 `src/lib/components/shared/slider-core.ts`（`tests/unit/slider-core.test.ts`）、鼠标拖着横向滚 `src/lib/components/shared/drag-scroll-core.ts`（`tests/unit/drag-scroll-core.test.ts`）和封面取景框 `src/lib/components/playlist/cover-crop-core.ts`（`tests/unit/cover-crop-core.test.ts`）。这里测的是手势规则本身：按下协议（鼠标 5px、触屏立即、只认主指针的主键；滚动条的触屏快速定位上下挪过 6px 才接手，是 `shared/press.ts` 的 `touchClaim`，测在 `tests/unit/slider-core.test.ts`）、什么时候算松手（只认真正的松开；Mac 上快速松手时先来一次主键已经松开的移动，照常跟手）、作废（右键、切走窗口、页面藏起来、pointercancel、打断后再按）、目标空位和预览顺序、放下提交 / 作废撤回、Alt + ↑ / ↓、边缘滚动量、松手速度和松手后的滑行，以及取景框的平移夹紧、按焦点缩放、双指和裁剪 ↔ 视图互转。**不**在这里测 DOM 测量、元素重建、指针捕获（浏览器自己收回捕获算松手，在 `shared/press.ts` 的 attachGrip）、触屏快速定位的接线（层叠判断、拦页面滚动、手指下的元素被拿掉，在 `shared/press.ts` 的 attachTouchClaim）、滚动的实际效果、焦点和动效；这些在适配器的接线里（`shared/press.ts` 和各个 `.svelte.ts` / `drag-scroll.ts`），靠作者试用，改了 `shared/press.ts` 走 `delivery.md` 第 3 步的例外，不把纯核心当成浏览器证据。
- 第三个是“浮层栈核心” `src/lib/components/overlay/overlay-stack.ts`（`tests/unit/overlay-stack.test.ts`），用 `tests/_kit/overlay-history.ts` 的内存 history 适配器覆盖转交、返回与播放层前进恢复、忙时钉住、焦点、来源失效、会话清理和导航取消/替代/失败，写法见 `docs/agents/overlay.md`「测试」。浏览器的实际焦点和 Kit 历史行为靠作者试用，改了 `overlay-history.svelte.ts` 走 `delivery.md` 第 3 步的例外，不把内存适配器当成浏览器证据。见 Spec #11 Testing Decisions。
- 第四个是“多选规则核心” `src/lib/components/library/selection-core.ts`（`tests/unit/selection-core.test.ts`）：测勾选、Shift 连选、全选可见、搜索时勾选的仍是整张歌单里的歌，以及列表的标识（换了列表就退出）；不测 DOM、焦点、浮层和 App 的写入。
- 第五个是“会话一轮 / 保存的播放队列核心” `src/lib/app/session-round.ts` 和 `src/lib/app/saved-queue.ts`（`tests/unit/session-round.test.ts`）：用假的 `Api`、`BackgroundLane`、`Player` 和本机数据库，测两个并发 needsLogin 只让 `expired`、`lane.stop`、`current` 各前进一次且两个结果都是 null；别的标签页退出时停播不写最后一首打卡、也不直接发。这里不测 App 状态、界面和真实网易云。
- 第六个是“写歌曲信息核心” `src/lib/app/song-info-core.ts`（`tests/unit/song-info-core.test.ts`，#79 导出）：输入原文件和下载里存着的歌曲信息，输出新文件。用 `music-metadata`（开发依赖）把新文件解回来逐项核对 mp3（ID3v2.3）和 flac（Vorbis 注释、PICTURE 块）里写的每一项、拿不到的不写，核对音频部分一个字节不差、flac 仍能解出时长。样本是生成的几秒静音（`tests/fixtures/audio/`，怎么生成见那里的 README），不能提交真歌。选文件夹、文件名、取消和失败在主要接入点上测（`tests/behavior/export.test.ts`）。
- 第七个是“下载面板视图核心” `src/lib/components/downloads/download-panel-core.ts` 和 `speed.ts`（`tests/unit/download-panel-core.test.ts`、`tests/unit/download-speed.test.ts`，#38）：测面板显示哪几行（下载中 > 失败 > 排队、上限 50）、什么时候该出来、这一帧里哪些任务是下完的（取消掉的不算），以及速率采样窗口；不测 DOM、计时器、焦点和动效，这些靠作者试用。

## 场景、录制和替身

- 写新测试前先看 `tests/_kit/listener.ts`：从按领域命名的登录、同步停点、本机副本读取和请求过滤场景开始；只有新的听众行为才在测试文件里加准备步骤。
- 网易云的返回只用验证关卡录下、脱敏过的数据（`tests/fixtures/netease/`），用 `world.netease.reply()` 放进去，不连真实账号。
- 录制、脱敏、身份检查、索引与 SDK 维护入口归 `tests/tools/`，具体操作见 `tests/fixtures/netease/README.md`「录制与维护」。采集须显式指定实例、短期授权；常规回放不读本机私有文件。
- World 的 `reply` 默认是必需调用，`when` 声明关键查询；需要跨模块顺序时传 `ordered: true`，合法并发用 `anyOrder()`。取消后本来不应调用的步骤不预装必需回复。仅条件性准备可用 `required: false` 并说明原因；原始录制不保存 Cookie，最终登录回复必须配新 MUSIC_U，专测缺 Cookie 的负例用 `expectedMissingLoginCookie` 声明并先确认合同确实失败；通用服务器异常用具名 exception 声明，不能靠未准备调用制造；会话用例要暂停后台同步时显式调用 `pauseSync()`，它只为合成账号的 likelist 提供具名失败，其他意外调用仍在收尾失败。
- SDK 两种替身共享 `sdk-input.ts`、`sdk-contract.ts`、历史查询和失败转换。原始录制与运行时最终响应分开校验；索引的 validation 区分成功 schema、专用错误 schema、历史失败归一化与浏览器直传。失败归一化不代表失败 body 通过成功 schema。 成功 schema 证据可按实际 schema 与完整内容摘要有界复用；普通数据首次校验使用独立快照，body 改动后按新内容匹配证据，未命中时重新调用 schema，status、实体、Cookie 和失败元数据仍逐次检查。特殊对象不走内容缓存，不能仅凭对象身份或 JSON 文本相同复用证据。
- World 在同一 SSR runner 加载录制与严格队列，让实际 schema 共用完整内容证据；录制 body 先复制为回包使用的表示。listener 只读录制的编号、URL 等场景元数据，实际回包仍由 World 完整校验。种子缓存序列化快照，每个实例解码自己的完整副本，不能共享可变模板或放宽测试时限。
- 默认 `small` 种子是合成关系的小曲库，人工 mock 和后继浏览器共用；`large` 场景保留 before 大种子，after/deleted 保留历史差异。场景来源、命令和规模边界见 `tests/README.md`。新增实体须同时保证声明的导航和写后读回。
- 缺哪种浏览器能力的替身，就在这张票里补产品能力与 `tests/_kit/browser.ts`，交互 mock 从 `tests/_kit/mock` 外部装配。

## 会话重试的回归

只读请求在业务 301 后最多续期一次，写入默认不自动重放。包含写入和后续查询的流程，通过 App 操作验证已经成功的写入只有一次、重读保持原编号、失败不存成本机成功；创建歌单的 301 和连接中断样本明确标为构造场景。带 token 写入也要断言失败后没有隐式重放，听众再次操作时浏览器取得新 token。不要按 HTTP GET/POST 推断读写。

环境生命周期回归用 `pnpm test:environment`，与默认套件复用 delivery 选择；每份临时环境有独占子进程、工作根和密钥，World 与 Vitest 自身也使用独立根，避免重写普通开发的 `$app` 与 env。统一开发入口与证书策略由 `scripts/dev.mts` 提供，测试只复用接口；默认 delivery 另验证证书复用、并发续签、失败和取消。原生 HTTPS、真实 mkcert、HTTP/2 与 WSS 用显式专项 `pnpm test:environment:https`，见测试导航和 ADR-0020。

交互子进程或首次提权引导变化时，运行 `tests/delivery/dev-terminal.test.ts`：用伪终端验证控制终端读取、拒绝、Ctrl+C / SIGTERM 和自有进程清理。它只向受控替身输入固定标记，测试不安装系统 CA 或修改 hosts；依赖与边界见测试导航。

候选交付不使用开发 SW：`delivery:verify --sha <SHA>` 构建独占 Node/Vercel/next，再用真实生产 Node 与独立 Chromium 检查安装/控制、真正离线重开、下载播放、恢复和延迟激活。pwa 归 tests/delivery 专项，默认 browser/a11y 继续明确 block SW。发布负例与全部入口见 tests/README 和 #101 验收文档；用 503 代替网络离线不构成生产 PWA 证据。
