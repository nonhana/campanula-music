---
name: Campanula
description: 纯粹、简单、优雅的第三方网易云音乐播放器；手机和桌面共用一套设计系统
colors:
  morning-ground: "#F5FCF9"
  mint-mist: "#E8F8F1"
  mint-glass: "#D1F1E3"
  mint-line: "#B9EAD5"
  mint: "#A8E6CF"
  mint-sprout: "#59CFA3"
  mint-leaf: "#37BE8C"
  mint-stem: "#2B976F"
  deep-mint: "#206F52"
  forest-ink: "#1A5B43"
  paper: "#FFFFFF"
  peach-mist: "#FFF8F2"
  peach-wash: "#FFEEE2"
  peach-glow: "#FFE1CC"
  peach-ember: "#E6601F"
  peach-bark: "#B34719"
  coral-heart: "#FF3040"
  ink: "#111827"
  graphite-deep: "#1F2937"
  graphite-strong: "#374151"
  graphite: "#4B5563"
  graphite-soft: "#6B7280"
  hairline: "#E5E7EB"
  hairline-faint: "#F3F4F6"
  trial-wash: "#FFF8E1"
  trial-ink: "#BF360C"
  error-wash: "#FBE9E7"
  error-ink: "#D32F2F"
typography:
  headline:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  headline-sm:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  title-sm:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  micro:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "18px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  sheet: "24px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.deep-mint}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 20px 0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.forest-ink}"
  button-download:
    backgroundColor: "{colors.peach-wash}"
    textColor: "{colors.peach-bark}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 20px 0 16px"
    height: "40px"
  button-download-hover:
    backgroundColor: "{colors.peach-glow}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 20px 0 16px"
    height: "40px"
  button-icon:
    textColor: "{colors.graphite-strong}"
    rounded: "{rounded.full}"
    size: "40px"
  button-icon-hover:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.forest-ink}"
  button-destructive:
    backgroundColor: "{colors.error-ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "44px"
  chip-tag:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "24px"
  badge-trial:
    backgroundColor: "{colors.trial-wash}"
    textColor: "{colors.trial-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  badge-unavailable:
    backgroundColor: "{colors.hairline-faint}"
    textColor: "{colors.graphite-strong}"
    typography: "{typography.micro}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 8px 0 16px"
    height: "44px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "8px"
  nav-rail-item-active:
    backgroundColor: "{colors.mint-glass}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.lg}"
    height: "48px"
  song-row:
    rounded: "{rounded.lg}"
    height: "56px"
  song-row-now:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.forest-ink}"
  player-bar-desktop:
    backgroundColor: "{colors.paper}"
    height: "80px"
    padding: "0 20px"
  mini-player:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    height: "64px"
  play-button-large:
    backgroundColor: "{colors.forest-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "64px"
  bottom-sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sheet}"
  dialog:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
---

<!-- 2026-10-07 按视觉原型选定方案（变体 A · 分区首页，并入 B 的波浪进度条、胶囊按钮、封面染底）重写。证据：prototype/visual 分支的 src/lib/prototype/variants/a/、uno.config.ts、static/prototype/shots/final/。 -->

<!-- 2026-10-14 动效方向 B「封面是主角」（作者定）：Overview 加 Motion，Layout 加滚动，Components 加 Cover Wheel、Overlays、Scrollbar，并改了 Navigation、Song Row、Morning Row、Player Bars、Lyrics 的动效；减少动态效果改成保留 150ms 以内的淡入淡出。技术选择见 ADR-0011、ADR-0012。 -->

# Design System: Campanula

## Overview

**Creative North Star: "清晨的风铃草"**

Campanula 是风铃草。界面像清晨窗边的一株风铃草：整页是一层带薄荷味的晨光底，白色面板是轻轻浮在上面的纸，薄荷绿只出现在“被选中”“正在走”的地方：正在播放的那一行、进度、焦点、当前的导航项。画面里真正浓烈的颜色来自歌曲封面，它们大多是色彩饱满的动漫插画；界面退在封面后面，给它让位。

手机和桌面共用这一套系统，区别只在布局和交互方式。手机照 Auxio 的交互：顶部文字标签、Auxio 式歌曲行、浮起的迷你播放条、底部弹层。桌面以原来的 Campanula 为蓝本：64px 顶栏（搜索框在正中）、72px 图标侧栏、内容区、80px 底部通栏。桌面打开是整个曲库的分区总览：我喜欢的音乐（三行横向歌曲格）、每日推荐方块、歌单、专辑、歌手。播放页是一层由当前封面染出的淡雾，进度是一条柔和的波浪线，歌词逐字点亮。

这套系统拒绝四样东西：Tailwind 默认观感；用 emoji 或 Unicode 字符当图标；只在悬停时出现的操作；粉彩色底上放白字。

**Key Characteristics:**

