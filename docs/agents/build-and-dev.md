# 构建、开发与环境命令

Node 与 pnpm 版本以 `.node-version` 和 `package.json` 的 `packageManager` 为准，安装依赖统一执行 `pnpm install --frozen-lockfile`。

## 常用开发与检查命令

| 任务                   | 命令                                                                                        | 说明                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 真实本地开发（HTTPS）  | `pnpm dev`                                                                                  | 默认 `https://local.campanula.test:8443/`，需 `.env` 配 `COOKIE_SECRET` |
| Mock 本地开发（HTTPS） | `pnpm dev:mock`                                                                             | 默认 `https://mock.campanula.test:8444/mock/login`，预置曲库不连网易云  |
| HTTP 备用启动          | `pnpm dev:http` / `pnpm dev:mock:http`                                                      | `localhost:5173` / `127.0.0.1:5174`（按主机隔离 Cookie）                |
| 首次 HTTPS 信任准备    | `pnpm dev:setup`                                                                            | 仅复核 mkcert CA 信任与域名解析，不启动应用                             |
| 静态类型检查           | `pnpm check`                                                                                | `svelte-kit sync` + `svelte-check --tsgo` + Service Worker `tsc`        |
| 代码检查与令牌门禁     | `pnpm lint` / `pnpm lint:fix`                                                               | ESLint（含 UnoCSS strict）+ `tests/tools/check-design-tokens.mts`       |
| 代码格式化             | `pnpm fmt` / `pnpm fmt:check`                                                               | 由 `oxfmt.config.mts` 决定；CI 与提交前跑 `fmt:check`                   |
| 端点与录制索引检查     | `pnpm check:endpoints` / `pnpm fixtures:index:check`                                        | 核对 API 端点目录与脱敏录制索引                                         |
| 死代码检查             | `pnpm knip`                                                                                 | 按需运行，误报白名单在 `knip.json`                                      |
| 生产构建               | `pnpm build`                                                                                | `VERCEL=1` 用 `adapter-vercel`（`hkg1` / Node 24），否则 `adapter-node` |
| 文档站开发与构建       | `pnpm docs:dev` / `pnpm docs:build`                                                         | 先构建 `website/demo`，再启动/构建 Astro 到 `website/dist/`             |
| 文档站类型与回归       | `pnpm exec tsc -p website/tsconfig.json --noEmit` / `pnpm docs:test` / `pnpm docs:test:dev` | 独立 Playwright 静态产物与 dev 回归（不在播放器默认 `pnpm test` 中）    |

## 环境变量与本地隔离规则

- **必需环境变量**：真实模式与生产部署均须设置 `COOKIE_SECRET`（至少 32 字符，可用 `openssl rand -base64 32` 生成）；缺失时 `src/hooks.server.ts` 拒绝全部 `/api/*` 请求。可选 `NETEASE_REAL_IP`、`LOGIN_COOKIE_NAME`。
- **双主机与独立工作根**（[ADR-0020](../adr/0020-isolated-development-environments.md)）：`scripts/dev.mts` 统一管理开发模式、mkcert CA 复用/30 天续签与 Vite 生命周期。Cookie 按主机隔离，访问非预期 Host 时开发中间件返回 421。
- **Mock 稳定工作根**：`pnpm dev:mock` 使用 `.campanula/mock` 独占 `$app`、Kit/Vite 缓存与密钥（重启沿用密钥、曲库回种子）；`/design` 在 `dev` 与 `dev:mock` 均可打开，生产包排除并返回 404。
- **提交前钩子**：`simple-git-hooks` 运行 `lint-staged`（改动的源码跑 ESLint 与设计令牌检查，改动的 fixture 跑身份校验）。

## 生产候选构建与隔离检查

发布候选和 mock 隔离验证使用显式 SHA 与独立输出目录：

```sh
pnpm build:delivery --sha <完整SHA> --adapter node|vercel --out <尚不存在的目录>
pnpm test:delivery --sha <完整SHA> --adapter <同目标> --candidate <同目录>
pnpm delivery:verify --sha "$(git rev-parse HEAD)"
pnpm test:pwa --sha <完整SHA> --candidate <node候选> --next <next候选>
pnpm release:check --sha <完整SHA>
```

`pnpm check:mock-isolation` 为 `test:delivery` 的兼容入口，拒绝任何 mock、录制数据、开发页或合成媒体混入生产包。
