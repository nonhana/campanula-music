# 独立浏览器检查与作者点名诊断

实现者默认不开浏览器（[delivery.md](./delivery.md)）；仅在运行受控浏览器/无障碍回归或作者点名做视觉、焦点、动效诊断时读本文件。

## 独立 Chromium 命令

无需先启动 `dev`。所有命令由 fixture 自启固定版本 Playwright Chromium、本机 mock 服务与空 context，禁止任何非自有 origin 请求，不访问作者浏览器 profile 或真实账号：

```sh
pnpm test:browser:install                                           # Linux 用 playwright install --with-deps chromium
pnpm smoke:mock                                                     # 桌面/手机保存核心 smoke
pnpm test:browser                                                   # journeys/
pnpm test:a11y                                                      # accessibility/（双视口全套 + 27 组对比度门禁）
pnpm test:browser tests/browser/journeys/keyboard.spec.ts --project=desktop --headed
pnpm test:browser --grep '加入歌单' --project=phone
pnpm test:browser:faults                                            # 故障注入敏感性验证
pnpm browser:trace /绝对路径/trace.zip
```

## 报告与无障碍门禁

- 报告输出至独占 `.reports/browser/run-*/`（`tests.json`、HTML、`results/` 下每例 trace/截图/环境网络附件与逐状态完整 axe JSON），`latest.json` 仅作导航。
- **零 violations 门禁**：全页运行 WCAG 2.0/2.1/2.2 A/AA + best-practice，无整页排除；`incomplete` 按视口、场景、规则、节点对照 `tests/baselines/a11y-manual.json`，新增项阻断，该基线仅凭明确人工审查修改。
- **对比度与低视力**：无参数 `pnpm test:a11y` 要求全部文件在桌面/手机通过，并生成 `contrast-summary.json` 核验 27 个组件组全部 ≥ 4.5:1（带过滤参数运行输出 `partial`，不代表完整专项）。低视力固定回归验证 320px 窄屏、规范字距、200% 文字模拟与强制颜色。
- **故障注入**：`pnpm test:browser:faults` 在临时源码副本依次破坏保存、可访问名称、焦点归还、模态循环与手机队列后确认检出并恢复，报告在 `.reports/browser-faults/`。

## 作者点名诊断（`tests/tools/browser/sweep.ts`）

使用 `tests/browser/fixture.ts` 在 `tests/browser/journeys/` 复用或新增具名用例（示例：`journeys/diagnostics.spec.ts`），并通过 `--headed` / `--grep` 复跑：

| 工具                                                               | 用途与核对要求                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `install(page, { freshImages: true })` / `shoot(page, info, name)` | 导航前挂位移、错误、请求与逐帧记录，保存截图与布局报告；位移与错误逐项检查                                                             |
| `keys`                                                             | 真实键盘操作并记录每步焦点名称、角色与可见焦点环                                                                                       |
| `roundtrip`                                                        | 经真实链接往返，核对地址、窗口与架子 `scrollLeft` 及选中标签恢复                                                                       |
| `motion`                                                           | 触发后冻结 Web Animations（含 View Transition 伪元素），对照 [docs/design/motion.md](../design/motion.md) 核验时长、属性与减少动态效果 |
| `tween` / `slow`                                                   | 放慢 `performance` 时钟抓 JS 抽屉指定帧，或连续触发中间态                                                                              |
| `hidden`                                                           | 模拟 `visibilityState` 隐藏/恢复，仅证明产品事件响应，不冒充系统锁屏节流                                                               |

- 静态截图用 `reducedMotion: 'reduce'`，普通动效用 `'no-preference'`；慢网络用 mock `slow` 场景或 `page.route`，不改动宿主网络。
- 真实网易云账号、Android 系统返回与原生选择器、TalkBack 等读屏体验始终留给作者真机试用。
