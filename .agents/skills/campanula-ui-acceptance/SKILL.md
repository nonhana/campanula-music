---
name: campanula-ui-acceptance
description: Campanula 界面票的设计参照和验收截图。Use when 实现或验收改界面的票、对照原型的截图基准、拍 390×844 / 1440×900 验收截图、截加载中/空/出错状态。
---

界面票从设计参照到交给作者看截图的做法。目标是 **省**：设计从原型的源码读（文字，一次读完），图片只在对照时每张看一次，截图成批拍、结果落在文件里。

## 1. 设计参照：读原型源码

选定的视觉方案是原型 A，源码在作者本机的工作目录 `../campanula-prototype-visual/src/lib/prototype/variants/a/`（拖拽相关在 `../campanula-prototype-dnd/`）。没有这个目录时用 `git show origin/prototype/visual:src/lib/prototype/variants/a/<文件>`。

- 按画面找组件：手机是 `Phone*.svelte`，桌面是 `Desktop*.svelte`，例如歌单页是 `PhonePlaylist` / `DesktopPlaylist`，曲库首页是 `PhoneLibrary` / `DesktopHome`。
- 布局、间距、文案、各种状态都写在源码里；设计规则以 `DESIGN.md` 为准，两边冲突时问作者。
- 要看交互，在原型目录里 `pnpm dev`，地址参数见 `docs/prototype/visual.md`「交付物」。

完成标准：说得出这张票每个画面的布局、文案和加载中/空/出错的样子，每一条都有源码出处。

## 2. 截图基准：每张看一次

基准图在 `_notes/baselines/final/`（拖拽的在 `dnd/`），文件名和原型分支 `static/prototype/shots/final/` 一样，后缀是 `.jpg`。目录不存在或原型分支更新过，在仓库根目录跑一次：

```sh
sh .agents/skills/campanula-ui-acceptance/scripts/baselines.sh
```

- 只读票里列出的、或这张票画面对应的那几张，`read` 每张一次。
- 看完马上用一两句文字记下要对照的点（例如“头部 200px 封面，右边标题、元信息、操作行，搜索框右对齐”）。之后对照靠这段文字；早先读过的图可能已经不在上下文里，再读一遍也看不到更多。
- 不读原型分支上的 PNG 原图（2 倍屏，桌面 1800 宽）。

完成标准：每张需要的基准图都有一段文字记录。

## 3. 开发时看渲染

开发服务器（`pnpm dev`，端口 5173）开着，用 Chrome DevTools 工具看作者那个 Chrome 标签页：`list_pages` 里打开着 `localhost:5173` 的那个，编号会随浏览器重连变（`sweep.py` 自己找）。

- 一次 `evaluate_script` 里做完一串操作和检查（输入、点击、滚动、读结果），不要每一步一个调用。
- `navigate_page` 返回时页面可能还没画出来，先等要看的元素出现再 `take_screenshot`，否则会截到白屏。
- 手机曲库的“我喜欢 / 歌单”标签用 `replaceState` 切换，不留浏览记录。在标签页上 `history.back()` 会离开 App，测“返回恢复滚动”要从歌单页返回。
- 手机视口和桌面视口互换（`emulate` 的 `mobile` 变了）会重新加载页面：页面里装的脚本、播放队列都没了。先换视口，再放歌、再装脚本。
- `emulate` 没有“减少动态效果”。用 `sweep.py` 的 `reduced=True` 模拟：它让样式表里真正那条媒体查询生效，读到的是真的 CSS 变量；但仍是模拟，交付时请作者在 DevTools 的 Rendering 面板里真开一次。模拟装在页面里，换回正常动效要重新打开页面（`motion`、`slow` 会自己做，还在就报错）。
- 页面藏到后台：在这个 Chrome 连接下开新标签页，原来的页面仍是 `visible`。用 `sweep.py` 的 `hidden()`（或 `HIDE_JS` / `SHOW_JS`）在页面里改 `visibilityState`。

## 4. 验收截图：交给子代理成批拍

用 `task` 开一个子代理拍截图，主会话不进截图循环。给子代理的内容：这个 skill 的名字、票号、截图清单（每张写画面、视口和状态）、第 2 步记下的对照要点、开发服务器已经开着。子代理在 Python eval 里：

```python
%load .agents/skills/campanula-ui-acceptance/scripts/sweep.py
```

```python
report = await shoot(22, [...])   # 票号用数字或字符串都行；每张的字段见 sweep.py 里 shoot 的注释
```

调 `shoot`、`motion`、`slow` 的 eval 单元格给 `timeout: 300`：一组要调几十次 DevTools，默认 30 秒会超时，超时会清掉 eval 里定义的东西，要重新 `%load`。

`shoot` 按清单换视口、装拦截、打开页面，等画面出现后再截图，存到 `_notes/screenshots/issue-<票号>/<名字>-<宽x高>.png`。它只返回每张的结果，图片留在文件里。等不到画面、拦截没装上、本机数据库没清掉时直接报错，不会存一张错的图。

清单要覆盖：
- 这张票的每个画面，390×844（`phone`）和 1440×900（`desktop`）各一张。`name` 用对应基准图的文件名去掉 `-mobile` / `-desktop`，例如 `library-playlists`，对照时一眼能配上；
- 加载中、空、出错、搜不到这几种状态；
- 这张票新加或改过的页面，在 `768`、`1024` 下各一张（结果里的 `overflow` 要为空）。

