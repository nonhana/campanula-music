# #99 测试曲库与 SDK 合同

开工：2026-11-16，`rewrite/v1`，基线 `267cbd16768b5efe9037b61834d1bd9861acc71b`；父 Spec #96 的恢复授权生效，#98 已关闭。实现不使用作者浏览器或账号。

## 开工覆盖清单

| 需求 / 输入                              | 接入点与输出                                                                      | 正常、失败、边界及回归                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 生产 SDK 值导入、安装版 schema、原始样本 | sdk-report / fixture-index → 消费者、关键查询、采集与测量版本、校验类别、失败缺口 | sdk-contract / mock-index；缺绑定、错误 body、索引重建                                 |
| SDK query、状态曲库与排队回复            | sdk-modules、runtime、World → 最终响应、调用记录、收尾                            | sdk-contract / mock-runtime；错 ID、额外/遗漏/顺序、并发、失败元数据                   |
| 小曲库与写操作                           | 同一 runtime / store → 收藏导航、歌曲、播放下载、歌词、写后读回                   | mock-library / mock-store / mock-server；reset、删除关系、规模种子                     |
| 扫码、空搜索、512、限流和恢复            | runtime + 真实本机 HTTP / App → 状态、Cookie、两步请求和读回                      | mock-library / mock-server / 原 playlist-tracks、heart-collect、session、login、search |
| 显式实例与一次性授权、合成采集源         | tests/tools → 脱敏样本、来源、索引；删除临时授权                                  | recording；成功、失败、拒绝、源异常、无私有材料                                        |
| 安装版 / 本地候选 SDK                    | test:sdk → 公开文件副本、版本与步骤报告；清理                                     | 原始样本、两种替身、类型、代表 App；不联网查 latest                                    |
| 现有所有消费者                           | World/App、客户端与直接 HTTP 调用、开发环境                                       | 原 755 条迁移基线逐项核对；完整默认套件及双构建交 CI                                   |

SDK 为 6.1.0。当前业务字段均在该包公开声明中，未增加产品对上游字段的需求。实际 action 清单从 `src` 值导入生成，辅助函数与 watchman 单列。ADR-0005、0018、0019、0020 继续适用。DESIGN 与 GLOSSARY 没有新增产品行为或领域概念。

## 数据与证据边界

原始脱敏录制保留采集版本和来源；索引区分成功 schema、专用错误 schema、历史失败归一化、浏览器直传。失败归一化只证明本地失败合同，不能证明真实上游失败 body 符合成功 schema。报告的 failureGap 如实列出没有真实失败样本的 action。

默认小种子使用录制形状和明确构造的实体关系，来源及生成媒体见 tests/README。大种子仍保留规模和历史差异。World 不使用交互模板；声明的条件性回复和特定模块不可用场景用于保留既有取消、随机队列和账号测试语义，收尾仍拒绝其他未准备调用。

## 实际验证

