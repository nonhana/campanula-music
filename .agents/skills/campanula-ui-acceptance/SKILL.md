---
name: campanula-ui-acceptance
description: Campanula 界面票的设计参照，和作者点名时的截图、浏览器检查工具。Use when 写界面票前读原型源码；作者要求拍截图、对照原型基准、查骨架挪位置、返回恢复位置、键盘焦点、动效逐帧。
---

两种用法：

- **写界面票**：只用第 1 步，从原型源码读设计。验收由作者亲手试用（`docs/agents/delivery.md` 第 3、6 步），截图和浏览器检查不是交付步骤。
- **作者点名**（“拍一下 …”“查一下返回位置”“拍这个动效的逐帧”）：只做作者点到的那几项，用第 2–5 步的工具。目标是 **省**：基准图的对照要点存成文字，成批的检查和截图交给子代理，结果落在文件里，主会话只看结论。

## 1. 设计参照：读原型源码

选定的视觉方案是原型 A，源码在作者本机的工作目录 `../campanula-prototype-visual/src/lib/prototype/variants/a/`（拖拽相关在 `../campanula-prototype-dnd/`）。没有这个目录时用 `git show origin/prototype/visual:src/lib/prototype/variants/a/<文件>`。

- 按画面找组件：手机是 `Phone*.svelte`，桌面是 `Desktop*.svelte`，例如歌单页是 `PhonePlaylist` / `DesktopPlaylist`，曲库首页是 `PhoneLibrary` / `DesktopHome`。
- 布局、间距、文案、各种状态都写在源码里；设计规则以 `DESIGN.md` 为准，两边冲突时问作者。
- 要看交互，在原型目录里 `pnpm dev`，地址参数见 `docs/prototype/visual.md`「交付物」。

完成标准：说得出这张票每个画面的布局、文案和加载中/空/出错的样子，每一条都有源码出处。

## 2. 截图基准：先读对照要点

基准图在 `_notes/baselines/final/`（拖拽的在 `dnd/`），文件名和原型分支 `static/prototype/shots/final/` 一样，后缀是 `.jpg`。目录不存在或原型分支更新过，在仓库根目录跑一次：

```sh
sh .agents/skills/campanula-ui-acceptance/scripts/baselines.sh
```

每张基准图的对照要点存在 `_notes/baselines/notes.md`，一张一段，段首是文件名：

- 先读 notes.md 里这张票要的那几段。
- 缺哪张的段落，才 `read` 那张图，看一次，马上写一段补进 notes.md（例如“头部 200px 封面，右边标题、元信息、操作行，搜索框右对齐”）。之后对照靠这段文字，不再读图。
- 重跑过 baselines.sh 的，改过的那几张重看一次、改段落。
- 不读原型分支上的 PNG 原图（2 倍屏，桌面 1800 宽）。

完成标准：这张票要的每张基准图，notes.md 里都有一段。

## 3. 浏览器：专用窗口

浏览器是专用窗口 `scripts/axi`（chrome-devtools-axi 的 campanula 会话，看得见的窗口；作者在里面扫码登录过，登录存在 `~/.cache/campanula-axi/chrome-profile`，关掉重开还在）。开发服务器（`pnpm dev`，端口 5173）要开着。作者平时用的 Chrome 不碰。这个窗口连的是作者的真账号：

- 点红心、收藏、加入歌单这类按钮会真的写进网易云。检查和截图里不点它们；要拍它们的状态，先装拦截（第 4 步），或者断网（`emulate` 的 `networkConditions: 'Offline'`，App 断网时不发请求）。
- 拦截按路径匹配、不分请求方法：`/api/hearts` 的同步读取和红心写入是同一个路径，拦不开，红心只能断网拍。收藏、加歌的路径（`/api/(playlists|albums|artists)/\d+/(collect|tracks)`）只有写入，拦得开（#30）。

