---
name: Campanula
description: 纯粹、简单、优雅的第三方网易云音乐播放器；手机和桌面共用一套设计系统
colors:
  morning-ground: "#F5FCF9"
  mint-mist: "#E8F8F1"
  mint-glass: "#D1F1E3"
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
  display:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: "52px"
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Noto Sans Variable, Noto Sans SC Variable, Noto Sans JP Variable, Noto Sans TC Variable, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
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

## Colors

一组高明度的薄荷色做底和标记，配冷灰的文字，蜜桃和珊瑚各管一件事；粉彩色只当底色和标记，上面一律放深色字。

### Primary

- **晨光底**（`morning-ground`）：整页的底色，手机和桌面都是。
- **薄荷雾**（`mint-mist`）：白色面板上“正在播放”那一行的晨光、悬停底、标签 chip 的底。
- **薄荷玻璃**（`mint-glass`）：侧栏当前项的底；行放在晨光底上时（手机），晨光行用这一档才看得见；选中文字的底色。
- **薄荷线**（`mint-line`）：输入框、描边按钮悬停时的边框。
- **薄荷**（`mint`）：品牌原色，现在只用在 `primary` 的默认值和 `accent-color`，界面上几乎不直接铺。
- **新芽绿**（`mint-sprout`）：输入框、搜索框获得焦点或展开时的边框。
- **叶绿**（`mint-leaf`）：logo（Lucide 的 flower 图形）的描边，一处不改。
- **茎绿**（`mint-stem`）：焦点环、波浪进度线已播放的部分、输入光标。
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

- **Display**（600，56px，行高 52px，字距 -0.03em，等宽数字）：只用在每日推荐的日期大数字上；播放页、介绍页的大字是它的放大版。
- **Headline**（600，28px，行高 36px，字距 -0.01em）：歌单、专辑、歌手、已下载、搜索结果的页面标题（手机 22px）。
- **Title**（600，20px，行高 28px）：首页的区块标题（我喜欢的音乐、歌单、专辑、歌手）、弹窗标题（18px）。
- **Body**（400，15px，行高 22px）：手机上的歌名、正文、说明。
- **Label**（500，14px，行高 20px）：桌面的歌名、按钮文字、导航文字、标签。
- **Caption**（400，13px，行高 20px）：歌手、首数、时长、元信息；桌面次要行用 12.5px。
- **Micro**（500，11px，行高 18px）：试听、无版权、未下载这类徽标。

### Named Rules

**The Three Real Weights Rule.** 只用 400 / 500 / 600 三个字重，而且都是字体文件里真实存在的字重（`font-synthesis: none`）。不再出现浏览器模拟出来的粗体。

**The Mixed Script Rule.** 显示歌名、歌手、专辑、歌单名的元素必须带 `lang`：含假名的标 `ja`，繁体标 `zh-TW`，其余跟随页面的 `zh-CN`。字体检查页逐字测过：按 `lang` 切换后，假名字宽一致，没有回退造成的空隙。

## Layout

- **桌面骨架**：64px 顶栏固定在晨光底上（菜单键、logo、返回、正中的搜索框、头像）；左侧图标侧栏 72px，菜单键展开成带文字的 220px，内容区跟着让位；内容区最大宽 1280px、左右 32px；底部通栏 80px。
- **桌面首页**：首次同步条 → 我喜欢的音乐（白色面板里的三行横向歌曲格，一屏 3.25 列，露出的半列淡入面板）和右侧 280px 的每日推荐方块 → 歌单封面网格（带 全部 / 自建 / 收藏 筛选）→ 专辑、歌手两排横向架子。区块之间 40px。
- **桌面歌单页**：沿用原来的两栏：左 208px 是曲库里的歌单（封面），右边是 200px 大封面的头部、操作行、歌单内搜索，下面是 56px 一行的虚拟列表。
- **桌面搜索**：顶栏搜索框挂下拉（历史 / 建议，无遮罩）；按搜索后，结果是内容区里的一页（单曲 / 歌单 / 歌手 / 专辑）。
- **手机骨架**：logo 行（搜索、每日推荐日历），文字标签（我喜欢 / 歌单 / 专辑 / 歌手），同步细条，Auxio 式歌曲行（左 16px、56px 高、无分隔线），底部离屏幕边 8px 的浮起迷你播放条，下面垫一层晨光底的渐隐；二级页面有返回栏。
- **播放页**：桌面左列是封面、歌名、波浪进度、控制键、音量，右列是 歌词 / 播放队列；手机照 Auxio 的结构，一屏放下，不滚动。
- **断点**：小于 768px 用手机布局，768px 及以上用桌面布局。操作细节按输入方式切换，不按宽度：窄窗口里用鼠标，右键仍是浮动菜单；触屏用底部弹层。
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
- **Focus:** 2px 茎绿焦点环，离开元素 2px。

### Chips

