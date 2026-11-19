# 测试目录说明

新检出仓库后先按 `.node-version` 与 `package.json` 运行 `pnpm install --frozen-lockfile`。所有离线命令均自行启动本机服务与合成设备，不依赖正在运行的 `dev`、个人 Chrome 或真实网易云账号。

回归范围盘点、七个测试接入点与录制规矩见 [docs/agents/testing.md](../docs/agents/testing.md)；mock 场景与录制维护见 [docs/agents/mock-and-fixtures.md](../docs/agents/mock-and-fixtures.md)；作者点名浏览器诊断见 [docs/agents/browser.md](../docs/agents/browser.md)。

## 快速命令

```sh
pnpm test:unit tests/unit/selection-core.test.ts
pnpm test:behavior tests/behavior/playback.test.ts -t '换到还不知道时长'
pnpm test:contract tests/contract/api.test.ts
pnpm test:environment
pnpm test:environment:https            # 显式专项，需 mkcert/OpenSSL；使用临时 CA，不改系统信任或 hosts
pnpm test:browser:install              # Linux: pnpm exec playwright install --with-deps chromium
pnpm smoke:mock
pnpm test:browser                      # journeys/
pnpm test:a11y                         # accessibility/（双视口 + 27 组对比度门禁）
pnpm test:browser:faults               # 故障注入敏感性验证
pnpm test                              # 离线 Vitest 全套 + journeys/ + accessibility/
pnpm test:coverage                     # 全套回归 + V8/SSR 分区覆盖率
pnpm test:coverage:calibrate           # SSR 覆盖率校准（验证命中与未请求路由零值对照）
pnpm docs:test                         # 官网静态产物回归与 axe 扫描（不在默认 pnpm test 中）
pnpm docs:test:dev                     # 官网 Astro dev 模式回归
```

## 目录归属

`tests/suites.ts` 统一供 Vitest、runner 与 CI 枚举测试文件：必需套件非空、文件不可跨层重叠、基线 `tests/baselines/migration.json` 中任一用例缺失或跳过均会失败。单用例时限 15 秒。

| 目录         | 归属与职责                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `unit/`      | 纯规则单测（手势、多选、浮层栈、会话轮次、元数据写入、下载面板核心）                                |
| `behavior/`  | 听众行为测试（World 经产品客户端、真实本机 HTTP 与独立 Vite SSR）                                   |
| `contract/`  | 客户端 HTTP 合同、脱敏录制与 mock SDK 自检                                                          |
| `delivery/`  | 隔离开发环境、双 HTTPS、伪终端提权（需 Python 3.9+ `pty`）、mock HTTP 装配、生产候选与 PWA          |
| `browser/`   | Playwright 真实页面旅程（`journeys/`）与无障碍/对比度/低视力专项（`accessibility/`）                |
| `website/`   | 官网与独立试听示例的静态产物及 dev Playwright 回归（含 `a11y-manual.json` 与 `verify-preview.mts`） |
| `_kit/`      | World、Device、listener、浏览器/SDK 替身与外部装配的 `mock/`                                        |
| `fixtures/`  | 脱敏网易云录制（见 `fixtures/netease/README.md`）与静音音频样本（`fixtures/audio/`）                |
| `baselines/` | 迁移基线 `migration.json`、覆盖率对照与浏览器无障碍人工基线 `a11y-manual.json`                      |
| `tools/`     | 测试启动器、覆盖率合并、设计令牌检查、CI 计划与交付验证脚本                                         |

## 报告与覆盖率口径

每次运行输出至独占目录，不互相覆盖；`latest-*.json` 仅作导航指针：

- **Vitest 与覆盖率**：`.reports/runs/run-*/`（`tests.json`、`suites.json`、`migration.json`、`partitions.json`、`summary.md`、`coverage-final.json`、`ssr.json`）。测试采集器会合并独立 Vite SSR module runner 的 V8 快照与源码映射，产品分母保留全部未运行源码；`.svelte` 组件不计入 Vitest V8 覆盖，由 `browser/` 单独覆盖。
- **浏览器与故障注入**：`.reports/browser/run-*/`（含每例 trace、截图、网络附件、逐状态 axe JSON 与完整运行的 `contrast-summary.json`）、`.reports/browser-faults/`。
- **环境、HTTPS 与官网**：`.reports/environments/`、`.reports/https/`、`.reports/website/run-*/`（含逐文件 SHA-256 清单与 `run.json`）。

## 候选产物、SDK 与 CI

```sh
pnpm sdk:report                                                   # 生成 .reports/sdk/contract.json
pnpm test:sdk [--candidate /本地候选包]                             # 离线重跑 SDK 合同与代表行为
pnpm delivery:verify --sha "$(git rev-parse HEAD)"                # 构建 Node/Vercel/next 并跑生产 PWA 验证
pnpm build:delivery --sha <SHA> --adapter node|vercel --out <目录>
pnpm test:delivery --sha <SHA> --adapter <同目标> --candidate <目录>
pnpm test:pwa --sha <SHA> --candidate <node目录> --next <next目录>
pnpm release:check --sha <SHA>
node tests/tools/daily-plan.mts <完整基准SHA>                      # 本地复现日常 CI 计划
```

日常门禁见 `.github/workflows/ci.yml`（Linux CI 在 `tests/tools/offline.sh` 无外网命名空间中执行），完整验收见 `.github/workflows/acceptance.yml`。官网预览上线后可用 `pnpm exec tsx tests/website/verify-preview.mts <run.json绝对路径> <HTTPS预览URL>` 做显式联网验收。
