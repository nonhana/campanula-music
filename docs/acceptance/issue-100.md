# #100 开工与验收

基线：986069b3814570a5e1dfdfc3f428f0d40111faf5；rewrite/v1。前置 #99 已关闭，2026-11-16 最新恢复授权取代旧暂停。

## 开工覆盖清单

接入点已由 #96/#100 授权：真实页面（控件输入、导航、DOM、焦点、可访问状态）、自行启动的环境（HTTP、Cookie、IndexedDB、Cache Storage、HMR 与清理）。沿用 World 的 App/HTTP 和纯规则接入点；不以 HTTP 写入代替保存按钮。

依据：#96 用户故事 1–4、#100 全部方案；ADR-0003/0004/0005/0006/0007/0014/0016/0017/0018/0019/0020；DESIGN 的 Song Row、Wave Progress、Player Bars、Lyrics、Overlays、Notices、Download Panel（WCAG 2.2 AA）；docs/agents/overlay.md；规则①–⑫。原型 A 源码 origin/prototype/visual 的 Desktop/Phone Library、Playlist、Album、Artist、Daily、Player、Downloads、Search、Login、SongMenu/PlaylistEditor 为设计参照。产品结构保留，实测阻断单独红绿修复。

| 输入/行为                                    | 实际调用方与输出                                                                                                              | 回归与证据                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 默认 3 歌单/6 歌；编辑自建歌单，空名与有效名 | PlaylistEditorPanel → App editPlaylist → api-client → name 路由 → SDK playlistNameUpdate；保存后同 ID 新名、刷新保留          | journeys/save，桌面/手机；断保存接线必须失败                                                                      |
| 歌曲更多菜单→加入另一歌单→返回               | SongMoreButton/MenuList/AddToPlaylist/OverlayHost/overlay-stack；Enter、方向、Escape、Tab/Shift+Tab，真实焦点与刷新后的新增歌 | journeys/keyboard；错误归还故障必须失败；现有 overlay-stack、playlist-edit、like-collect 回归                     |
| 登录 QR 各阶段、短信失败重试                 | LoginQr/LoginSms → App login → 本地 SDK 场景/HTTP 失败；提示、刷新和恢复                                                      | journeys/login，axe 正常/失败                                                                                     |
| 曲库/歌单/专辑/歌手/每日推荐/搜索/账号       | routes 与各领域组件，经真实 App/HTTP，导航、空、失败、慢响应、断连/重试结果                                                   | journeys/core + states；现有 library、search、session 与 contract 全量保留                                        |
| 播放切歌、队列、歌词、滑块                   | PlayerPage/PlayerBar/Queue/Lyrics，真实 audio 与本地 WAV；名称、切歌、键盘数值，进度不持续 live                               | journeys/player；现有 playback/lyrics/gesture 回归                                                                |
| 下载取消、完成、导出                         | 下载面板/已下载/ExportDialog；本地媒体与合成 File System Access（取消/失败/成功），真实按钮启动                               | journeys/downloads；现有 downloads/export 回归；系统选择器人工                                                    |
| 全页、菜单、弹窗、失败与各核心页面           | 同一个 Playwright page 的 axe，WCAG A/AA + best-practice                                                                      | accessibility；初次完整 JSON 保留 violations/incomplete/passes/inapplicable，逐节点存量清单；缺少名称故障必须失败 |
| 两实例/新设备、同时人工端口占用、HMR/新路由  | startEnvironment + 独立 source/root/端口，空 context，Cookie/IDB/Cache Storage                                                | journeys/environment，关闭后进程/端口/根清理，失败证据保留；不碰作者服务                                          |
| 截图、逐帧、返回、键盘、限速与可见状态诊断   | scripts/browser/axi/playwright、sweep.py、intercept.js 的现有调用逐项迁移 tests/tools                                         | diagnostics 冒烟，UI skill、指南、包与 lockfile 同步；移除 attach/profile/锁/全局桥接                             |

