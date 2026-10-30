// 动效的数字只写在这里（DESIGN.md Overview · Motion、.impeccable/design.json 的 motion）：uno.config.ts 变成 CSS 变量和工具类，
// motion.ts 给 JS 过渡用。减少动态效果只在这两处处理、组件里不判断。这个文件不引入别的模块（uno.config.ts 在 Node 里加载它）。

export const EASINGS = {
  /** 先快后慢、不回弹 */
  'out-soft': [0.16, 1, 0.3, 1],
  /** 越走越快 */
  'in-soft': [0.4, 0, 1, 1],
} as const

/** uno.config.ts 的 --ease-* 变量、Web Animations 的 easing 都用它；组件的 CSS 里写 var(--ease-…) */
export const cssEasing = (name: keyof typeof EASINGS): string => `cubic-bezier(${EASINGS[name].join(', ')})`

/** 时长（ms）：--duration-<名字> 给透明度、颜色、模糊（减少动态效果时最多 150ms），--move-<名字> 给位移、缩放、宽高、字号（减少动态效果时 0）；工具类写 duration-<名字>、duration-move-<名字> */
export const DURATIONS = {
  /** 按下、悬停、图标切换 */
  'feedback': 120,
  /** 行状态、菜单、提示条；退场 */
  'state': 200,
  'state-out': 120,
  /** 换页、歌词 / 播放队列、弹窗；退场 */
  'panel': 360,
  'panel-out': 200,
  /** 播放页换碟；播放条里的小转盘和封面飞行 */
  'focal': 600,
  'focal-bar': 480,
  /** 封面加载完从薄荷底上淡入、骨架换成内容 */
  'reveal': 240,
  /** 拖封面没到切歌阈值，松手转回原位 */
  'wheel-return': 240,
  /** 桌面侧栏展开时文字淡入 */
  'rail-label': 160,
  /** 抽屉从收着到整个拉开 */
  'drawer': 380,
  /** 暂停时抹平、播放时起伏回来 */
  'wave-flatten': 160,
  'wave-rise': 420,
  /** 换到下一行：字号、颜色 */
  'lyric-line': 300,
  /** 跟着播放进度往右铺 */
  'morning-row': 260,
  /** 换歌时旧的散掉 */
  'wash-out': 300,
  /** 换歌时交叉淡化 */
  'tint': 700,
  /** 进度线匀速跟上 */
  'tick': 250,
} as const

/** 等多久才出现或消失（ms），减少动态效果时不变；CSS 变量 --delay-<名字> */
export const DELAYS = {
  /** 超过这么久播放键才淡入转圈，不在每次点歌时闪 */
  'spinner': 300,
  /** 滚动停下、鼠标离开或松开滑块这么久后，滚动条才淡出；歌词的跳转胶囊也按这个收起（DESIGN.md Lyrics） */
  'scrollbar': 1000,
  /** 宽度开始变化这么久后文字才淡入 */
  'rail-label': 60,
} as const

/** 循环动画一圈的时长（ms），CSS 变量 --loop-<名字>；循环处都加 animation-play-state: var(--loop-state)，减少动态效果时停住 */
export const LOOPS = {
  /** animate-spin */
  'spin': 1000,
  /** 骨架上扫过的光 */
  'bone': 1600,
  /** 往右流一个波长 */
  'wave-flow': 1800,
  /** 三根竖条一起一落（各自快慢不同） */
  'now-bars': 1100,
  /** 小点向外淡开一圈 */
  'qr-dot': 1800,
} as const

/** 减少动态效果时淡入淡出、颜色变化的上限（ms） */
export const REDUCED_FADE_MS = 150

/** 飘入、飘出漂多远（px） */
export const FLOAT_DISTANCE = { in: 12, out: 6 } as const

/** 换页整页漂多远（px）：进入下一层、返回时上下飘入 16、飘出 8；同一层之间横着飘入 24 */
export const PAGE_DISTANCE = { in: 16, out: 8, lateral: 24 } as const

/** 骨架换成内容：前 count 个依次晚 step ms，其余和第 count 个一起 */
export const STAGGER = { step: 30, count: 6 } as const

/** 飘出往这边漂、飘入从反方向来；进入下一层 up，返回 down，同一层按左右顺序，下一首 left */
export const AXES = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const

/** 旧页飘出开始这么久后新页才飘入（ms，DESIGN.md Motion · 飘出）；CSS 变量 --delay-float-in，减少动态效果时 0、只剩交叉淡化 */
export const FLOAT_IN_DELAY = 60

/** 换碟（DESIGN.md Cover Wheel）：轴心在封面正下方、离中心 pivot 倍边长，相邻两张隔 pitch 度；文字晚 textDelay ms 飘，旧出 textOut px、新进 textIn px */
export const WHEEL = {
  pivot: 1.6,
  pitch: 28,
  textDelay: 80,
  textOut: 12,
  textIn: 16,
} as const

/** 飞行的弧线（点歌时封面飞进播放条、打开 App 时 logo 归位；motion.ts 的 flightArc）：控制点离起止连线正中 FLIGHT_ARC 倍连线长，往上鼓 */
export const FLIGHT_ARC = 0.12

/**
 * 打开 App 时内容区从 logo 落点那边一块块飘出来（DESIGN.md Motion · 打开 App，boot/opening.ts）：花起飞 delay ms 后离落点最近的那块先来，
 * 按离落点的远近依次晚到，最远的再晚 spread ms；每块（和 logo 旁的字样）从 blur px 的薄雾里清晰起来
 */
export const OPENING = { delay: 160, spread: 320, blur: 6 } as const

/** 按钮按下时缩到这么大；减少动态效果时不缩。CSS 变量 --press-scale，工具类 press */
export const PRESS_SCALE = 0.98
