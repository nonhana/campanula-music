# #87 执行记录

> 本文保留 4.0.0-next.0 的历史候选与结果。作者现要求使用 4.0.0 正式版，后续状态见 [正式版追加记录](issue-87-stable-v4.md)，本文绿灯不代表正式版候选已验证。

## 当前结论

离线实现已完成，独立审查修正后的最终候选全部离线门禁通过。AC-08/09 缺当次真实页面、账号与测试部署取址证据，整票 BLOCKED（仅指外部验收未完成）；#87 保持 open，没有提交、推送、部署、关票或启动 #118。尚未获得本票真实账号/部署操作授权。

本票来源是 GitHub #87 与父 hana-music-api#80 当前合同。原件、所有命令日志、JUnit、安装包与独立审查保存在本机 `_notes/acceptance/issue-87/`，沿用仓库现有 `_notes` 忽略约定；初期证据原存 `.artifacts/testing/issue-87/`，原命令/路径回执未改标，后整体迁移至这里。

## 基线与改动边界

- branch：`rewrite/v1`；HEAD/远端起点：`f60fe316079dd2f5014a50eab522bb657cd14088`。
- 原 diff SHA-256：`50aaa2c84db8bbe2f55f8b9f675b8e74db14bc5e5009790b25f2acda72e344be`；原 6 项改动备份见 `preexisting.patch`、`baseline.json` 和 `preexisting/`。
- `src/env.ts`、`motion-tokens.ts`、`respond.ts`、`session.ts`、`uno.config.mts` 与原备份逐字节相同。`netease.ts` 原多行导入格式保留；本票仅修改其 ExtraConfig/SDK 配置片段，后续提交必须按片段排除原导入修改。
- 无新界面、网易云业务字段或录制；无新 ADR。本票复用 #30 的 App 收藏流程，保留取消不取 token 的应用决策。
- 最终候选内容 SHA-256（所有受版本管理文件及非忽略 untracked，排除 runs）：`9b7b3116e1c781133ebb9a08946d54dd1d88ec46943921de43e1f98c67f20015`。明细见 `candidate.json`。testedHead 仍是上述起点，没有伪称提交后重跑。

## npm 候选与数据流

catalog 精确固定 `hana-music-api@4.0.0-next.0`，根 SDK 与独立 `./watchman` 来自同一 registry 安装；无本地 link 或 SDK 源码路径。当前 registry next=4.0.0-next.0、latest=3.2.1。tarball SHA-256：`8143eb697c100874e2d3dd6cf9e354da9980c3d060d0542568ba10c0be087553`；SRI：`sha512-fLHCLcSMT28zCStmhOzcAetVRZaPgvKuoxsY34K4TCmRo3YB29d+s6eGrO6I75fky/pcifdlmavZgUODbm3fcQ==`。本次重新读取 registry、下载 archive 并计算，原件 `registry.json`、`package-pack.json`、`package-fingerprint.json`。根 SDK 要求 Node >=24/Bun ESM，Vercel 配置已是 nodejs24.x。

浏览器在收藏主动操作时调 SDK initializer（SDK 自己按页面复用），每次 getToken 现取；mock 分支先返回本地固定令牌，不初始化官方脚本。手写 loader/Window 扩展/产品和业务参数源已删除。World 与 mock 仅放行精确 `hana-music-api/watchman`，其余子路径仍拒绝。

App → 自有 JSON 业务路由 → HTTP 1–1024 位非空格可打印 ASCII 校验 → 唯一 SDK 适配层的当次 `checkToken` 字符串。设备/凭据由应用持有，经 `state.deviceId`/`cookie` 每次传入；删除顶层设备字段，不用协议覆盖或 shim。应用取消不取、不传 token；SDK 的读取/取消显式字符串/provider 能力已由实际包消费者验证，不将其误述为 SDK 限制。服务端与浏览器都没有新增跨调用 token/凭据存储。

## red/green、故障有效性与回归

