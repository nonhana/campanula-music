# 测试导航

新检出仓库先用 `.node-version` 的 Node 和 `package.json` 的 pnpm 版本运行 `pnpm install --frozen-lockfile`。下列命令自己启动本机 HTTP 和 Kit，只用合成设备与脱敏录制，不需要正在运行的 dev、浏览器、全局 CLI 或账号凭据。

## 从一个文件开始

```sh
pnpm test:unit tests/unit/selection-core.test.ts
pnpm test:behavior tests/behavior/playback.test.ts
pnpm test:behavior tests/behavior/playback.test.ts -t '换到还不知道时长'
pnpm test:contract tests/contract/api.test.ts
pnpm test
```

同一条播放用例既在单文件命令中运行，也在默认套件中运行。`-t` 过滤用例全名；Vitest 的其他运行参数也可以追加。文件或全名选不到用例时会失败。受控套件只提供已经存在的入口：`test:unit`、`test:behavior`、`test:contract`；浏览器、a11y 和候选产物的入口由后续票交付。

| 目录                           | 输入与可观察输出                                                | 证据范围                                                                              |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `unit/`                        | 操作序列、音频样本 → 规则结果、新文件                           | 手势、多选、浮层栈、会话轮次、歌曲标签；不运行页面                                    |
| `behavior/`                    | 听众操作、时间/网络/设备事件 → App 状态、请求、Cookie、本机保存 | World 经过产品客户端、真实本机 HTTP 和独立 Vite SSR；浏览器外部能力与网易云由替身提供 |
| `contract/api.test.ts`         | HTTP 合同 → 请求方法、载荷和 keepalive 边界                     | 客户端消费者合同；不连真实 HTTP                                                       |
| `contract/mock-*.test.ts`      | 录制索引、mock SDK 与状态 → 数据和合同检查                      | 录制 / 替身自检，不算产品听众行为或真实上游证据                                       |
| `delivery/mock-server.test.ts` | 实际 HTTP 请求 → mock 装配后的响应                              | 既有开发环境自检，随默认套件运行；不证明 Node/Vercel 候选产物                         |
| `_kit/`、`fixtures/`、`tools/` | 设备、时钟、严格 SDK 替身；有来源的录制；启动和诊断             | 共用测试基础设施，产品覆盖率单独计算                                                  |

`tests/suites.ts` 是 Vitest、runner 和 CI 共用的文件选择。它检查每个必需套件非空、每个发现的文件恰好归属一层、迁移基线中的必需文件都存在。新增测试放进对应目录即可；根目录漏放、目录重叠或删掉必需文件会直接失败。单用例时限为 15 秒，容纳 V8 精准采集下真实 HTTP 和本机保存的开销；业务等待仍用受控时钟验证。World 仍共用 Kit 测试输出，暂时串行跑文件；也请将测试、类型检查和构建顺序运行。

## 迁移清单与回归结果

[baselines/migration.json](baselines/migration.json) 来自开工提交 `9c2ec71b6cbf025f6f25fdb1a84cbd8584d94cec` 的实际 JSON 测试报告：42 文件、755 用例，全部 passed，跳过 0。每条都保留原路径、全名、原结果及迁入路径。`session-round` 中 3 条纯核心用例迁入 `unit`，其余继续走 `behavior`，用例全名不改。

`pnpm test` 全量成功后逐项核对基线，漏用例、重复执行或从 passed 改为跳过都会失败；新增用例单独列出。产物在 `.reports/all/`：`tests.json` 是 Vitest 真实结果，`suites.json` 按证据层列文件，`migration.json` 列保留与新增。按文件 / 全名运行时只报告所选用例，不冒充全量迁移通过。

## 覆盖率：先确认采集到了什么

```sh
pnpm test:coverage
pnpm test:coverage:calibrate
```

第一个命令运行同一份默认回归并核对迁移，产物在 `.reports/coverage/`；第二个只跑“未登录打开 App”的既有行为，用独立目录 `.reports/calibration/` 校准。它要求账号 `GET` 处理函数实际执行、未请求的歌单改名路由计数为零，任一不符就失败。CI 顺序运行这两个命令并上传本次 SHA 的报告。

- `partitions.json`：完整 `src`、扣除 mock / 开发页的产品、App、服务端、API 路由、Svelte UI、测试基建分别列文件数、命中数和分母。
- `summary.md`：各分区行与分支的命中数、分母和百分比。
- `coverage-final.json`、`index.html`：合并后的逐文件源码位置与执行次数。
- `ssr.json`：独立 SSR 的映射结果；`ssr-raw/` 保留 V8 计数和执行时的代码 / 源码映射，便于定位漏采或映射错误。
- `calibration.json`：账号处理函数命中和未请求路由的零值对照，仅校准命令产生。

采集使用 Vitest / V8 5.1.0，产品分母纳入 `src/**/*.ts` 和 `src/**/*.svelte`、排除声明，保留未运行文件。现有 `src/lib/server/mock/`、`src/lib/dev/` 与 `tests/` 工具归测试基建；`src` 一栏保留完整分母，`product` 扣除前两者后另列，不能拿基建抬高产品覆盖率。独立 Vite module runner 的脚本使用绝对路径 `sourceURL`，标准采集器只收 `file://` 而漏掉它；测试采集器从同一次 V8 快照保留这些脚本，以当次内联源码映射转换后合并，不靠“请求过”人工填命中。

157 个 `.svelte` 文件没有浏览器执行记录，报告明确标为未采集。它们仍在全 `src` 分母内，零值不证明界面行为；`.svelte.ts` 中的浏览器适配、Service Worker、安装和系统行为也不能由纯规则或 App 的替身证明。浏览器旅程 / a11y 自动化由 Spec #96 的后续票接入，真实账号、Android 系统与真实读屏仍由作者验收。

基线复测、校准前后分母、风险排序和新增回归的对照见 [baselines/coverage.md](baselines/coverage.md)。覆盖率数值只比较同口径分区；修正 SSR 漏采带来的增加与新增断言带来的增加分别记录。