- **Tag:** 薄荷雾底、森林墨字、24px 高，用在歌单标签上。
- **Filter / History:** 纸白底 + 发丝线（搜索历史、歌单筛选）；选中时变成薄荷玻璃底 + 森林墨字。
- **Badges:** 试听（琥珀底琥珀字）、无版权、未下载（淡发丝底、石墨重字），11px、500 字重，跟在歌名后面。

### Cards / Containers

- **Corner Style:** 16px（面板）、12px（网格封面）。
- **Background:** 纸白，放在晨光底上。
- **Shadow Strategy:** 环境光（见 Elevation & Depth）。
- **Border:** 无。
- **Internal Padding:** 列表面板 8px；每日推荐方块、弹窗 20–24px。

### Inputs / Fields

- **Style:** 纸白底、1px 发丝线、胶囊形，44px（顶栏搜索、歌单内搜索）；表单输入框 12px 圆角。左边是搜索图标，有内容时右边出现清除按钮。
- **Focus:** 边框换成新芽绿，外面加一圈 3px 的薄荷雾光环。
- **Error / Disabled:** 出错用出错红的边框和说明文字；禁用降到 50%。

### Navigation

- **桌面侧栏:** 72px 图标栏（曲库、每日推荐、已下载，设置在最下面），当前项是 48px 高、12px 圆角的薄荷玻璃底 + 森林墨图标；展开后显示 14px / 500 的文字。
- **手机标签:** 我喜欢 / 歌单 / 专辑 / 歌手，选中是墨色 600 字重 + 下面一条 3px 的薄荷短线，未选中是石墨淡。
- **返回:** 桌面顶栏有返回键（Alt ←），手机二级页面有返回栏。

### Song Row

56px 一行，单击（轻点）整行就播放，绝不要求双击。左边是序号（桌面）或封面（手机），歌名 + 歌手两行，桌面多出专辑、状态、时长列；最右边的“更多”按钮始终可见。桌面右键打开同一份菜单。

- **状态:** 已下载（蜜桃枝图标）、下载中（蜜桃进度）、排队、下载失败（出错红，可重试）、试听、无版权（整行降到 45%，不可播，徽标写明原因）、离线时没下载的歌（同样降到 45%，标“未下载”）。

### Morning Row（晨光行，签名组件）

正在播放的那一行，被一层浅薄荷光从歌名左边缘开始往右慢慢铺开，长度等于播放进度；起点 16px 渐入，前沿 40px 渐隐，像晨光爬过桌面，而不是一根进度条。白色面板上用薄荷雾，晨光底上（手机）用薄荷玻璃。封面不被遮住，只在中间压一枚 28px 的白色小圆片，里面是三根森林绿的小竖条（暂停时停住）；桌面序号列也换成这三根竖条。减少动态效果时，光只在换进度时跳到位，竖条不动。

### Wave Progress（波浪进度条）

播放页的进度条：已播放的部分是一条缓缓起伏的正弦线（茎绿，3px），未播放的部分是一条平的发丝线；游标是 4×18px 的深薄荷圆角竖条，两端是等宽数字的时间。只在播放时流动，暂停时压平成小振幅。它是真正的滑块：拖动、点按跳转，←/→ ±5 秒，Home / End。常驻的播放条（桌面底栏、手机迷你条）用一条 2px 的平直进度线，不用波浪。

### Player Bars

- **桌面底栏:** 80px、纸白、浮起阴影，顶边一条 2px 的薄荷进度线；左边上一首 / 44px 森林墨圆形播放键 / 下一首 + 时间，中间封面和歌名（点开播放页），右边播放模式、音量、播放队列。
- **手机迷你播放条:** 64px、纸白、16px 圆角、浮起阴影，离屏幕边 8px；封面、歌名（500）、歌手、44px 圆形播放键、下一首，底边一条很细的进度线；轻点打开播放页。

### Lyrics

逐字歌词：每个词是两层同样的字叠在一起，上层按唱到的比例裁切点亮，唱到一半的字只亮一半；当前行更大、更深，其他行更淡；当前行停在高度约 38% 的位置；点一行跳到那里。只有逐行歌词时整行高亮。翻译、音译各一个开关，这首歌没有时开关禁用并说明原因。没有歌词时写“纯音乐，请欣赏”或“暂无歌词”。

## Do's and Don'ts

### Do:

- **Do** 让封面承担画面里最饱和的颜色；薄荷只用在选中、进度、正在播放、焦点上（The Morning Light Rule）。
- **Do** 在粉彩浅底上放深色字：薄荷浅底配森林墨，蜜桃浅底配蜜桃木（The Dark Ink on Pastel Rule）。
- **Do** 主要动作用实心深绿胶囊，下载用浅蜜桃胶囊，次要用描边白胶囊。
- **Do** 统一用 Lucide 线条图标；文案里提到“更多”菜单时，画出同一个图标，或者直接写“更多”。
- **Do** 显示歌名、歌手、专辑、歌单名时带上 `lang`。
- **Do** 加载中用形状一致的骨架行，放在列表本来的位置上；空、出错、离线都要写清楚发生了什么、能怎么办。
- **Do** 头部的首数、已下载数和下面实际显示的列表对得上。

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