- 先改 `tests/credentials.test.ts`，真实 AssertionError 检出旧顶层 deviceId（`red-device-*`，5 项选择，1 失败/4 通过）；移除字段后 `green-device-*` 5/5。不是导入错误或网络 guard 失败。
- 新增/补强 App 测试：三轮 fresh token、取消不取、确认后才写本机、失败后不后台重试而主动恢复、405/拒绝回滚、断网不写、同对象顺序提交、排队或取值期间退出、合法长度 1/1024 与非法/空 token、URL/query/Cookie/日志/本机不留 token。原有专辑取消 404 与曲目复用继续回归。
- 包消费者以最终 fetcher 替换网络，Node/Bun 各执行读取/取消的字符串/provider 4 次 transport，并验证 crypto/ua/domain/e_r/acceptGzip/headers/deviceId/未知键即使 undefined 也被拒绝；不会访问上游。原件 `package-consumer.mjs` 和对应日志。
- 真实浏览器适配器搭配合成 DOM，检查脚本失败清理、下一次主动恢复、跨能力对象复用同一初始化、每次新值、空白拒绝、10 秒超时和超时后的下一次操作；mock 初始化/网络均为 0。它只证明离线接线，`realPageEvidence:false`，不能冒充真实官方页面。
- 对实际 browser.ts 的两份临时源码副本分别注入“缓存旧 token”和“跳过初始化”。消费者各出现原生 AssertionError（fresh 值不等 / 应拒绝却成功），2/2 有效检出，见 `mutations.json` 和原日志；工作区源码未被替换。
- 首轮 lint 失败包含本地证据被扫描和新增代码格式问题；证据移到 `_notes`，修正后复跑成功。独立规范初审发现 3 处重复读取本机歌单编号，已复用现有 storedPlaylistIds 后重跑最终候选。所有失败轮次保留，不作为通过证据。
- fixture 346 份 / 52 模块全部用新包重新校验；`index.json` 仅 checkedWith 更新，录制及来源元数据不改。README 明确它们只证明历史返回兼容。

## 最终命令记录

最终命令均由 `run.py` 保存实际 argv、UTC 起止时间、退出码、testedHead、diff 指纹和完整 output.log；详细目录见本机证据。规范修正后的 14 条 `*-reviewed-*` 命令全部 exit 0，tracked diff 指纹一致（`7b3fd4af58dddae62ffa43e1b9378de2a309edd87322b09c09afcb961f648757`），汇总 `final-gates.json`。

首轮专项 5 文件 87/87；全量 42 文件 632/632、零失败零跳过，JUnit 为 `junit.xml`；check、lint、check:endpoints、Vercel 构建、Node 构建、check:mock-isolation、fixtures:index:check、smoke:mock 均 exit 0。首轮生产隔离检查 2901 文件。共享构建串行；smoke 使用专用 mock 上下文和本票启动的 5174，完成后已停止本票服务，不触碰真账号。

最终轮专项仍为 87/87；全量仍为 42 文件、632/632、零失败零跳过（`junit-reviewed.xml`），两构建、隔离、fixture、mock smoke、Node/Bun 包消费者及真实适配器/合成 DOM 的正常和 mock 两模式全部成功。安装包 713 个文件已逐字节对照 canonical tarball；75 个浏览器 JS 中只有一个包含独立 Watchman 标识，无 Node crypto 或根 SDK 的执行配置/请求内核标记（`installed-package.json`、`client-bundle.json`）。

独立规范轴/需求轴/专门风格审查原文分别为 `review-standards.md`、`review-spec.md`、`review-style.md`；修正后的同候选复核全部完成：规范轴 PASS（初审 P3 已修）、需求轴未发现源码阻断、专门风格轴 PASS，均确认最终指纹无漂移。需求轴同时明确外部 AC-08/09 未完成，因此整票不能通过。

## 待作者确认的试用计划（尚未执行）

推送当前分支会触发 Vercel，而本次接力要求全部 AC 满足后才自动收尾；真实页面却需要先上线候选。因此需要作者当次选择允许一次候选准备提交/普通推送，或指定其他测试部署方式。准备提交也只包含本票，排除上述 6 项原改动；不是提前关票。

