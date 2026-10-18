# 交付一张票

实现 Spec #11 下的票时，按顺序走完每一步。

1. **开工**：切到 `rewrite/v1` 并 `git pull`。读票；父 Spec #11、`DESIGN.md`、`tests/fixtures/netease/README.md` 这几份大文档只读票里提到的章节和规则，先 `grep` 找到再读那几段。完成标准：在对话里交出开工清单，再写代码：
   - 用到的 Spec 章节、ADR 和规则；
   - 每个画面和规则要读的网易云字段，各自在 `node_modules/hana-music-api/dist/client.generated-*.d.ts` 里有没有声明（ADR-0005）。有没声明的：开 SDK 票，标好阻塞，停下来告诉作者；
   - 已有的录制和还缺的录制；
   - 要改的文件。
2. **测试**：用 `/tdd`，测试写在测试接入点“去掉界面的整个 App”上（`tests/harness/world.ts`，用法看 `World`、`Device`、`Tab` 的注释）。拖动手势是唯一的例外，写在第二个接入点“拖动手势核心”上：抽屉的 `src/lib/components/player/drawer-core.ts`（`tests/drawer-core.test.ts`）、手机播放页封面转盘的 `src/lib/components/player/wheel-core.ts`（`tests/wheel-core.test.ts`），见 Spec #11 Testing Decisions。
   - 网易云的返回只用验证关卡录下、脱敏过的数据（`tests/fixtures/netease/`），用 `world.netease.reply()` 放进去，不连真实账号。
   - 缺录制数据时用 `scripts/netease-record.mts`（`pnpm tsx` 跑）录，做法和脱敏规则见 `tests/fixtures/netease/README.md`「录制」。录制用的登录 Cookie 用 `pnpm tsx scripts/take-login.mts` 从专用浏览器窗口（`scripts/axi`）取；录制开始前会确认登录有效，失效时停下来请作者在专用窗口里扫码。
   - SDK 的成败规矩看 `tests/harness/netease-sdk.ts` 和 `fixtures.ts` 的注释；上游 README 还没写，见 nonhana/hana-music-api#43。
   - 缺哪种浏览器能力的替身，就在这张票里加进 `src/lib/app/browser.ts` 和 `tests/harness/browser.ts`。
3. **界面票**：用 `campanula-ui-acceptance` skill：设计从原型源码读，基准图的对照要点存在 `_notes/baselines/notes.md`、缺的才看图；浏览器用专用窗口（`scripts/axi`）。界面做完后按 skill 第 4 步的清单交给子代理做浏览器检查和截图（新画面截图、新骨架不挪位置、能点进去的返回后位置不变、新的键盘操作），完成标准是那张表里的每一条；主会话只看子代理报回来的结论。动效逐帧和“减少动态效果”那几组等作者要时再拍。
4. **真账号**：遵守 Spec #11「交付方式」里的五条规矩。需要作者在场时（扫码、收短信、用真机、看截图），停下来叫作者。
5. **收尾**：用 `/code-review` 审一遍，提交并推送 `rewrite/v1`（推送前钩子跑 `pnpm check`、`pnpm test`、`pnpm build`）。CI 通过、作者的实例部署成功，这一步才算完。
6. **交付**：截图在 `_notes/screenshots/issue-<票号>/`（作者本机，不进 git）。在票里留言写清做了什么、怎么验证的，列出截图的文件名和每张拍的是什么。等作者确认后再关票。
