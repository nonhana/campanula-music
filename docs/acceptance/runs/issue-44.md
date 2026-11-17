# #44 第六步：真实部署与上线条件

2026-11-18，开工基线 `rewrite/v1@c6dbf6bfb5dde858e25d2dceec8e54a615fd9e5e`。本轮从第五步的境外预览开始，分别执行能独立推进的部署和核验。最终提交、同 SHA CI/Vercel、修订正文的预览及实际进度在 #44 阶段评论记录。票保持开启。

## 当前结果

| 项目                  | 这次实际做到哪里                                                                              | 还缺什么                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Vercel 从按钮创建     | 新私有仓库与独立项目已创建，已比较复制后的完整 Git tree，配置了根播放器构建命令与独立测试密钥 | 首次 Deploy 出现平台身份验证，尚无部署记录；需作者完成验证，再检查实际函数地区、域名证书和正常登录页 |
| GHCR 正式 Docker 路线 | 重新读取公开标签、清单和两架构 revision                                                       | 仍只有旧 `latest` / `v0.0.1`，需要适用的 v1 发布镜像，以及可配置公网 HTTPS 的干净 Docker 主机        |
| 源码容器补充诊断      | 当前源码在本机缓存基础镜像上完成构建，容器匿名账号接口与登录页正常，缺密钥提示符合正文        | 原样教程构建仍卡 Docker Hub 认证 EOF；诊断没有证明干净拉取、发布镜像或公网 HTTPS                     |
| Netlify 同候选        | 徽标仍关闭；Python 全量 730 份响应一致，Node 严格工具与 Chromium 仍观察到 HTML 差异           | 响应随客户端请求路径出现差异，严格文件一致性尚未通过                                                 |
| 官网域名              | 读取并保存 Cloudflare 原记录、当前 HTTPS 响应和原目标响应                                     | 未切 DNS，旧托管绑定的归属和可用回退部署尚未确认                                                     |

## 采用的正文与隔离范围

