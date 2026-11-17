# #44 第二步：阅读体验阶段记录

2026-11-17。基线 `rewrite/v1@4fb955c43a070f093ef45c883d906956a1b2cd3a`，对应已批准计划第二步。最终交付提交与远端 CI 链接记录在 #44 的本阶段留言。#44 保持打开。

## 实际改动与共享源

- 正式站提供 `/` 首页入口、`/guide/` 部署选择、`/guide/vercel/` 教程。部署选择沿用应用设置页的 640px 单栏、晨光底、白色整行入口和安装/离线文字入口。服务器和设备说明指向仓库现有文件，不建立尚未撰写的文章路径。
- `@astrojs/svelte 9.1.6` 与已锁定 Astro 7、Svelte 5 匹配；依赖仍在根 catalog、唯一包清单和锁文件中。根播放器命令、适配器和部署目标保持原用途。
- `website/astro.config.mts` 直接消费根 `uno.config.mts`，字体、色板、字号阶梯、圆角、阴影、焦点和动效来自同一源。共享类名位于 `src/lib/components/ui/control-styles.ts`，应用 `Button.svelte`、设置页和官网同时消费；明确扫描该 TS 文件，并用 Uno 的 include 标记避免默认过滤。网站扫描路径相对配置文件解析成绝对路径，禁用二次自动加载配置覆盖。
- 顶栏使用真实 `Brand.svelte`；复制命令使用真实 `Button.svelte`，两者在构建时渲染 HTML。站内导航保持 `<a>`。只给需要处理拖动的真实 `Scrollbar.svelte` 加载 Svelte 水合；关闭 JavaScript 时恢复页面原生滚动条，代码块保留原生横向滚动。
- Starlight 管内容、目录数据和标题锚点，组件覆盖提供 Campanula 的页面外壳。正文约 640px；桌面右侧章节、手机原生可开合目录，桌面也保留开关以支持无 JS 跨宽度操作。
- 原生跨文档 View Transitions 的 opt-in 内联到每页 head，避免外部样式慢到时取消转场；根快照承载正文，顶栏和滚动条单独命名保持稳定。方向消费应用的 up/down/fade 类型及时长、曲线；原生历史负责滚动，保存入口焦点，页面返回链接跳回最近父页记录，跨过本篇的章节历史。
- Vercel 教程用 MDX 放置真正的静态控件，正文由本次成稿：准备、生成并保留密钥、创建播放器根项目、检查版本与 hkg1、配置自己的 DNS/HTTPS、打开登录页及排错，保留手动导入方式。

## 验证范围与结果

所有浏览器使用仓库固定 Playwright 的配套 Chromium、空 context 和自有回环服务。网站测试复制同一份 `website/dist` 到独立目录再启动随机端口，结束关闭；不依赖 4321、4322、作者浏览器、账号或预先启动的后端。本阶段脚本在 `.reports/website-step2/`，没有提前接入第五步的网站测试命令或 CI 专项。

