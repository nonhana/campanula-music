# 交付流程

> **完成 = 远端 `rewrite/v1` 最终提交 CI 全部通过 + issue 留言验收清单。**
> 作者的 Vercel 实例由推送触发部署且开启 Deployment Checks（等待 CI 绿灯才切正式域名）；实现者须自行推送并主动跟进 CI 至最终提交通过，不把推送留给作者。

## 1. 开工清单

切到 `rewrite/v1` 并 `git pull`，读取目标 issue（命令见 [issues.md](./issues.md)；若有回滚说明一并读）。动手写代码前，在对话交出开工清单：

- 涉及的 Spec 章节、ADR、业务规则（[rules.md](../product/rules.md)）与设计文档（[docs/design/](../design/)）；
- 新读取的网易云字段在 `node_modules/hana-music-api/dist/client.generated-*.d.ts` 中是否已声明（[ADR-0005](../adr/0005-hana-music-api-co-evolution.md)）；缺失则先开 SDK issue 标阻塞并停下告知作者；
- 已有录制与缺失录制；
- 按 [testing.md](./testing.md) 盘点的受影响调用方、行为分支与对应回归测试；
- 计划改动的文件清单。

## 2. 实现、测试与界面边界

- **测试驱动与覆盖**：按 [testing.md](./testing.md) 与 [code-style.md](./code-style.md) 编写和运行受影响测试，明确自动化验证与作者人工试用的边界。
- **界面改动默认不开浏览器**：优先复用现有组件并严格对照 [docs/design/](../design/) 实现；实现者默认不开浏览器，由作者按试用清单在部署实例上验收。
  - **例外**：改动 `overlay/overlay-history.svelte.ts`、`shared/press.ts`、Service Worker 或读代码无法判定的真实浏览器行为时，先一句话询问作者是否自测，否则写清试用清单项。
  - 截图、动效逐帧与 axe 诊断仅在作者点名时按 [browser.md](./browser.md) 执行。
- **真实网易云账号**：仅留给作者试用，reviewer 只看 diff。仅在上游行为从未验证过时先征得作者同意后用一次性脚本探测；需要扫码、短信或真机时停下请作者配合。

## 3. 提交、推送与 CI 跟进

推送前本地跑 `pnpm check`、`pnpm fmt:check`、`pnpm lint` 及开工清单中全部受影响测试（改动官网时补 `pnpm exec tsc -p website/tsconfig.json --noEmit` 与 `pnpm docs:test`）。

- **提交信息格式**：Conventional Commits 单行格式 `<type>: <中文一句话说明>`（type 用英文 `feat`/`fix`/`docs`/`refactor`/`test`/`chore` 等），**不写 scope、正文和脚注**。
  - 例：`feat: 手机音量恒为 100%，桌面音量照旧可调并记住`
- **跟进 CI**：推送 `rewrite/v1` 后记录当前 `HEAD` SHA，用 `gh run list --commit <SHA> --workflow CI` 找到对应 run 并用 `gh run watch <run-id> --exit-status` 跟进，确认 `headSha` 与最终 `HEAD` 一致且全部计划项通过；旧提交的绿灯不能代替当前提交。
- **CI 失败时的 fixup 与 force push**：
  1. 读失败日志、复现并修复，补齐回归并重跑本地检查。
  2. 先执行 `git fetch origin rewrite/v1`，核对并整合远端新增提交，确认 `git merge-base --is-ancestor origin/rewrite/v1 HEAD` 后记录待替换的远端 SHA。
  3. 对造成失败的提交执行 `git commit --fixup=<提交>`，再执行 `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <提交>^` 合回（保持单行提交格式）。
  4. 用 `git push --force-with-lease=refs/heads/rewrite/v1:<已记录的远端SHA> origin HEAD:refs/heads/rewrite/v1` 推送；若 lease 被拒，基于最新远端重新整合后重做 fixup 与验证，禁止无条件 `--force`。
  5. 重新跟进新提交的 CI 直到全部通过。

## 4. 交付留言与作者试用清单

最终提交 CI 全绿后，在对应 issue 下留言：提交 SHA、CI run 链接与结果、改动摘要、测试覆盖范围、部署验证结果（仅写实际跑出的结果，未跑写“没验证到”），并附**作者试用清单**：

- 每项写明：去哪、怎么操作、期望看到什么、异常表现；会改账号数据的写明撤销方式（歌单写操作只在临时自建歌单进行）。
- 自动化未覆盖、只能靠真机/人工验证的项目排最前（含第 2 步例外项、真账号、Android 系统手势与读屏）。
- 视觉不可见项写明检验动作（如按 Tab 看焦点落点、按返回数次、读屏播报）。
- 自动化已覆盖、无需人工重测的场景另列一行说明。
- 涉及键盘操作、减少动态效果或响应式宽度变化时，各附一行提醒。

## 回滚

若作者要求回滚某张票的实现，回滚后在原 issue 留 1–3 行说明问题与下轮避坑要点；已在 GitHub 上修改过的 Spec 或票正文不会随代码回滚，须人工改回。