- 浅色唯一（ADR-0008），整页底色是晨光底，不是灰。
- 白色面板带极淡的环境光阴影；只有真正浮起的层（菜单、弹层、播放条）才有更明显的阴影。
- 颜色有固定分工：薄荷 = 选中与进度，珊瑚 = 红心，蜜桃 = 本机与下载；封面是画面里最饱和的东西。
- 胶囊形按钮：主要动作是实心深绿，下载是浅蜜桃，次要是描边白。
- Noto 可变字体（自托管），只用 400 / 500 / 600 三个真实字重；日文、繁体按 `lang` 切换字体。
- 签名动作“晨光行”：正在播放的那一行，被一层浅薄荷光从歌名开始往右慢慢铺开。
- 动效是“飘入飘出”：东西从来的方向轻轻飘来、停稳，离开时先淡再走，不弹跳；封面是主角，动效跟着封面走。
- 第二个签名动作“换碟”：切歌时，封面像挂在一个看不见的转盘上，下一张沿弧线转到正中。

### Motion（飘入飘出）

动效只回答三件事：刚才的操作生效了没有、东西从哪来到哪去、现在是什么状态。它像晨风里的花瓣和薄雾：轻轻飘来、停稳；离开时先淡、再走。封面是画面的主角，动效也跟着封面走：同一张封面从格子飞到页头、从歌曲行飞进播放条、从播放条长成播放页的大封面；切歌时换碟（见 Components 的 Cover Wheel）。

- **飘入**：透明度从 0 到 1，同时从来的方向漂过来停住（12px，整页 16px），先快后慢（`ease-out-soft`，`cubic-bezier(0.16, 1, 0.3, 1)`），不回弹。
- **飘出**：透明度从 1 到 0，往去的方向漂走（6px，整页 8px），越走越快（`ease-in-soft`，`cubic-bezier(0.4, 0, 1, 1)`），时长约是飘入的六成。新内容不等旧内容走完：飘出开始 60ms 后飘入就开始。
- **移动**：换位置、换大小（封面飞行、标签指示块、面板轨道、换碟）只用 `transform`，曲线同飘入。
- **方向**：进入下一层（曲库 → 歌单、专辑、歌手、设置）新内容从下面浮上来，旧的往上散；返回反过来，往下沉；同一层之间（手机曲库标签、歌词 / 播放队列、登录方式）按左右顺序横着走；下一首往左转走，上一首往右。
- **时长四档**：反馈 120ms（按下、图标切换）；状态 200ms、退场 120ms（行状态、菜单、提示）；面板和页面 360ms、退场 200ms（换页、歌词 / 播放队列、弹窗；抽屉保持 380ms）；主角 600ms（换碟；播放条里的小转盘和封面飞行 480ms）。整段换页不超过 0.5 秒。
- **依次飘入只在第一次出现**：一组东西整体第一次出现（骨架换成内容）时，前 6 个依次晚 30ms，其余和第 6 个一起；虚拟列表滚动时新挂上的行不飘；换页时整页一起飘，不逐行。
- **随时可打断**：每个动画都能从此刻的样子转向新的终点。连按三次下一首，转盘直接转向第三首；过渡中又点了别的页面，上一个过渡立刻结束。
- **看不见时不动**：页面在后台（锁屏、切走）时状态直接到位，回来时不补放。
- **不动布局**：只动 `transform`、`opacity`、`filter`、`clip-path`；不对 `width`、`height`、`top`、`margin` 做动画。例外只有一次性的布局变化：侧栏展开（200ms）、会推开内容的通知条展开和收起（200ms）。
- **图片**：封面加载完时从薄荷底上淡入（240ms）；挂上时已经解码好的（缓存里有）直接显示，不再淡一次。
- **减少动态效果**（系统设置里打开时）：去掉所有位移、旋转、缩放、飞行和循环动画（波浪流动、三根竖条、骨架扫光）；保留 150ms 以内的淡入淡出和颜色变化，状态变化仍然看得出来。拖动（抽屉、转盘）照样跟着手走，松手后直接到位。

### Named Rules

**The Float Rule.** 来有来处，去有去向：每个飘入都从它来的方向来，每个飘出都朝它去的方向走；不弹、不晃、不为好看而转。去掉以后听众会看不懂刚才发生了什么的动效，才值得做。

**The Cover Leads Rule.** 封面是主角，同一时刻只有一张封面在飞；飞行只落在已经加载好的图片上，终点看不见或图片没到，就退回普通的飘入。

## Colors

一组高明度的薄荷色做底和标记，配冷灰的文字，蜜桃和珊瑚各管一件事；粉彩色只当底色和标记，上面一律放深色字。

### Primary

