import { presetRemToPx } from '@unocss/preset-rem-to-px';
import {
  defineConfig,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';
import type { Theme } from 'unocss/preset-mini';

import { TILE_GRID_SAFELIST } from './src/lib/components/library/tile-grid';
import {
  AXES,
  cssEasing,
  DELAYS,
  DURATIONS,
  EASINGS,
  FLOAT_DISTANCE,
  FLOAT_IN_DELAY,
  LOOPS,
  PAGE_DISTANCE,
  PRESS_SCALE,
  REDUCED_FADE_MS,
  STAGGER,
} from './src/lib/components/shared/motion-tokens';
import { colors, skeleton } from './uno.palette.mts';

const FONT_SANS = `'Noto Sans Variable', 'Noto Sans SC Variable', 'Noto Sans JP Variable', 'Noto Sans TC Variable', system-ui, sans-serif`;
const FONT_JA = `'Noto Sans Variable', 'Noto Sans JP Variable', 'Noto Sans SC Variable', system-ui, sans-serif`;
const FONT_TC = `'Noto Sans Variable', 'Noto Sans TC Variable', 'Noto Sans SC Variable', system-ui, sans-serif`;

const MOUSE_MEDIA = '@media (hover: hover) and (pointer: fine)';

const motionVariables = (reduced: boolean): string => {
  const lines = [
    ...Object.entries(DURATIONS).flatMap(([name, ms]) => [
      `--duration-${name}: ${reduced ? Math.min(ms, REDUCED_FADE_MS) : ms}ms;`,
      `--move-${name}: ${reduced ? 0 : ms}ms;`,
    ]),
    `--loop-state: ${reduced ? 'paused' : 'running'};`,
    `--press-scale: ${reduced ? 1 : PRESS_SCALE};`,
    `--delay-float-in: ${reduced ? 0 : FLOAT_IN_DELAY}ms;`,
  ];
  if (!reduced) {
    lines.push(
      ...(Object.keys(EASINGS) as (keyof typeof EASINGS)[]).map(
        (name) => `--ease-${name}: ${cssEasing(name)};`,
      ),
      ...Object.entries(DELAYS).map(
        ([name, ms]) => `--delay-${name}: ${ms}ms;`,
      ),
      ...Object.entries(LOOPS).map(([name, ms]) => `--loop-${name}: ${ms}ms;`),
    );
  }
  return lines.join('\n');
};

const revealCss = (): string => {
  const delays = Array.from({ length: STAGGER.count - 1 }, (_, i) => {
    const nth = i + 2;
    return `.revealing > :nth-child(${
      nth === STAGGER.count ? `n+${nth}` : nth
    }) { animation-delay: ${(i + 1) * STAGGER.step}ms; }`;
  });
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
  `;
};

const pageTransitionCss = (ground: string): string => {
  const reach = {
    up: PAGE_DISTANCE.in,
    down: PAGE_DISTANCE.in,
    left: PAGE_DISTANCE.lateral,
    right: PAGE_DISTANCE.lateral,
  };
  return `
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

    /* 手机曲库标签下的薄荷短线滑到新标签下面；跟着标签行出现、消失时只淡入淡出 */
    ::view-transition-group(tab-line) {
      animation-duration: var(--move-panel);
      animation-timing-function: var(--ease-out-soft);
    }

    ::view-transition-old(tab-line):only-child,
    ::view-transition-new(tab-line):only-child {
      animation-duration: var(--duration-state);
    }

    ${Object.entries(AXES)
      .map(
        ([type, [x, y]]) => `
    html:active-view-transition-type(${type}) {
      --page-x: ${x};
      --page-y: ${y};
      --page-in: ${reach[type as keyof typeof AXES]}px;
    }`,
      )
      .join('\n')}

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

    /* 默认的交叉淡化靠 plus-lighter 把两页叠成一张：改了 animation 就得自己补上，否则淡到一半透出底色 */
    html:active-view-transition-type(fade)::view-transition-old(root) {
      animation: page-fade-out var(--duration-state) var(--ease-out-soft) both;
      mix-blend-mode: plus-lighter;
    }

    html:active-view-transition-type(fade)::view-transition-new(root) {
      animation: page-fade-in var(--duration-state) var(--ease-out-soft) both;
      mix-blend-mode: plus-lighter;
    }

    ::view-transition-group(cover) {
      animation-duration: var(--move-focal-bar);
      animation-timing-function: var(--ease-out-soft);
    }

    /* 终点没有封面时只剩旧页：让它跟着旧页一起飘出，不单飞 */
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
  `;
};

export default defineConfig<Theme>({
  presets: [presetWind3(), presetRemToPx()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  // 格子网格的格宽 / 列数 / 骨架排法在 tile-grid.ts 里拼出来，开发时的模块扫描看不到 .ts 字符串，这里显式带上
  safelist: [...TILE_GRID_SAFELIST],
  shortcuts: {
    press: 'active:scale-[var(--press-scale)]',
    // 40px 高的胶囊上下各往外撑 2px：点击范围 44px，不改布局
    'pill-hit':
      'relative before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-empty',
  },
  blocklist: [
    [
      /^(?:transition-)?(?:duration|delay)-\d+$/,
      {
        message:
          '时长用动效令牌：duration-feedback / state / panel / focal 或具名的（src/lib/components/shared/motion-tokens.ts）',
      },
    ],
    [
      /^(?:transition-)?ease-(?:in|out|in-out)$/,
      { message: '曲线用 ease-out-soft（默认）或 ease-in-soft' },
    ],
    [
      /^motion-(?:reduce|safe):/,
      {
        message:
          '减少动态效果由动效令牌统一处理（uno.config.ts 的 motionVariables、src/lib/components/shared/motion.ts），组件里不写',
      },
    ],
    [
      /^text-\[/,
      { message: '字号用八档 text-<档名>（DESIGN.md Typography），颜色用色板' },
    ],
    [
      /^rounded(?:-[trblse]{1,2})?-\[/,
      {
        message:
          '圆角用 rounded-sm / md / lg / xl / sheet / full（DESIGN.md Shapes）',
      },
    ],
    [
      /^shadow-\[/,
      {
        message:
          '阴影用 shadow-ambient / float / chip / field-focus（DESIGN.md Elevation & Depth）',
      },
    ],
    [
      /^(?:bg|border|ring|outline|fill|stroke)-\[(?:#|rgb|hsl)/,
      { message: '颜色用 uno.palette.ts 的色板（DESIGN.md Colors）' },
    ],
  ],
  variants: [
    {
      name: 'mouse',
      match(matcher) {
        if (!matcher.startsWith('mouse:')) return matcher;
        return {
          matcher: matcher.slice('mouse:'.length),
          handle: (input, next) =>
            next({
              ...input,
              parent: `${
                input.parent ? `${input.parent} $$ ` : ''
              }${MOUSE_MEDIA}`,
            }),
        };
      },
    },
  ],
  extendTheme: (theme) => {
    theme.borderRadius = {
      sm: '6px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      sheet: '24px',
      full: '9999px',
    };
    theme.fontSize = {
      micro: ['11px', '18px'],
      caption: ['13px', '20px'],
      label: ['14px', '20px'],
      body: ['15px', '22px'],
      'title-sm': ['17px', '24px'],
      title: ['20px', '28px'],
      'headline-sm': [
        '24px',
        { 'line-height': '32px', 'letter-spacing': '-0.01em' },
      ],
      headline: [
        '28px',
        { 'line-height': '36px', 'letter-spacing': '-0.01em' },
      ],
    };
    theme.fontFamily = { ...theme.fontFamily, sans: FONT_SANS };
    theme.duration = {
      DEFAULT: 'var(--duration-feedback)',
      ...Object.fromEntries(
        Object.keys(DURATIONS).flatMap((name) => [
          [name, `var(--duration-${name})`],
          [`move-${name}`, `var(--move-${name})`],
        ]),
      ),
    };
    theme.easing = {
      DEFAULT: 'var(--ease-out-soft)',
      linear: 'linear',
      ...Object.fromEntries(
        Object.keys(EASINGS).map((name) => [name, `var(--ease-${name})`]),
      ),
    };
    theme.animation = {
      keyframes: {
        spin: '{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
      },
      durations: { spin: 'var(--loop-spin)' },
      timingFns: { spin: 'linear' },
      counts: { spin: 'infinite' },
      properties: {
        spin: { 'animation-play-state': 'var(--loop-state)' },
      },
    };
  },
  theme: {
    boxShadow: {
      ambient:
        '0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07)',
      float:
        '0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18)',
      chip: '0 1px 3px rgb(17 24 39 / 0.18)',
      'field-focus': `inset 0 0 0 1px ${colors.primary[800]}, 0 0 0 3px ${colors.primary[100]}`,
      'field-focus-error': `inset 0 0 0 1px ${colors.error[700]}, 0 0 0 3px ${colors.error[50]}`,
    },
    colors,
  },
  preflights: [
    {
      // preflight 在 @unocss/reset 之后、工具类之前生效：别改 +layout.svelte 的引入顺序
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
          font-synthesis: none;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          -webkit-tap-highlight-color: transparent;
          caret-color: ${colors.primary[800]};
          accent-color: ${colors.primary[800]};
        }

        /* 原生滚动条一律隐藏、不占宽度，换成自绘的：锁住滚动时页面不横移 */
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

        :focus-visible {
          outline: 2px solid ${colors.primary[800]};
          outline-offset: 2px;
        }

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
});
