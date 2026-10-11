import { fileURLToPath } from 'node:url'
import antfu from '@antfu/eslint-config'
import { includeIgnoreFile } from '@eslint/config-helpers'
import globals from 'globals'

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url))

// App 只从注入的 BrowserCapabilities 拿浏览器能力，测试里才能整个换成替身。
// 直接用全局对象会绕过替身：setTimeout 不跟假时钟走，fetch 不带设备的 Cookie
const BROWSER_GLOBALS = ['window', 'self', 'document', 'navigator', 'location', 'fetch', 'indexedDB', 'localStorage', 'sessionStorage', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'Audio', 'MediaMetadata']

export default antfu(
  {
    svelte: true,
    unocss: true,
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
      'no-restricted-globals': ['error', ...BROWSER_GLOBALS.map(name => ({
        name,
        message: `App 里不直接用 ${name}：从 BrowserCapabilities（src/lib/app/browser.ts）拿，测试里才能换成替身`,
      }))],
    },
  },
)
