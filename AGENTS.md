# Campanula Music — Agent 指令

## Agent 技能

### Issue 跟踪

本仓库的 issue 和 Spec 都存成 GitHub issue，仓库是 `nonhana/campanula-music`，统一用 `gh` CLI 操作。见 `docs/agents/issue-tracker.md`。新建 Spec 或票之前，先读 `docs/agents/issue-template.md`（步骤和正文模板）。

### 分诊标签

默认使用五种角色标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### 领域文档

单上下文（single-context）：根目录一份 `GLOSSARY.md`，加上 `docs/adr/`。见 `docs/agents/domain.md`。

**决策**：在回复、计划或代码里陈述或依赖某个设计决策之前，先查 `docs/adr/`；每个文件名就写明了它对应的决策。ADR 的效力高于回忆出来的记忆。

### 交付

开发、修复或提交推送前，先读 `docs/agents/delivery.md`：测试范围、分支与提交、推送后的 CI 跟进、失败后的 fixup 和 force push，以及作者试用验收。流程和文档修改同样适用。确定测试范围、编写或修改测试时，读 `docs/agents/testing.md`。

### 代码规范

写代码和审查时对照 `CODING_STANDARDS.md`；能用工具查的规则以 `eslint.config.mts` 为准，排版（行宽、分号、引号、断行）以 `oxfmt.config.mts` 为准——改完跑 `pnpm fmt` 格式化，`pnpm fmt:check` 只检查不改文件（CI 里跑的就是这条）。

### 浏览器验证

- 实现者默认不开浏览器，作者照试用清单亲手试；例外和清单写法见 `docs/agents/delivery.md` 第 3、6 步。reviewer 只看 diff。
- 作者点名做浏览器检查时：mock 用 `pnpm dev:mock`（5174）和 `scripts/browser.sh`，见 `docs/agents/mock.md`；真账号用专用浏览器 `scripts/axi.sh`，打开前先 `scripts/browser.sh check --real`，不是登录态就停下请作者扫码，见 `docs/agents/browser.md`。

## 代码地图

领域目录名优先用 `GLOSSARY.md` 的概念（例如 `library/` 曲库、`playlist/` 歌单、`player/` 播放、`downloads/` 下载）；`ui/`、`svg/`、`shell/`、`shared/` 是实现结构，不要求有术语。不确定某个概念该放在哪时先查 GLOSSARY。

- `src/routes/`：页面；`src/routes/api/**/+server.ts` 是服务端接口（ADR-0013）。
- `src/lib/app/`：去掉界面的整个 App（测试接入点）；`api-client.ts` 是浏览器发请求的那一层，契约在 `src/lib/api/`。
- `src/lib/api/`：服务端接口的契约与端点目录；`src/lib/server/`：服务端适配层与 mock；`netease/` 按登录、曲库、歌单、播放、搜索调用 SDK，`credentials.ts` 复用 SDK 生成设备编号。
- `src/lib/components/`：
  - `account/` 账号与退出；`boot/` 打开 App、部署与根屏（`Brand` 是根屏、登录和外壳共用的品牌字样）；`menu/` 更多菜单（条目、行、壳、歌曲菜单）。
  - `overlay/` 浮层栈与弹窗外壳（确认、对话框；加浮层、从浮层里换页、改返回行为先读 `docs/agents/overlay.md`）；`playlist/` 歌单编辑、加入歌单、歌单封面（选图/裁剪/上传）。
  - `player/` 播放条、播放页、播放队列（含当前这首、换碟、封面飞行、音量、播放器内提示）；`songs/` 歌曲列表与歌曲行。
  - `library/` 曲库、歌单页、格子网格与多选；`downloads/` 已下载；`search/` 搜索；`daily/` 每日推荐。
  - `login/` 登录；`notice/` 全局提示条；`shell/` 桌面/手机骨架、返回栏、播放条停靠、页面过渡；`svg/` 内联图标；`ui/` 基础控件与封面图。
  - `shared/`：界面通用工具（文字与格式化、布局、动效、指针与手势、App 上下文、路由快照）。
- `src/lib/dev/`：只在开发时打开的设计系统页；`scripts/`：录制、fixtures、门禁、mock smoke；`tests/`：App 接缝与纯逻辑核心。
- `src/params.ts`：路由参数（`neteaseId` 只认正整数）；`uno.config.mts`：设计令牌、字号阶梯和全局样式（焦点环）。

**规则①–⑫** 定义在 `docs/prototype/logic.md`；产品 Spec #11 在 GitHub issue（`gh issue view 11`）。

## Svelte

拿不准 Svelte 5 / SvelteKit 的 API 时，用 Svelte MCP（`.omp/mcp.json`）查：先 `list-sections`，再用 `get-documentation` 取对应章节。`svelte-file-editor` subagent 的定义在 `.omp/agents/`。
