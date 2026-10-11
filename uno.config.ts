import type { Theme } from 'unocss/preset-mini'
import { presetRemToPx } from '@unocss/preset-rem-to-px'
import {
  defineConfig,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

// 设计系统的源头（DESIGN.md、.impeccable/design.json）：颜色、两档阴影、圆角、字号阶梯和全局基础样式都在这里。
// 字体随项目打包（src/routes/+layout.svelte 引入 @fontsource-variable），不从网络加载。

/** 拉丁 → 简体 → 日文 → 繁体；日文、繁体按元素的 lang 把各自的字体提前（The Mixed Script Rule） */
const FONT_SANS = `'Noto Sans Variable', 'Noto Sans SC Variable', 'Noto Sans JP Variable', 'Noto Sans TC Variable', system-ui, sans-serif`
const FONT_JA = `'Noto Sans Variable', 'Noto Sans JP Variable', 'Noto Sans SC Variable', system-ui, sans-serif`
const FONT_TC = `'Noto Sans Variable', 'Noto Sans TC Variable', 'Noto Sans SC Variable', system-ui, sans-serif`

/** 悬停效果只给能悬停的精确指针（鼠标、触控板）：触屏上 :hover 会粘在点过的元素上 */
const MOUSE_MEDIA = '@media (hover: hover) and (pointer: fine)'

/** 色板：作者定义的源头。DESIGN.md 的颜色名都落在这几条色阶上，例如晨光底 morning-ground = primary-50 */
const colors = {
  primary: {
    DEFAULT: '#A8E6CF',
    50: '#F5FCF9',
    100: '#E8F8F1',
    200: '#D1F1E3',
    300: '#B9EAD5',
    400: '#A8E6CF',
    500: '#80DBB9',
    600: '#59CFA3',
    700: '#37BE8C',
    800: '#2B976F',
    900: '#206F52',
    950: '#1A5B43',
  },
  secondary: {
    DEFAULT: '#FFD3B6',
    50: '#FFF8F2',
    100: '#FFEEE2',
    200: '#FFE1CC',
    300: '#FFD3B6',
    400: '#FFBF99',
    500: '#FFA877',
    600: '#FF8F55',
    700: '#FF7733',
    800: '#E6601F',
    900: '#B34719',
    950: '#8C3914',
  },
  accent: {
    DEFAULT: '#FF8C94',
    50: '#FFF5F6',
    100: '#FFE8EB',
    200: '#FFD1D5',
    300: '#FFBAC0',
    400: '#FF8C94',
    500: '#FF5E69',
    600: '#FF3040',
    700: '#E01D2C',
    800: '#B31622',
    900: '#8C1019',
    950: '#6E0C14',
  },
  neutral: {
    DEFAULT: '#6B7280',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0A0F1A',
  },
  success: {
    DEFAULT: '#81C784',
    50: '#F2FBF5',
    100: '#E6F7EB',
    200: '#C7EED1',
    300: '#A8E6B7',
    400: '#81C784',
    500: '#66B366',
    600: '#4A9951',
    700: '#35793D',
    800: '#265B2E',
    900: '#1A4121',
  },
  warning: {
    DEFAULT: '#FFC107',
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFC107',
    500: '#FFA000',
    600: '#FF8F00',
    700: '#FF6F00',
    800: '#E65100',
    900: '#BF360C',
  },
  error: {
    DEFAULT: '#E57373',
    50: '#FBE9E7',
    100: '#FFCCBC',
    200: '#FFAB91',
    300: '#FF8A65',
    400: '#E57373',
    500: '#EF5350',
    600: '#E53935',
    700: '#D32F2F',
    800: '#C62828',
    900: '#B71C1C',
  },
}

export default defineConfig<Theme>({
  presets: [
    presetWind3(),
    presetRemToPx(),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
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
  },
  theme: {
    boxShadow: {
      // 环境光：静止的白色面板、网格封面、搜索框
      'ambient': '0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07)',
      // 浮起：只给浮在内容上、可以关掉的层（菜单、弹层、弹窗、播放条、搜索下拉）
      'float': '0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18)',
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
      `,
    },
  ],
})