- **晨光底**（`morning-ground`）：整页的底色，手机和桌面都是。
- **薄荷雾**（`mint-mist`）：白色面板上“正在播放”那一行的晨光、悬停底、标签 chip 的底。
- **薄荷玻璃**（`mint-glass`）：侧栏当前项的底；行放在晨光底上时（手机），晨光行用这一档才看得见；选中文字的底色。
- **薄荷线**（`mint-line`）：输入框、描边按钮悬停时的边框。
- **薄荷**（`mint`）：品牌原色，现在只是 `primary` 的默认值，界面上几乎不直接铺。
- **新芽绿**（`mint-sprout`）：只做装饰（例如浅色底上的小点）。白底上只有 1.9:1，不能当焦点或边框用。
- **叶绿**（`mint-leaf`）：logo（Lucide 的 flower 图形）的描边，一处不改。
- **茎绿**（`mint-stem`）：焦点环、输入框和搜索框获得焦点时的边框、波浪进度线已播放的部分、输入光标和 `accent-color`（原生勾选框、进度条；薄荷和叶绿在白底上都不到 3:1）。
- **深薄荷**（`deep-mint`）：主要按钮（播放全部、登录、重试）的底；白底上的薄荷色文字（链接、“查看全部”、“已收藏”）。
- **森林墨**（`forest-ink`）：最大的播放键；薄荷浅底上的文字和图标；主要按钮的悬停色。

### Secondary

- **蜜桃**（`peach-mist` / `peach-wash` / `peach-glow`）：属于“这台设备”的东西，包括下载按钮、离线提示条、下载中的进度底。
- **蜜桃枝**（`peach-ember`）：“已下载”的图标。
- **蜜桃木**（`peach-bark`）：下载、离线相关的文字。

### Tertiary

- **珊瑚心**（`coral-heart`）：实心红心，也是“我喜欢的音乐”的标记。只用在心形图标上，不当底色。

### Neutral

- **墨**（`ink`）：主文字。
- **石墨深**（`graphite-deep`）、**石墨重**（`graphite-strong`）：描边按钮的文字、图标按钮的图标。
- **石墨**（`graphite`）：次要文字（歌手、首数、说明）。
- **石墨淡**（`graphite-soft`）：第三级文字（时长、序号、提示），只放在白底或晨光底上。
- **发丝线**（`hairline`）：输入框和描边按钮的 1px 边框、波浪进度线未播放的部分。
- **淡发丝**（`hairline-faint`）：“无版权”徽标的底、面板里的分隔线。
- **纸白**（`paper`）：面板、播放条、弹层、菜单。

### Status

- **试听**（`trial-wash` 底 + `trial-ink` 字）：会员歌曲给非会员的试听徽标。
- **出错**（`error-wash` 底 + `error-ink`）：下载失败、删除歌单的确认键、出错状态的图标圆。

### Named Rules

**The Morning Light Rule.** 晨光底是晨光，白色是纸，薄荷绿只出现在“选中”“进度”“正在播放”上。画面里最饱和的颜色属于封面，不属于界面。

**The Dark Ink on Pastel Rule.** 粉彩色上只放深色字：薄荷浅底配森林墨（6.6:1 以上），蜜桃浅底配蜜桃木（4.8:1 以上）。白字只出现在深薄荷、森林墨、出错红这几种深色实心底上（6:1 以上）。

**The One Job per Color Rule.** 每种颜色只管一件事：珊瑚只是红心，蜜桃只是本机和下载，试听用琥珀色而不是蜜桃。不要拿它们来装饰。

## Typography

**Display Font:** 无单独的展示字体，标题与正文同一家族
**Body Font:** Noto Sans Variable（拉丁）→ Noto Sans SC Variable → Noto Sans JP Variable → Noto Sans TC Variable → system-ui；随项目打包，不从网络加载
**Label/Mono Font:** 无；数字一律用等宽数字（tabular-nums）

**Character:** 一套为多语言混排设计的无衬线字族，安静、中性；它的任务是把日文假名、英文、简繁中文排得一样整齐，而不是表现个性。

### Hierarchy

字号阶梯在 #18 定稿（2026-10-11，作者看过前后对比截图）：只有下面八档，UnoCSS 里写 `text-<档名>`（见 `uno.config.ts`；Wind 自带的 `text-sm`、`text-lg` 这类已经去掉）。不要写 `text-[13.5px]` 这种阶梯以外的字号。视觉原型里零散的 10 / 12 / 12.5 / 13.5 / 14.5 / 16 / 18 / 21 / 22 / 32px 都归到最近的一档。原来最大的一档 Display（44px）只给介绍页的大标题用，#19 起登录页不再有介绍（作者定，2026-10-11），这一档随之删掉；以后真有比 Headline 更大的标题，再重新定。

