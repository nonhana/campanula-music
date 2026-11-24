# 浮层栈

新增菜单、弹窗或底部弹层，从浮层内换页，或修改返回、前进与焦点归还行为前必读。代码位于 `src/lib/components/overlay/`。

## 三个核心文件

- `overlay-stack.ts`：纯核心，不碰 DOM 与 Kit。层的开关、转交、占用的浏览记录、焦点归还、忙时钉住都在这里；单测在 `tests/unit/overlay-stack.test.ts`。
- `overlay-history.svelte.ts`：核心历史端口（`read` / `write` / `go` / `leave`）在 Kit 上的实现；仅修改端口签名或语义时改动。
- `overlays.svelte.ts`：登记表，注册各层历史策略、组件与关闭钩子，并挂接手机根页播放中防误退守卫（`shell/exit-guard.ts`，仅在 `stack.top === null` 且无同文档可退历史时启用）；组件内通过 `getOverlays()`（`overlay-context.ts`）取层、`stack` 与 `exitPrompt`。

## 新增一层

1. 在 `overlay-requests.ts` 新增请求类型：菜单继承 `MenuRequest`（有锚点为浮动菜单，无锚点为底部弹层），弹窗继承 `DialogRequest`。
2. 在 `overlays.svelte.ts` 调用 `register<请求>('名字', menu | dialog | 自定义选项, 组件)` 并纳入返回对象；传入组件的层由 `OverlayHost` 统一挂载。
3. 菜单套 `menu/MenuOverlay.svelte`（条目数据见 `menu/menu.ts`，列表与键盘在 `MenuList`），弹窗套 `overlay/DialogShell.svelte`。
4. 原地转交至另一层：`当前层.transfer(目标层, 请求)`（位置与焦点平滑交接）。菜单内触发转交或换页的条目设 `closeOnChoose: false`，避免壳重复关闭。

## 浏览记录占用策略

占浏览记录的层，系统返回先关闭该层再退页：

| 层                   | 是否占浏览记录           |
| -------------------- | ------------------------ |
| `menu` 策略          | 底部弹层占，浮动菜单不占 |
| `dialog` 策略        | 手机占，桌面不占         |
| 播放页、手机播放队列 | 占                       |
| 多选                 | 手机占，桌面不占         |
| 桌面播放队列面板     | 不占                     |

## 从浮层内换页

| 场景                                           | 用法                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 无层占历史时的页面链接                         | 普通 `<a>`，换页时栈自动撤掉可见浮层                                                        |
| 菜单项换页；播放页、底部弹层等占历史的层内链接 | `stack.leave(path)`：先退回打开浮层前的历史条，再新开目标页，返回直接回原页不留空条         |
| 删除当前页实体、退出登录                       | `层.leaveTo(path)`：替换打开前的历史条，返回不再回来；业务写入仅在返回 `'committed'` 后执行 |

- `path` 须先用 `resolve()` 拼好；`stack.holdsHistory` 决定 `songs/CreditName.svelte` 等链接是否拦截改走 `stack.leave`。
- 忙态层（上传封面、导出写文件中）拦截换页，使 `leave` / `leaveTo` 返回 `'cancelled'`。

## 测试与浏览器焦点

- **单测**：`tests/unit/overlay-stack.test.ts` 用 `scene()` 与内存历史适配器 `tests/_kit/overlay-history.ts` 模拟 `failNext` / `holdNext` / `cancelNext` 及 `back` / `forward` / `navigate` / `reload`，断言 `stack.top` 与 `history` 状态。改动 `overlay-history.svelte.ts` 时须走 [delivery.md](./delivery.md) 的浏览器例外。
- **焦点循环与重置**：`DialogShell`、播放页与手机播放队列共用 `modal-focus.ts` attachment 在当前可见启用控件间循环 `Tab` / `Shift+Tab`（嵌套仅由最顶层模态接管，关闭后等 DOM 解锁 `inert` 再归还焦点）。`MenuOverlay` 每次请求、账号菜单每次打开均重新初始化列表焦点，即便退出动画未完也不沿用上次失焦节点。真实键盘路径回归在 `tests/browser/journeys/keyboard.spec.ts`。