- 最新完整 `pnpm test --coverage`：55 文件 / 824 passed、0 failed / skipped，`.reports/runs/run-RAuEpI/all/tests.json`、`migration.json` 逐项保留原 755 条、另列 69 条新增。服务端行覆盖率 96.21%、分支 78.42%，保留原 96% 行门槛。此前 823 条全过但服务端行 95.85% 的整次命令判失败；补上已知上游退出不可用时仍清 Cookie、重开未登录、只调一次上游的 App/HTTP 回归后才过门槛。随后收紧日志归因，只断言退出后新增警告，完整会话带覆盖率再过 20/20（`run-XfUy4u`）。
- 实现早期 `pnpm test`：55 文件 / 818 passed，failed 0、skipped 0；`.reports/runs/run-bxSf1K/all/tests.json`、`migration.json` 逐项保留 755 条基线，另列 63 条新增（其中 45 条来自先前交付）。之后新增的两个昵称边界由采集专项及最终 CI 覆盖；收尾又核对小曲库名称和数量一致，`run-Wa9OzU/contract/tests.json` 的 3 条通过。
- `pnpm test:contract` 的本地完整回归（新增两个昵称边界前）：7 文件 / 32 passed，`.reports/runs/run-HiF5JU/contract/tests.json`。包括错 body、错实体、重复/意外/遗漏/乱序、缺 Cookie、成功失败错分、全部技术失败 kind 和 business code=null。取消、随机操作的条件性预装均显式声明；原行为断言保留。
- HTTP：8/8，`.reports/runs/run-wLoBMv/delivery/tests.json`。包含 512 initial 返回 428、fallback 后读回、真实本机媒体内容与长度、忽略 Range 后返回完整文件供重下、reset 图片清理；媒体由本地生成，不是真歌。
- SDK 6.1.0：42 业务 action、3 辅助导入、1 Watchman 能力。355 份样本 / 52 模块：308 success-schema、1 error-schema、43 normalized-failure、3 direct-upload。原 353 份原文保留，新增未知失败与排序重读两份构造样本；索引重建一致。报告仍列出 28 个缺少真实失败样本的 action，不用合成 transport 失败冒充真实上游证据。
- 安装版 `pnpm test:sdk`（最终源代码报告 `.reports/sdk-upgrade-4PgkJQ/result.json`）与显式本地候选 `--candidate .../node_modules/hana-music-api` 的五步均退出 0。后者在 `.reports/sdk-upgrade-inoFW2/result.json`；含基线/测量版本及 module/queryKey/outcome/validation 的差异，最终源代码的显式候选五步均为 0，全部契约 37 条通过；当前兼容候选 samples/removed 均为空。原始样本、两种替身、类型和登录/搜索/曲目写入代表行为都在无私有材料的公开文件副本运行，实际检查该临时副本已删除。
- 不兼容候选实际退出 1，`.reports/sdk-upgrade-BLndEF/result.json` 与 step-1.log 记录首次样本校验失败。它没有被当成成功；默认命令不查询 latest。
- 模拟采集保存成功和失败，手机号、验证码、凭据和身份被替换，错误消息中的原值回显同样被清除；临时输出重新索引/重放一致。8 条 recording 用例覆盖正常、过期、源异常、非法 JSON 原始值、缺计数器及昵称与 JSON 键/空值同名，均检查授权删除；未调用真实上游。
- 推送后的 CI `43749785799` 在带覆盖率的曲库准备步骤发现两条失败：默认 1 秒轮询结束时仍在取 `/api/songs`，真实工作完成后才到达预设歌单停点。用原代码 + `--coverage` 复现 2 红（`run-9XFTRw`），诊断核对了 pending 请求与 held 数量；同类 6 处改用已有 `world.settle()` 等待真实任务后保留原数量/请求/行为断言，未增加时限。完整曲库文件带覆盖率回归 28/28、0 跳过（`run-0IEFfl/behavior/tests.json`），临时诊断已移除，两路增量审查无发现。其他两处直接 held 断言原本已先 settle，保留；后继慢运行又暴露三处千首状态轮询，同样改为 settle 后保留原值断言。
- 后继 CI `43751821772` 的较慢运行在另外三处状态轮询与两条整体时限上失败（815 passed / 5 failed），未把它算作交付。精准覆盖率实测相同 2 MB / 3 MB 回复十次 schema 为 1130 / 1915 ms，完整 V8 指纹为 36 / 51 ms，加入普通数据资格检查后首个样本十次合计 181 ms。现按实际 schema 对象和完整内容摘要有界复用成功证据；body 改动后匹配新内容的成功证据，未命中时重验，元数据逐次检查，不加时限。异步校验用同一次序列化的独立快照，Proxy / getter 等特殊对象不复用；`run-akr26z` 的异步错证据和 Proxy 拒绝实际 2 红，修复后合同文件带覆盖率 10/10、0 跳过（`run-RHZuBi`），含同对象改坏、null / NaN 区分。两路增量审查无剩余发现；中止的过渡全套不计作通过。
- `pnpm check`：0 errors / 0 warnings；lint、fmt:check 通过。Standards / Spec 两路只读 code-review 发现的问题均修复，复核无剩余发现。

最终 SHA、同 SHA CI 全步骤、双构建/覆盖率/HTTPS 报告和 Vercel 链接在 #99 的交付留言核对；本文件不把本地结果当作远端交付。DESIGN 与 GLOSSARY 无需改变；ADR-0018、测试/录制/浏览器指南和父 Spec 按实际责任同步。

## 作者试用边界

本票工程测试只证明数据、合同、App 与 HTTP，不证明真实控件、焦点、Android、系统选择器、真实账号或读屏。

1. 在干净 checkout 安装 lockfile 依赖后运行 `pnpm fixtures:index:check`、`pnpm sdk:report` 和 `pnpm test:contract`，应不需要私有文件。查看报告中一个 success-schema、一个 normalized-failure 和一个 direct-upload 条目，两种版本和来源应可辨认。
2. 运行 `pnpm dev:mock`，打开曲库的每个收藏专辑和歌手；默认测试专辑、歌手都能进入。打开 poems，改名后刷新仍显示新名；用 mock reset 还原即可撤销。大规模场景另选 large，缺历史详情不当成小曲库导航通过。
3. 具名扫码、空搜索、512 和失败恢复由自动化覆盖；真实网易云是否仍返回同样数据未验证。真实采集须操作者单独显式授权，限定临时歌单并撤销，默认命令不会使用作者账号。
