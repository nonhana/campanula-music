import type { Theme } from 'unocss/preset-mini'
import { presetRemToPx } from '@unocss/preset-rem-to-px'
import {
  defineConfig,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { TILE_GRID_SAFELIST } from './src/lib/components/library/tile-grid'
import { AXES, cssEasing, DELAYS, DURATIONS, EASINGS, FLOAT_DISTANCE, FLOAT_IN_DELAY, LOOPS, PAGE_DISTANCE, PRESS_SCALE, REDUCED_FADE_MS, STAGGER } from './src/lib/components/shared/motion-tokens'
import { colors, skeleton } from './uno.palette'

// 设计系统的源头（DESIGN.md、.impeccable/design.json）：色板在 uno.palette.ts，两档阴影、圆角、字号阶梯、动效和全局基础样式都在这里。
// 动效的数字在 src/lib/components/shared/motion-tokens.ts（JS 也要用），这里把它们变成 CSS 变量和工具类。
// 字体随项目打包（src/routes/+layout.svelte 引入 @fontsource-variable），不从网络加载。

/** 拉丁 → 简体 → 日文 → 繁体；日文、繁体按元素的 lang 把各自的字体提前（The Mixed Script Rule） */
const FONT_SANS = `'Noto Sans Variable', 'Noto Sans SC Variable', 'Noto Sans JP Variable', 'Noto Sans TC Variable', system-ui, sans-serif`
const FONT_JA = `'Noto Sans Variable', 'Noto Sans JP Variable', 'Noto Sans SC Variable', system-ui, sans-serif`
const FONT_TC = `'Noto Sans Variable', 'Noto Sans TC Variable', 'Noto Sans SC Variable', system-ui, sans-serif`

/** 悬停效果只给能悬停的精确指针（鼠标、触控板）：触屏上 :hover 会粘在点过的元素上 */
const MOUSE_MEDIA = '@media (hover: hover) and (pointer: fine)'

/**
 * 动效令牌的 CSS 变量。减少动态效果只在这里处理（DESIGN.md Motion）：透明度、颜色的时长（--duration-*）最多 150ms，
 * 位移、缩放、宽高的时长（--move-*）变成 0，循环（--loop-state）停住，按钮按下（--press-scale）不缩，
 * 换页的新页不再晚一步（--delay-float-in）。组件里不写这条媒体查询
 */
function motionVariables(reduced: boolean): string {
  const lines = [
    ...Object.entries(DURATIONS).flatMap(([name, ms]) => [
      `--duration-${name}: ${reduced ? Math.min(ms, REDUCED_FADE_MS) : ms}ms;`,
      `--move-${name}: ${reduced ? 0 : ms}ms;`,
    ]),
    `--loop-state: ${reduced ? 'paused' : 'running'};`,
    `--press-scale: ${reduced ? 1 : PRESS_SCALE};`,
    `--delay-float-in: ${reduced ? 0 : FLOAT_IN_DELAY}ms;`,
  ]
  if (!reduced) {
    lines.push(
      ...(Object.keys(EASINGS) as (keyof typeof EASINGS)[]).map(name => `--ease-${name}: ${cssEasing(name)};`),
      ...Object.entries(DELAYS).map(([name, ms]) => `--delay-${name}: ${ms}ms;`),
      ...Object.entries(LOOPS).map(([name, ms]) => `--loop-${name}: ${ms}ms;`),
    )
  }
  return lines.join('\n')
}

/**
 * 依次飘入（DESIGN.md Motion）：骨架换成内容时，一组里前 6 个依次晚 30ms 从下面飘上来，其余和第 6 个一起。
 * src/lib/components/shared/motion.ts 的 reveal 只在这一小会儿给这一组挂上 .revealing，之后才挂上的（虚拟列表滚出来的行）不飘
 */
function revealCss(): string {
  const delays = Array.from({ length: STAGGER.count - 1 }, (_, i) => {
    const nth = i + 2
    return `.revealing > :nth-child(${nth === STAGGER.count ? `n+${nth}` : nth}) { animation-delay: ${(i + 1) * STAGGER.step}ms; }`
  })
  return `
    .revealing > * {
      animation:
        reveal-fade var(--duration-reveal) var(--ease-out-soft) backwards,
        reveal-drift var(--move-reveal) var(--ease-out-soft) backwards;
    }

    ${delays.join('\n')}

    @keyframes reveal-fade {
      from { opacity: 0; }
    }

    @keyframes reveal-drift {
      from { translate: 0 ${FLOAT_DISTANCE.in}px; }
    }
  `
}

/**
 * 换页（ADR-0011、DESIGN.md Navigation · 页面切换）。src/lib/components/shell/page-transition.ts 把方向放进 types：
 * up 进入下一层、down 返回、left / right 同一层之间按左右顺序（内容往哪边走）、fade 只淡入淡出。
 * 内容区就是根元素（root）的快照：页面是窗口在滚（ADR-0012），只有整个视口的快照不受滚动位置影响；
 * 顶栏、侧栏、播放条各自起了名字，不在这张快照里。它们带 view-transition-class：
 * still 原地不动、只放新的一帧（它是活的，播放条的进度线照常走）；crossfade 交叉淡化（手机顶行、标签行）。
 * 减少动态效果时位移的时长（--move-*）是 0、淡入淡出最多 150ms，只剩交叉淡化。ground 是整页的底色（晨光底）
 */
function pageTransitionCss(ground: string): string {
  const reach = { up: PAGE_DISTANCE.in, down: PAGE_DISTANCE.in, left: PAGE_DISTANCE.lateral, right: PAGE_DISTANCE.lateral }
  return `
    /* 新旧两页都半透明的那一会儿，底下透出来的是晨光底，不是白 */
    ::view-transition {
      background: ${ground};
    }

    ::view-transition-group(*.still) {
      animation: none;
    }

    ::view-transition-old(*.still) {
      display: none;
    }

    ::view-transition-new(*.still) {
      animation: none;
    }

    ::view-transition-group(*.crossfade) {
      animation-duration: var(--duration-state);
      animation-timing-function: var(--ease-out-soft);
    }

    /* 手机曲库标签下的薄荷短线：滑到新标签下面；跟着标签行出现、消失时只淡入淡出 */
    ::view-transition-group(tab-line) {
      animation-duration: var(--move-panel);
      animation-timing-function: var(--ease-out-soft);
    }

    ::view-transition-old(tab-line):only-child,
    ::view-transition-new(tab-line):only-child {
      animation-duration: var(--duration-state);
    }

    ${Object.entries(AXES).map(([type, [x, y]]) => `
    html:active-view-transition-type(${type}) {
      --page-x: ${x};
      --page-y: ${y};
      --page-in: ${reach[type as keyof typeof AXES]}px;
    }`).join('\n')}

    /* 旧页往去的方向飘出，新页晚一点从来的方向飘入 */
    ::view-transition-old(root) {
      animation:
        page-fade-out var(--duration-panel-out) var(--ease-in-soft) both,
        page-drift-out var(--move-panel-out) var(--ease-in-soft);
    }

    ::view-transition-new(root) {
      animation:
        page-fade-in var(--duration-panel) var(--ease-out-soft) var(--delay-float-in) both,
        page-drift-in var(--move-panel) var(--ease-out-soft) var(--delay-float-in) backwards;
    }

    /*
     * 同一种页面之间（桌面歌单页左栏换歌单）：同样快慢的交叉淡化，两页一样的地方（左栏）不闪。
     * 浏览器自带的交叉淡化靠 plus-lighter 把两张叠成一张，它写在默认的 animation 里，这里改了 animation 就要自己补上；
     * 没有它，淡到一半两页都半透明，透出底色，整个内容区像刷新了一下
     */
    html:active-view-transition-type(fade)::view-transition-old(root) {
      animation: page-fade-out var(--duration-state) var(--ease-out-soft) both;
      mix-blend-mode: plus-lighter;
    }

    html:active-view-transition-type(fade)::view-transition-new(root) {
      animation: page-fade-in var(--duration-state) var(--ease-out-soft) both;
      mix-blend-mode: plus-lighter;
    }

    /*
     * 从格子飞到页头的封面（page-transition.ts 只给露在屏幕里、图已经加载好的封面这个名字）：
     * 位置、大小一起变（480ms），两头是同一张图，交叉淡化时圆角跟着变（歌单、专辑 12px ↔ 16px，歌手一直是圆的）
     */
    ::view-transition-group(cover) {
      animation-duration: var(--move-focal-bar);
      animation-timing-function: var(--ease-out-soft);
    }

    /* 终点没有封面（页头还是骨架、格子滚出了屏幕、图没到）：起飞的那张不飞，跟着旧页一起飘出 */
    ::view-transition-old(cover):only-child {
      animation:
        page-fade-out var(--duration-panel-out) var(--ease-in-soft) both,
        page-drift-out var(--move-panel-out) var(--ease-in-soft);
    }

    @keyframes page-fade-out {
      to { opacity: 0; }
    }

    @keyframes page-fade-in {
      from { opacity: 0; }
    }

    @keyframes page-drift-out {
      to { translate: calc(var(--page-x) * ${PAGE_DISTANCE.out}px) calc(var(--page-y) * ${PAGE_DISTANCE.out}px); }
    }

    @keyframes page-drift-in {
      from { translate: calc(var(--page-x) * -1 * var(--page-in)) calc(var(--page-y) * -1 * var(--page-in)); }
    }
  `
}

export default defineConfig<Theme>({
  presets: [
    presetWind3(),
    presetRemToPx(),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  // 格子网格的格宽 / 列数 / 骨架排法在 tile-grid.ts 里拼出来，开发时的模块扫描看不到 .ts 字符串，这里显式带上
  safelist: [...TILE_GRID_SAFELIST],
  shortcuts: {
    // 按下时轻轻缩一点（DESIGN.md Buttons）：可点的元素加 press（按钮常写 enabled:press）
    'press': 'active:scale-[var(--press-scale)]',
    // 40px 高的胶囊按钮：上下各往外撑 2px，点击范围 44px，不改布局（DESIGN.md Buttons）
    'pill-hit': 'relative before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-empty',
  },
  // 只用设计系统的档位：零散的时长、曲线，逐个组件的“减少动态效果”写法，阶梯以外的字号、圆角、阴影、颜色都不生成。
  // scripts/check-design-tokens.mts 在 pnpm lint 里查所有写法（eslint 的 unocss/blocklist 只看得到纯字符串的 class）
  blocklist: [
    [/^(?:transition-)?(?:duration|delay)-\d+$/, { message: '时长用动效令牌：duration-feedback / state / panel / focal 或具名的（src/lib/components/shared/motion-tokens.ts）' }],
    [/^(?:transition-)?ease-(?:in|out|in-out)$/, { message: '曲线用 ease-out-soft（默认）或 ease-in-soft' }],
    [/^motion-(?:reduce|safe):/, { message: '减少动态效果由动效令牌统一处理（uno.config.ts 的 motionVariables、src/lib/components/shared/motion.ts），组件里不写' }],
    [/^text-\[/, { message: '字号用八档 text-<档名>（DESIGN.md Typography），颜色用色板' }],
    [/^rounded(?:-[trblse]{1,2})?-\[/, { message: '圆角用 rounded-sm / md / lg / xl / sheet / full（DESIGN.md Shapes）' }],
    [/^shadow-\[/, { message: '阴影用 shadow-ambient / float / chip / field-focus（DESIGN.md Elevation & Depth）' }],
    [/^(?:bg|border|ring|outline|fill|stroke)-\[(?:#|rgb|hsl)/, { message: '颜色用 uno.palette.ts 的色板（DESIGN.md Colors）' }],
  ],
  variants: [
    // mouse:hover:bg-primary-100：操作细节按输入方式切换，不按宽度（DESIGN.md Layout）
    {
      name: 'mouse',
      match(matcher) {
        if (!matcher.startsWith('mouse:'))
          return matcher
        return {
          matcher: matcher.slice('mouse:'.length),
          handle: (input, next) => next({
            ...input,
            parent: `${input.parent ? `${input.parent} $$ ` : ''}${MOUSE_MEDIA}`,
          }),
        }
      },
    },
  ],
  extendTheme: (theme) => {
    // 圆角和字号只留设计系统里的档位：换掉 Wind 的默认值，rounded-2xl、text-lg 这类就不再生效
    theme.borderRadius = {
      sm: '6px', // 徽标
      md: '8px', // 行内小封面
      lg: '12px', // 歌曲行、网格封面、表单输入框、侧栏当前项
      xl: '16px', // 白色面板、迷你播放条、弹窗
      sheet: '24px', // 底部弹层顶边
      full: '9999px', // 胶囊：按钮、搜索框、chip
    }
    // [字号, 行高或行高和字距]；字重另写：font-400 / font-500 / font-600
    theme.fontSize = {
      'micro': ['11px', '18px'],
      'caption': ['13px', '20px'],
      'label': ['14px', '20px'],
      'body': ['15px', '22px'],
      'title-sm': ['17px', '24px'],
      'title': ['20px', '28px'],
      'headline-sm': ['24px', { 'line-height': '32px', 'letter-spacing': '-0.01em' }],
      'headline': ['28px', { 'line-height': '36px', 'letter-spacing': '-0.01em' }],
    }
    theme.fontFamily = { ...theme.fontFamily, sans: FONT_SANS }
    // 时长、曲线、转圈只留动效令牌：duration-state、duration-move-panel、ease-in-soft、animate-spin（见 motionVariables）
    theme.duration = {
      DEFAULT: 'var(--duration-feedback)',
      ...Object.fromEntries(Object.keys(DURATIONS).flatMap(name => [
        [name, `var(--duration-${name})`],
        [`move-${name}`, `var(--move-${name})`],
      ])),
    }
    theme.easing = {
      DEFAULT: 'var(--ease-out-soft)',
      linear: 'linear',
      ...Object.fromEntries(Object.keys(EASINGS).map(name => [name, `var(--ease-${name})`])),
    }
    theme.animation = {
      keyframes: { spin: '{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' },
      durations: { spin: 'var(--loop-spin)' },
      timingFns: { spin: 'linear' },
      counts: { spin: 'infinite' },
      properties: { spin: { 'animation-play-state': 'var(--loop-state)' } },
    }
  },
  theme: {
    boxShadow: {
      // 环境光：静止的白色面板、网格封面、搜索框
      'ambient': '0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07)',
      // 浮起：只给浮在内容上、可以关掉的层（菜单、弹层、弹窗、播放条、搜索下拉）
      'float': '0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18)',
      // 小圆片：封面上“正在播放”的白色小圆片，压在什么封面上都分得开（design.json Morning Row）
      'chip': '0 1px 3px rgb(17 24 39 / 0.18)',
      // 输入框、搜索框获得焦点：配 1px 边框加粗成 2px，外面一圈 3px 的浅色光环；出错时换成出错红
      'field-focus': `inset 0 0 0 1px ${colors.primary[800]}, 0 0 0 3px ${colors.primary[100]}`,
      'field-focus-error': `inset 0 0 0 1px ${colors.error[700]}, 0 0 0 3px ${colors.error[50]}`,
    },
    colors,
  },
  preflights: [
    {
      // 在 @unocss/reset 之后、工具类之前生效（见 src/routes/+layout.svelte 的引入顺序）
      getCSS: () => `
        :root {
          ${motionVariables(false)}
        }

        @media (prefers-reduced-motion: reduce) {
          :root {
            ${motionVariables(true)}
          }
        }

        html {
          font-family: ${FONT_SANS};
          color: ${colors.neutral[900]};
          background: ${colors.primary[50]};
          /* 只用字体文件里真实存在的字重，不让浏览器模拟粗体（The Three Real Weights Rule） */
          font-synthesis: none;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          -webkit-tap-highlight-color: transparent;
          /* 输入光标、原生勾选框和进度条：茎绿，白底上 3.6:1 */
          caret-color: ${colors.primary[800]};
          accent-color: ${colors.primary[800]};
        }

        /* 系统滚动条一律隐藏、不占宽度，换成自绘的（ADR-0012、ui/Scrollbar.svelte）：播放页、弹窗锁住滚动时页面不横移 */
        * {
          scrollbar-width: none;
        }

        ::-webkit-scrollbar {
          display: none;
        }

        :lang(ja) {
          font-family: ${FONT_JA};
        }

        :lang(zh-TW) {
          font-family: ${FONT_TC};
        }

        ::selection {
          background: ${colors.primary[200]};
          color: ${colors.primary[950]};
        }

        /* 焦点环：2px 茎绿，离开元素 2px */
        :focus-visible {
          outline: 2px solid ${colors.primary[800]};
          outline-offset: 2px;
        }

        /* 加载中的骨架（歌曲行、封面格子、歌词、二维码）：一道很淡的光从左扫到右；减少动态效果时停住 */
        .bone {
          display: block;
          background: linear-gradient(90deg, ${skeleton.from} 0%, ${skeleton.to} 40%, ${skeleton.from} 80%);
          background-size: 240% 100%;
          animation: bone-sweep var(--loop-bone) ease-in-out infinite;
          animation-play-state: var(--loop-state);
        }

        @keyframes bone-sweep {
          from {
            background-position: 100% 0;
          }
          to {
            background-position: -140% 0;
          }
        }

        ${revealCss()}

        ${pageTransitionCss(colors.primary[50])}
      `,
    },
  ],
})
