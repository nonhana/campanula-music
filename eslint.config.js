import { fileURLToPath } from 'node:url'

import antfu from '@antfu/eslint-config'
import { includeIgnoreFile } from '@eslint/config-helpers'
import globals from 'globals'

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

// App 只从注入的 BrowserCapabilities 拿浏览器能力，测试里才能整个换成替身。
// 直接用全局对象会绕过替身：setTimeout 不跟假时钟走，fetch 不带设备的 Cookie
const BROWSER_GLOBALS = [
  'window',
  'self',
  'document',
  'navigator',
  'location',
  'fetch',
  'indexedDB',
  'localStorage',
  'sessionStorage',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'Audio',
  'MediaMetadata',
]

export default antfu(
  {
    svelte: true,
    // strict：uno.config.ts 的 blocklist（零散的动效时长、曲线等）在 lint 里报错
    unocss: { strict: true },
    pnpm: true,
    // 录下来的网易云真实返回，原样保留（歌名里的全角空格等不能被 lint 改掉）
    ignores: ['tests/fixtures/**/*.json'],
    rules: {
      'no-unused-expressions': 'off',
    },
  },
  includeIgnoreFile(gitignorePath),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['src/lib/app/**/*.ts'],
    ignores: ['src/lib/app/browser.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map(name => ({
          name,
          message: `App 里不直接用 ${name}：从 BrowserCapabilities（src/lib/app/browser.ts）拿，测试里才能换成替身`,
        })),
      ],
    },
  },
  {
    // 全项目统一：箭头函数优先（关掉 antfu 的 function 声明约定）、直接返回对象、
    // import 按来源分组（组间空一行）并排序；参考 hana-music-api 的 oxfmt sortImports
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,svelte}'],
    rules: {
      'antfu/top-level-function': 'off',
      'func-style': ['error', 'expression'],
      'arrow-body-style': ['error', 'as-needed'],
      // 箭头函数不提升：互相引用、工具函数放后面都是常态。
      // 真正的初始化期 TDZ 由测试和构建兜底，不靠书写顺序报错
      'no-use-before-define': [
        'error',
        {
          functions: false,
          variables: false,
          classes: false,
          enums: true,
          typedefs: true,
          ignoreTypeReferences: true,
          allowNamedExports: false,
        },
      ],
      'ts/no-use-before-define': [
        'error',
        {
          functions: false,
          variables: false,
          classes: false,
          enums: true,
          typedefs: true,
          ignoreTypeReferences: true,
          allowNamedExports: false,
        },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            'side-effect',
            ['type-builtin', 'value-builtin'],
            ['type-external', 'value-external'],
            [
              'type-internal',
              'value-internal',
              'type-subpath',
              'value-subpath',
            ],
            [
              'type-parent',
              'value-parent',
              'type-sibling',
              'value-sibling',
              'type-index',
              'value-index',
            ],
            'side-effect-style',
            'style',
            'unknown',
          ],
          newlinesBetween: 1,
          order: 'asc',
          type: 'natural',
          partitionByComment: true,
          sortSideEffects: false,
        },
      ],
    },
  },
  {
    // 网易云适配层是服务端里唯一调 SDK 的地方（Spec #11“服务端：网易云适配层”）；测试架子要用 SDK 导出的结构定义校验录制数据
    files: ['**/*.{js,ts,svelte}'],
    ignores: ['src/lib/server/netease.ts', 'src/lib/server/mock/**', 'tests/harness/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'hana-music-api', message: '只有网易云适配层（src/lib/server/netease.ts）能用 hana-music-api' },
          ],
        },
      ],
    },
  },
)
