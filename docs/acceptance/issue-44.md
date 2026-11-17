# 官网静态候选与上线验收

实施计划第五步将官网回归、日常 CI 和独立 Netlify 预览接起来。最终源 SHA、CI、Vercel、Netlify 部署 ID、URL 和静态产物摘要以 #44 的阶段评论为准；每次构建的 demo 版本文件会变化，不能用另一轮构建的清单替代。

## 第五步的验证

1. 从根按唯一锁文件安装依赖，运行 `pnpm test:browser:install` 和 `pnpm docs:test`。根命令先构建网站，独立 Playwright 再从自启回环静态服务读取同一份 `website/dist`，结束收尾自己的进程。作者的原型 4321、预览 4322 和个人浏览器不参与此套件。
2. `artifact.spec.ts` 遍历全部 HTML、本地链接/锚点/图片/脚本/样式入口，核对 canonical、sitemap、404、demo noindex、文档源链接的站内转换及指南不含账号载荷。`reading.spec.ts` 在两个视口检查所有文章、目录、复制、返回焦点/位置、无脚本阅读和降级。`motion.spec.ts` 在开场和真实跨文档转场期间观察正常与减少动态策略，并用真实 Tab 进出 iframe。`demo.spec.ts` 操作真实播放、切歌、歌词翻译、队列、曲库、深链与失败重试，保留原生 Audio 引用观察离页后暂停且来源已清空，检查存储、广播、Cookie、SW 和未开放服务的隔离。
3. 所有浏览器执行只允许当前静态 origin；第三方请求、WebSocket、SW 或未处理页面异常失败。测试媒体是 `website/public/media` 登记的公开原创素材，没有使用真实账号。产品的业务、对比度和候选发布门禁保持原范围。
4. axe 的零 violations 是自动门禁。`tests/website/a11y-manual.json` 保存首轮 `run-UD28vI` 等三轮的 166 条精确 incomplete 观察，按视口、状态、target 和 failureSummary 匹配，新增节点或原因失败。这些来自缩放 iframe 中的图片背景、渐变、歌词覆盖层、被其他元素遮住的文本与过短时间文字；原始 axe JSON 可逐节点查阅。它们仍需要人工判断，不能据此声称颜色对比度或读屏已验收，也没有修改原播放器的 incomplete 清单。
5. 日常计划对官网、网站测试、根工具链、Uno、静态资源与 `src/` 变化增加 `website` 分片。网站 spec 有独立套件，不进入 Vitest 或播放器 browser 项目；触发范围和归属由 `ci-plan.test.ts` 回归。回执核对同 SHA、全部文件实际执行、无跳过/重试、静态产物摘要；CI 保存 `website-candidate` 中的 dist、清单、trace、截图和 axe。根播放器仍执行自己的构建与候选验证。

## 独立 Netlify 预览

官网项目为 `campanula-music-website`，site ID `d7dace49-41f9-4b37-853c-f293f465a249`，与作者播放器及既有其他 Netlify 站独立。根 `netlify.toml` 固定根锁安装、`pnpm docs:build` 和仅发布 `website/dist`，不带运行密钥或服务端函数。`.netlify` 已忽略。

官方 Netlify 插件负责读取团队和创建项目；当前插件没有本地文件上传工具，本机也没有 CLI 登录凭据，因此手动上传使用已登录的 Netlify 管理界面。上传前将已测试的 dist 原样打 ZIP，平台只接收静态文件，不触发另一次构建。使用平台域名，不绑定 `campanula.caelum.moe`。如果以后改由平台构建，必须用该轮文件清单核对线上文件后才能提升候选。

上传后显式运行 `tests/website/verify-preview.mts`，下载每份文件核对 SHA-256，另用独立 Chromium 在桌面/手机操作播放与下一首，进入指南、刷新文章深链并检查 404。线上报告保留源 SHA、总摘要、逐文件结果、截图和外部请求清单。手动上传不自动把 Git commit 记进平台元数据，源对应关系由已验清单和阶段记录建立。

## 作者试用与第六步

尚未验收的项目放在前面：真实账号登录、Android/系统安装与返回、TalkBack、真实下载后的断网重开、升级后会话与下载保留、两次独立 Vercel/Docker 从零部署、正式域名与 DNS 切换。当前 GHCR 适用的同版发布镜像仍是第六步前置，不用旧 `latest/v0.0.1` 或源码自建冒充该发布验收；本阶段不发播放器版本、不改默认分支或作者实例。

作者可打开阶段评论的 Netlify 预览，在手机/桌面各试听一次，观察首次开场和品牌随指南往返是否自然，再从「部署指南」按文章部署。键盘可选：Tab 从官网进入试听，再连续 Tab 或 Shift+Tab 离开；手机目录按 Enter 打开、Escape 关闭并回到目录按钮。系统减少动态后重复往返，应只见短淡变；正文阅读和入口保持完整。发现颜色难辨、焦点消失、返回重播开场或离页仍响时，记录具体页面与操作。

自动化已经覆盖的失败/重试、深链、无 JS、网络与存储隔离不要求重复人工验证。实际审美、手机触感和上面列出的账号/设备/发布条件保持未验；#44 继续开启。第六步已开始，独立部署、候选差异、DNS 原值与接续条件见[真实部署记录](./runs/issue-44.md)。
