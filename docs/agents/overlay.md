# 浮层栈

加一种菜单、弹窗或底部弹层，从浮层里换页，改返回、前进、焦点归还时读。代码在 `src/lib/components/overlay/`。

## 三个文件

- `overlay-stack.ts`：纯核心，不碰 DOM 和 Kit。层的开关、转交、占用的浏览记录、焦点归还、忙时钉住都在这里，行为改动改它，测试在 `tests/overlay-stack.test.ts`。
- `overlay-history.svelte.ts`：核心的历史端口（`read` / `write` / `go` / `leave`）在 Kit 上的实现。只有端口的签名或语义要变时才读它。
- `overlays.svelte.ts`：登记表。每一层的历史策略、组件、关闭钩子都在这里登记；组件里用 `getOverlays()`（`overlay-context.ts`）取到层和 `stack`。

## 加一层

1. `overlay-requests.ts` 加请求类型：菜单类继承 `MenuRequest`（有锚点是浮动菜单，没锚点是底部弹层），弹窗类继承 `DialogRequest`。
2. `overlays.svelte.ts` 里 `register<请求>('名字', menu | dialog | 自定义选项, 组件)`，并加进末尾的返回对象。给了组件的层由 `OverlayHost` 统一挂载。
3. 组件：菜单套 `menu/MenuOverlay.svelte`（条目数据见 `menu/menu.ts`，行和键盘在 `MenuList`），弹窗套 `overlay/DialogShell.svelte`。
4. 从这一层换到另一层：`当前层.transfer(目标层, 请求)`，同一个位置、焦点交过去。菜单里转交或换页的条目设 `closeOnChoose: false`，这一层由栈撤掉，壳不再关一次。

## 哪些层占浏览记录

占了记录的层，系统返回先关它。

| 层 | 占不占 |
|---|---|
| `menu` 策略 | 底部弹层占，浮动菜单不占 |
| `dialog` 策略 | 手机占，桌面不占 |
| 播放页、手机播放队列 | 占 |
| 多选 | 手机占，桌面不占 |
| 桌面播放队列面板 | 不占 |

## 从浮层里换页

| 场景 | 用法 |
|---|---|
| 没有层占着记录时页面里的链接 | 普通 `<a>`；换页时栈自动撤掉看得见的层 |
| 菜单项换页；播放页、底部弹层这类占着记录的层里点链接 | `stack.leave(path)`：先退回打开这些层之前那一条，再新开一条。返回回到原页，不留空记录 |
| 删除当前页的东西、退出登录 | `层.leaveTo(path)`：替换掉打开前那一条，返回不再回来。业务写入只在它返回 `'committed'` 后做 |

- `path` 用 `resolve()` 拼好再传。
- `stack.holdsHistory` 表示有没有层占着记录：`songs/CreditName.svelte` 用它决定要不要拦下链接、改走 `stack.leave`。
- 忙着的层（上传封面中、导出写文件中）拦得住换页：这时 `leave` / `leaveTo` 返回 `'cancelled'`。

## 测试

`tests/overlay-stack.test.ts` 顶部的 `scene()` 建好栈和内存历史（`tests/harness/overlay-history.ts`），`register` 默认占记录、modal。

- 内存历史的 `failNext` / `holdNext` / `cancelNext` 模拟历史操作失败、卡在半路、被取消；`back` / `forward` / `navigate` / `reload` 模拟浏览器。
- 断言 `stack.top`、`history.url`、`history.index`、`history.length`。

内存历史只证明核心。改了 `overlay-history.svelte.ts` 时，走 `delivery.md` 第 3 步的例外。