- 开发时看一眼：`scripts/axi eval "<js>"`、`scripts/axi screenshot <文件>`、`scripts/axi emulate --viewport 390x844x2,mobile,touch`。几步连着做就写进一次 `scripts/axi run <<'EOF' … EOF`（脚本里 `await page.open(地址)`、`await page.eval(() => …)`、`console.log` 结果）。`scripts/axi open` 每次都打印整页结构（最多 16k 字），只换页面时用 `run` 里的 `page.open`。
- 每打开一次页面，开发服务器都用作者的账号问网易云（账号、曲库同步、页面要的数据）。连着重开十几次会被网易云限流（#32）；反复开页面的检查和截图走第 4 步的 sweep.py，它重放存下的回答。
- 专用窗口没登录了（扫码过期）：`scripts/axi run` 打开 `http://localhost:5173/`，停下来请作者在那个窗口里扫码。
- 页面里的等待都要有上限：等元素、等文字用轮询，最多几秒；等图片看 `img.complete`，不用 `await img.decode()`（#32 一直不返回，把 DevTools 连接卡死，之后七次调用全失败）。
- 浏览器卡住、连不上：`scripts/axi stop`，再跑任意一条 `scripts/axi` 命令会重开（登录还在）。
- 手机曲库的“我喜欢 / 歌单”标签用 `replaceState` 切换，不留浏览记录。在标签页上 `history.back()` 会离开 App，测“返回恢复滚动”要从歌单页返回。
- 手机视口和桌面视口互换（`emulate` 的 `mobile` 变了）会重新加载页面：页面里装的脚本、播放队列都没了。先换视口，再放歌、再装脚本。
- `emulate` 没有“减少动态效果”。用 `sweep.py` 的 `reduced=True` 模拟：它让样式表里真正那条媒体查询生效，读到的是真的 CSS 变量；但仍是模拟，回给作者时说明这一点，真的效果要他在 DevTools 的 Rendering 面板里开。模拟装在页面里，换回正常动效要重新打开页面（`motion`、`slow` 会自己做，还在就报错）。
- 页面藏到后台：开新标签页不会让原来的页面变成 `hidden`。用 `sweep.py` 的 `hidden()`（或 `HIDE_JS` / `SHOW_JS`）在页面里改 `visibilityState`。
- 量帧时间、长任务用 `pnpm build && pnpm preview`：开发服务器上 Svelte 的开发模式检查会把数字放大。

## 4. 检查和截图：作者点名时交给子代理，用 sweep.py

只做作者点到的那几项。用 `task` 开一个子代理做，主会话不进这个循环、不看截图。给子代理的内容：这个 skill 的名字、票号、作者要的那几项（画面、视口、状态、要点的链接）、第 2 步的对照要点、开发服务器已经开着；页面上有会写账号的按钮时，再给它第 3 步那两条和要装的拦截规则。子代理在 Python eval 里：

```python
%load .agents/skills/campanula-ui-acceptance/scripts/sweep.py
```

```python
report = await shoot(22, [...])   # 票号用数字或字符串都行；每张的字段见 sweep.py 里 shoot 的注释
```

调 `shoot`、`roundtrip`、`motion`、`slow` 的 eval 单元格给 `timeout: 300`：一组要调几十次 DevTools，默认 30 秒会超时，超时会清掉 eval 里定义的东西，要重新 `%load`。

### 清单：作者点到哪项做哪项

| 作者要的 | 做什么 | 完成标准 |
|---|---|---|
| 新的、改过的画面 | `shoot`：每个画面 390×844（`phone`）和 1440×900（`desktop`）各一张 | 每张 `moves`、`errors` 都是空的；逐张对照过 |
| 新的骨架（加载中） | 同上：`shoot` 等骨架换成内容再截，这一下里各块挪没挪位置记在 `moves` | `moves` 是空的 |
| 能点进别的页面再返回的列表、网格、横向架子 | `roundtrip(票号, 地址, 链接的选择器, shelf=(架子名, 横向滚多少))` | `same` 是 True |
| 新的标签、菜单、键盘操作 | `keys(['Tab', 'ArrowRight', …], focus=起点的选择器)` | 每一步焦点落在该落的地方，`ring` 是 True |
| 换了宽度会变的布局 | `shoot` 抽查 `768`、`1024` | `overflow.pageWider` 是 False（横向架子里的格子伸出视口不算） |

