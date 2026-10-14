// 动效的数字只写在这里（DESIGN.md Overview · Motion、.impeccable/design.json 的 motion）。
// uno.config.ts 把它们变成 CSS 变量和工具类（duration-panel、ease-out-soft），motion.ts 给组件的 JS 过渡用。
// 减少动态效果也只在那两处处理，组件里不判断：CSS 用下面说的变量，JS 用 motion.ts 的过渡和时长。
// 这个文件不引入别的模块：uno.config.ts 在 Node 里加载它

/** 两条曲线（cubic-bezier 的四个控制点） */
export const EASINGS = {
  /** 飘入和移动：先快后慢、不回弹 */
  'out-soft': [0.16, 1, 0.3, 1],
  /** 飘出：越走越快 */
  'in-soft': [0.4, 0, 1, 1],
} as const

/**
 * 时长（ms）。CSS 里每个都有两个变量：
 * --duration-<名字> 给透明度、颜色、模糊，减少动态效果时最多 150ms；
 * --move-<名字> 给位移、缩放、宽高、字号，减少动态效果时是 0，直接到位。
 * 工具类对应写 duration-<名字>、duration-move-<名字>
 */
export const DURATIONS = {
  /** 反馈：按下、悬停、图标切换 */
  'feedback': 120,
  /** 状态：行状态、菜单、提示条；退场 */
  'state': 200,
  'state-out': 120,
  /** 面板和页面：换页、歌词 / 播放队列、弹窗；退场 */
  'panel': 360,
  'panel-out': 200,
  /** 主角：播放页换碟；播放条里的小转盘和封面飞行 */
  'focal': 600,
  'focal-bar': 480,
  // 下面是有专门含义的
  /** 内容出现：封面加载完从薄荷底上淡入、骨架换成内容 */
  'reveal': 240,
  /** 抽屉（播放页、底部弹层）从收着到整个拉开 */
  'drawer': 380,
  /** 波浪进度线暂停时抹平、播放时起伏回来 */
  'wave-flatten': 160,
  'wave-rise': 420,
  /** 歌词换到下一行：字号、颜色 */
  'lyric-line': 300,
  /** 晨光行跟着播放进度往右铺 */
  'morning-row': 260,
  /** 封面染底换歌时交叉淡化 */
  'tint': 700,
  /** 播放器报一次进度的间隔（timeupdate，约 250ms）：进度线匀速跟上 */
  'tick': 250,
} as const

/** 等多久才出现（ms），减少动态效果时不变。CSS 变量 --delay-<名字> */
export const DELAYS = {
  /** 取地址、缓冲超过这么久，播放键才淡入转圈：不在每次点歌时闪一下 */
  spinner: 300,
  /** 打开 App 时 logo 晚这么久才淡入：通常请求先回来，看不到这一闪 */
  opening: 400,
} as const

/** 循环动画一圈的时长（ms）。CSS 变量 --loop-<名字>；写循环的地方都加 animation-play-state: var(--loop-state)，减少动态效果时停住 */
export const LOOPS = {
  /** 转圈 animate-spin */
  'spin': 1000,
  /** 骨架上扫过的光 */
  'bone': 1600,
  /** 波浪进度线往右流一个波长 */
  'wave-flow': 1800,
  /** 正在播放的三根竖条一起一落（三根各自快慢不同） */
  'now-bars': 1100,
  /** 等待扫码的小点向外淡开一圈 */
  'qr-dot': 1800,
} as const

/** 减少动态效果时，淡入淡出、颜色变化最长这么久（ms） */
export const REDUCED_FADE_MS = 150

/** 飘入、飘出漂多远（px）；整页的是 16 / 8 */
export const FLOAT_DISTANCE = { in: 12, out: 6 } as const

/** 按钮按下时轻轻缩到这么大；减少动态效果时不缩。CSS 变量 --press-scale，工具类 press */
export const PRESS_SCALE = 0.98