- **Headline**（600，28px，行高 36px，字距 -0.01em）：桌面的页面标题（歌单、专辑、歌手、已下载、搜索结果）。
- **Headline-sm**（600，24px，行高 32px，字距 -0.01em）：手机的页面标题、桌面播放页的歌名。
- **Title**（600，20px，行高 28px）：首页的区块标题（我喜欢的音乐、歌单、专辑、歌手）、手机播放页的歌名。
- **Title-sm**（600 或 500，17px，行高 24px）：弹窗标题、手机的区块标题、播放队列标题、空状态和出错的标题、logo 旁的 Campanula 字样（500）。
- **Body**（400 或 500，15px，行高 22px）：手机上的歌名、正文、说明；输入框里的字。
- **Label**（500 或 400，14px，行高 20px）：桌面的歌名、按钮文字、导航文字、chip。
- **Caption**（400 或 500，13px，行高 20px）：歌手、首数、时长、元信息、表头、提示、歌单标签。
- **Micro**（500，11px，行高 18px）：试听、无版权、未下载这类徽标。

每日推荐的日期大数字（桌面方块 56px、每日推荐页 88px、手机 72px，600，等宽数字）是图形，不算阶梯里的一档。数字一律用等宽数字（`tabular-nums`）。

### Named Rules

**The Three Real Weights Rule.** 只用 400 / 500 / 600 三个字重，而且都是字体文件里真实存在的字重（`font-synthesis: none`）。不再出现浏览器模拟出来的粗体。

**The Mixed Script Rule.** 显示歌名、歌手、专辑、歌单名的元素必须带 `lang`：含假名的标 `ja`，繁体标 `zh-TW`，其余跟随页面的 `zh-CN`。字体检查页逐字测过：按 `lang` 切换后，假名字宽一致，没有回退造成的空隙。

## Layout

- **桌面骨架**：64px 顶栏固定在晨光底上（菜单键、logo、返回、正中的搜索框、头像）；左侧图标侧栏 72px，菜单键展开成带文字的 220px，内容区跟着让位；内容区最大宽 1280px、左右 32px；底部通栏 80px。
- **桌面首页**：首次同步条 → 我喜欢的音乐（白色面板里的三行横向歌曲格，一屏 3.25 列，露出的半列淡入面板）和右侧 280px 的每日推荐方块 → 歌单封面网格（带 全部 / 自建 / 收藏 筛选）→ 专辑、歌手两排横向架子。区块之间 40px。
- **桌面歌单页**：沿用原来的两栏：左 208px 是曲库里的歌单（封面），右边是 200px 大封面的头部、操作行、歌单内搜索，下面是 56px 一行的虚拟列表。窄于 1024px 时左栏收起（768px 时留给列表的只剩约 390px），从曲库进出歌单。
- **桌面搜索**：顶栏搜索框挂下拉（历史 / 建议，无遮罩）；按搜索后，结果是内容区里的一页（单曲 / 歌单 / 歌手 / 专辑）。
- **手机骨架**：logo 行（搜索、每日推荐日历），文字标签（我喜欢 / 歌单 / 专辑 / 歌手），同步细条，Auxio 式歌曲行（左 16px、56px 高、无分隔线），底部离屏幕边 8px 的浮起迷你播放条，下面垫一层晨光底的渐隐；二级页面有返回栏。
- **播放页**：桌面左列（320–420px，窄于 1024px 时两栏按比例分）是封面、歌名、波浪进度、控制键、音量，右列是 歌词 / 播放队列；手机照 Auxio 的结构，一屏放下，不滚动。播放页是一层抽屉：打开时从底下升起，收起时缩回底下，整段 380ms、先快后慢地停住，离开顶部时露出 24px 的圆角，后面的曲库跟着压暗一点。桌面顶上正中有拖动把手，手机按住“正在播放”那一块，往下拖都跟着手走（挪过 10px 才开始拖，用鼠标是 2px；先往横里挪的不算）；松手时从按下的地方拖过自己露出来的高度的 1/4、或者往下一甩（整段拖动的平均速度超过 0.4px/ms）就收起，往回拖了或者没拖够就弹回（拖着时按了 Esc 或返回，松手就收起）；往拉开那边拉过头时有阻尼（拉过 v px 只走 8·(ln(v+1)−2) px，最多 48px），抽屉底下多垫 48px 同样的底色，不露出后面的页面。这几个数和 Vaul 一样；拖着时按了右键、切走了窗口，或者松开没传到页面上，这次拖动作废，弹回原处，右键菜单也不弹。从底栏、迷你播放条的封面和歌名往上拖（或一甩）同样能拉开它。手机的播放队列弹层也一样按自己的高度滑进滑出，拉手往下拖收起，底下那条“播放队列”往上拖拉开。
- **断点**：小于 768px 用手机布局，768px 及以上用桌面布局。操作细节按输入方式切换，不按宽度：窄窗口里用鼠标，右键仍是浮动菜单；触屏用底部弹层。悬停效果只给鼠标和触控板，UnoCSS 里写 `mouse:hover:`（`@media (hover: hover) and (pointer: fine)`）。
- **滚动**：页面由浏览器自己滚动（窗口），歌词、播放队列、横向架子、弹层在各自的区域里滚（ADR-0012）。系统滚动条一律隐藏、不占宽度，换成自绘的滚动条（见 Components 的 Scrollbar），所以播放页、弹窗锁住滚动时页面不会横移。程序滚到某处（滚到正在播放的那首、点当前标签回到顶部）用平滑滚动；不接管滚轮和触控板的手感。顶栏下面留出 `scroll-padding-top`，键盘操作和定位不会把内容藏到顶栏底下。
- **节奏**：以 4px 为基数，常用 8、12、16、20、24、32、40px。

