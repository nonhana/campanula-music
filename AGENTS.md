# Campanula Music — Agent Instructions

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `nonhana/campanula-music`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

**Decisions**: before stating or relying on a design decision (in a reply, a plan, or code), check `docs/adr/`; each filename names its decision. ADRs outrank recalled memories.

### Delivery

Before implementing a ticket, read `docs/agents/delivery.md`: branch, test seam, real-account rules, and hand-off with a trial checklist for the author (the author verifies by trying it; screenshots only on request).

### Mock 与浏览器验证

- 日常界面、动效和 reviewer 验证走 mock：`pnpm dev:mock`（5174），`scripts/browser`（默认 mock，不需要登录）。见 `docs/agents/mock.md`。
- 真账号只用于作者最后的交付试用，走专用浏览器 `scripts/axi`；打开前先 `scripts/browser check --real`，不是登录态就停下请作者扫码。见 `docs/agents/browser.md`。
- reviewer 不自己启动 Chrome；父 agent 用 mock 做视觉验证，把结论和截图路径交给 reviewer。

## 代码地图

领域目录名优先用 `GLOSSARY.md` 的概念（例如 `library/` 曲库、`playlist/` 歌单、`player/` 播放、`downloads/` 下载）；`ui/`、`svg/`、`shell/`、`shared/` 是实现结构，不要求有术语。不确定一个概念住哪时先查 GLOSSARY。

- `src/routes/`：页面；`src/routes/api/**/+server.ts` 是服务端接口（ADR-0013）。
- `src/lib/app/`：去掉界面的整个 App（测试接入点）；`api-client.ts` 是浏览器发请求的那一层，契约在 `src/lib/api/`。
- `src/lib/api/`：服务端接口的契约与端点目录；`src/lib/server/`：服务端适配层与 mock（只有 `netease.ts` 调 `hana-music-api`）。
- `src/lib/components/`：
  - `account/` 账号与退出；`boot/` 打开 App、部署与根屏（`Brand` 是根屏、登录和外壳共用的品牌字样）；`menu/` 更多菜单（条目、行、壳、歌曲菜单）。
  - `overlay/` 浮层栈与弹窗外壳（确认、对话框）；`playlist/` 歌单编辑、加入歌单、歌单封面（选图/裁剪/上传）。
  - `player/` 播放条、播放页、播放队列（含当前这首、换碟、封面飞行、音量、播放器内提示）；`songs/` 歌曲列表与歌曲行。
  - `library/` 曲库、歌单页、格子网格与多选；`downloads/` 已下载；`search/` 搜索；`daily/` 每日推荐。
  - `login/` 登录；`notice/` 全局提示条；`shell/` 桌面/手机骨架、返回栏、播放条停靠、页面过渡；`svg/` 内联图标；`ui/` 基础控件与封面图。
  - `shared/`：界面通用工具（文字与格式化、布局、动效、指针与手势、App 上下文、路由快照）。
- `src/lib/dev/`：只在开发时打开的设计系统页；`scripts/`：录制、fixtures、门禁、mock smoke；`tests/`：App 接缝与纯逻辑核心。

**规则①–⑫** 定义在 `docs/prototype/logic.md`；产品 Spec #11 在 GitHub issue（`gh issue view 11`）。

## Svelte

When unsure about a Svelte 5 / SvelteKit API, look it up with the Svelte MCP (`.omp/mcp.json`): `list-sections`, then `get-documentation` for the relevant sections. The `svelte-file-editor` subagent lives in `.omp/agents/`.
