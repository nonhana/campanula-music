# 交付一张票

> **完成 = 远端 `rewrite/v1` 的最终提交 CI 全部通过 + 票里留言。**
> 只停在本地 commit 不算交付：作者的 Vercel 实例由**推送**触发部署，作者在手机上验收的是部署后的版本。
> 实现者必须自己推送，不能把推送留给作者。
>
> 验证分三层：提交时钩子跑 lint-staged（改动文件的 eslint、设计令牌、fixture 身份）；推送时没有钩子；完整的 lint、类型检查、测试、两种构建和生产构建检查交给 CI（`.github/workflows/ci.yml`）。
> Vercel 开了 Deployment Checks，要求 CI 通过：推送后新版本照常构建，等 CI 通过才切到正式域名；CI 失败时线上留着上一个版本。实现者必须主动跟进本次提交的 CI，失败就返工修复，直到最终提交通过；票里要求的部署验收也要核对。

实现 Spec #11 下的票时，按顺序走完每一步。

1. **开工**：切到 `rewrite/v1` 并 `git pull`。先读票（命令见 `issue-tracker.md`「读 issue」）；票里有回滚说明的一并读（见文末「回滚」）。父 Spec #11、`DESIGN.md`、`tests/fixtures/netease/README.md` 这几份大文档，只看票里提到的章节和规则：先用 `grep` 定位，再读那几段。完成标准：在对话里交出开工清单，再写代码：
   - 用到的 Spec 章节、ADR 和规则；
   - 每个画面和规则要读的网易云字段，各自在 `node_modules/hana-music-api/dist/client.generated-*.d.ts` 里有没有声明（ADR-0005）。确实没有声明的：开 SDK 票，标好阻塞，停下来告诉作者；
   - 已有的录制和还缺的录制；
   - 按 `testing.md` 盘点的受影响调用方、行为分支和对应回归测试；
   - 要改的文件。
2. **测试**：用 `/tdd`，按 `docs/agents/testing.md` 先确定完整回归范围，再实现和验证。测试必须符合 `CODING_STANDARDS.md` 与该文档的接入点、录制和替身规矩。每条需求及受影响行为都要有可观察的验证依据；自动化覆盖和作者试用的边界写清楚。票里写明不加新测试的，仍须核对并运行已有的受影响测试。
3. **界面票**：设计从视觉原型的源码读，规则以 `DESIGN.md` 为准，读法见 `campanula-ui-acceptance` skill 第 1 步。效果靠复用已有组件、照 `DESIGN.md` 和现有的交互推出来；验证由作者照试用清单亲手试（Spec #11「交付方式」），实现者默认不开浏览器。
   - 例外是测试替身证明不了的那一层：改了浮层栈的历史适配（`overlay/overlay-history.svelte.ts`）、手势的按下松手（`shared/press.ts`）或 Service Worker，以及读代码弄不清的浏览器行为（例如第三方脚本在本机能不能用）。碰到例外先用一句话问作者要不要查一次；作者说不用，就在试用清单里写清怎么看、出错时是什么样子。
   - 截图、浏览器检查、动效逐帧只在作者点名时做：mock 见 `docs/agents/mock.md`，真账号见 `docs/agents/browser.md`。
4. **真账号**：作者试用就是真账号验证；reviewer 只看 diff，不开浏览器。实现者只在上游行为还没被证明过时（新接的网易云模块、SDK 修复还没在真账号上成功过），先问作者，同意后用一次性脚本查，遵守 Spec #11「交付方式」里的五条规矩，并记录做了什么。需要作者在场时（扫码、收短信、用真机），停下来叫作者。
5. **收尾**：推送前自己跑 `pnpm check`、`pnpm fmt:check` 和盘点出的全部受影响测试文件（`pnpm exec vitest run tests/<文件>`），完整测试和构建交给 CI。用 `/code-review` 审代码和测试覆盖清单，提交并**推送** `rewrite/v1`，主动跟进到最终提交的 CI 全部通过。
   - 提交信息统一用 Conventional Commits 的单行格式 `<type>: <message>`：type 用英文（`feat`、`fix`、`docs`、`refactor`、`test`、`chore` 等），message 用中文、一句话说清改了什么，只写一行，不写 scope、正文和脚注（作者 2026-11-04 定）。例：`feat: 手机音量恒为 100%，桌面音量照旧可调并记住`。
   - 推送后记录当前 HEAD，按这个 SHA 查 CI run；可用 `gh run list --commit <SHA> --workflow CI` 找到运行，再用 `gh run watch <run-id> --exit-status` 跟进。核对 run 的 `headSha` 与最终 HEAD 一致，所有应执行的检查全部成功后才进入交付。没有启动、被取消或必要检查被跳过时，先恢复验证；旧提交的绿灯不能代替当前提交。
   - CI 失败时主动读失败日志、定位原因，按下面的 fixup 流程返工；复现并修复问题，补齐遗漏的回归，重跑适用的本地检查。修复归回造成失败的提交后，跟进改写后提交的新 CI；重复直到通过，不能等作者报错。
   - **fixup 与 force push**：返工前先执行 `git fetch origin rewrite/v1`，核对并整合远端新增提交；确认 `git merge-base --is-ancestor origin/rewrite/v1 HEAD` 成功后，记录本轮准备替换的远端 SHA，再开始修复和改写。对造成失败的提交执行 `git commit --fixup=<提交>`，再用 `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <提交>^` 把修复合回该提交。临时 fixup 提交使用 Git 生成的消息，合并后的最终提交仍遵守上面的单行格式。用 `git push --force-with-lease=refs/heads/rewrite/v1:<已记录的远端SHA> origin HEAD:refs/heads/rewrite/v1` 推送；lease 被拒绝时，从最新远端提交重新整合本轮修复，重做 fixup、autosquash 和验证，保留他人工作后再推，不能仅更新 lease 的 SHA 或改用无条件 `--force`。
6. **交付**：在最终提交的 CI 全部通过后，往票里留言，写清提交 SHA、CI run 链接与结果、做了什么、测试覆盖了哪些情况，以及票里要求的部署验证结果，再写一份试用清单。作者只照这份清单验收：
   - 每一项写去哪、点什么、应该看到什么、出错时是什么样子；会改账号的写怎么撤销（歌单编辑只在临时歌单上，真账号第 1 条规矩）。
   - 测试没覆盖、只能靠试出来的几项排在最前面，标出来；第 3 步的例外交给作者时也写在这里。
   - 眼睛看不到的写怎么看出来：按 Tab 看焦点停在哪、按返回数要按几次、读屏读到什么。
   - mock 里看不到的（录制里没有的页面、真机才有的手势）写明去真账号或真机上看。
   - 测试已经覆盖、不用试的情况另列一行（例如断网、网易云拒绝、操作频繁）。
   - 票里有键盘操作、“减少动态效果”、换宽度会变的布局时，各加一行提醒，试不试由作者定。
   - 留言里的验证结果只写真的跑出来的；没跑成的写“没验证到”。

   作者在部署后的实例上照清单试过、确认后再关票。

**回滚**：作者要回滚一张票的实现时，回滚后在票里留言写 1–3 行：哪里不对、下一轮别怎么做。上一轮在 GitHub 上改过的 Spec、票正文不跟着代码回滚，要手动改回。
