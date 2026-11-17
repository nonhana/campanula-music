# #44 第四步：指南成稿与旧文档迁移

本阶段开工基线为 `rewrite/v1@9f3241f12d3c2df30615e76286c05d0dd78b2df6`。执行 `_notes/website/plan.md` 第四步，并包含作者追加的完整文档迁移要求。最终提交、同 SHA CI 和 Vercel 结果在 #44 阶段评论记录；不把本地验证或历史绿灯当成当前部署验收。

## 开工范围与依据

依据 ADR-0003/0004/0006/0007/0009/0014/0015/0017/0020，核对凭据、单进程、下载与账号数据、HTTPS、导出、离线外壳、页面下载和开发隔离。只改网站正文与导航、仓库旧文档入口，不改第三步首页品牌、OPENING、View Transition 捕获等待或 demo-ready 动效。首页仅把服务器链接换为站内入口。

没有新增网易云调用、字段或 SDK 合同，不需要录制数据。改动影响指南选择、长文目录、返回链接、站内 Markdown 交叉引用和旧入口；对应验证为静态构建及链接/锚点遍历、类型/静态检查、空目录 Node 启动，不用产品业务单元测试的数量代替阅读路径证据。浏览器专项与网站 CI 接线属于第五步，真人平台部署属于第六步。

## 文档迁移清单

开工时 `docs/` 共 45 份 Markdown。按用途盘点全部目录：两份正式操作正文迁移，43 份工程决定、工作约定或证据保留。另从验收材料抽取听众操作写成使用指南，原验收记录保持原用途。README 不再维护另一套启动命令。