| 接入点                 | 实际结果                                                                                                                                                                                           | 证据                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 静态站安装、构建和类型 | `pnpm install --frozen-lockfile`、`pnpm docs:build`、网站 tsc 通过；清除网站生成缓存后重建，确认共享背景和胶囊布局进入产物                                                                         | `.reports/website-step2/build-final.log`                              |
| 播放器构建、静态检查   | `pnpm build`、`pnpm check`、网站 tsc、`pnpm lint`、`pnpm fmt:check`、`git diff --check` 通过；Svelte autofixer 对 Button/设置页无问题                                                              | `.reports/website-step2/check.log`、`lint.log`                        |
| 共享控件对播放器的影响 | `pnpm test:browser` 定向 keyboard、player、core、save、login，桌面/手机共 26/26 通过。覆盖设置→退出、登录、保存成功/失败、播放/切歌/歌词/队列/滑块、模态焦点及归还                                 | `.reports/browser/run-Ncsved/`                                        |
| 网站读者操作           | 阅读候选 24/24 通过：1440×900、390×844，从首页进入两页、全部章节锚点、深链刷新、浏览器进退阅读位置和入口焦点、两级页面返回、复制成功/拒绝、正文选字、手机目录键盘及焦点、无 JS、768/1024/1100 边界 | `.reports/website-step2/reading-2026-11-17T12-59-51-142Z/report.json` |
| 滚动与无 JS 边界       | 真鼠标拖应用滚动条后页面位置改变；无 JS 从手机收起目录，加宽到桌面后仍能用键盘展开；1100px 目录右缘留 24px；手机首页留白实际测量                                                                   | 同一最终 report 与 screenshots                                        |
| 动效实测               | 正常进 up、退 down；360ms 进入/200ms 退出、60ms 交叠、16px/8px、真实两条曲线，顶栏 top=0 且独立快照；0/120/240/420ms 暂停采样。减少动态只有 150ms 淡变，没有位移动画                               | 同目录 `native-up-frames.json`、`native-up-*ms.png`、trace            |
| 无障碍和边界           | 部署选择、教程、手机打开目录等 5 个 axe 场景均 violations=0、incomplete=0。浏览器/HTTP 错误=0、外部请求=0、SW 注册=0，无 API/mock/demo 请求                                                        | 同目录 `axe-*.json` 与 report                                         |
| 两路只读审查           | Standards 首轮 2 项、Spec 首轮 2 项：修正首页 padding 范围、补真实滚动条、保留桌面目录开关、限制右侧目录宽度。复核各 0 剩余                                                                        | 本次聊天审查记录；浏览器另补真实操作断言                              |

最终网站报告目录保存了静态候选、逐文件 SHA256 清单、桌面/手机 trace、截图和 axe 原始结果。24 项通过后，仅把桌面目录开关的焦点环移到行内，避免被滚动容器裁切；这次 CSS 调整另做定向键盘、截图和 axe 复验，最终产物清单单列为 `final-candidate-manifest.json`，不与前一份完整阅读候选混用。390px 可信触摸事件还实际走过首页→部署选择→教程→目录→域名：目录关闭、目标标题 top=88，触摸拖滚动条使 scrollY 从 150 到 860；补充证据为同目录 `touch.json`、`phone-touch-trace.zip`。截图逐张查看；首轮缺失共享样式和首页贴边的截图只作诊断，交付引用上表最终 run。

## 首轮 CI 失败与修复

