# 测试

`delivery.md` 第 2 步的细则：确定回归范围、写测试、补录制数据、加浏览器能力的替身时读。

## 先查齐影响范围，再开发

测试必须符合 `CODING_STANDARDS.md` 和下面的接入点、录制、替身规矩，并完整覆盖本次需求及改动涉及的行为。按以下顺序执行：

1. 从票的验收标准和实际调用链列出要验证的行为：适用的正常结果、输入边界、失败、重试、取消、异步先后、账号切换，以及远端副作用和本机保存结果。
2. 用 `rg` 查齐受影响的定义和调用方，包括 App、服务端路由、SDK 适配、测试与 mock、脚本。改 HTTP 请求头、Cookie、token 或失败合同时，既查统一 API 客户端，也查绕过它直接 `fetch` 的消费者；例如 `tests/mock-server.test.ts` 必须独立同步请求合同并回归。
3. 在开工清单里把每条需求、受影响行为、调用方和对应测试文件逐项对上。复用下面约定的接入点和已有场景；有缺口就补测试。自动化证明不了的浏览器或真实上游行为，明确列进作者试用清单。
4. 实现过程中随合同和行为变更同步更新测试、录制及替身；修 bug 先在正确接入点复现失败，再修到通过。测试断言可观察的结果，替身按真实依赖的行为和失败路径工作。
5. 推送前运行清单中的全部受影响测试，逐项检查实际断言是否覆盖需求和行为分支。reviewer 同时核对覆盖清单、改动和测试结果；补齐遗漏的调用方或分支并重跑回归后，再复核通过。

完成标准：每条需求和受影响行为都有测试证据或明确的作者试用项，适用的自动化回归全部通过。通过的测试数量不能代替这份逐项核对；推送后的完整 CI 按 `delivery.md` 跟进到最终提交全部通过。

## 七个接入点

业务测试写在主要接入点“去掉界面的整个 App”上（`tests/harness/world.ts`，用法看 `World`、`Device`、`Tab` 的注释）。纯逻辑另有六个接入点（第二到第七个，和主要接入点合起来共七个）：