SDK 当前为 hana-music-api 6.1.0，lockfile 与 node_modules 一致。src/lib/server/netease/{login,library,playlist,playback,search}.ts 已消费 SDK 公开返回类型；已核对 dist/client.generated-*.d.ts 声明的 playlist.id/name/creator/trackIds、song.id/name/ar/al/dt/privilege、account/profile、album/artist、搜索结果、QR code/data、歌词 lrc/yrc 及音频 URL/type/size。没有新增 SDK 字段需求，不以旧行号判断缺口。#99 的 small 种子提供完整关系，before/after/deleted/large 保留规模。42 action 合同与录制来源沿用 tests/fixtures/netease/README.md、index 和 sdk-report；真实失败录制缺口不伪称已补齐。新增状态使用具名场景或有说明的受控浏览器能力。

依赖盘点：当前有 @playwright/cli 0.1.24、axe-core 4.14.0、chrome-devtools-axi 0.1.46、chrome-devtools-mcp 1.13.0；尚无直接 @playwright/test/@axe-core/playwright。将固定 Playwright Test 及其 Chromium revision、axe 适配器版本，删除迁移后无调用的旧桥接依赖。

改动范围：tests/browser/{config,fixture,journeys,accessibility}、tests/tools 的 runner/诊断、tests/suites.ts 与 Vitest 选择、package/catalog/lock、CI、浏览器/mock/testing/delivery/README/AGENTS/UI skill，及实测需要修复的组件。保留原 824 条离线断言，原 755 条迁移清单仍逐项校验。

## 人工边界

真实账号扫码和权益、Android 系统返回/锁屏、系统文件选择器、TalkBack 的真实朗读由作者试用。Chromium 手机视口不等于 Android，axe 不等于读屏。本票不接生产 PWA 断网重开（#101）。工程证据满足后按 #96 授权关 #100，再串行启动 #101。

## 实际接入与迁移

| 原入口/调用方                                                  | 当前入口                                                                                      | 留证内容                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| scripts/mock-smoke.mts 的 HTTP 改名                            | journeys/save.spec.ts；smoke:mock 复用同文件                                                  | 控件保存、空名、拒绝回滚/恢复、同 ID 刷新                                               |
| browser.mts / axi.sh / playwright.sh / .playwright attach 配置 | tests/tools/browser.mts + playwright.config.ts + fixture.ts；scripts/browser.sh 只转入 runner | Chromium revision 1255 / Chrome for Testing 159.0.8154.6；每例新服务/根/context         |
| Python sweep shoot/布局位移                                    | tests/tools/browser/sweep.ts install/shoot                                                    | 原位置/错误记录程序保留为浏览器注入文本；截图、moves/errors、溢出、重放附件             |
| roundtrip / keys                                               | sweep.ts 同名函数                                                                             | 原地址、窗口/架子滚动、选中标签；真实键盘每步名称/角色/选中/焦点环                      |
| motion / slow / tween / hidden / sheet                         | sweep.ts；原冻结/时钟程序在 tests/tools/browser                                               | 普通和 reduce 的逐帧、慢放、JS 抽屉、隐藏切歌前后新动画计数、拼图；隐藏仍为受控事件模拟 |
| 当前页面 axe                                                   | fixture 的同 page scan 与 failureEvidence                                                     | WCAG A/AA（含 2.2）和 best-practice，完整结果与按场景汇总                               |
| 录制与工具说明                                                 | tests/tools 原有录制器 + browser/mock/testing/delivery/README/AGENTS/UI skill                 | 不再调用旧桥接、profile、文件锁或 attach；真实账号由作者手动试用                        |

代码依赖已移除 @playwright/cli、chrome-devtools-axi、chrome-devtools-mcp；直接锁定 @playwright/test/playwright-core 1.65.1 与 @axe-core/playwright 4.14.0（引擎 4.14.0）。playwright-core 的直接约束同时固定 axe 的 peer 类型，避免安装到 alpha 版本。

前置回归以原 migration.json 的 755 条，加 issue-99.json 的 69 条增量全名/原状态组成 824 条清单；完整运行两份检查，重复、缺失或跳过均失败。新用例另列，未修改原断言或覆盖率门槛。

## 实测阻断与红绿证据

