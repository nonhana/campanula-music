# 同一候选的交付证据

本票承接 Spec #96，开工基线 d056bcd0d4395c4fa98a740629a78ecb0a1b3e90。#101 的细化 AC 在 GitHub；本文件给出调用方、验证边界与复测方法，最终 SHA、CI、Vercel 和报告统计放在交付评论。

## 接入点与覆盖

| 需求          | 实际调用方、输入与观察结果                                                                                        | 回归证据                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 同份清单  | tests/suites.ts 的选择和 VALIDATION_PLAN → 本地 test:ci 与 CI；缺文件、空选择、旧用例缺失/跳过/重复失败           | unit/suites；run、browser、ci 的 SHA/选择/版本/结果报告；755+69+4 与 54 条页面基线逐项保留                                                                      |
| AC2 两份产物  | build-candidate 在独立工作根使用产品 Vite，输出独立目录；test:delivery 接收 SHA/adapter/candidate                 | candidate.test：缺目录/空树/空入口/目标与 SHA 不符/摘要变化；实际 Node HTTP 和独立 Vercel v3 路由、函数 handler、静态资源                                       |
| AC3 泄漏      | 扫路径及普通、gzip、Brotli 内容，核对全部文件摘要；Vercel 只允许可移植的内部相对软链，共享函数实体只扫一次        | candidate.test：mock 控制路由、开发标记、录制、测试工具、合成音频、额外文件、软链越界；真实候选文件数非零                                                       |
| AC4 离线      | Node 的真实 index.js 监听独占回环端口，经自有代理供 Chromium 使用；安装并控制后 setOffline、关完页、新页导航      | pwa/offline：空设备离线打开 downloads；本机缓存账号与下载行、真实 Blob 音频推进播放进度；联网、实际账号请求与刷新后下载保留                                     |
| AC5 换版/缓存 | 同 SHA 两份不同 version 的 Node；代理切后端，不改产品文件；观察 waiting、文档标记、两个外壳缓存、关完后新缓存独占 | pwa/update：两旧页、逐页关闭、新 worker 激活、localStorage 保留；GET/POST/失败 API 和第二回环 origin 的音频不进外壳缓存；断网 API 导航明确网络错误              |
| AC6 发布      | tag/manual 的 Docker job 先读最新同 SHA CI attempt、五个必要 jobs 的全部步骤、下载本次候选包重新核验              | release.test：错 SHA、缺/重复/空检查、失败/取消/跳过/运行中、后续失败覆盖旧绿；release:check 只读 dry-run；镜像只 COPY 已核验 Node，保留原触发与 packages:write |
| AC7 平台      | Vercel Checks V2 只读 API → 实际 ci 门禁和部署 check run；最终 ci 等待 verify/https/sdk/delivery                  | 交付前后 API 摘要、同 SHA job/run、production READY 与 PROMOTED；无需更改域名或门禁设置                                                                         |
| AC8 SDK       | SDK 副本换候选包 → 索引/schema、check、contract、代表 HTTP/App behavior、实际保存页面/刷新                        | test:sdk 六步日志与录制差异、页面 trace/axe；sdk:latest 单独联网报告，scheduled/manual workflow 不参与锁定离线回归                                              |
| AC9 回归/文档 | 原七个产品接入点与已建 browser/a11y 不变；本票增加候选 CLI、生产 PWA 和只读发布判定                               | 全默认 coverage、SSR 校准、故障、双 HTTPS、SDK、两目标及 PWA；两轴审查；原时限和覆盖率阈值保留                                                                  |
| AC10 收尾     | 最终提交推送 → 同 SHA 完整 CI / Vercel → 下载并逐项核对报告 → GitHub 评论/清单/Spec 审计                          | 最终 #101/#96 评论，不借用旧 SHA 的绿灯                                                                                                                         |

没有新增网易云字段或 action：账号、Song 和本机下载均沿用现有合同与脱敏录制，SDK 仍为独立发布的上游（ADR-0005）。不补真实账号录制，不把构造数据当真实权益验证。领域概念不变，GLOSSARY 无需新增词。相关决定是 ADR-0009、0015、0019、0020；本票不重开 CA、hosts 或开发启动器优化。

