# 独立浏览器验证

`pnpm test:browser` 自行启动固定版本 Playwright 的配套 Chromium、本机 mock 服务和空 context。无需先开 dev。执行阶段只访问 fixture 领取的本机 origin；每个用例有独立工作根、上游和浏览器存储。真实账号由作者在自己的浏览器试用。

```sh
pnpm test:browser:install
pnpm smoke:mock
pnpm test:browser
pnpm test:a11y
pnpm test:browser tests/browser/journeys/keyboard.spec.ts --project=desktop --headed
pnpm test:browser --grep '加入歌单' --project=phone
pnpm test:browser:faults
pnpm browser:trace /绝对路径/trace.zip
```

Linux 第一次用 `pnpm exec playwright install --with-deps chromium` 安装浏览器及系统库；版本来自 lockfile，浏览器 revision 来自 playwright-core/browsers.json。已有浏览器安装后，用例可在禁止外网的数据环境运行。Linux CI 在 tests/tools/offline.sh 创建的临时网络命名空间中执行 smoke、故障注入和完整回归，保留回环与无出口的本机虚拟链路；Chromium 可判断本机在线，IPv4/IPv6 外网路由必须不可达，地址/路由/出口探针证据在 .reports/offline。不修改宿主网络。没有指定系统 Chrome，也不读取作者 profile、账号或已开窗口。

`test:browser` 跑 journeys，`test:a11y` 跑 accessibility；领域旅程在打开菜单、弹窗和失败态时也扫描同一个 page。`pnpm test` 顺序跑离线 Vitest 和这两类浏览器文件。文件和 `--grep` 可以组合，选择为空会失败。`smoke:mock` 是同一份保存用例的桌面/手机子集。

## 报告

终端输出本次 `.reports/browser/run-*/`。其中 tests.json 与 HTML 记录实际步骤、项目和错误，results 下保留所有用例的 trace、截图、环境/网络附件及逐场景 axe JSON。每个 axe 结果保留 violations、incomplete、passes、inapplicable 和规则 tags；best-practice 与 WCAG A/AA 同时运行。没有整页排除，当前已扫描状态要求零 violations；incomplete 逐场景/规则/节点对照 tests/baselines/a11y-manual.json，新增项阻断，清单只由明确人工判断修改。原始观测见 `docs/acceptance/issue-100.md`；对比度数值核验与已测组见 `docs/acceptance/issue-103.md`，完整运行的 contrast-summary.json 拒绝缺组、缺状态或低于4.5，不把原 incomplete 标成 axe passes。latest.json 只是导航，交付引用明确的 run 和最终 SHA 的 CI 附件。

`test:browser:faults` 在临时源码副本依次断保存、去按钮名称、改焦点归还，检查同一用例在指定原因失败，再恢复通过；报告位于 `.reports/browser-faults/`。不修改共享 src，也不把预期失败混成普通绿灯。

## 作者点名的诊断

用 tests/browser/fixture.ts 的 test、page 和 environment，在 `tests/browser/journeys/` 写或复用一个具名用例。截图、骨架位移、返回恢复、键盘、动效逐帧、JS 抽屉逐帧、慢放和隐藏状态模拟在 `tests/tools/browser/sweep.ts`；浏览器侧的原记录/冻结/时钟脚本也归 tests/tools/browser。示例为 journeys/diagnostics.spec.ts，使用同一条 headed/grep 命令重跑。

- `install(page, { freshImages: true })` 在导航前安装位移、错误、请求和逐帧记录，可给本实例的 mock 图片加新请求标记；`shoot(page, info, name)` 保存截图/布局报告。位移与错误逐项检查，不能用总图数代替。
- `keys` 用真实键盘输入并记录每步焦点；`roundtrip` 从真实链接进入再返回，核对地址、窗口/架子滚动位置和选中标签。
- `motion` 触发后冻结 Web Animations；省略元素选择器时也捕获 View Transition 的伪元素动画；`tween` 在独立页内放慢 performance 时钟，给 JS 抽屉拍指定时间；`slow` 支持连续操作。每组报告应与 DESIGN 的时长、属性及减少动态效果规则比对。
- `hidden` 模拟 visibilityState，证明产品接收事件后的反应；不证明操作系统后台节流/锁屏。网络慢响应优先用具名 slow 场景或 page.route 暂停自己的响应；不会改变作者网络。
- 通过 page.emulateMedia 选择 reduce/no-preference，视口通过 fixture 的项目或 page.setViewportSize 设置。真实触屏行为仍由 Android 试用。

原 scripts/browser/axi/playwright 和 Python sweep 的 attach/profile/桥接接口已移除；脚本薄入口 scripts/browser.sh 进入相同的独立 runner，参数为 Playwright Test 文件/grep/headed，不再接受 open/exec/port。原截图、逐帧用途的迁移映射和验证结果见 #100 验收文档。录制真实上游请用 tests/tools 的录制入口，见 tests/README。
