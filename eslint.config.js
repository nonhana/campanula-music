import { fileURLToPath } from 'node:url'
import antfu from '@antfu/eslint-config'
import { includeIgnoreFile } from '@eslint/config-helpers'
import globals from 'globals'

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

export default antfu(
  {
    svelte: true,
    unocss: true,
    pnpm: true,
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
    files: [
      'src/lib/components/hana/Button.svelte',
      'src/lib/components/hana/Card.svelte',
    ],
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
)