- 第二个是“拖动手势核心”，包括抽屉 `src/lib/components/player/drawer-core.ts`（`tests/drawer-core.test.ts`）、手机播放页封面转盘 `src/lib/components/player/wheel-core.ts`（`tests/wheel-core.test.ts`）、拖动排序 `src/lib/components/shared/drag-sort.ts`（`tests/drag-sort.test.ts`）、进度条 / 滚动条的线性核心 `src/lib/components/shared/slider-core.ts`（`tests/slider-core.test.ts`）、鼠标拖着横向滚 `src/lib/components/shared/drag-scroll-core.ts`（`tests/drag-scroll-core.test.ts`）和封面取景框 `src/lib/components/playlist/cover-crop-core.ts`（`tests/cover-crop-core.test.ts`）。这里测的是手势规则本身：按下协议（鼠标 5px、触屏立即、只认主指针的主键；滚动条的触屏快速定位上下挪过 6px 才接手，是 `shared/press.ts` 的 `touchClaim`，测在 `tests/slider-core.test.ts`）、什么时候算松手（只认真正的松开；Mac 上快速松手时先来一次主键已经松开的移动，照常跟手）、作废（右键、切走窗口、页面藏起来、pointercancel、打断后再按）、目标空位和预览顺序、放下提交 / 作废撤回、Alt + ↑ / ↓、边缘滚动量、松手速度和松手后的滑行，以及取景框的平移夹紧、按焦点缩放、双指和裁剪 ↔ 视图互转。**不**在这里测 DOM 测量、元素重建、指针捕获（浏览器自己收回捕获算松手，在 `shared/press.ts` 的 attachGrip）、触屏快速定位的接线（层叠判断、拦页面滚动、手指下的元素被拿掉，在 `shared/press.ts` 的 attachTouchClaim）、滚动的实际效果、焦点和动效；这些在适配器的接线里（`shared/press.ts` 和各个 `.svelte.ts` / `drag-scroll.ts`），靠作者试用，改了 `shared/press.ts` 走 `delivery.md` 第 3 步的例外，不把纯核心当成浏览器证据。
- 第三个是“浮层栈核心” `src/lib/components/overlay/overlay-stack.ts`（`tests/overlay-stack.test.ts`），用 `tests/harness/overlay-history.ts` 的内存 history 适配器覆盖转交、返回与播放层前进恢复、忙时钉住、焦点、来源失效、会话清理和导航取消/替代/失败，写法见 `docs/agents/overlay.md`「测试」。浏览器的实际焦点和 Kit 历史行为靠作者试用，改了 `overlay-history.svelte.ts` 走 `delivery.md` 第 3 步的例外，不把内存适配器当成浏览器证据。见 Spec #11 Testing Decisions。
- 第四个是“多选规则核心” `src/lib/components/library/selection-core.ts`（`tests/selection-core.test.ts`）：测勾选、Shift 连选、全选可见、搜索时勾选的仍是整张歌单里的歌，以及列表的标识（换了列表就退出）；不测 DOM、焦点、浮层和 App 的写入。
- 第五个是“会话一轮 / 保存的播放队列核心” `src/lib/app/session-round.ts` 和 `src/lib/app/saved-queue.ts`（`tests/session-round.test.ts` 的纯逻辑部分）：用假的 `Api`、`BackgroundLane`、`Player` 和本机数据库，测两个并发 needsLogin 只让 `expired`、`lane.stop`、`current` 各前进一次且两个结果都是 null；别的标签页退出时停播不写最后一首打卡、也不直接发。这里不测 App 状态、界面和真实网易云。
- 第六个是“写歌曲信息核心” `src/lib/app/song-info-core.ts`（`tests/song-info-core.test.ts`，#79 导出）：输入原文件和下载里存着的歌曲信息，输出新文件。用 `music-metadata`（开发依赖）把新文件解回来逐项核对 mp3（ID3v2.3）和 flac（Vorbis 注释、PICTURE 块）里写的每一项、拿不到的不写，核对音频部分一个字节不差、flac 仍能解出时长。样本是生成的几秒静音（`tests/fixtures/audio/`，怎么生成见那里的 README），不能提交真歌。选文件夹、文件名、取消和失败在主要接入点上测（`tests/export.test.ts`）。
- 第七个是“下载面板视图核心” `src/lib/components/downloads/download-panel-core.ts` 和 `speed.ts`（`tests/download-panel-core.test.ts`、`tests/download-speed.test.ts`，#38）：测面板显示哪几行（下载中 > 失败 > 排队、上限 50）、什么时候该出来、这一帧里哪些任务是下完的（取消掉的不算），以及速率采样窗口；不测 DOM、计时器、焦点和动效，这些靠作者试用。

## 场景、录制和替身

- 写新测试前先看 `tests/harness/listener.ts`：从按领域命名的登录、同步停点、本机副本读取和请求过滤场景开始；只有新的听众行为才在测试文件里加准备步骤。
- 网易云的返回只用验证关卡录下、脱敏过的数据（`tests/fixtures/netease/`），用 `world.netease.reply()` 放进去，不连真实账号。
- 缺录制数据时用 `scripts/netease-record.mts`（`pnpm tsx` 跑）录，做法和脱敏规则见 `tests/fixtures/netease/README.md`「录制」。录制用的登录 Cookie 用 `pnpm tsx scripts/take-login.mts` 从专用浏览器窗口（`scripts/axi.sh`）取；录制开始前会确认登录有效，失效时停下来请作者在专用窗口里扫码。
- SDK 替身在 `tests/harness/netease-sdk.ts`，具名调用由 `src/lib/server/mock/sdk-modules.ts` 绑定到原录制队列；`world.ts` 的隔离探针核对全部导出。只有替身自身能从真实 SDK 根入口复用设备编号和失败读取工具，业务调用仍被替换。
- `fixtures.ts` 校验录制返回体，`mock/fixture-format.ts` 为历史返回补 SDK 5 的失败元数据；`mock/query-key.ts` 只在匹配时转换历史参数表示，录制文件和来源保留。
- 缺哪种浏览器能力的替身，就在这张票里加进 `src/lib/app/browser.ts` 和 `tests/harness/browser.ts`。

## 会话重试的回归

只读请求在业务 301 后最多续期一次，写入默认不自动重放。包含写入和后续查询的流程，通过 App 操作验证已经成功的写入只有一次、重读保持原编号、失败不存成本机成功；创建歌单的 301 和连接中断样本明确标为构造场景。带 token 写入也要断言失败后没有隐式重放，听众再次操作时浏览器取得新 token。不要按 HTTP GET/POST 推断读写。