## 本机与 CI 使用同一入口

```sh
pnpm test:ci verify
pnpm test:ci https
pnpm test:ci sdk
pnpm delivery:verify --sha "$(git rev-parse HEAD)"
```

准备阶段是锁定依赖、配套 Chromium/Linux 系统库；HTTPS 专项另准备 mkcert。Linux CI 执行阶段套在 `sh tests/tools/offline.sh ...` 的独立网络 namespace 中，只有回环与无出口本机链路。registry 查询和 mkcert 下载明确在外面；默认测试不改作者网络、CA 或 hosts。

候选报告在 `.reports/candidates/run-*/`。`node`、`vercel`、`next` 各有 output、candidate.json、build.log 和 build-result.json；摘要核验、Node HTTP/退出/端口报告在 `.reports/delivery/`，真实 PWA JSON/trace/截图/请求及进程清理在 `.reports/pwa/`。tar.gz 保留 Vercel 的相对软链；直接上传解引用的目录会把每个函数别名复制为整份依赖。`verification.json` 绑定全部七步和 PWA 结果。latest JSON 只是导航。

候选构建拒绝已有 out 目录；输出工作根与普通 dev/mock 独立，构建期间源码改变会失败。本地未提交的诊断构建可以检查，但标 `source.dirty=true`，发布判定拒绝它。CI 的 clean SHA 才能成为发布候选。摘要用于发现串读、损坏或额外文件；可信来源来自指定 CI run 的 artifact，不把摘要当签名。

单项重跑：

```sh
pnpm test:delivery --sha <完整SHA> --adapter node --candidate /本次目录/node
pnpm test:delivery --sha <完整SHA> --adapter vercel --candidate /本次目录/vercel
pnpm test:pwa --sha <完整SHA> --candidate /本次目录/node --next /本次目录/next --grep '断网 API' --project desktop
pnpm test:environment tests/delivery/candidate.test.ts
pnpm test:environment tests/delivery/release.test.ts
pnpm release:check --sha <完整SHA>
```

发布检查需要已有 gh 登录和 actions:read，仅 GET／下载，不推镜像或标签。它读取最新 run 与当前 attempt，不挑历史绿灯；失败、取消、缺项、空步骤或必要 skip 均拒绝。Docker workflow 另加 `--wait --prepare-image`，将重新核验过的 Node 输出复制到 `.reports/release-image`，runtime Dockerfile 只包装它。根 Dockerfile 仍支持站长自行构建。

## 已检出的生产问题

旧 `$app/env` 的 version 在当前 Kit 的 worker 环境依赖页面全局，实际缓存名为 `campanula-shell-undefined`。本票由 Vite 给 SW 注入同一个构建版本，并用两次真实生产构建证明不再共用缓存。旧 worker 对离线 `/api/account` 导航回了 200 外壳，新增回归先实际失败，现明确排除 `/api`。版本、延迟激活和“API 不缓存”的产品决定不变。

设计页的路由壳在 ssr=false 时返回 200，匿名布局显示登录；检查不能拿 HTTP 200 说设计工具已暴露。扫描确认设计组件标记与代码没有进产物，生产浏览器访问 /design 仍是登录且无 data-design-page。

首轮 CI 检出既有手机滑块的间歇失败。独立副本六轮复现四次，事件记录确认焦点和按键正确，原生音频在 seek(5) 后仍回报 0；最小 Chromium Audio 证明忽略 Range 的 200 响应只暴露 seekable=[0,0]，206 响应暴露完整范围并稳定停在 5 秒。现由共享 audioResponse 修正 mock 服务、两个页面覆盖和生产专项自有媒体的四处响应，遵照 RFC 9110 只处理 GET 单段范围；HTTP 回归保留无 Range 与不支持多段时的整文件重下，并补单段/后缀/越界/HEAD/POST。新增页面回归在修复前实际报“206 收到 200”，修复后验证原生 seeked 后的位置；原键盘 5/0、焦点、axe 与时限均保留。最终全量结果以本次提交 CI 为准。