## Elevation & Depth

纵深靠“底色分层 + 两档阴影”。整页是晨光底；白色面板用一层极淡的环境光阴影，轻轻离开底色；真正浮在内容上、可以关掉的东西（菜单、底部弹层、弹窗、浮起的播放条、搜索下拉）才用更明显的浮起阴影。播放页的纵深来自封面染出的淡雾：当前封面放大、重度模糊（64px，饱和度 1.15），盖一层 80% 的白纱，每首歌把页面染成自己的颜色，同时保持明亮、字可读。

### Shadow Vocabulary

- **环境光**（`box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07)`）：静止的白色面板、网格里的封面、搜索框。
- **浮起**（`box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18)`）：菜单、底部弹层、弹窗、底部播放条、手机迷你播放条、搜索下拉、播放页的大封面。

### Named Rules

**The Ambient Light Rule.** 静止的面板只用环境光；浮起阴影只给“浮在内容上、可以关掉”的层。阴影表达的是“纸离开桌面”，不是层级的高低。

**The Light-Only Fog Rule.** 封面染底永远是浅色的：白纱不低于 80%，深色封面上的次要文字也要保持 4.5:1。不做深色播放页。

## Shapes

柔和的圆角是主调。按钮、搜索框、标签、徽标的外形都是胶囊（全圆角）；白色面板和网格封面 16px / 12px；歌曲行和行内小封面 12px / 8px；底部弹层顶边 24px；徽标 6px。歌手头像、播放键、“正在播放”的小圆片是正圆。没有直角的封面，也没有粗描边。

## Components

### Buttons

柔和、安静、克制：胶囊形，按下时轻轻缩一点（98%），不和封面抢注意力。

- **Shape:** 胶囊（全圆角）；桌面 40px 高，手机 44px 高；图标按钮是 40 / 44px 的圆。
- **Primary:** 深薄荷底、白字、500 字重，左 16px 右 20px，左边带图标。例：播放全部、登录、重试、取消收藏的确认键。悬停变成森林墨。
- **Download:** 浅蜜桃底、蜜桃木字。例：下载。悬停加深一档。
- **Outline:** 纸白底、1px 发丝线、石墨深字。例：收藏 / 已收藏、清空、取消。悬停时边框变薄荷线、底色变成极浅的薄荷。
- **Icon:** 透明底、石墨重图标；悬停时变成薄荷雾底、森林墨图标。例：•••、上一首、下一首、播放模式。
- **Destructive:** 出错红底、白字，只用在删除歌单的确认键上。
- **Disabled:** 实心按钮变成发丝线灰底、石墨淡字；其他按钮降到 50% 不透明度。
- **Focus:** 2px 茎绿焦点环，离开元素 2px。整行可点的歌曲行、播放页的歌词行例外：焦点环画在行内 2px，不压到相邻的行。

### Chips

- **Tag:** 薄荷雾底、森林墨字、24px 高，用在歌单标签上。
- **Filter / History:** 纸白底 + 发丝线（搜索历史、歌单筛选、播放页歌词的翻译 / 音译开关）；选中时变成薄荷玻璃底 + 森林墨字；禁用时降到 50%。
- **Badges:** 试听（琥珀底琥珀字）、无版权、未下载（淡发丝底、石墨重字），11px、500 字重，跟在歌名后面。

### Cards / Containers

- **Corner Style:** 16px（面板）、12px（网格封面）。
- **Background:** 纸白，放在晨光底上。
- **Shadow Strategy:** 环境光（见 Elevation & Depth）。
- **Border:** 无。
- **Internal Padding:** 列表面板 8px；每日推荐方块、弹窗 20–24px。

### Inputs / Fields

- **Style:** 纸白底、1px 发丝线、胶囊形，44px（顶栏搜索、歌单内搜索）；表单输入框 12px 圆角。左边是搜索图标，有内容时右边出现清除按钮。
- **Focus:** 边框加粗成 2px 茎绿（白底上 3.6:1），外面加一圈 3px 的薄荷雾光环。新芽绿边框在白底上只有 1.9:1，看不出焦点，#18 换成了茎绿。
- **Error / Disabled:** 出错用出错红的边框和说明文字；禁用降到 50%。

