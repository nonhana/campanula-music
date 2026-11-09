# #87 正式版请求层重构执行记录

作者于 2026-11-09 明确要求升级 npm 4.0.0 并重构 netease.ts 及相关文件。本轮基线仍是 rewrite/v1 @ f60fe316079dd2f5014a50eab522bb657cd14088，叠加上一轮未提交迁移；所有启动前文件另存本机 `_notes/acceptance/issue-87/stable-v4/before/`，不覆盖旧证据。

已从 registry 核对 4.0.0 / latest=4.0.0，发布 gitHead=344d28ab81df3546e41254cb3551b642ec097c35，Node>=24、根 ESM 与独立 Watchman 导出不变。catalog 精确固定 4.0.0，继续通过 registry 安装。

请求层保持唯一 invokeModule，使用公开 ModuleQueryOf；设备/会话逐次传入，token 只接收当次字符串，取消不传。独立 netease-error.ts 由 netease/respond/session/logout 直接共享；返回/续期/退出继续按相同 failure/body 分支处理。mock 失败改成 SDK 4 的标准三字段对象，替身响应类型复用 NcmApiResponse。

首次类型检查发现 SdkQueryOf 未从 SDK 根导出、logout 仍引用旧错误位置，已改用公开 ModuleQueryOf 并更新全部引用；修正后 check 为 0 错误/0 警告。此为实现期间工具错误，不充当行为 red；本次为保留行为的重构，复用 App/HTTP/会话回归。

正式版专项和完整门禁均已完成，通过结果如下。此前 next.0 的 632 项成功不改标为本轮结果。真实账号、部署和 AC-08/09 仍未执行/未授权；未提交、推送、关票或启动后继。

## 最终证据

- 当前内容指纹 `ee6d46bd9f5b9d2261819b9e649a61821e03dd7cfb9fa9d77aa376ee0d926add`，包含所有受版本管理及非忽略新文件，排除 runs；tracked diff 指纹 `64d70833703bf173e23cb56e8cdee19145f9fbf0c5efe912833c7428c1b26e2f`。所有 14 条最终命令的 diff 一致。
- npm 4.0.0 tarball SHA-256 `a4b91277c71de8f80dae84329091f30ab44f6ead6f957df75c974976a8528cb2`，SRI `sha512-i/aXJrXqeba87KR2caD0f+xpjpbh1a9P8N+61VktgPDj66TUkaMG0Q8F2CTcK+6YVSeeMmLKqKUpMiInvpZ5wA==`；registry/lock 一致，安装内容 713 文件与 archive 逐字节相同。
- 8 个专项文件 119/119；全量 42 文件 632/632、零失败/错误/跳过（junit.xml）。覆盖登录、续期、退出、HTTP 错误映射、收藏 token、失败回滚、账号隔离及既有曲库行为。
- check、lint（327 文件设计令牌）、端点检查（40 路由/42 处理函数/42 端点）、VERCEL=1 build、Node build、生产隔离（2906 文件）、fixture 索引检查（346 份/52 模块）全成功。两构建串行。
- Node/Bun 分别用实际安装包执行读取/取消的显式字符串与 provider、废弃配置键拒绝、SSR 环境边界，各 13 个场景成功；最终 fetcher 替代网络，不访问真实上游。真实 App 浏览器适配器搭配合成 DOM 的正常 8 场景/mock 2 场景成功，不能当真实页面。
- mock smoke 成功：自动登录、同步 4,984 首、打开歌单、写入、刷新、重置。本票启动的 5174 服务已停止，未动真实账号。
- 本轮运行 argv/时间/退出码/testedHead/diff 和原始输出逐项保存在上述本机目录，汇总 final-gates.json；初始类型检查错误保留为失败轮次，不冒充 red/green。
- 原最早 6 项改动均保留：env/motion/uno 逐字节不变；netease 多行导入原块保留；respond/session 在恢复本轮导入变化后与原备份逐字节一致。未暂存、提交、推送、部署或关票。

独立规范轴、需求轴与专门风格审查已完成最终同候选复核，均无遗留代码发现，原文分别为本机 review-standards.md、review-spec.md、review-style.md。原票 AC-08/09 的当次外部验收仍待作者，不因正式包发布而自动完成；试用清单沿用历史记录，但执行时必须确认部署是本次 4.0.0 候选。

本轮仅完成已授权的稳定版升级与本地重构。上一轮 ticket-only.patch 是 next.0 历史候选，不能用于当前交付；正式版已另备 ticket-only.patch，仍仅供后续获授权时使用，不暂存原作者改动。

## 2026-11-09 提交与推送授权

作者明确要求“好的，提交并推送。”，已授权在真实页面验收之前提交本票并普通推送 rewrite/v1，触发既有 Git 部署流程。AC-08/09 仍待作者当次真实验收，保持 #87 open，不启动后继。此项覆盖前文“等待提交/推送授权”的历史状态，不扩大为真实账号操作授权。

提交范围沿已审查的正式版候选，排除最早 6 项作者改动；提交前发现 browser.ts 又有一处纯命名调整，同样保留在本机、不顺带提交。工作区原文件不重置、不 stash。提交检查照常执行 lint-staged 的项目任务，使用不备份、不隐藏局部改动、改动即失败的选项，防止钩子把未暂存内容一起放入提交。实际提交/远端回执记在本机 closeout.json 与 #87 交付评论，本文不预写未执行结果。
