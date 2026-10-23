# 交付一张票

> **完成 = 远端 `rewrite/v1` 有提交 + CI 通过 + Vercel 部署成功 + 票里留言。**
> 只停在本地 commit 不算交付：作者的 Vercel 实例由**推送**触发部署，作者在手机上验收的是部署后的版本。
> 实现者必须自己推送，不能把推送留给作者。

实现 Spec #11 下的票时，按顺序走完每一步。

1. **开工**：切到 `rewrite/v1` 并 `git pull`。读票；父 Spec #11、`DESIGN.md`、`tests/fixtures/netease/README.md` 这几份大文档只读票里提到的章节和规则，先 `grep` 找到再读那几段。完成标准：在对话里交出开工清单，再写代码：
   - 用到的 Spec 章节、ADR 和规则；
   - 每个画面和规则要读的网易云字段，各自在 `node_modules/hana-music-api/dist/client.generated-*.d.ts` 里有没有声明（ADR-0005）。有没声明的：开 SDK 票，标好阻塞，停下来告诉作者；
   - 已有的录制和还缺的录制；
   - 要改的文件。
2. **测试**：用 `/tdd`，业务测试写在测试接入点“去掉界面的整个 App”上（`tests/harness/world.ts`，用法看 `World`、`Device`、`Tab` 的注释）。纯逻辑另有两个接入点（除主要接入点之外的第二、第三个）：
   - 第二个是“拖动手势核心”，包括抽屉 `src/lib/components/player/drawer-core.ts`（`tests/drawer-core.test.ts`）、手机播放页封面转盘 `src/lib/components/player/wheel-core.ts`（`tests/wheel-core.test.ts`）、拖动排序 `src/lib/components/drag-sort.ts`（`tests/drag-sort.test.ts`）、进度条 / 滚动条的线性核心 `src/lib/components/slider-core.ts`（`tests/slider-core.test.ts`）和封面取景框 `src/lib/components/cover-crop-core.ts`（`tests/cover-crop-core.test.ts`）。这里测的是手势规则本身：按下协议（鼠标 5px、触屏立即、只认主指针的主键）、作废（右键、切走窗口、指针被收回、打断后再按）、目标空位和预览顺序、放下提交 / 作废撤回、Alt + ↑ / ↓、边缘滚动量，以及取景框的平移夹紧、按焦点缩放、双指和裁剪 ↔ 视图互转。**不**在这里测 DOM 测量、元素重建、指针捕获、滚动的实际效果、焦点和动效；这些由适配器的接线交给 mock 自查，不把纯核心当成浏览器证据。
   - 第三个是“浮层栈核心” `src/lib/components/overlay-stack.ts`（`tests/overlay-stack.test.ts`），用 `tests/harness/overlay-history.ts` 的内存 history 适配器覆盖转交、返回与播放层前进恢复、忙时钉住、焦点、来源失效、会话清理和导航取消/替代/失败。浏览器的实际焦点和 Kit 历史行为仍用 mock 自查，不把内存适配器当成浏览器证据。见 Spec #11 Testing Decisions。
   - 写新测试前先看 `tests/harness/listener.ts`：从按领域命名的登录、同步停点、本机副本读取和请求过滤场景开始；只有新的听众行为才在测试文件里加准备步骤。
   - 网易云的返回只用验证关卡录下、脱敏过的数据（`tests/fixtures/netease/`），用 `world.netease.reply()` 放进去，不连真实账号。
   - 缺录制数据时用 `scripts/netease-record.mts`（`pnpm tsx` 跑）录，做法和脱敏规则见 `tests/fixtures/netease/README.md`「录制」。录制用的登录 Cookie 用 `pnpm tsx scripts/take-login.mts` 从专用浏览器窗口（`scripts/axi`）取；录制开始前会确认登录有效，失效时停下来请作者在专用窗口里扫码。
   - SDK 的成败规矩看 `tests/harness/netease-sdk.ts` 和 `fixtures.ts` 的注释；上游 README 还没写，见 nonhana/hana-music-api#43。
   - 缺哪种浏览器能力的替身，就在这张票里加进 `src/lib/app/browser.ts` 和 `tests/harness/browser.ts`。
3. **界面票**：设计从视觉原型的源码读，规则以 `DESIGN.md` 为准，读法见 `campanula-ui-acceptance` skill 第 1 步。实现者的自查走 mock（`pnpm dev:mock`、`scripts/browser`，见 `docs/agents/mock.md`）；验收仍由作者亲手试用（Spec #11「交付方式」），实现者不拍截图、不做成批的浏览器检查。写代码时碰到读代码弄不清的浏览器行为（例如第三方脚本在本机能不能用），先用一句话问作者要不要在专用窗口（`scripts/axi`）里查一次。截图、浏览器检查、动效逐帧只在作者点名时做，用那个 skill 的工具。
4. **真账号**：作者试用就是真账号验证。日常实现和 reviewer 都走 mock（见 `docs/agents/browser.md`），reviewer 不自己启动 Chrome。实现者只在上游行为还没被证明过时（新接的网易云模块、SDK 修复还没在真账号上成功过），先问作者，同意后用一次性脚本查，遵守 Spec #11「交付方式」里的五条规矩，并记录做了什么。需要作者在场时（扫码、收短信、用真机），停下来叫作者。
5. **收尾**：用 `/code-review` 审一遍，提交并**推送** `rewrite/v1`（推送前钩子跑 `pnpm check`、`pnpm test`、`pnpm build`）。只提交不推送，CI 和 Vercel 都不会跑，作者没法在手机上验收。
   - 推送后等 CI 成功：`gh run list --branch rewrite/v1`，确认这次提交的 run 是 `completed / success`。
   - 再看这次提交的 Vercel 状态：`gh api repos/nonhana/campanula-music/commits/<sha>/status`，`Vercel` 要是 `success`。
   - 两个都成功才算收尾完成；失败就修，不要先去留言说做完了。
6. **交付**：在票里留言，写清推送的提交、CI 和 Vercel 部署状态、做了什么、测试覆盖了哪些情况，再写一份试用清单：
   - 每一项写去哪、点什么、应该看到什么；会改账号的写怎么撤销（歌单编辑只在临时歌单上，真账号第 1 条规矩）。
   - 测试已经覆盖、不用试的情况另列一行（例如断网、网易云拒绝、操作频繁）。
   - 票里有键盘操作、“减少动态效果”、换宽度会变的布局时，各加一行提醒，试不试由作者定。

   作者在部署后的实例上照清单试过、确认后再关票。