拦截规则写在每张的 `intercept` 里，格式是 `{'path': 地址正则, 'after': 前几个放行, 'reply': 'hold' 或 {'status', 'body'}}`（详见 `scripts/intercept.js` 开头）。**规则按先后匹配，第一条命中的生效**：针对某张歌单的规则放在前面，通配的放在后面。

| 状态 | 怎么拍 |
|---|---|
| 加载中 | `fresh`，`^/api/playlists/\d+/track-ids$` 回 `'hold'`，`ready: '[aria-busy=true]'` |
| 出错 | `fresh`，先写这张歌单的 track-ids 回 `{'status': 502, 'body': {'error': {'kind': 'neteaseUnavailable'}}}`，再写通配的 track-ids 回 `'hold'`，`ready: 'main [role=alert]'` |
| 空 | `fresh`，先写这张歌单的 track-ids 回 `{'body': {'trackIds': []}}`，再写通配的 `'hold'`，`text: '这张歌单还没有歌'` |
| 只同步了一部分 | `fresh`，`^/api/songs$` 设 `after: 1`、回 `'hold'`（我喜欢的音乐只同步第一页） |
| 搜不到、搜索结果 | `act` 里往搜索框填值并派发 `input` 事件 |

`fresh: True` 会清空本机副本，让歌单回到“还没同步”。拍完后 `shoot` 会清掉拦截规则，把浏览器换回桌面视口并打开首页，App 在后台用作者的真账号重新同步（约 100 个请求，一两分钟），不用等它同步完。所以只给要“还没同步”的那几张加 `fresh`。

子代理拍完后，逐张看一次截图，和对照要点比。截图是 2 倍屏，基准图是缩小过的，比布局、文案和状态，不比像素。把发现的不一致报回主会话。原型里有、但属于之后的票的东西（例如搜索、每日推荐的入口，专辑、歌手标签）写明“之后的票做”，不算不一致。

### 动效逐帧

改了动效的票（DESIGN.md Motion），每个改过的动效拍一组逐帧，再在“减少动态效果”下拍一组。同一个 eval 里：

```python
r = await motion(51, 'wheel-page-next', 'desktop', [0, 60, 150, 300, 600],
                 path='/', setup='play-open', trigger='page-next', grab='page')
```

- `motion` 触发变化，等 `grab`（或 `when`）上的动画开始，把它们停在 `times` 的每个毫秒数各拍一张，存成 `<名字>-f<毫秒>-<宽x高>.png`。带延迟的（歌名晚 80ms 才飘）也拍得到，拍到某一帧时已经走完的会真的走完。转圈、骨架这类循环不冻。各参数见 `sweep.py` 里 `motion` 的注释。
- `setup`、`trigger`、`grab` 可以写 `sweep.py` 里 `SETUPS`、`TRIGGERS`、`GRABS` 的名字（`'play'`、`'play-open'`、`'page-next'`、`'bar-previous'`、`'pick-other'`、`'page'`、`'bar'`…），也可以写自己的函数、选择器。播放页开着时播放条被盖住：拍播放条的组用 `setup='play'`、`path='/'` 重新打开。
- 结果里的 `anims` 是冻住的每个动画的时长和动的属性，对照 DESIGN.md 的数字；`reduced=True` 时只能有 `opacity`，不超过 150ms。
- 打断、连续触发（连按三次下一首、转到一半又切歌）用 `slow(票号, 名字, 视口, [(秒, 触发)…], [截图的秒…])`：动画放慢 10 倍，按墙上的时间触发和截图，文件名里的毫秒是折回的动效时刻。
- 看不见时不动：先 `await run(SETUPS['play-open'])` 摆好页面，再 `await hidden(['page-next', 'page-next'])`，后台期间和回来以后新开始的动画都应是 0，画面上只剩一张封面、一块歌名。
- 限速才看得到的（转圈晚 300ms 出现、封面淡入）加 `network='Slow 4G'`，拍完自己取消。封面淡入用 `on_load=True, grab='main img'`：它让网络图片重新下载，冻住新开始的淡入。
- 换页（View Transitions）不写 `grab`：`trigger` 点链接或 `history.back()`，冻住的是 `::view-transition-*` 上的动画，结果里的 `types` 是方向（up / down / left / right / fade）。冻着的时候新的一帧仍是活的（播放条的进度照常走）；过渡里 Chrome 把点按都交给 `<html>`，要点东西先拍完。
- 骨架换成内容：`grab='.revealing > *, [aria-busy=true]', when='.revealing > *'`，`setup` 里把那个请求拖慢一两秒（包一层 `window.fetch`），再从别的页面点进去，才看得到骨架。
- 静态截图要在“减少动态效果”下拍，`shoot` 每张加 `'reduced': True`。
- 看图用 `sheet(票号, 名字, [glob…], crop=…, height=…)` 把一组拼成一张，`read` 一次看完；每张缩放到 `height` 高，裁得很小也会放大。只看播放条时裁底部，例如桌面底栏 `crop=(0.335, 0.905, 0.5, 0.995), height=200`。

完成标准：清单里每张都拍了；结果里没有报错、`overflow` 为空；改过的每个动效都有一组逐帧和一组“减少动态效果”，`anims` 和 DESIGN.md 对得上；每张都对照过，不一致的已修好重拍，或者写明了原因。

## 5. 交给作者

截图留在 `_notes/screenshots/issue-<票号>/`。这个目录不进 git，作者在本机看。票里的留言列出截图的文件名和每张拍的是什么，不贴图、不贴链接。
