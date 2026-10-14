# 交付一张票

实现 Spec #11 下的票时，按顺序走完每一步。

1. **开工**：切到 `rewrite/v1` 并 `git pull`。读票；父 Spec #11 只读票里提到的章节和规则，先 `grep` 找到再读。完成标准：在对话里交出开工清单，再写代码：
   - 用到的 Spec 章节、ADR 和规则；
   - 每个画面和规则要读的网易云字段，各自在 `node_modules/hana-music-api/dist/client.generated-*.d.ts` 里有没有声明（ADR-0005）。有没声明的：开 SDK 票，标好阻塞，停下来告诉作者；
   - 已有的录制和还缺的录制；
   - 要改的文件。
2. **测试**：用 `/tdd`，测试只写在唯一的测试接入点“去掉界面的整个 App”上（`tests/harness/world.ts`，用法看 `World`、`Device`、`Tab` 的注释）。
   - 网易云的返回只用验证关卡录下、脱敏过的数据（`tests/fixtures/netease/`），用 `world.netease.reply()` 放进去，不连真实账号。
   - 缺录制数据时用 `scripts/netease-record.mts`（`pnpm tsx` 跑）录，做法和脱敏规则见 `tests/fixtures/netease/README.md`「录制」。
   - SDK 的成败规矩看 `tests/harness/netease-sdk.ts` 和 `fixtures.ts` 的注释；上游 README 还没写，见 nonhana/hana-music-api#43。
   - 缺哪种浏览器能力的替身，就在这张票里加进 `src/lib/app/browser.ts` 和 `tests/harness/browser.ts`。
3. **界面票**：用 `campanula-ui-acceptance` skill：设计从原型源码读，截图基准每张看一次，验收截图交给子代理成批拍。全程开着真浏览器看渲染结果。
4. **真账号**：遵守 Spec #11「交付方式」里的五条规矩。需要作者在场时（扫码、收短信、用真机、看截图），停下来叫作者。
5. **收尾**：用 `/code-review` 审一遍，提交并推送 `rewrite/v1`。CI 通过、作者的实例部署成功，这一步才算完。
6. **交付**：截图在 `_notes/screenshots/issue-<票号>/`（作者本机，不进 git）。在票里留言写清做了什么、怎么验证的，列出截图的文件名和每张拍的是什么。等作者确认后再关票。
