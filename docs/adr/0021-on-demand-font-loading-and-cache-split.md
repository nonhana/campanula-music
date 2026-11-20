# 字体按需加载与跨版本缓存分层

ADR-0015 把 `$app/manifest` 的全部构建产物在 Service Worker `install` 阶段一次性写进版本缓存，包括 4 套自托管可变字体的 335 个 `.woff2` 分片（约 14 MB）；根布局也静态导入了全部 4 套字体 CSS（341 条 `@font-face`、约 322 KB），导致首屏样式表阻塞渲染、弱网下 SW 安装期与首屏脚本和 `/api/account` 抢占带宽、每次发版重复拉取 14 MB 字体，且 `build/server` 也冗余复制了一份 `.woff2`。

## 决策

- **构建期裁剪无用与被遮蔽子集**（`vite.config.mts` 的 `campanula:prune-fonts`）：
  - 应用全局 `ssr = false`，SSR 构建中对 `@fontsource-variable/*` CSS 返回空模块，避免向服务端产物复制 `.woff2`。
  - 客户端构建中移除基础 `noto-sans` 里不会命中的 4 个语系子集（`devanagari`、`cyrillic-ext`、`greek-ext`、`vietnamese`），以及 `noto-sans-{sc,jp,tc}` 中被前置 `Noto Sans Variable` 遮蔽的 12 个 `latin`/`latin-ext`/`cyrillic`/`vietnamese` 块。
- **字体 CSS 分级加载**（`src/lib/components/shared/fonts.ts`、`src/lib/components/shared/text.ts`）：
  - 首屏阻塞 CSS 仅保留基础 `noto-sans`；`noto-sans-sc` 在应用启动时异步加载；`noto-sans-jp` 与 `noto-sans-tc` 在 `langOf()` 识别到 `ja` 或 `zh-TW` 文本时按需加载并缓存，不从外网拉取字体，继续满足混排按 `lang` 切换字体的设计要求。
- **Service Worker 外壳与字体双缓存分层**（`src/service-worker/index.ts`）：
  - `campanula-shell-${version}` 仅在 `install` 时预缓存非字体外壳资源（JS、CSS、`static/` 与 `/`），与原有发版切换策略一致。
  - 全部构建产出的带内容哈希 `.woff2` 字体分片移入跨版本持久缓存 `campanula-fonts`，采用运行时 Cache-First（命中直接返回，未命中联网拉取并写回）；仅在 `activate` 时对照当前构建清单清理已失效哈希的旧分片。

## Consequences

- 首次访问的 Service Worker `install` 预缓存从 427 条 / 15.15 MB 降到约 91 条 / 1.18 MB，不再与首屏脚本和接口争抢弱网连接池；发版更新外壳时已缓存的字体分片直接跨版本复用，无需重新下载。
- 权衡：首次打开后若尚未触发过的字形分片（例如从未展示过的日文/繁体分片）在随后断网时才出现，会干净回退到 `system-ui`，而不是在安装期预存全部 14 MB 字库；凡是联网时已渲染过的界面与文本分片在断网重开和版本升级后都会继续命中本机缓存。
- ADR-0015 中关于外壳缓存、waiting 延迟激活、断网打开本机副本以及排除 `/api/**` 与外部媒体的决策保持不变。