验收者读取 [第五步预览的 Vercel 教程](https://6afc9f28bc7eaf69f46a6a96--campanula-music-website.netlify.app/guide/vercel/)和同站 Docker、服务器正文。该轮文档源为 `c6dbf6b`，静态候选共 730 份文件，摘要 `b77c8f9b135cc3e8fe67edcde9fc3edfeddc11a9ad1d16525f47e51fdb42b569`，上传 ZIP 的 SHA-256 为 `8eb452e1c60be33e6f3586782c4cba870084afeb7bd796e7ea524a9507b1798a`。本轮正文修订后的候选单独记录，不混用这份清单。

遵循 ADR-0003/0009/0019/0020，测试密钥仅用于新项目和受限临时环境文件，不使用真实账号、原项目密钥或私人实例。仓库 `.vercel` 绑定、既有项目、官网 DNS 和作者 4321/4322 预览均未改动。没有创建播放器 Release/tag、上传镜像或修改默认分支。

本轮没有新增网易云字段、SDK 调用或产品代码。文档修订影响 Vercel 文章阅读、目录、复制、链接与部署步骤，对应现有官网产物/阅读回归；平台实际结果另记。真人登录、安装、下载与升级不由合成测试证明。

## Vercel：复制内容已核对，部署等待本人验证

从线上按钮打开 Vercel，在 `nonhanas-projects` 创建 `campanula-website-acceptance-20261118`，项目 ID 为 `prj_8ARCZiDPxwfnZdukDg9JdqQAQnWE`。新私有仓库为 `nonhana/campanula-website-acceptance-20261118`，与原仓库分开。

按钮指定源提交 `4fb955c43a070f093ef45c883d906956a1b2cd3a`，源 tree 为 `0675c293e1e6a3e34609226ca8b977155bd52ba6`。复制后的初始提交为 `50a0afc486777be41553deb294043acabcf09fcb`，tree 为 `f28ac78d792490b94808eea485d503ec54239568`。在独立临时 clone 引入源提交后比较完整 diff：四份 `.github/workflows/*.yml` 被省略，`CLAUDE.md` 和 `.claude/skills/campanula-ui-acceptance` 从符号链接变成相同 blob 的普通文件，其余内容一致。`src/`、`static/`、构建配置、Dockerfile、包清单与锁文件没有差异。

复制表单显示 `master`，不能据此判断复制了哪个版本；实际文件证明这次采用了固定 v1 源码。该固定提交早于本轮文档 SHA，不把它写成当前 HEAD。完整源记录在 `.reports/website-step6/vercel-source.json` 与 `vercel-source-diff.txt`。

实际页面在 Create 后只显示必填环境变量，没有构建设置。已据此修正教程：从项目列表另开 **Settings → Build and Deployment**，确认根目录留空、SvelteKit，打开两个 Override 并保存 `pnpm build`、`pnpm install --frozen-lockfile`。在新项目实走这段并保存设置，截图为 `.reports/website-step6/vercel-build-settings.png`。正文也补了平台要求本人验证时的操作，后续必须从修订预览重走受影响步骤。

首次 Deploy 后，页面显示 **Verify Your Identity**，要求验证器当前六位码。该步骤留给作者；未读取验证器、未代填验证码，也没有换用 API/CLI 绕过。截止本记录，部署列表为空，故没有声称 Ready、香港函数运行、HTTPS 登录成功或真实登录成功。

只在新项目添加了验收域名 `campanula-acceptance-20261118.caelum.moe`；Vercel 返回域名归属 verified，Cloudflare 查询确认该名字原先没有记录。本轮尚未添加其 DNS，verified 不等于路由和证书已就绪。身份验证完成后，先从修订预览核对设置、继续原部署，再按 Domains 显示的实际目标配置这个新子域名，检查证书、匿名账号接口和登录页。

## Docker：发布前置与补充诊断分开

本轮 GHCR `/tags/list` 仍只有 `v0.0.1`、`latest`。清单仍为 `sha256:c8c2d16c61d24881dee3374c8f6e3107b88c14281b066d2cb38010fffdf1c549`，`linux/amd64` 和 `linux/arm64` 的 revision 都是 `6886a015edad082490b23c6079428827e88db9bb`。原始结果在 `.reports/website-step6/ghcr-{tags,index,revisions}.json`。未拉旧程序冒充 v1。

源码补充尝试在新的 `/tmp/campanula-step6-source-20261118` clone 执行原样教程的 `docker build --pull`，仍于 `docker/dockerfile:1` 的 Docker Hub 匿名认证请求返回 EOF，项目构建未开始，日志为 `docker-build.log`。没有修改作者 Docker 全局代理或镜像源。

随后仅为定位阻塞层，在报告目录复制一份省略首行外部 syntax 指令的 Dockerfile，使用本机已经缓存的 `node:26-alpine`，关闭强制拉取。此诊断改变了构建前置，不能算原教程通过。Docker 官方文档提到的 `BUILDKIT_SYNTAX=dockerfile.v0` 在本机被当成外部镜像名，亦未成功；失败日志保留，不把该参数写成可用教程。

缓存诊断完成当前源码的依赖安装和 Node 产物构建，得到本地镜像 ID `sha256:d1f7ba7a554569cd0c82b81c902e4bc2039a7522e939e5d5164b6465755a9617`，架构 `linux/arm64`，revision 为完整 `c6dbf6b`，运行用户为 `node`。缓存基础镜像的 registry digest 为 `node@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94`；本地镜像 ID 不是 GHCR 发布清单 digest。

全新容器只映射回环端口。配置测试密钥后 `/api/account` 返回 200 和 `{"account":null}`，独立 Chromium 显示品牌、扫码/短信登录选项和获取验证码按钮，没有填手机号或登录。另起无密钥容器，接口返回 500 / `cookieSecretMissing`，日志报告缺少 `COOKIE_SECRET`。证据为 `docker-cached-diagnostic.log`、`docker-local-browser.json`、`docker-local-login.png`、`docker-missing-http.txt` 和 `docker-missing.log`。localhost 被浏览器视为安全上下文，不能据此声称公网 HTTPS 已验收。

正式 Docker 路线仍需项目发布适用 v1 镜像，再在有公网域名、80/443 和证书条件的干净主机照正文拉取同版 digest。当前没有提供这样的远端主机，不能拿本机容器或临时自签证书代替。

## 官网候选、DNS 与回退准备

Netlify 项目 `campanula-music-website` 的徽标仍为关闭，管理页显示 “The badge is not shown on this project.”。查阅官方徽标文档、General 设置和公开 OpenAPI，没有查到可核实的托管注释独立开关；没有改套餐、关闭安全保护或增加响应改写。

对第五步同一部署再次执行永久严格工具，仍退出 1。Python urllib 全量下载比较却得到 730 份文件全部一致，结果为 `.reports/website-step6/netlify-current-files.json`。随后对同一 `404.html` 分别重验：Python 得到 14,668 字节、无注释，摘要与候选一致；Node 默认请求、只改成 Python/Chrome User-Agent、加 `Cache-Control: no-transform`，以及独立 Chromium 的实际导航，都得到 14,994 字节，仍多 326 字节托管注释。仅更改 User-Agent 没有消除差异，尚未确定具体的传输或平台判定条件。原始响应和响应头见 `netlify-request-variants.json`、`netlify-{python,browser}-response.{json,html}`。

第五步的 Node 全量诊断曾得到 716 份非 HTML 一致、14 份 HTML 不一致；本轮保留与它不同的 Python 全量结果，没有用其中一个客户端替代另一个，也没有修改永久工具、剥注释或归一化后宣称原字节一致。没有重复上传原 ZIP。修订正文发布的预览只作为可阅读的后续候选，仍须独立通过严格核验后才可切正式域名。

读取 Cloudflare `caelum.moe` zone 后，保存原记录 `.reports/website-step6/dns-before.json`：`campanula.caelum.moe` 为 CNAME，目标 `campanula.netlify.app`，TTL `1`（自动），`proxied=true`，记录 ID `e0981c83add8286f58ed47c133e6ad10`，注释 `campanula music netlify`。zone 归属当前连接的 `hana` 账号，现有连接能读到记录。

官网 HTTPS 当前返回 404。原目标 `https://campanula.netlify.app/` 返回 200，标题为「API 使用 demo」，响应中的 site ID 为 `2db650ff-9f61-4e5b-8ca9-5b34724080d4`，不在此次可见的已拥有 Campanula 项目列表中。无法确认其托管归属或 `campanula.caelum.moe` 的原绑定，所以恢复原 CNAME 只能恢复目前的 DNS 状态，尚无已验证可用的旧官网部署可回退。两份响应和响应头均保存在报告目录。

正式切换前须重新读取并核对这条记录，补齐旧绑定归属和可用回退部署。仅在 Vercel、同版 GHCR/Docker 两条正式路线和静态候选条件都通过后，才把官网域名绑定到已验静态部署、检查 HTTPS/首页/文章深链/试听/404，并将 README 换成正式 URL。目前保留境外预览，README 继续提供同仓库正文入口。

## 作者接续与交付检查

1. 本人先在保留的 Vercel **Verify Your Identity** 页面完成验证，不发送验证码或密钥。实现者随后继续原新项目部署与临时子域名核验。
2. 项目发布适用的 v1 GHCR 标签后，在干净公网 Docker 主机重新照 Docker 与服务器正文执行，记录标签、两架构清单、拉取 digest、HTTPS 登录页和实际运行 revision。
3. 平台候选条件和两条正式路线通过后，再补旧官网托管归属与回退目标，执行正式 DNS 切换。当前不要把预览地址替换成已上线的正式地址。
4. 真实网易云登录、Android/桌面安装、下载后断网重开、升级保留会话与下载、系统返回、TalkBack、axe incomplete 及实际视觉判断，继续由作者按既有清单在自己的实例和设备验收。自动化和本轮容器诊断没有替代这些项目。

本轮受影响检查、两路 code-review 与最终 SHA 的远端结果在阶段评论中逐项列出。所有未满足条件继续保留，不关闭 #44。
