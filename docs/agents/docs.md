# 文档维护规范

新增、拆分、迁移或修改 `docs/`、`website/` 或根目录文档前读本文件，用于防止文档体系腐化与踩进官网测试门禁。

## 目录与受众归属

| 位置                        | 面向与职责                                                | 硬边界                                                                                                    |
| --------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 根目录                      | 仅保留 `README.md`、`AGENTS.md`、`CLAUDE.md -> AGENTS.md` | 不新增其他根 `.md`；`AGENTS.md` 严守 ≤ 40 行纯面包屑（一句话简介 + 触发式路由，不写正文、命令或代码地图） |
| `docs/agents/`              | Agent 任务契约，按任务触发按需读取                        | 只写代码与 `package.json` 推不出来的边界与流程；单职责、可独立阅读                                        |
| `docs/product/`             | 产品范围、领域术语表、核心规则①–⑫与运行时不变量           | 只保留当前生效的产品事实                                                                                  |
| `docs/design/`              | 设计系统活规范（视觉基础、布局、动效、文案、组件、播放）  | 精确色值、字号与动效数值源头在 `uno.palette.mts`、`uno.config.mts`、`motion-tokens.ts`，文档不重复抄表    |
| `docs/adr/`                 | 不可变架构决策记录（`NNNN-<slug>.md`），记录“为何这样选”  | 新决策递增编号；被取代的旧 ADR 在头部标 `status: superseded by ADR-XXXX`                                  |
| `website/src/content/docs/` | 面向听众、站长与开源读者的公开文档站                      | 简洁凝练、快速定位；不暴露内部测试基建、issue 编号或 Agent 流程                                           |
| `tests/README.md`           | `tests/` 目录索引、常用命令与报告路径                     | 不与 `docs/agents/testing.md` 重复写规范                                                                  |

**禁止入库进 `docs/`**：一次性验收日志（写入 GitHub issue 留言）、原型过程记录、测试跑批产物（归 `.reports/`）、个人笔记与本机截图（归 `_notes/`）。

## 活文档反腐化纪律

- **就地更新，不写变更日志**：`docs/agents/`、`docs/product/`、`docs/design/` 只描述当前生效的事实；禁止追加日期头、`<!-- 更新日志 -->`、“原来是……后来改成……”或旧方案对比（历史原因归 `docs/adr/` 与 git log）。
- **单归属（SSOT）**：每条规则、命令或约束只在一个文件里定义，其他文件通过相对链接引用，不复制粘贴。
- **按触发拆分**：单篇文档职责发散或过长时按任务/关注点拆分，并同步更新 [AGENTS.md](../../AGENTS.md) 路由。
- **术语对齐**：全仓文档统一采用 [glossary.md](../product/glossary.md) 的术语，不使用其列出的禁用同义词。

## 修改 `website/` 的硬约束

- **链接格式**：站内文章互链写相对 `.md` / `.mdx` 路径（构建期由 `website/content-links.mts` 自动转为干净 URL）；**站外链接与最终 HTML 不得出现 `.md` / `.mdx` 后缀**（`tests/website/artifact.spec.ts` 强制拦截）。
- **无障碍与隔离门禁**：禁止把单个纯符号（如 `⌘`）单独包进反引号 `<code>`（axe 会判 `color-contrast` incomplete 阻断）；非 demo 页面禁止引用 `/demo/`、`.mp3` 或写出 `MUSIC_U=` 等凭据字样；表格列保持紧凑以通过 320px 窄屏无横向溢出检查。
- **新增页面同步清单**：新建文章后同步登记到 `website/src/components/guide/Choices.astro`、`website/src/content/docs/guide/index.md` 与 `tests/website/reading.spec.ts`。

## 改文档后的验收

1. 移动、重命名或删除文档后，全仓 `rg` 排查旧路径并更新全部引用（含 `docs/adr/`、代码报错文案、`.agents/` 与 `tests/`），确认所有相对链接有效。
2. 运行 `pnpm fmt:check`（零行尾空格，符合 `oxfmt`）。
3. 改动 `website/` 时加跑 `pnpm exec tsc -p website/tsconfig.json --noEmit` 与 `pnpm docs:test`（涉及 dev 入口时补跑 `pnpm docs:test:dev`）。