### Navigation

- **桌面侧栏:** 72px 图标栏（曲库、每日推荐、已下载，设置在最下面），当前项是 48px 高、12px 圆角的薄荷玻璃底 + 森林墨图标；展开后显示 14px / 500 的文字。展开时文字在宽度开始变化 60ms 后淡入（160ms），收起时文字先淡出。
- **手机标签:** 我喜欢 / 歌单 / 专辑 / 歌手，选中是墨色 600 字重 + 下面一条 3px 的薄荷短线，未选中是石墨淡。换标签时，薄荷短线滑到新标签下面（360ms），和播放页的标签指示块一样。
- **返回:** 桌面顶栏有返回键（Alt ←），手机二级页面有返回栏。
- **页面切换（ADR-0011）:** 只有内容区在动，顶栏、侧栏、播放条原地不动。进入下一层：旧页往上飘出（8px，200ms），新页从下面 16px 浮上来（360ms）；返回反过来；手机曲库标签之间横着走（新页从所选标签那一侧进来，24px）。从格子点开歌单、专辑、歌手时，被点的那张封面飞到页头变成大封面（480ms），其余内容在它周围飘入；返回时飞回格子原来的位置，格子已经滚出屏幕就只飘。数据还没到、页头还是骨架时不飞。手机顶行（logo 行 ↔ 返回栏）和标签行跟着交叉淡化。系统返回手势自己放了预览动画时，不再叠一层。

### Song Row

56px 一行，单击（轻点）整行就播放，绝不要求双击。左边是序号（桌面）或封面（手机），歌名 + 歌手两行，桌面多出专辑、状态、时长列；最右边的“更多”按钮始终可见。桌面右键打开同一份菜单。

- **状态:** 已下载（蜜桃枝图标）、下载中（蜜桃进度）、排队、下载失败（出错红，可重试）、试听、无版权（整行降到 45%，不可播，徽标写明原因）、离线时没下载的歌（同样降到 45%，标“未下载”）。
- **点歌:** 半秒内讲清楚“它开始放了”。桌面行里的序号淡出、三根竖条从底下长出来，手机封面上的白色小圆片带着竖条淡入（200ms），歌名变成森林墨；上一首所在的行，竖条缩回序号。同时这一行的封面飞进播放条的封面位置（480ms，走一道很浅的弧线），落下时播放条里的歌名、歌手换成新的（旧的往上飘出，新的从下面飘入）。播放条还没出现时（第一次点歌），它先从屏幕底下浮上来（360ms），封面再落进去。点的就是正在放的那首，或者在播放页的播放队列里点歌时不飞（播放页里换碟）。连续快点几首，只有最后一首在飞。减少动态效果时不飞、竖条不长，只交叉淡化。

### Morning Row（晨光行，签名组件）

正在播放的那一行，被一层浅薄荷光从歌名左边缘开始往右慢慢铺开，长度等于播放进度；起点 16px 渐入，前沿 40px 渐隐，像晨光爬过桌面，而不是一根进度条。白色面板上用薄荷雾，晨光底上（手机）用薄荷玻璃。封面不被遮住，只在中间压一枚 28px 的白色小圆片，里面是三根森林绿的小竖条（暂停时停住）；桌面序号列也换成这三根竖条。换歌时，旧行的光在 300ms 里散掉，不是一帧消失；新行的光先从左边缘淡入（200ms），再随进度往右铺。减少动态效果时，光只在换进度时跳到位，竖条不动。

### Wave Progress（波浪进度条）

播放页的进度条：已播放的部分是一条缓缓起伏的正弦线（茎绿，3px），未播放的部分是一条平的发丝线；游标是 4×18px 的深薄荷圆角竖条，两端是等宽数字的时间。只在播放时起伏、流动；暂停（和拖动游标）时马上抹平成一条直线（160ms），再播放时 420ms 里渐渐起伏回来，线一直是 3px 粗。它是真正的滑块：拖动、点按跳转，←/→ ±5 秒，Home / End。常驻的播放条（桌面底栏、手机迷你条）用一条 2px 的平直进度线，不用波浪。减少动态效果时：线不流动，起伏直接切换不渐变，游标只跟着播放器报的进度跳（约 250ms 一次）。

### Player Bars