| 来源                                                                                                             | 去向或保留理由                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/self-hosting.md`                                                                                           | 正文拆入 `/guide/server/`、`/guide/docker/`、`/guide/node/`、`/guide/upgrade/`。原路径与七个重要章节层级保留，正文只链接新来源。                                                                   |
| `docs/development.md`                                                                                            | 对外操作完整迁到独立 `/development/`：获取源码、真实/mock 启动、首次授权、证书复用、HTTP/端口/代理排错、旧入口迁移、网站构建和检查。原七个章节锚点保留。底层进程装配细节继续由源码和测试记录负责。 |
| `docs/acceptance/issue-101.md` 中的安装离线试用                                                                  | 听众操作重写为 `/guide/listen/`，补登录、Android Chrome/电脑 Chrome/Edge 安装、完成下载的判定、断网重开、数据与导出。原文件保留候选/PWA/发布门禁证据，官网不再外跳到它。                           |
| `README.md`                                                                                                      | 部署、听歌、升级、本地开发均直达同仓库新正文；保留原「开发」「部署」「License」标题及项目/设计/术语/ADR 源码入口。修掉“v1 还不能使用”的过时笼统状态。                                              |
| `docs/adr/*.md`，20 份，0001 至 0020                                                                             | 全部保留。它们是带决策与后果的工程权威来源，部分含被替代的历史决定，不能改写成当前用户教程或复制出第二份决定。                                                                                     |
| `docs/agents/{browser,delivery,domain,issue-template,issue-tracker,mock,overlay,testing,triage-labels}.md`，9 份 | 全部保留。这些是代理与维护者的工作约定、测试接入与建票流程，不是听众或站长的操作正文。                                                                                                             |
| `docs/prototype/{dnd,logic,visual}.md`，3 份                                                                     | 全部保留。它们记录作者选定方案与历史原型结论，供设计和实现查证，不是当前产品使用说明。                                                                                                             |
| `docs/acceptance/{issue-87,issue-88,issue-99,issue-100,issue-101,issue-103,issue-104}.md`，7 份                  | 全部保留。包含测试矩阵、专项核验、平台边界及精确人工检查，保留证据完整性，不作为站内教程替身。                                                                                                     |
| `docs/acceptance/runs/{issue-87,issue-87-stable-v4,issue-44-step2,issue-44-step3}.md`，4 份                      | 全部保留。它们绑定历史提交和验证结果，不能通过改写迁成现行承诺；新增本记录也只承担证据用途。                                                                                                       |

官网正文、导航和文章交叉引用均走站内；右上角 GitHub 和明确查看源码的引用保留。Vercel 的固定代码来源与 `.env.example` 参数是代码来源，不是用仓库 Markdown 代替教程。媒体许可证与重建登记属于资源来源，仍在 `website/public/media/README.md`，不混入部署操作。

## 实现接线

- 新正文：服务器共用密钥/转发头/HTTPS；Docker 源码自建和公开镜像发布前置；Node 独立发布目录、前台与 systemd 用户服务；三种方式升级回退；安装、下载、断网和导出；独立本地开发。
- Vercel 补充按项目显示值填写 Cloudflare DNS、仅 DNS 状态与官方来源；保持必填密钥、可选真实 IP、10004 的不确定边界。仓库阅读可走完整手动导入，生成命令也在普通文字中可读。
- `content-links.mts` 在构建时把内容目录里的相对 `.md/.mdx` 文件链接转成文章地址。源码里的链接可直接在 GitHub 阅读；站内不必跳出网站。保留章节 hash，目录外的真正源码链接仍按外链处理。
- 目录与页尾返回适用于所有文章；首页服务器入口和指南选择均到 `/guide/server/`，安装、升级、开发均有明确入口。
- 增加中文 404 阅读出口，补齐 `#main`，标记 noindex，canonical 使用真实的 `404.html` 产物地址。

## 事实核验与外部边界

2026-11-18 用 `gh repo view` 确认默认分支仍是 `master`。全部当前源码操作显式选 `rewrite/v1`；没有修改默认分支或发布播放器版本。

匿名读取 GHCR `/tags/list` 只有 `v0.0.1`、`latest`。两次 `docker buildx imagetools inspect` 均为清单 `sha256:c8c2d16c61d24881dee3374c8f6e3107b88c14281b066d2cb38010fffdf1c549`，含 `linux/amd64` 和 `linux/arm64`；两架构 config 的 revision 都是 `6886a015edad082490b23c6079428827e88db9bb`。它不是本阶段 v1，不作为新版运行证据。

**当前源码自建命令与已发布镜像验收分开。** 正文给出当前 Dockerfile 的源码构建路径、revision 标签、环境文件和回退办法；本机按原命令尝试两次，均在 Docker Hub `docker/dockerfile:1` 的匿名认证端点返回 EOF，尚未执行项目构建，未取得本轮新镜像运行证据。Node 路线已经独立跑通。第六步“按已发布同版 GHCR 标签从零部署”的验收仍需项目先发布适用版本，不能用源码方案或旧镜像算完成。

源码复核：`credentials.ts` 的密钥下限和 Secure/httpOnly Cookie、`hooks.server.ts` 的缺密钥日志和 API 错误、`+layout.svelte` 的安全上下文提示、`netease/config.ts` 的可选 realIP、当前 adapter-node 的协议/主机转发头与 ORIGIN 行为、App 本机数据与 SW 生命周期。新文档不再沿用“ORIGIN 永远无效”或“改 IP 必然解决 10004”的旧说法。

外部操作分别查阅 Vercel Deploy Button/环境变量/域名/Instant Rollback、Cloudflare DNS 状态、Caddy 安装/自动 HTTPS/转发头、Nginx 代理、GitHub Container Registry、Chrome/Edge 安装、Node/systemd 官方页面。正文就近链接来源；没有以查过官方文档冒充真实平台部署。

## 实际验证

本机原始输出在 `.reports/website-step4/`，均不含真实 Cookie 或密钥。只读外部镜像资料为 `ghcr-tags.json`、`ghcr-config.json`、两份 imagetools 输出。

- 空目录 Git clone 当前 v1 基线，无 `_notes/`、私有 `.env` 或预装依赖。Node `26.13.1`、pnpm `12.18.0` 按锁安装和构建，独立运行目录仅带 `build/`、`package.json`，没有 node_modules。教程中主目录发布路径替换为隔离临时根，其余构建/启动命令保持同义。
- 同一份产物测试缺密钥、合格密钥、短密钥、再次修复四次 HTTP 启动；分别得到 500/200/500/200，错误为 `cookieSecretMissing`，成功为 `{"account":null}`，并传真实格式的协议/域名转发头。修密钥不重建产物。日志、报告为 `node-clean.log`、`node-smoke.json`。未登录真实账号、未安装系统服务或证书。
- 网站静态构建、内容/旧入口的相对路径与章节锚点遍历、原有标题保留检查、站外链接属性检查及作者预览与 dist 对齐，结果在阶段评论。没有操作原型 4321 或停止原有 4322。
- 根 `pnpm check`、网站 TypeScript、`pnpm lint`、`pnpm fmt` / `fmt:check`、中文标点检查与 `git diff --check`，结果以最终阶段评论为准。
- 环境文件生成命令实际检查：生成 44 字符密钥、文件权限 600，第二次执行拒绝覆盖且原文件摘要不变；没有向输出打印密钥。
- Standards 首轮硬性违规与 smell 建议均 0。Spec 首轮指出 Vercel 复制仓库的升级步骤缺失，已补全独立克隆、备份分支、导入上游文件、检查并推送自己的生产分支；用无共同历史的独立 Git fixture 核对导入后文件树等于新版、旧文件删除、旧分支和提交可恢复。最终复核结果在阶段评论。

## 作者试用与第五步接线

1. 尚未由自动化证明：真实账号登录、Android/桌面系统安装、下载后的飞行模式重开、真实 systemd 常驻、独立 Vercel/Docker 域名部署、升级后的真实会话与本机下载。第六步按新正文从零验证，适用 GHCR 发布仍是前置。
2. 本机 `http://127.0.0.1:4322/` 进入「自己的服务器」，应留在站内；从部署方式分别进入 Vercel、服务器、安装、升级、本地开发，应能阅读正文并由文内章节继续。看到跳去旧 `self-hosting.md` 或验收 issue 正文即失败。
3. 从仓库 README、旧 `docs/self-hosting.md`、旧 `docs/development.md` 进入新来源，应能读同一份步骤；旧章节地址仍存在。按 Node 教程搭隔离实例，缺密钥应能通过配置文件修复，不能要求清浏览器数据。
4. 可选手机宽度、Tab/目录/Escape、返回阅读位置及减少动态：仍用既有文章外壳；实际观感、手机触感未由本轮人工验收。上一阶段品牌与演示观感也仍等待作者判断。

第五步使用 `website/dist/` 同一静态候选；新增 `/guide/{server,docker,node,upgrade,listen}/`、`/development/` 和中文 `/404.html`。正文相对源链接经 `website/content-links.mts` 转换，新增根内容/官网配置/共享代码变化都应触发网站回归。应纳入所有本地文章/锚点/资源、目录和返回、无 JS、外链、试听与隔离边界检查，并建立境外预览；本阶段未实施该 CI 接线或正式域名切换。
