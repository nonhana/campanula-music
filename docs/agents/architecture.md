# 代码架构与模块边界

本仓库为单上下文（single-context）SvelteKit SPA/PWA 应用，按领域术语组织代码目录。不确定某个概念的命名或归属时，先查 [术语表](../product/glossary.md)；陈述或依赖任何设计决策之前，先按文件名查 [docs/adr/](../adr/)（ADR 效力高于记忆；若发现与既有 ADR 冲突，须明确标出，不悄悄覆盖）。

## 目录职责

| 路径                                 | 职责                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`                        | 页面路由；`src/routes/api/**/+server.ts` 为服务端 API 路由（[ADR-0013](../adr/0013-api-routes-not-remote-functions.md)）                                             |
| `src/lib/app/`                       | 去掉界面的完整 App 核心（测试主要接入点）；`api-client.ts` 负责浏览器请求，`local.ts` 负责 IndexedDB 本地副本                                                        |
| `src/lib/api/`                       | 服务端接口契约与端点目录（`endpoints.ts` 编译期配对路径与请求/响应类型）                                                                                             |
| `src/lib/server/`                    | 无状态服务端会话与适配层：`credentials.ts` 负责加密 Cookie 与设备编号，`session.ts` 负责只读续期，`netease/` 按登录、曲库、歌单、播放、搜索直接调用 `hana-music-api` |
| `src/lib/components/`                | 按领域拆分的 Svelte 5 界面组件（见下表）                                                                                                                             |
| `src/lib/dev/`                       | 仅开发期可见的 `/design` 设计系统页（生产构建排除并返回 404）                                                                                                        |
| `src/service-worker/`                | PWA 外壳缓存与延迟更新（独立 `tsconfig.json`）                                                                                                                       |
| `src/params.ts`                      | 路由参数校验（`neteaseId` 只认正整数）                                                                                                                               |
| `uno.palette.mts` / `uno.config.mts` | 设计系统色板源、字号阶梯、阴影与焦点环全局样式                                                                                                                       |
| `scripts/`                           | 统一本地开发与证书启动器（`scripts/dev.mts` 及私有 `scripts/dev/`）                                                                                                  |
| `tests/`                             | 分层测试、脱敏录制、外部装配 mock（`tests/_kit/mock`）与工具脚本                                                                                                     |
| `website/`                           | Astro + Starlight 公开文档站与隔离试听示例（`website/demo/`）                                                                                                        |

### `src/lib/components/` 分域目录

- **领域目录**（对应术语表）：`account/`（账号与退出）、`daily/`（每日推荐）、`downloads/`（已下载、任务行、下载面板与导出）、`library/`（曲库、歌单/专辑/歌手页、网格与多选）、`login/`（登录）、`player/`（播放条、播放页、播放队列、换碟、封面飞行、音量、歌词）、`playlist/`（歌单编辑、加入歌单、换封面）、`search/`（搜索）、`songs/`（歌曲列表与行）。
- **实现结构目录**（不要求对应术语）：`boot/`（开场、部署提示与 `Brand`）、`menu/`（更多菜单）、`notice/`（全局提示条）、`overlay/`（浮层栈与弹窗外壳，改动前读 [overlay.md](./overlay.md)）、`shell/`（桌面/手机骨架、返回栏、播放条停靠、页面过渡）、`svg/`（内联图标）、`ui/`（基础控件与封面图）、`shared/`（文字格式化、布局、动效令牌、指针手势、App 上下文、路由快照）。

## 依赖方向与硬边界

```text
src/lib/components  →  src/lib/app  →  src/lib/api  ←  src/routes/api  →  src/lib/server/netease  →  hana-music-api
```

- **界面不直连服务端**：组件一律经 `src/lib/app/` 操作业务状态与请求，不直接 `fetch('/api/...')`。
- **App 不直接读写受限浏览器全局对象**：`src/lib/app/**/*.ts`（除 `browser.ts`）必须从 `BrowserCapabilities` 获取浏览器能力，ESLint `no-restricted-globals` 强制检查，以保证测试可替换为替身。
- **SDK 导入隔离**：只有 `src/lib/server/netease/**`、`src/lib/server/credentials.ts` 和 `tests/_kit/**` 允许值导入 `hana-music-api`（其余文件仅允许类型导入），ESLint `no-restricted-imports` 强制检查。
- **服务端完全无状态**：不在内存保存跨请求状态，不在启动时读写本地文件；网易云凭据加密签名存于 `httpOnly` Cookie，大流量（音频流、下载、封面直传）由浏览器直连网易云存储（[ADR-0003](../adr/0003-credentials-in-encrypted-cookie.md)、[ADR-0004](../adr/0004-single-sveltekit-process-spa.md)）。
- **产品配置不含 mock**：`vite.config.mts` 只装配产品代码，mock SDK、控制接口与开发标记由 `tests/_kit/mock` 从外部注入（[ADR-0020](../adr/0020-isolated-development-environments.md)）。

## Svelte 5 / SvelteKit API 查阅

拿不准 Svelte 5 或 SvelteKit API 时，通过 Svelte MCP（`.omp/mcp.json`）查阅：先调用 `list-sections`，再调用 `get-documentation` 读取对应章节。`svelte-file-editor` subagent 定义位于 `.omp/agents/`。
