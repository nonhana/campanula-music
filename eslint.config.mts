import antfu from '@antfu/eslint-config'

import { RESTRICTED_BROWSER_GLOBALS } from './src/lib/app/browser-globals.ts'

export default antfu(
  {
    svelte: true,
    unocss: { strict: true },
    pnpm: true,
    ignores: ['tests/fixtures/**/*.json'],
    rules: {
      'no-unused-expressions': 'off',
    },
  },
  {
    files: ['src/lib/app/**/*.ts'],
    ignores: ['src/lib/app/browser.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...RESTRICTED_BROWSER_GLOBALS.map(name => ({
          name,
          message: `App 里不直接用 ${name}：从 BrowserCapabilities（src/lib/app/browser.ts）拿，测试里才能换成替身`,
        })),
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,svelte}'],
    rules: {
      'antfu/top-level-function': 'off',
      'func-style': ['error', 'expression'],
      'arrow-body-style': ['error', 'as-needed'],
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
