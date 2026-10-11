# 交付一张票

实现 Spec #11 下的票时，按顺序走完每一步。

1. **开工**：切到 `rewrite/v1` 并 `git pull`。读票，再读父 Spec #11 里和这张票相关的部分。
2. **测试**：用 `/tdd`，测试只写在唯一的测试接入点“去掉界面的整个 App”上（`tests/harness/world.ts`，用法看 `World`、`Device`、`Tab` 的注释）。
   - 网易云的返回只用验证关卡录下、脱敏过的数据（`tests/fixtures/netease/`），用 `world.netease.reply()` 放进去，不连真实账号。
   - SDK 的成败规矩看 `tests/harness/netease-sdk.ts` 和 `fixtures.ts` 的注释；上游 README 还没写，见 nonhana/hana-music-api#43。
   - 缺哪种浏览器能力的替身，就在这张票里加进 `src/lib/app/browser.ts` 和 `tests/harness/browser.ts`。
3. **界面票**：全程开着真浏览器看渲染结果。按 390×844 和 1440×900 截图，对照票里列出的截图基准（在 `prototype/visual` 分支的 `static/prototype/shots/final/`）。
4. **真账号**：遵守 Spec #11「交付方式」里的五条规矩。需要作者在场时（扫码、收短信、用真机、看截图），停下来叫作者。
5. **收尾**：用 `/code-review` 审一遍，提交并推送 `rewrite/v1`。CI 通过、作者的实例部署成功，这一步才算完。
6. **交付**：截图推到 `screenshots` 孤儿分支，在票里留言写清做了什么、怎么验证的。等作者确认后再关票。

## 截图分支

`screenshots` 和代码历史无关，按票号分目录，留言里用固定提交的 raw 链接贴图：

```bash
git worktree add --detach /tmp/campanula-shots origin/screenshots
mkdir -p /tmp/campanula-shots/issue-<票号> && cp <截图> /tmp/campanula-shots/issue-<票号>/
git -C /tmp/campanula-shots add . && git -C /tmp/campanula-shots commit -m "docs: #<票号> 验收截图"
git -C /tmp/campanula-shots push origin HEAD:screenshots
# 贴图：https://raw.githubusercontent.com/nonhana/campanula-music/<提交>/issue-<票号>/<文件>.png
git worktree remove /tmp/campanula-shots
```

这个分支没有 `package.json`，pre-push 钩子会直接放行。推它不会触发 Vercel 部署（2026-10-11 实测）。
