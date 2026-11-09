# #87 Watchman 与 SDK major 迁移验收矩阵

来源：campanula-music#87、hana-music-api#80（2026-11-09 读回快照见 `_notes/acceptance/issue-87/`）。

## Acceptance criteria

- [ ] AC-01：catalog 精确固定 npm `hana-music-api@4.0.0`，lockfile integrity 与 registry 一致；浏览器 `./watchman` 与服务端使用同一安装包，无 link 或源码路径。记录包 SHA-256 / SRI、版本与引擎边界（根 SDK Node >=24/Bun ESM）。
- [ ] AC-02：browser capability 删除手写 loader、Window 扩展、产品/业务参数与初始化；通过 SDK initializer 复用页面实例，每次收藏主动现取 token，初始化/取值各最多 10 秒，空值拒绝；失败后下一次用户主动操作可恢复，无后台重试或旧实现 fallback。
- [ ] AC-03：保留 BrowserCapabilities.checkToken 和 App 业务接缝；取值失败不发收藏，成功只通过本次 JSON 请求体和 SDK config 转交；取消由应用决定不取、不传。SDK 读取/取消也接受显式字符串/provider 的合同以实际候选包消费者证据说明。
- [ ] AC-04：唯一服务端适配层移除顶层 deviceId，使用 cookie、state.deviceId 和 ModuleCallConfig；不传 CreateRequestOptions 的自由协议/身份字段，不用兼容 shim。调用方持有设备和会话；新包严拒未知键（含 undefined），保持各动作协议及已批准的 web/iPhone/clientlog 自洽身份。
- [ ] AC-05：HTTP 保持 1–1024 位可打印非空格 ASCII 校验；170 只是官方观察值。token 不进 URL/query/Cookie/日志/持久副本，失败回滚、405 不自动重试、断网不写、同对象顺序写、退出后不发排队写、曲目复用、专辑取消 404 完成语义和账号隔离均有非空行为断言。
- [ ] AC-06：测试与 mock 精确隔离浏览器子路径，其余 SDK 子路径仍拒绝；默认测试/mock 不加载外网 Watchman、不请求网易云，生产浏览器不捆根 SDK，生产产物无 mock/fixtures/开发页。
- [ ] AC-07：原票专项测试、check、lint、check:endpoints、完整 test、Vercel/Node 两构建、check:mock-isolation、fixtures:index:check、smoke:mock 全通过；共享构建串行。新行为记录有效 red/green，保存命令/退出码/原日志/源码与锁文件指纹；fixture 只更新验证索引，不改录制来源。
- [ ] AC-08：当次作者试用或明确授权后，在同一真实 origin 页面会话、至少两张非本人且初始未收藏的歌单，连续三轮每张收藏→读回→取消→读回，每收藏 fresh token。最多 12 次写，顺序执行，任一步失败即停；记录执行次数、失败与恢复、最终原状态，以及 origin/浏览器/日期/初始化次数，不记录 token/Cookie 原文。
- [ ] AC-09：父 #80 要求的同一候选在测试部署读取《Ficus》/exhigh，记录有限只读取址结果（可用地址或上游拒绝码）；当次确认部署、账号与目标条件，不扩为播放或其他写权限。
- [ ] AC-10：未参与实现的独立规范轴/需求轴审查和专门风格审查核对原始需求、全部 diff/untracked 与原始日志；缺外部证据保持未完成。全部 AC 满足后才按既有授权提交本票、普通推送并核对远端、作者确认后 completed 关票，再启动唯一可运行后继。无新 PR、合并或稳定发布。

## 验证接缝与文件

沿用 World/App + BrowserCapabilities，观察 App 状态、HTTP 请求、本机副本、Cookie、日志、SDK 调用配置。浏览器实际官方脚本与真实账号由作者试用证明。

计划修改：pnpm-workspace.yaml、pnpm-lock.yaml、src/lib/app/browser.ts、src/lib/server/netease.ts 的配置片段、tests/credentials.test.ts、tests/heart-collect.test.ts、tests/harness/netease-sdk.ts；按实际解析需要精确隔离 world/mock 的 watchman，重建 fixture 索引并补来源说明。无新增界面与业务字段，无新 ADR。

完整命令沿用 #87 原清单；本票明确覆盖仓库默认交给 CI 的全量命令。有限离线故障检查用于新配置拒绝/新 token 的有效性，禁止用 guard 报错当行为 red。

外部条件：AC-08/09 需本次作者执行或授权；AC-10 必须区分代码审查与票完成。结果只更新 runs。

## 2026-11-09 正式版追加范围

作者确认 4.0.0 已正式发布，授权直接升级并整理 netease.ts 及相关请求代码。AC-01 改为固定已发布的 4.0.0；旧 next.0 指纹/绿灯作为历史保留，新版本重新验证。新请求参数直接使用公开 ModuleQueryOf，移除仅承载 checkToken 的 ExtraConfig；每次调用仍显式传 cookie/state.deviceId 和当次 token。错误定义从网易云适配层移到 netease-error.ts，respond/session/logout 直接引用，唯一 SDK 调用仍留在 netease.ts。mock 失败改为 SDK 4 的标准 status/body/cookie 对象，测试替身复用 NcmApiResponse 类型。

无新增业务行为，沿用已经约定的 World/App 接缝回归；不新增只断言内部结构的单元测试，也不人为破坏旧实现凑 red。本轮原始证据在本机 `_notes/acceptance/issue-87/stable-v4/`，追加执行记录 `docs/acceptance/runs/issue-87-stable-v4.md`。现行 AC-08/09 的当次外部验收仍未执行，不把 SDK 正式发布视为应用页面验收。