## Vercel 的实际接通范围

2026-11-16 只读核对项目 prj_P51L2u146A2fzJa1nIRe8uNbowSA（nonhanas-projects/campanula）：production branch 为 rewrite/v1，autoAssignCustomDomains=true。Checks V2 的唯一设置是 `ci`，source 为 GitHub externalCheckName=ci、targets=[production]、blocks=deployment-alias、timeout=5000。基线 d056bcd 的 check run succeeded，externalUrl 指向同 SHA 的 CI 43777854936 / job 133008135270；alias 在该检查完成后 PROMOTED。旧 Checks V1 的空列表不能证明 GitHub 门禁不存在。

保留 ci 名称，将原主 job 改名 verify，ci 在 verify/https/sdk/delivery 全部完成后显式拒绝任何非 success。Vercel 继续自行构建，production 域名等待 ci；preview 构建 READY 不代表 production 放行。本票不触发额外公开发布或更改域名。设置入口：<https://vercel.com/nonhanas-projects/campanula/settings/deployment-checks>；只读核对用 `/v2/projects/<id>/checks` 和 `/v2/deployments/<id>/check-runs`，最终结果在交付评论。

SDK registry 的 schedule 只在 workflow 位于 GitHub 默认分支时触发；当前默认分支 master，本轮只推 rewrite/v1，因此不能声称周期任务已经自动运行。按需本地 `pnpm sdk:latest` 可直接执行；workflow 将随本分支正式并入默认分支后提供 weekly/manual 宿主入口。这不阻塞候选包的离线 CI 门禁，不擅自改 master 或默认分支。

## 自动化边界与作者试用

1. Android 已安装应用：先联网打开并下载一首自己有权益的歌，确认完成；关掉所有 Campanula 页面，开系统飞行模式，再打开应用。应能进外壳、看到离线条和本机下载，并播放；恢复网络后提示消失。本机数据丢失、白屏、显示未下载或不能播放均为失败。验后恢复网络，按需删除这首临时下载。
2. Android 两版本：旧版本播放时保留另一个标签页，新版本上线后当前页不应刷新；关掉全部页面再开，应使用新外壳且本机下载仍在。自动化证明 Chromium SW 生命周期，不能代替 Android 安装/系统退出和锁屏。
3. 真实账号、系统返回、系统选择器与 TalkBack 继续按 #100 清单。WCAG 的 color-contrast incomplete 精确人工清单仍保留，未实测不能宣称完整 WCAG/TalkBack 通过。
4. 从同一次 CI 摘要打开失败命令与对应 artifact，重跑上面的单项；检查 version、SHA、目标、文件数及清理。发布 gate 用 release:check 只读试，成功只表示候选可放行，不应为了试验真的打 tag 或推镜像。

自动化已覆盖的合成设备离线/恢复、缓存边界、延迟换版、失败门禁和进程收尾不用作者重复工程确认。真实账号与设备仍是人工边界，不能拿 viewport、OPFS、DOMException、hidden 或 axe 冒充。

## 两轴审查的回归

初审的六项问题均按具体负例修复：无 .git 的 SDK 副本在 contract 初始报告确实失败，现由宿主显式传 SHA，六步含页面保存均通过；新增 skip 在报告边界被拒绝，-t 的未选用例仍允许。候选逐个解析路由目标、软链真实目标必须为非空文件，空目录也进目录摘要；静态 design 路径阻断，保留产品服务器的 404 路由壳。并发请求使用各自记录，受控 503/502 也记实际状态，实际 PWA 负例先检出错配再恢复。

Vercel trace 按官方适配器将根路由对应 index.func，其他函数别名仍逐个解引用。undici 的公开运行时入口本来会导出其 lib/mock/MockAgent，这部分库代码不是本项目 mock 装配；仅该依赖路径不按目录名误报，项目标记、录制、媒体及测试路径仍扫描。package.json 的 scripts 引用 tests/tools/fixtures 不代表文件被打包；实际目录和文件继续检查，内容里的项目 mock/设计标记不豁免。