- DialogShell 的 Tab 逃到页面外：run-2U3z0w 实际失败；添加仅对当前可见/启用/非 inert 控件的 Tab/Shift+Tab 循环，keyboard 同文件恢复通过。
- 每日推荐/简介按钮的可见文字不在名称中、浮动菜单和 mock 标记无区域归属：首次 axe run-qI9e71 保留规则/节点；自然名称、含预览的简介名称与具名区域修复，原页面扫描复测。手机搜索分类另外由 run-Hajxub 检出，PhoneShell 的分类区有具名 region 后同状态恢复。
- 歌词滚动区不能键盘聚焦：run-6T42xi 的 scrollable-region-focusable；新增真实 Tab 停点、Home/方向键滚动断言，原页面扫描复测。
- 播放状态缺少可访问播报：run-SPPa0g 实际失败；新增只含当前歌曲/播放状态的 status，进度滑块不在 live 区，播放进度变化期间观察该 status 的 DOM，要求零改写。真实 TalkBack 仍待作者。
- QR 扫码头像走到了外部来源：run-Iub9pt 的 network 附件检出；具名 QR 场景返回同样经过 localize，保留原录制不改写；扫码路径复测。
- 新增路由 404：run-7cc83H / run-PvmE0n；SvelteKit 按配置路径匹配新增事件，独立根 src 的真实路径和软链路径不同。启动器仅向本环境传 routes 的真实目录，run-6T42xi 桌面/手机组件 HMR 保留同 document 标记、真实新增页面显示通过，不修改人工源码或系统配置。
- 保存/名称/焦点三种故障在临时源码中逐一注入，要求原用例在指定原因失败，再恢复同一文件通过；故障报告保留，普通回归不允许 flaky/skip。另有受控 retry：第一次写了上游与设备存储后故意失败，Playwright 的 retry #1 必须从原始歌单、空 Cookie/存储和新根开始。该预期失败与普通回归分开报告。

GLOSSARY 没有新增领域概念；ADR-0019/0020、DESIGN、overlay 约定及产品 Spec #11 的 Testing Decisions 更新实际页面接入点。原 App、HTTP、SDK 分层及数据格式不变。

## 作者试用（自动化没有验证的部分）

1. **真实登录/账号权益**：在部署后的实例用自己的浏览器进行一次必要的扫码或短信登录；应进入曲库并能播放自己有权益的歌曲。失败表现是停在确认/错误页或不能播放；失败不要连续重试，按屏幕提示恢复。自动化只使用合成会话。
2. **Android TalkBack**：新建临时歌单“Campanula 验收 · 可删除”，从另一张歌单的歌曲更多菜单加入它，听清歌曲名/操作名，关闭后应回到原歌曲继续操作；按 Tab/Shift+Tab、Enter/Escape 也应走得通。切歌/暂停应按需播报，进度不能持续打断。错误表现是焦点跑到页面顶端、名称只读图标或一直读秒；验完移除刚加入的歌并删除临时歌单。Chromium 手机视口和 axe 不代替此项。
3. **系统文件选择器**：在已下载选一首，导出时点击选择文件夹，先取消一次应留在确认页；再选新建的空临时文件夹，应生成可播放的音频文件，App 内下载仍在。拒绝权限/磁盘写满应能恢复。验完用系统文件管理器删除导出文件和临时文件夹；删除 App 下载不会删除导出文件。自动化使用 OPFS 和标准 DOMException，只证明应用交互。
4. **Android 系统返回/锁屏**：打开播放页/队列、关闭屏幕再回来，用系统返回关浮层，应回原页与原歌曲；不要把 hidden 事件模拟当成设备后台证据。PWA 生产断网重开由 #101 专项交付。
5. **可选布局/动效**：桌面 1440×900、手机 390×844，768/1024 宽度查看无页面横向溢出；系统打开减少动态效果后，菜单/弹窗应主要淡入淡出。可见焦点应一直可辨。自动化已有相应视口、键盘和 reduce 证据，观感和真实触屏仍可试。
6. **真实歌单保存**：只在上述临时歌单改名、保存、刷新，应该是同一张歌单的新名；失败时应提示并回到旧名。验完删掉临时歌单，不在已有歌单上测试写入。