`name` 用对应基准图的文件名去掉 `-mobile` / `-desktop`，例如 `library-playlists`，对照时一眼能配上。截图存在 `_notes/screenshots/issue-<票号>/<名字>-<宽x高>.png`，`shoot` 只返回每张的结果。等不到画面、拦截没装上、本机数据库没清掉、等了 10 秒还在加载时直接报错，不会存一张错的图。

### 接口重放

每个 `/api/` 的 GET 第一次真去问（开发服务器再用作者的账号问网易云），成功的回答存进 `_notes/replay/issue-<票号>.json`，之后打开页面都从这里回，晚 600ms（骨架照样出现，再换成内容）。一批截图、检查只问网易云几次。要最新的数据就删掉这个文件；比 300 KB 大的回答（几千首歌的整页）不存，每次照样真去问。

### 挪位置和报错

`shoot`、`roundtrip` 每次打开页面都装上记录：没人操作（最近 500ms 没有按键、点按）时 main 里的标题、section、标签管的内容区在排版里挪了超过 1px，记进 `moves`（谁、什么时候、`dy`，正数是往下）；飘入、换页这些动画的位移不算。`console.error` 和没接住的异常记进 `errors`。骨架和真内容不一样高、骨架套了两层淡出（开发时 `fadeAway` 会报错），都会出现在这里。不用浏览器自带的布局偏移记录：#32 里骨架换成内容时标题挪了 112px，它一条都没记。

### 拦截：截状态图

拦截规则写在每张的 `intercept` 里，格式是 `{'path': 地址正则, 'after': 前几个放行, 'reply': 'hold' 或 {'status', 'body'}}`（详见 `scripts/intercept.js` 开头）。**规则按先后匹配，第一条命中的生效**：针对某张歌单的规则放在前面，通配的放在后面。规则先于重放。

| 状态 | 怎么拍 |
|---|---|
| 加载中 | `fresh`，`^/api/playlists/\d+/track-ids$` 回 `'hold'`，`ready: '[aria-busy=true]'` |
| 出错 | `fresh`，先写这张歌单的 track-ids 回 `{'status': 502, 'body': {'error': {'kind': 'neteaseUnavailable'}}}`，再写通配的 track-ids 回 `'hold'`，`ready: 'main [role=alert]'` |
| 空 | `fresh`，先写这张歌单的 track-ids 回 `{'body': {'trackIds': []}}`，再写通配的 `'hold'`，`text: '这张歌单还没有歌'` |
| 只同步了一部分 | `fresh`，`^/api/songs$` 设 `after: 1`、回 `'hold'`（我喜欢的音乐只同步第一页） |
| 搜不到、搜索结果 | `act` 里往搜索框填值并派发 `input` 事件 |

`fresh: True` 会清空本机副本，让歌单回到“还没同步”，之后整个曲库要真的重新同步（约 100 个请求，比重放的上限大的照样真去问）。所以只给要“还没同步”的那几张加 `fresh`。

子代理做完后逐张看一次截图，和对照要点比。截图是 2 倍屏，基准图是缩小过的，比布局、文案和状态，不比像素。只把结论报回主会话：每项的结果，不一致的写清哪张、哪里、什么样。原型里有、但属于之后的票的东西（例如搜索、每日推荐的入口，专辑、歌手标签）写明“之后的票做”，不算不一致。

### 动效逐帧

作者要看动效（DESIGN.md Motion）时，给他点名的每个动效拍一组逐帧；要看“减少动态效果”时，再在 `reduced=True` 下拍一组。同一个 eval 里：

