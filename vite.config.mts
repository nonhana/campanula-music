import process from 'node:process'

import adapterNode from '@sveltejs/adapter-node'
import adapterVercel from '@sveltejs/adapter-vercel'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

import { mockPlugin } from './src/lib/server/mock/vite-plugin.ts'

const adapter = process.env.VERCEL
  ? adapterVercel({
      runtime: 'nodejs24.x',
      regions: ['hkg1'],
    })
  : adapterNode()

export default defineConfig(({ command }) => ({
  // mock（pnpm dev:mock）多一个插件，配置和 5173 的 pnpm dev 不同：共用 node_modules/.vite 时谁后启动谁重建依赖，
  // 另一边开着的页面拿到过期模块，卡在空白首帧。各用各的依赖缓存
  cacheDir: command === 'serve' && process.env.CAMPANULA_MOCK === '1'
    ? 'node_modules/.vite-mock'
    : undefined,
  define: {
    __CAMPANULA_MOCK__: JSON.stringify(command === 'serve' && process.env.CAMPANULA_MOCK === '1'),
  },
  plugins: [
    // SvelteKit 没有 index.html，UnoCSS 注册的 transformIndexHtml 永远不会被调用，只让 SvelteKit 每次读配置都警告一次
    // （kit 3.1.0 没有关掉它的开关）。交给 Vite 前把这个 hook 摘掉，扫描、生成 CSS 的其它 hook 不动。
    ...((plugins: Plugin[]): Plugin[] => {
      for (const plugin of plugins)
        delete plugin.transformIndexHtml
      return plugins
    })(UnoCSS()),
    // 只有 pnpm dev:mock（CAMPANULA_MOCK=1）的 dev 服务器才换掉网易云 SDK；生产构建不加载 mock（#58）
    ...(command === 'serve' && process.env.CAMPANULA_MOCK === '1'
      ? [
          mockPlugin(),
        ]
      : []),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter,
      // SvelteKit 开发时把环境变量的值（mock 的 COOKIE_SECRET、LOGIN_COOKIE_NAME）写进 <输出目录>/generated/dev/env/config.js：
      // 和 5173 共用 .svelte-kit 时，mock 一启动 5173 就换成 mock 的密钥，真账号掉登录。各用各的输出目录
      outDir: command === 'serve' && process.env.CAMPANULA_MOCK === '1'
        ? '.svelte-kit-mock'
        : undefined,
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    // 每个测试文件都会起一个 Vite 世界，共用 node_modules/.vite 的依赖缓存：并行启动时会在临时目录改名上打架（ENOTEMPTY），
    // 几条大曲库测试也会被挤到超时。文件一个一个跑，整轮 30 秒左右，稳定
    fileParallelism: false,
  },
}))