自动化已覆盖合成数据下的保存/失败恢复、核心导航、搜索正常/空/失败/重试、QR 阶段/短信失败恢复、退出、播放与队列/歌词/滑块、下载取消与刷新、导出取消/拒绝/写满/成功、键盘焦点、axe、存储隔离/HMR 与清理；这些工程项无需作者再重复确认。

## 初扫和人工判定

`tests/baselines/a11y-first-observations.json.gz` 保留各场景第一次实际全页观测的完整 JSON（violations、incomplete、passes、inapplicable、best-practice tags 与节点）。这是从 986069b 开始逐步接入时的开发快照集合，文件逐项记录 run/路径，不冒充单一 clean SHA；故障注入运行不作为存量基线。最终提交的 CI 另保存当前扫描，门禁始终为零 violations，violations 无豁免；incomplete 使用 a11y-manual.json 的逐场景/规则/节点人工清单，新增节点阻断，没有自动更新基线。

| 首扫项                          | 定位/影响                                                                    | 处理与复测                                                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| label-content-name-mismatch     | DailyTile 的链接、DescriptionPreview 的按钮；可见标签无法用同样名称操作      | 自然名称/包含预览原文；复跑 library、album                                                                                                                                                                                                         |
| region / aria-prohibited-attr   | mock 标记、浮动菜单、手机搜索分类；内容不属于可识别区域                      | 具名 region；复跑 playlist-menu、add-to-playlist、search-results 和所有基础页面                                                                                                                                                                    |
| scrollable-region-focusable     | Lyrics 的 .scroll；键盘无法滚动歌词                                          | tabindex=0 与原生 Home/方向键；复跑 player-paused / player-lyrics                                                                                                                                                                                  |
| 首扫 color-contrast violations  | daily 的 data-song-id=910000102 时长、playlist-menu 第三项；初扫发生在淡入中 | 未改颜色或阈值；字体 ready 并等 reduce 的 150ms 淡入结束后复测同节点。原失败 JSON 仍保留，稳定后原节点不能作为允许项                                                                                                                               |
| aria-prohibited-attr incomplete | 初始 mock div 的 aria-label 无 role                                          | 具名 region 后原节点复测，不作为遗留豁免                                                                                                                                                                                                           |
| heading-order incomplete        | downloads-empty 的 h1，“Unable to determine previous heading”                | 保留原节点；当前页面与快照核对标题顺序，并用 headed + TalkBack 检查跳转。不是已证实违反，也不改为 passes                                                                                                                                           |
| color-contrast incomplete       | 歌词逐字裁切层、播放器封面染底、菜单/表单覆盖层及少量状态文字                | 每个场景/具体节点在最终 a11y-summary.json 和对应 axe JSON 中列全；headed 进入同状态，对显示文字与实际背景取色，普通小字至少 4.5:1、大字至少 3:1；歌词未唱/正唱/唱完都检查。真实读屏同时核对重复层是否朗读。未人工判断的保持 incomplete，不声称通过 |

自动化通过不等于 WCAG 2.2 AA 的全部人工项目通过。真实名称顺序/朗读、触屏目标、设备系统返回与文件选择器按上面的作者清单保留；全站后续问题按具体场景分诊。本票不把未知项泛化排除，不自动把 incomplete 改为通过。

截图复核发现两处证据问题并修正：断点图原先可能拍到骨架交叉淡化，现等 aria-busy 清空、字体 ready 与淡入完成；JS 抽屉的默认两秒媒体会自动换歌，诊断改用同一生成器的 30 秒 WAV 并暂停，逐帧断言同一首歌，记录 requestedMs 与实际 actualVirtualMs。普通菜单在关闭动画完全退出后才切 no-preference 重新触发，回归检查 200ms 的 opacity/translate/scale；reduce 则检查只有 opacity 且不超过150ms。默认开发种子和下载仍生成两秒媒体。逐帧证据不冒充帧率性能或 Android 体验。

本地完整运行：`.reports/runs/run-VPuJMU`（55 文件 / 826 passed；755 原迁移、#99 的824全名/原状态逐项保留；服务端行96.21%，App行93.43%，路由行100%，原阈值不降）与 `.reports/browser/run-01V7Hm`（54 passed / 0 failed / 0 skipped / 0 flaky）。浏览器共58次全页 axe，零 violations；当前 incomplete 为跨场景328条节点记录，均属 color-contrast，有重复，不等于328个独立问题。原 aria-prohibited-attr/heading-order incomplete 在最终稳定画面未再出现。修正诊断与收尾后的专项运行、最终 SHA 的 CI 附件另外记录，不能用这份本地运行代替最终远端。