- **桌面底栏:** 80px、纸白、浮起阴影，顶边一条 2px 的薄荷进度线，它也是滑块：点按、拖动跳到那里（松手才跳，拖动时左边的时间跟着走），←/→ ±5 秒，Home / End；鼠标移上去、键盘聚焦、拖动时往下加粗到 4px，露出 4×14px 的深薄荷游标，点按区域是顶边上下 16px 高的一条。左边上一首 / 44px 森林墨圆形播放键 / 下一首 + 时间，中间封面和歌名（点开或往上拖拉开播放页），右边播放模式、音量、播放队列。
- **手机迷你播放条:** 64px、纸白、16px 圆角、浮起阴影，离屏幕边 8px；封面、歌名（500）、歌手、44px 圆形播放键、下一首，底边一条很细的进度线（只显示，跳进度在播放页）；轻点或往上拖打开播放页。
- **出现和换歌:** 播放队列里第一次有歌时，播放条从屏幕底下浮上来（360ms），清空时沉下去（200ms）。换歌时封面小窗里也是一个小转盘（见 Cover Wheel，480ms），歌名、歌手横着飘（12px），方向和换碟一样；在列表里点歌时是那一行的封面飞进来（见 Song Row）。
- **播放键:** 播放和暂停两个图标之间交叉淡化，新图标从 85% 放大到位（120ms）；取地址、缓冲超过 300ms 才淡入转圈，不在每次点歌时闪一下。
- **播放条 ↔ 播放页:** 拉开抽屉时，播放条上的小封面跟着抽屉拉开的比例长成播放页的大封面（位置、大小一起变，圆角 8px → 16px），收起时缩回去；拖动抽屉时同样跟着手走。减少动态效果时没有这段接力。

### Cover Wheel（换碟，签名动作）

切歌时，封面像挂在一个看不见的转盘边上：轴心在封面正下方，离封面中心 1.6 倍封面边长，相邻两张之间隔 28°。下一首时整个转盘逆时针转一格：当前封面沿弧线转向左下，边转边淡出；下一张从右下沿弧线转到正中，边转边淡入。上一首反过来。播放页 600ms，播放条的封面小窗 480ms，曲线 `ease-out-soft`，像用手拨了一下转盘，它自己慢慢停稳。歌名、歌手、专辑晚 80ms 跟着横着飘（旧的往左飘出 12px，新的从右边 16px 飘入）；封面染底同时交叉淡化（700ms）；波浪进度线已播放的部分用 200ms 收回起点，不是一下跳回去。

- **方向看换歌原因**（由 App 发布，不靠前后序号猜，随机播放时也对）：下一首、自动接续、跳过没有地址的歌、在播放队列里点歌，往左转；上一首往右转。重新打开时恢复播放队列不转；歌没变（播放队列里只有一首）也不转。
- **只在自己那一栏里转**：桌面播放页的封面转出左列的部分淡掉，不压到歌词；播放条的封面小窗是圆角裁切的。
- **手机：左右滑封面切歌。** 按住播放页的大封面左右拖，转盘跟着手转；松手时拖过一格的 1/4、或者往一边一甩（每秒 1000px），就切到上一首 / 下一首，不到就转回原位（240ms）。横着挪过 6px 才算拖，先竖着挪就不接管；轻点封面仍然是换成歌词。播放队列里只有一首时拖得动，但松手总是转回原位。
- **连续切歌**：转到一半又切了一首，转盘从此刻的角度直接转向最新那首，不把中间的歌一张张转完。
- **减少动态效果**：封面在原位交叉淡化（150ms）；手机上拖动时仍跟着手转，松手直接到位。

### Lyrics

逐字歌词：每个词是两层同样的字叠在一起，上层按唱到的比例裁切点亮，唱到一半的字只亮一半；当前行更大、更深，其他行更淡；当前行停在高度约 38% 的位置；点一行从那里开始放。听众自己滚动歌词后，3 秒内不跟着当前行走。只有逐行歌词时整行高亮。作词、作曲这类署名也是一行。翻译、音译各一个开关，这首歌没有时开关禁用，写明“无翻译”“无音译”。没有歌词时写“纯音乐，请欣赏”或“暂无歌词”；加载中是几条骨架，没取到时说明原因、能重试。减少动态效果时：滚到当前行直接跳过去不平滑滚动，字号直接变、颜色在 150ms 内渐变，逐字点亮跟着播放器报的进度跳；封面染底换歌时 150ms 交叉淡化；播放页和播放队列弹层打开、收起时直接到位，不滑动（拖动时照样跟着手走）。

- **歌词 / 播放队列（桌面）:** 两块并排放在一条轨道上，换标签时整条轨道和上面的指示块一起横着滑（360ms，`ease-out-soft`）。两块都一直挂着，歌词的滚动位置不丢；看不见的那块 Tab 不到。
- **封面 ↔ 歌词（手机）:** 换成歌词时，封面缩到 96% 并淡出（200ms），歌词从下面 16px 浮上来（360ms）；换回封面反过来。

### Overlays（菜单、弹层、提示）