首轮提交 `cb7d068` 的 [CI 44089234511](https://github.com/nonhana/campanula-music/actions/runs/44089234511) 在桌面 `low-vision.spec.ts` 的 200% 文字场景失败。保留原场景和几何断言，补上歌单标签 `aria-selected=true` 的等待后，本机稳定复现相同九段文字越界；原来的等待可能先命中尚未切走的「综合」列表，随后新列表没有被放大，形成假通过。

尺寸诊断及父 `4fb955c` 的 src/static 对照均显示：搜索歌单结果固定 64px，两行放大后的文字共 80px，会超出自己的行。修复只将行与链接改成最小 64px、链接上下各 8px；普通字号仍 64px，200% 时自然长到 96px，九段越界归零。父对照使用同一隔离工具链，只比较父拥有的产品源码，不冒充父提交旧依赖的完整重装。

回归包括桌面/手机两条定向 200% 用例及整份低视力文件的 14 条操作；Svelte autofixer、静态检查和追加只读审查通过。诊断、前后尺寸、截图、trace、失败日志及正式回归分别保存在 `.reports/website-step2/lowvision/diagnosis.md`、`.reports/browser/run-mnEJJy/`、`.reports/browser/run-tLQ2vg/`、`.reports/browser/run-WEu26v/`。网站重建后逐文件比较，354 份产物均与已验的最终网站候选相同，证据为 `.reports/website-step2/website-after-ci-fix.json`；本次附带修复不改变网站候选。

## Deploy Button 的只读核对

2026-11-17 对照 [Vercel 的源仓库参数](https://vercel.com/docs/deploy-button/source)和[必填变量参数](https://vercel.com/docs/deploy-button/environment-variables)，从最终页面取出实际链接，在空 Chromium 打开。没有登录平台、创建仓库/项目、触碰域名或发版。

- 分支 URL `/tree/rewrite/v1` 在匿名创建页显示成 `rewrite` 和 `v1`，因此弃用该来源，改为经 GitHub API 核对的基线完整提交 `/tree/4fb955c43a070f093ef45c883d906956a1b2cd3a`。
- 最终链接的 source 到该提交为止，没有附加 `website/` 子目录；`env=COOKIE_SECRET`，没有密钥值或 `envDefaults`；变量说明与源版本 `.env.example` 链接正确。源版本 `vite.config.mts` 是 SvelteKit 播放器根项目，Vercel 适配器配置 `hkg1`。
- 匿名创建页显示 `nonhana/campanula-music` 根仓库并停在登录。它没有展示 commit 和变量表单，不能据此声称登录后精确克隆、必填表单或实例已部署成功。这三项和从零部署归第六步验收；正文提醒检查根目录、构建命令、来源及部署结果，并保留手动 v1 导入。

证据：`.reports/website-step2/vercel-source.txt`、`vercel-source.png`（已否决的带斜线分支），`vercel-final-source.json`、`vercel-final-source.png`（最终页面实际链接）。

## 作者试用路线与边界

人工项优先：把官网与播放器设置页并排，比较字、白色入口行、胶囊、焦点和进退的观感；真手机触控手感、Android 系统返回和读屏仍由作者判断。Chromium 的手机视口和触摸事件不代表这些实机验收。无需输入真实密钥或创建实例来验本阶段。

1. 打开 `http://127.0.0.1:4322/`，点「部署 Campanula」，应进入单栏部署选择。点「部署到 Vercel」，应进入本篇教程；若出现三栏文档模板、按钮没底色或粗大下一页块，未通过。
2. 在教程点「复制命令」，应显示「已复制」，粘贴应为 `openssl rand -base64 32`；正文可拖选。手机点目录并选「绑定自己的域名」，目录收起，目标标题出现在顶栏下方；桌面直接点右侧章节。
3. 刷新这条章节深链，仍应停在对应标题。用页面「部署方式」返回，指南里的原入口应恢复焦点；再回首页，原来的部署入口应恢复焦点。浏览器返回/前进也应保留各自阅读位置。
4. 可选键盘：Tab 到手机目录，Enter 打开，Tab 进入章节，Escape 关闭，焦点回目录开关且有可见焦点环。可选减少动态：重走进入和返回，应只有短淡变。可选关闭 JS：正文、链接和原生目录仍能走完。
5. 需要查看按钮目的地时，只打开到 Vercel 登录前的页面，核对仓库来源。真正创建项目、修改 DNS、登录网易云、安装/下载和两次从零部署留待后续阶段；不把本次通过当成这些结果。

自动化已覆盖的 24 项网站操作、26 项播放器回归和 axe 无需作者逐项重复。没有做第三步首页试听、第四步其余文章、第五步 CI/境外托管或第六步部署与 DNS；#44 本轮不关闭。

## 本机预览与截图

保留原有本项目 Astro 静态预览 `http://127.0.0.1:4322/`。核对其 PID、命令和 cwd 后，通过 HTTP 比对三页响应与当次 `website/dist` 的内容一致；交付时再刷新。原型 4321 不修改、不依赖、不停止。

- 首页：`http://127.0.0.1:4322/`
- 部署选择：`http://127.0.0.1:4322/guide/`
- Vercel 教程：`http://127.0.0.1:4322/guide/vercel/`
- 域名章节：`http://127.0.0.1:4322/guide/vercel/#绑定自己的域名`

最终截图位于 `.reports/website-step2/reading-2026-11-17T12-59-51-142Z/`：`desktop-choice.png`、`desktop-tutorial.png`、`phone-home.png`、`phone-choice.png`、`phone-tutorial.png`、`phone-menu-focus.png`，另有完整长图、无 JS、深链和中间宽度。真实验证入口为 `.reports/website-step2/verify-reading.mjs`，运行结果以上述 report 和候选清单为准。