诊断修正后的专项：`.reports/browser/run-CskBwN`，18/18 通过（桌面/手机的诊断、播放器、环境与状态）。独立只读图检确认同首 Theme Of Laura II 的抽屉采样，桌面实际 9.32/152.27ms、手机 5.87/150.79ms；普通菜单200ms translate/opacity/scale，reduce仅150ms opacity，四张768/1024断点图的骨架残影已消除。实际采样时间与目标标签分别保留，不能称为精确零点或帧率证据。

补齐 View Transition 逐帧、mock 图片新请求与 replay 记录断言后，`.reports/browser/run-AkRTFk` 的诊断/保存/登录桌面及手机专项 10/10 通过。Svelte autofixer 检查改动组件，issues 均为空；建议涉及原有 DOM 尺寸测量、动画/浏览器订阅与 bind:this，不把有外部输入的效果改成纯 derived。

两轴独立审查：Standards 无需改动；Spec 发现键盘任务中途直接 focus 会掩盖转层问题，已改成 ArrowDown/End/Enter/Escape，并逐层断言初始和归还焦点，复核无未解决项。另补全前置824门禁的真实通过、增量跳过/重复/缺失断言，用例数量不变。最终故障专项 `.reports/browser-faults/run-pe9eaE` 的保存/名称/焦点三组红绿与重试隔离均通过；SSR 校准 `.reports/runs/run-z9Rlpu` 证实账号处理执行、未请求路由仍零，Node/Vercel构建及2952文件生产隔离检查通过。

固定 incomplete 清单的复跑 run-SNyv4L 曾阻断 dialog-keyboard 的新增节点：桌面标签区滚到下方后，“场景”分类标题被容器上沿裁切（elmPartiallyObscured）。已检查该次全页截图与原始 axe：原生滚动区裁切、aria-hidden 的视觉标题和具名 group 对应一致，不是已证实的颜色通过；仅此场景/视口/规则/节点补入人工清单，并给出滚回可见处取色与 TalkBack group 复测方法，原失败报告保留。没有自动收集或放宽整组件。

完整键盘路径检出实物问题：run-j8TL5J 与焦点事件探针表明，桌面关闭picker后约23ms内重开，仍复用原menu节点，挂载期focusInitial没有重跑，焦点停在退出的歌曲菜单并落到body；账号菜单run-oF7eX0同样失败。MenuOverlay按每次floating/shown请求、AccountMenu按每次opening重新创建MenuList，保留外壳动画。三处MenuList调用点已检查/覆盖；DialogShell快速重开run-W3ZYTx实际通过，搜索建议始终保留输入框焦点，没有新增初始化。探针只在测试临时使用后移除；正式键盘和账号回归保留，未用等待动画结束掩盖。

快速重开修复后的 `.reports/browser/run-1SQ9NE`：core/keyboard/diagnostics 桌面与手机12/12通过，0skip/0flaky；普通菜单与reduce逐帧仍符合原时长/属性，三处MenuList调用点和弹窗快速重开均保留可执行回归。两轴增量复核均0未解决项，新增AccountMenu及改动后的MenuOverlay autofixer issues为空。

首轮Linux CI 43764056208 的smoke实际失败：只有lo的namespace让Chromium判断设备离线，页面提示“网络已断开”并停在加载；产品browser.ts直接读取navigator.onLine。Chromium AddressTrackerLinux明确忽略IFF_LOOPBACK（https://chromium.googlesource.com/chromium/src/+/HEAD/net/base/address_tracker_linux.cc）。独立Linux容器的Chromium156底层探针实测仅lo时false、加无出口dummy链路后true，IPv4/IPv6外网路由均不可达；这不是配套159页面回归的替代。offline.sh现仅在自己的namespace新增192.0.2.1/32虚拟链路，不加默认或外网路由，执行前两种出口路由探针必须失败；fixture保存并断言每例初始navigator.onLine为true，正常离线状态用例仍自行setOffline。宿主网络不变，不覆盖产品navigator接口；首轮失败/跳过不能算最终通过。