建议 origin 为 `https://campanula-test.caelum.moe/`，需要作者本次确认。Vercel 连接只读列出 campanula 项目，但读取该 team 的域名/部署返回 403，未能据此核实当前 origin 或版本；没有换身份绕过，也没有改连接或部署。要用连接代办部署时需另行开通该 team 访问，作者自行验收不必先开通。

真实账号由作者亲手操作，或明确授权实现者按以下同一有限计划操作。目标建议 A=`95050200`、B=`8668352551`（来自已有第三方歌单录制，当前有效性/归属/收藏状态尚未核实）；作者也可明确指定两张。必须先确认都非本人且初始未收藏，任一不符合就停，不自行替换目标。

1. 在部署了本候选的同一 origin、同一页面会话完成；不要刷新整页或换标签页重建实例。先读账号/目标详情与完整歌单列表，记下两个初始状态。登录不在时停下请作者扫码，不重复登录尝试。
2. 每轮按 A 收藏→读回→A 取消→读回→B 收藏→读回→B 取消→读回，连续三轮。收藏用正常页面按钮；每次现取 token，取消不取。乐观显示不算读回：通过本实例 `/api/playlists?uid=<当前账号ID>` 新的一次只读 GET，确认目标编号出现/消失；不把页面本机副本当上游确认。
3. 合计最多 12 次写，顺序执行。任一步拒绝、超时或读回不符就停止本轮和后续矩阵，不自动再试。仅在作者明确同意恢复操作时，对已成功收藏但尚未撤销的目标做最多一次取消并读回，计入同一 12 次上限；失败/状态不明就交给作者，不反复取消。
4. 记录日期、候选版本/integrity/提交、origin、浏览器、初始化次数，以及每步结果/已执行写数/失败和恢复/最终状态；不记录 token、Cookie 原文，不要求截图。可在 DevTools 的 SDK 官方初始化调用处设日志断点，只计调用次数；fresh token 只记是否现取/长度，不打印值。
5. 父 #80 的独立只读项：同一测试部署通过 `/api/songs/1411594141/play-url?quality=exhigh` 取《Ficus》地址一次（歌曲编号在本仓库原录制中对应 Ficus），记录有无地址、有效性说明或上游拒绝码。不播放、不下载、不发打卡，不重复试到成功。

| 轮次/对象 | 收藏/第几次写 | 新 token | 上游读回已收藏 | 取消/第几次写 | 上游读回未收藏 |
| --- | --- | --- | --- | --- | --- |
| 1 / A | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 1 / B | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 2 / A | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 2 / B | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 3 / A | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 3 / B | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |

上表是计划，执行数当前为 0，最终账号状态没有本票操作造成的变化。AC-08/09 完成且作者确认后，再由 reviewer 核对实际证据并按既有授权完成提交/普通推送/关票/唯一后继；不提前启动 #118。

## 最终状态表

| AC | 状态 | 决定性证据 |
| --- | --- | --- |
| 01 | PASS | registry/lock SRI、canonical SHA、713 文件逐字节比较 |
| 02–06 | PASS（离线实现及回归） | 完整 App、实际包 Node/Bun/适配器、隔离与产物检查；不代替真实页面 |
| 07 | PASS | 14 条 reviewed 回执同 diff，专项 87、JUnit 632/0/0/0 |
| 08 | BLOCKED / 未执行 | 当次两歌单三轮及账号恢复，当前写数 0 |
| 09 | BLOCKED / 未执行 | 测试部署《Ficus》/exhigh 一次只读取址 |
| 10 | PARTIAL | 三项代码审查完成；整体外证、授权收尾和后继尚未满足 |

已准备只包含本票 13 个文件的 ticket-only.patch，并用 git apply --check --cached 验证可用于 index；没有实际暂存。候选提交信息预备为 `refactor: 改用 SDK Watchman 并适配新版调用配置`。原 netease 导入改动留在工作区，原 6 项内容不得顺带交付。
