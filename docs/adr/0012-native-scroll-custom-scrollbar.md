# 滚动交给浏览器，只把滚动条换成自绘的

页面仍由浏览器滚动（窗口），歌词、播放队列这类区域各自用 `overflow: auto`。系统滚动条一律用 `scrollbar-width: none` 隐藏，换成一个自绘的滚动条组件：浮在内容上、不占宽度，滚动时出现，可以拖动、点空白处翻页（样子见 DESIGN.md 的 Scrollbar）。起因是作者 2026-10-14 报告的两件事：打开播放页时页面被加上 `overflow: hidden`，系统滚动条消失，整页横移一个滚动条的宽度，关掉时再移回来；系统滚动条的样子也和 Campanula 不搭。作者同日在下面的方案里选了这一种。

## Considered Options

- **照旧站（master 分支）把整个 App 放进自定义滚动容器**（`ScrollContainer.svelte`：一个固定高度的 div 在滚，自己画滑块）：控制力最大。但 SvelteKit 只恢复窗口的滚动位置，返回上一页要自己重写；按窗口计算的虚拟列表要改；空格、PageDown 要先让容器获得焦点才能滚。旧实现还有两个缺陷：内容高度一变就把滚动位置清零（`updateSizes` 里的 `scrollTop = 0`）；滑块不能用键盘，也不能点轨道。
- **只给系统滚动条换颜色（`scrollbar-color`、`::-webkit-scrollbar`），再用 `scrollbar-gutter: stable` 预留滚动条的位置**：最省事，也能止住横移。但滚动条一直占着宽度，样子只能改颜色和粗细，做不到“滚动时才出现、移上去变粗”。
- **OverlayScrollbars 这类库**：做法和本方案一样（原生滚动 + 自绘滑块），但我们只需要一个很小的组件，不值得多一个依赖。

## Consequences

- 系统滚动条不占宽度，锁住滚动（播放页、弹窗）时页面不再横移，不需要 `scrollbar-gutter`。
- 滚动位置只由浏览器和听众决定：自绘滚动条只读滚动位置，除了听众拖滑块、点空白处，绝不写滚动位置。
- 键盘滚动、辅助技术、返回时恢复滚动位置、虚拟列表、View Transitions（ADR-0011）都照旧。
- 不接管滚轮和触控板的手感，不用 JS 模拟平滑滚动。“滚动行为”只用 CSS 和少量代码定：滚到某处时平滑滚动、横向架子的吸附、`overscroll-behavior`、顶栏下面的 `scroll-padding-top`。
- 装成应用后，Android 上往下拉会不会触发刷新要在真机上确认（刷新会打断播放）；会的话用 `overscroll-behavior-y: none` 关掉。
- 手机长列表的快速定位窄条（#36，`docs/prototype/dnd.md`）以后接在同一个组件上。