后两轮 Linux CI 43764718095 / 43766268599 的 smoke、故障专项及 HTTPS 均通过，完整 Vitest 在同四条原用例超时（3条行为的15秒、SDK消费者清单的30秒），未进入默认浏览器全量。独立2 CPU Linux容器剖析定位到大型种子复制、父测试与SSR重复校验，以及 JSON 解析对象与结构化副本的 V8 字节表示不同导致的证据未命中。修复只消除重复工作：录制先复制，World同一SSR runner加载校验与队列；场景构造只读元数据；种子缓存序列化字节、每次解码独立完整图；SDK清单仍读全部源码，只省去不可能有SDK导入的AST解析（含反斜杠的文件仍解析）。原824条断言、15/30秒预算、完整内容摘要、异步独立快照与特殊对象处理均不改。新增复制复用/改坏仍拒绝（run-Bl7pUc先红、run-Jathi2恢复绿）和种子图内关联/副本隔离回归；两轴增量审查均0 finding。上述失败运行不作为最终交付。

性能修复后的本地默认全量 `.reports/runs/run-JEwAUf`：55文件828条Vitest全过，755与824两份清单逐项保留；其明确引用的 `.reports/browser/run-CnrVXB` 为54通过、零失败/跳过/flaky、58次全页axe零violations。原四条超时用例本次分别4.95秒、4.26秒、0.01秒、8.51秒，仍沿用15/30秒预算。重新生成的SDK报告与优化前完整JSON一致，42个生产action、355份录制；最终Linux结果另以提交SHA对应CI为准。

CI 43772109171：55文件828条Vitest、755/824逐项保留全部通过，原四条超时已解决；browser为51通过/3失败。新增路由的HTTP已200，但Kit重建引发的HMR刷新打断同时的goto；仅对此路径的ERR_ABORTED或同URL导航中止做原预算内轮询，导航完成后另等真实标题，其他错误仍抛出。播放器扫描前用真实Home归零，避免暂停前经过的时间改变歌词位置。

播放器另两处失败是incomplete target误报新增：Svelte默认用文件名算scope，临时根引用的实际文件在不同检出目录得到不同类名（DesktopPlayerPage在本机1mcvaz5、GitHub i1sdgg、容器/work 3a2bqh）。独立开发编译现把rootDir设为实际源码根，沿用框架按相对文件名生成scope；生产构建仍用默认项目根。通过公开svelte/compiler按157组件生成一对一旧/新scope映射，selector其余部分、project/scenario/rule不变。原329项全部保留；CI74条经PNG/完整JSON/HTML与独立图检复核，61条是相同节点别名，仅13个新增精确项（非当前歌词行的字重选择器与新露出的data-line=7那行12个日文单字）保留人工unknown，清单共342项。没有通配、忽略组件或把incomplete改passes。原58份首扫逐项不变，另按Linux平台和118b6dc提交追加两份原始播放器扫描。

这轮修正的本机环境/播放器两布局10/10通过，类型零错误/警告、lint通过；同版本Node26.13.1/Playwright1.65.1官方Linux镜像继续做全54条离线页面验证。最终提交的完整CI另外核对，不用此处失败运行收尾。

修正后的同版本官方Linux镜像（Node26.13.1、Playwright1.65.1、配套Chromium）以当前文件只读覆盖诊断副本，在network none/自有dummy链路内运行完整54条：run-gtek6N，54通过、零失败/跳过/flaky；58次全页axe零violations、328条incomplete节点记录，54份trace；每例均核对root/PID/端口清理、零外部请求和初始online。扫描后的滑块任务重新聚焦起点（axe适配器finishRun会临时新建并关闭page），数值断言和完整浮层键盘路径保留。两轴对这轮增量均0 finding；最终干净SHA的CI仍另行核对。

最终本机启动器回归run-K0uW5T：9文件43条全过；pnpm check零错误/警告、lint与格式检查通过。全部测试和类型检查顺序执行，预算未放宽。