- **浮动菜单、搜索下拉:** 从锚点那一侧飘出来：从 4px 外、98% 大小到位（200ms）；关掉时只淡出（120ms）。
- **底部弹层:** 和播放页同一套抽屉（380ms，跟手拖）。
- **弹窗:** 遮罩淡入（200ms）；弹窗从下面 8px、98% 大小飘到位（360ms），关掉时淡出（200ms）。
- **提示条（播放提示、同步提示，以后的“已加入歌单”）:** 从它所在的那条边飘进来（12px，200ms），走时淡出（120ms）。播放页打开、提示从底部换到顶部时交叉淡化，不跳；会推开下面内容的通知条（首次同步）用 200ms 展开、收起。
- **加载 → 内容:** 骨架淡出（120ms），内容淡入（240ms），前 6 个依次晚 30ms。
- **筛选（歌单的 全部 / 自建 / 收藏）:** 整个格子先淡出再淡入（120ms / 240ms），不让一个个格子各自挪位。

### Scrollbar（滚动条）

系统滚动条一律隐藏，换成一条自绘的细条，浮在内容上、不占宽度（ADR-0012）。页面、播放队列、桌面歌单页的左栏、横向架子、弹层都用同一个；歌词和首页的横向歌曲格不显示（歌词自己跟着当前行走，歌曲格有翻页键）。

- **样子:** 平时 4px 宽、全圆角、石墨淡 45% 不透明；鼠标移到它附近（贴边 16px 宽的一条）或正在拖时加粗到 8px，变成茎绿（这时它表示位置，和进度同类），和底栏进度线移上去会加粗是同一个手势。
- **出现和消失:** 滚动时淡入（120ms），停下 1 秒后淡出（200ms）；鼠标停在它附近、正在拖时一直显示；内容不比区域高时没有。
- **操作:** 拖滑块跟手滚；点滑块上下的空白处翻一屏（平滑滚动）。键盘照常用方向键、空格、PageUp / PageDown、Home / End 滚（浏览器自己的滚动）；滑块不进 Tab 顺序，和系统滚动条一样。
- **位置:** 页面的那条贴着窗口右边，桌面从顶栏下沿到底栏上沿，手机从顶行下沿到迷你播放条上沿；区域里的那条贴着区域右边，横向的贴着底边。
- **触屏:** 只在滚动时显示，不能拖。手机长列表的快速定位窄条（#36，`docs/prototype/dnd.md`）以后接在它上面。
- **不改滚动位置:** 除了听众拖滑块、点空白处，它从不写滚动位置；内容高度变了也不动。

## Do's and Don'ts

### Do:

- **Do** 让封面承担画面里最饱和的颜色；薄荷只用在选中、进度、正在播放、焦点上（The Morning Light Rule）。
- **Do** 在粉彩浅底上放深色字：薄荷浅底配森林墨，蜜桃浅底配蜜桃木（The Dark Ink on Pastel Rule）。
- **Do** 主要动作用实心深绿胶囊，下载用浅蜜桃胶囊，次要用描边白胶囊。
- **Do** 统一用 Lucide 线条图标；文案里提到“更多”菜单时，画出同一个图标，或者直接写“更多”。
- **Do** 显示歌名、歌手、专辑、歌单名时带上 `lang`。
- **Do** 加载中用形状一致的骨架行，放在列表本来的位置上；空、出错、离线都要写清楚发生了什么、能怎么办。
- **Do** 头部的首数、已下载数和下面实际显示的列表对得上。
- **Do** 每个动效都说得出它在解释什么：操作生效了、东西从哪来到哪去、现在是什么状态（The Float Rule）。
- **Do** 新的动效同时写好“减少动态效果”时的样子：去掉位移，留下 150ms 以内的淡入淡出。

### Don't:

- **Don't** 在薄荷、蜜桃、珊瑚的粉彩底上放白字。
- **Don't** 使用近黑的中性色（`#111827`）当按钮的实心底色；实心按钮只有深薄荷、森林墨和删除用的出错红。
- **Don't** 用 emoji 或 Unicode 字符（包括 •••、▶、♥）当图标。
- **Don't** 只在鼠标悬停时才显示操作按钮；不要求双击才播放。
- **Don't** 在底部播放条里一行塞满控件；音质、歌词开关这类放进播放页。
- **Don't** 给不需要专注的任务开居中弹窗：桌面搜索挂在顶栏下面，结果是内容区里的一页；弹窗只给编辑、删除确认这类要打断一下的操作。
- **Don't** 在页面一打开时弹出无关提示，也不要让浮动按钮压住列表。
- **Don't** 让 logo 一直旋转，也不要改它的图形和颜色。
- **Don't** 做深色模式，或为深色模式预留变量（ADR-0008）。
- **Don't** 用回弹、弹簧、来回晃的曲线，也不要为好看让东西转圈、闪烁（换碟的转盘有含义，不算）。
- **Don't** 让听众等动画：内容到了就显示，不为了编排先藏起来；整段换页不超过 0.5 秒。
- **Don't** 接管滚轮和触控板的滚动手感，也不要用 JS 模拟滚动（ADR-0012）。
- **Don't** 给虚拟列表的每一行加入场动画。
