# Campanula Music

开源的第三方网易云音乐 SPA/PWA 播放器，基于 Svelte 5 + SvelteKit + UnoCSS，通过 `hana-music-api` 对接网易云。

## Agent Docs

### 工程与流程

- [architecture.md](./docs/agents/architecture.md) — 改动模块边界、目录职责、依赖方向或查 Svelte MCP 之前
- [build-and-dev.md](./docs/agents/build-and-dev.md) — 安装、运行 dev/mock、构建、格式化与静态检查之前
- [code-style.md](./docs/agents/code-style.md) — 编写代码、注释、测试或代码审查之前
- [testing.md](./docs/agents/testing.md) — 盘点回归范围、编写或运行自动化测试之前
- [mock-and-fixtures.md](./docs/agents/mock-and-fixtures.md) — 切换 mock 场景、补脱敏录制或改动 SDK 替身之前
- [browser.md](./docs/agents/browser.md) — 作者点名做浏览器截图、动效逐帧、焦点或 axe 无障碍诊断时
- [overlay.md](./docs/agents/overlay.md) — 新增浮层、从浮层换页或修改返回与焦点归还逻辑之前
- [delivery.md](./docs/agents/delivery.md) — 开工、提交、跟进 CI、fixup 推送或写作者试用清单之前
- [docs.md](./docs/agents/docs.md) — 新增、拆分、迁移或修改 `docs/`、`website/` 或根目录文档之前
- [issues.md](./docs/agents/issues.md) — 使用 `gh` 操作 GitHub issue、子票依赖或分诊标签之前
- [issue-template.md](./docs/agents/issue-template.md) — 新建 Spec 或任务票正文时

### 产品与设计

- [overview.md](./docs/product/overview.md) — 确认功能范围、目标设备与明确不做边界之前
- [glossary.md](./docs/product/glossary.md) — 命名目录、接口、文案、测试或 issue 术语之前
- [rules.md](./docs/product/rules.md) — 涉及播放队列、打卡、下载、同步、离线与会话规则①–⑫之前
- [foundations.md](./docs/design/foundations.md) — 涉及颜色语义、字号阶梯、阴影圆角、焦点环或强制颜色时
- [layout.md](./docs/design/layout.md) — 涉及桌面/手机骨架、页头网格、筛选多选与骨架防跳动时
- [motion.md](./docs/design/motion.md) — 涉及动效时长曲线、页面过渡、封面飞行、抽屉手势或滚动条时
- [copy.md](./docs/design/copy.md) — 编写文案、空态错态、按钮层级或选用 Lucide 图标时
- [components.md](./docs/design/components.md) — 实现或修改通用控件、歌曲行、弹窗、提示条或下载面板时
- [player.md](./docs/design/player.md) — 实现或修改播放条、播放页、晨光行、波浪进度、换碟、歌词或队列时

### 架构决策

- [docs/adr/](./docs/adr/) — 陈述或依赖任何架构与交互决策之前先按文件名查阅；ADR 效力高于记忆
