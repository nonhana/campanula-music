import { fileURLToPath } from 'node:url'
import antfu from '@antfu/eslint-config'
import { includeIgnoreFile } from '@eslint/compat'
import tailwind from 'eslint-plugin-tailwindcss'
import globals from 'globals'

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

export default antfu(
  { svelte: true },
  ...tailwind.configs['flat/recommended'],
  includeIgnoreFile(gitignorePath),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
)
