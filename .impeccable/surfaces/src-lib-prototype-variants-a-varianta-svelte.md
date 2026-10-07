---
version: 1
slug: "src-lib-prototype-variants-a-varianta-svelte"
primary_target: "src/lib/prototype/variants/a/VariantA.svelte"
related_targets: ["src/routes/prototype/+page.svelte"]
---

# Campanula 应用界面（手机 + 桌面）· 视觉原型 A

## Scope and mode
- 范围：Campanula 的全部应用界面（简报第一部分列出的 11 类），手机 + 桌面两种布局，一套设计系统。
- 模式：应用界面属于 Operate；未登录的介绍页按 Persuade 处理（首屏要讲清这是什么，并直接给出能用的登录表单）。
- 听众、设备、行为参照见 PRODUCT.md；视觉系统见 DESIGN.md（收尾时按建成结果重写）。

## Chosen direction
第一轮三选一，站长选 A（分区首页），并从 B 拿来：波浪进度条、胶囊按钮、播放页用封面颜色染底；不要手机右下角的随机播放悬浮按钮；曲库第一个标签叫“我喜欢”（页面标题仍是“我喜欢的音乐”）。

## Direction contract
THESIS：打开就是整个曲库的分区总览——我喜欢的音乐、歌单、专辑、歌手一屏可见，点一下就响；拒绝推荐信息流首页，也拒绝只剩一张列表的素净起点。
OWN-WORLD：清晨的风铃草。薄荷晨光底（primary-50）上浮着带极淡环境光阴影的白色面板；颜色主要来自封面；薄荷只标选中、进度、正在播放；珊瑚 = 红心，蜜桃 = 本机与下载；实心深绿或浅色胶囊按钮；Noto 可变字体 400/500/600；播放页是一层封面颜色染出的淡雾，进度是柔和的波浪线。
STORY：听众打开就看到自己的曲库，点一首就开始播放，想找歌就用顶部的搜索；正在播放的歌一直看得见，一点就展开；同步、下载、版权、离线这些状态始终写清楚。
FIRST VIEWPORT：桌面：64px 顶栏（logo、居中的搜索胶囊、头像）、72px 图标侧栏、同步条、“我喜欢的音乐”三行横向歌曲面板和右侧的每日推荐方块、下方的歌单封面网格、80px 底栏；主要动作“播放全部”在“我喜欢的音乐”标题右侧。手机：logo 行（搜索、每日推荐图标）、文字标签（我喜欢 / 歌单 / 专辑 / 歌手）、同步条、Auxio 式歌曲行、浮起的迷你播放条。
FORM：分区首页（结构候选第 4 位，THE ROLL），并入 B 的波浪进度条、胶囊按钮和封面染底；签名动作“晨光行”：正在播放的那一行被浅薄荷光随进度从左铺到右。seed key 7b599941。
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment
晨光行：正在播放的那一行，被一层浅薄荷光从左往右慢慢铺满。

## Unresolved (交给主会话，不在原型里拍板)
- 平板宽度的具体断点与布局细节，只验证“窄窗口用鼠标仍有右键菜单”。
- 拖拽排序、多选、封面裁剪的手感由交互原型回答。
