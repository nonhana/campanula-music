---
name: campanula-ui-acceptance
description: Campanula 界面票的设计参照和作者点名的浏览器检查。Use when 写界面票前读原型源码；作者要求截图、骨架位置、返回恢复、键盘焦点、动效逐帧、操作 trace 或 axe 无障碍扫描。
---

两种用法：

- **写界面票**：只用第 1 步，从原型源码读设计。验收由作者亲手试用（`docs/agents/delivery.md` 第 3、6 步），截图和浏览器检查不是交付步骤。
- **作者点名**（“拍一下 …”“查一下返回位置”“拍这个动效的逐帧”）：只做作者点到的那几项，用第 2–5 步的工具。目标是 **省**：基准图的对照要点存成文字，成批的检查和截图交给子代理，结果落在文件里，主会话只看结论。

## 1. 设计参照：读原型源码

选定的视觉方案是原型 A，源码在作者本机的工作目录 `../campanula-prototype-visual/src/lib/prototype/variants/a/`（拖拽相关在 `../campanula-prototype-dnd/`）。没有这个目录时用 `git show origin/prototype/visual:src/lib/prototype/variants/a/<文件>`。

- 按画面找组件：手机是 `Phone*.svelte`，桌面是 `Desktop*.svelte`，例如歌单页是 `PhonePlaylist` / `DesktopPlaylist`，曲库首页是 `PhoneLibrary` / `DesktopHome`。
- 布局、间距、文案、各种状态都写在源码里；设计规则以 `DESIGN.md` 为准，两边冲突时问作者。
- 要看交互，在原型目录里 `pnpm dev`，地址参数见 `docs/prototype/visual.md`「交付物」。

完成标准：说得出这张票每个画面的布局、文案和加载中/空/出错的样子，每一条都有源码出处。

## 2. 截图基准：先读对照要点

基准图在 `_notes/baselines/final/`（拖拽的在 `dnd/`），文件名和原型分支 `static/prototype/shots/final/` 一样，后缀是 `.jpg`。目录不存在或原型分支更新过，在仓库根目录跑一次：

```sh
sh .agents/skills/campanula-ui-acceptance/scripts/baselines.sh
```

每张基准图的对照要点存在 `_notes/baselines/notes.md`，一张一段，段首是文件名：

- 先读 notes.md 里这张票要的那几段。
- 缺哪张的段落，才 `read` 那张图，看一次，马上写一段补进 notes.md（例如“头部 200px 封面，右边标题、元信息、操作行，搜索框右对齐”）。之后对照靠这段文字，不再读图。
- 重跑过 baselines.sh 的，改过的那几张重看一次、改段落。
- 不读原型分支上的 PNG 原图（2 倍屏，桌面 1800 宽）。

完成标准：这张票要的每张基准图，notes.md 里都有一段。

## 3. 独立浏览器与截图

作者点名检查时，用 `tests/browser/fixture.ts` 的 test/page/environment 写或复用具名用例，`pnpm test:browser <文件> --project=desktop|phone --headed`。fixture 自启本机服务、空 context 和配套 Chromium，收尾销毁，不用作者窗口或账号。真实账号交给作者手动试用；自动化媒体与数据只取自本机受控服务。

截图和动效使用 `tests/tools/browser/sweep.ts`，示例为 `tests/browser/journeys/diagnostics.spec.ts`，细节见 `docs/agents/browser.md`。原 Python sweep 的浏览器记录/冻结/时钟已迁入 tests/tools/browser，运行和报告由 Playwright Test 统一负责。

| 点名项            | 接入点                                       | 完成标准                                          |
| ----------------- | -------------------------------------------- | ------------------------------------------------- |
| 静态画面/骨架位移 | install → shoot，desktop/phone               | 截图对照第 2 步；逐项检查 moves/errors            |
| 返回恢复          | roundtrip，真实链接/返回                     | 页面与滚动回原处；复杂架子另断言 shelf.scrollLeft |
| 键盘/焦点         | keys，真实 keyboard                          | 每步名称/角色/焦点/可见环符合预期                 |
| 768/1024 布局     | setViewportSize → shoot                      | 无页面横向溢出                                    |
| CSS/WA 动效逐帧   | motion                                       | 指定时刻截图、动画属性和时长对 DESIGN             |
| JS 抽屉逐帧       | tween                                        | 从头触发每帧；finally 恢复时钟                    |
| 慢放/连续触发     | slow                                         | 连续操作的中间帧与最后状态                        |
| 隐藏后恢复        | hidden                                       | visibilityState 模拟边界标明；不冒充系统后台      |
| 限速/空/错误/重放 | 具名 mock scenario、page.route、intercept.js | 响应来源、等待与恢复结果可查                      |
| 无障碍            | 同 page scan fixture                         | 全页 WCAG A/AA + best-practice，保留 incomplete   |

原截图批处理仍可交给子代理，但每个使用自己的 fixture，不共享 page/profile。先换视口和 reducedMotion，再准备播放等状态。所有等待有上限。静态截图用 reduce；普通动效用 no-preference。逐帧不证明掉帧，性能 trace 用候选生产构建。

完成标准：作者点到的每项都有实际操作和报告，截图逐张对照设计要点，问题定位到画面与状态；不能只以数量通过。截图、trace、axe 和布局报告在本次 `.reports/browser/run-*/results/`，对话给出明确运行路径与文件名。

## 4. 交给作者

留出真实账号、Android 系统返回、系统选择器和 TalkBack 的人工项，写去哪、操作、期望、失败表现和撤销。截图/trace 的自动化结果只陈述实际验证内容。工具不会访问作者浏览器或持久 profile。