```python
r = await motion(51, 'wheel-page-next', 'desktop', [0, 60, 150, 300, 600],
                 path='/', setup='play-open', trigger='page-next', grab='page')
```

- `motion` 触发变化，等 `grab`（或 `when`）上的动画开始，把它们停在 `times` 的每个毫秒数各拍一张，存成 `<名字>-f<毫秒>-<宽x高>.png`。带延迟的（歌名晚 80ms 才飘）也拍得到，拍到某一帧时已经走完的会真的走完。转圈、骨架这类循环不冻。各参数见 `sweep.py` 里 `motion` 的注释。
- `setup`、`trigger`、`grab` 可以写 `sweep.py` 里 `SETUPS`、`TRIGGERS`、`GRABS` 的名字（`'play'`、`'play-open'`、`'page-next'`、`'bar-previous'`、`'pick-other'`、`'page'`、`'bar'`…），也可以写自己的函数、选择器。播放页开着时播放条被盖住：拍播放条的组用 `setup='play'`、`path='/'` 重新打开。
- 结果里的 `anims` 是冻住的每个动画的时长和动的属性，对照 DESIGN.md 的数字；`reduced=True` 时只能有 `opacity`，不超过 150ms。
- 打断、连续触发（连按三次下一首、转到一半又切歌）用 `slow(票号, 名字, 视口, [(秒, 触发)…], [截图的秒…])`：动画放慢 10 倍，按墙上的时间触发和截图，文件名里的毫秒是折回的动效时刻。
- 抽屉（播放页、底部弹层）是 JS 补间，`motion`、`slow` 冻不住，用 `tween(票号, 名字, 视口, [毫秒…], trigger='bar-open', reset='page-close')`：每一帧从头触发一次，把补间停在那一毫秒拍。拖到一半松手弹回：`setup=drag_js(选择器, -200)`（按住往上拖 200px）、`trigger='release'`。先 `await run(SETUPS['play'])` 放好歌。
- 看不见时不动：先 `await run(SETUPS['play-open'])` 摆好页面，再 `await hidden(['page-next', 'page-next'])`，后台期间和回来以后新开始的动画都应是 0，画面上只剩一张封面、一块歌名。
- 限速才看得到的（转圈晚 300ms 出现、封面淡入）加 `network='Slow 4G'`，拍完自己取消。封面淡入用 `on_load=True, grab='main img'`：它让网络图片重新下载，冻住新开始的淡入。
- 换页（View Transitions）不写 `grab`：`trigger` 点链接或 `history.back()`，冻住的是 `::view-transition-*` 上的动画，结果里的 `types` 是方向（up / down / left / right / fade）。冻着的时候新的一帧仍是活的（播放条的进度照常走）；过渡里 Chrome 把点按都交给 `<html>`，要点东西先拍完。
- 骨架换成内容：`grab='.revealing > *, [aria-busy=true]', when='.revealing > *'`，从别的页面点进去才看得到骨架（重放的回答晚 600ms，骨架一定会出现）。
- 静态截图要在“减少动态效果”下拍，`shoot` 每张加 `'reduced': True`。
- 看图用 `sheet(票号, 名字, [glob…], crop=…, height=…)` 把一组拼成一张，`read` 一次看完；每张缩放到 `height` 高，裁得很小也会放大。只看播放条时裁底部，例如桌面底栏 `crop=(0.335, 0.905, 0.5, 0.995), height=200`。

完成标准：作者点到的每一项都做了，表里的完成标准都满足，结果里没有报错；每张截图都对照过，不一致的写清哪张、哪里、什么样。作者要了逐帧时，每组的 `anims` 和 DESIGN.md 对得上。

## 5. 交给作者

截图留在 `_notes/screenshots/issue-<票号>/`。这个目录不进 git，作者在本机看。回复里列出截图的文件名和每张拍的是什么，不贴图、不贴链接。
