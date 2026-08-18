import { presetRemToPx } from '@unocss/preset-rem-to-px'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { presetScrollbar } from 'unocss-preset-scrollbar'

/** 色阶；success/warning/error 沿用旧主题（原只有到 900 的色阶，令牌层保持一致） */
const FULL_SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const SCALE_TO_900 = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

/**
 * 主题色引用皮肤令牌：`bg-primary/50`、`text-primary-900` 等写法保留透明度与色阶语义，
 * 颜色值由 [data-skin] 作用域的 --skin-* 变量提供（见 src/lib/skin/skins.css）。
 */
function skinColor(name: string, steps: number[] = FULL_SCALE) {
  return {
    DEFAULT: `rgb(var(--skin-${name}) / <alpha-value>)`,
    ...Object.fromEntries(
      steps.map(step => [
        step,
        `rgb(var(--skin-${name}-${step}) / <alpha-value>)`,
      ]),
    ),
  }
}

export default defineConfig({
  presets: [
    /* Core Presets */
    presetWind3(),
    presetAttributify(),
    presetIcons(),
    presetTypography(),
    presetWebFonts({
      provider: 'google',
      fonts: {
        noto: [
          'Noto Sans:300,400',
          'Noto Sans SC:300,400',
          'Noto Sans TC:300,400',
          'Noto Sans JP:300,400',
        ],
      },
    }),

    /* Community Presets */
    presetRemToPx(),
    presetScrollbar(),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  shortcuts: [['title', 'text-lg font-bold text-neutral-500']],
  theme: {
    colors: {
      primary: skinColor('primary'),
      secondary: skinColor('secondary'),
      accent: skinColor('accent'),
      neutral: skinColor('neutral'),
      success: skinColor('success', SCALE_TO_900),
      warning: skinColor('warning', SCALE_TO_900),
      error: skinColor('error', SCALE_TO_900),
      /* 语义表面：页面背景 / 卡片表面 / 主次文本 / 边框 */
      app: {
        'bg': 'rgb(var(--skin-bg) / <alpha-value>)',
        'surface': 'rgb(var(--skin-surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--skin-surface-hover) / <alpha-value>)',
        'text': 'rgb(var(--skin-text) / <alpha-value>)',
        'text-muted': 'rgb(var(--skin-text-muted) / <alpha-value>)',
        'border': 'rgb(var(--skin-border) / <alpha-value>)',
      },
    },
    borderRadius: {
      sm: 'var(--skin-radius-sm)',
      md: 'var(--skin-radius-md)',
      lg: 'var(--skin-radius-lg)',
      xl: 'var(--skin-radius-xl)',
    },
    boxShadow: {
      sm: 'var(--skin-shadow-sm)',
      md: 'var(--skin-shadow-md)',
      lg: 'var(--skin-shadow-lg)',
    },
  },
  preflights: [
    {
      getCSS: () => `
        html,
        body {
          @apply contents font-noto;
          font-family: var(--skin-font-family);
        }

        ::selection {
          @apply bg-primary/50 text-primary-900;
        }
      `,
    },
  ],
})
