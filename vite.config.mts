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
      runtime: 'nodejs26.x',
      regions: ['hkg1'],
    })
  : adapterNode()

export default defineConfig(({ command }) => ({
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
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    // 每个测试文件都会起一个 Vite 世界，共用 node_modules/.vite 的依赖缓存：并行启动时会在临时目录改名上打架（ENOTEMPTY），
    // 几条大曲库测试也会被挤到超时。文件一个一个跑，整轮 30 秒左右，稳定
    fileParallelism: false,
  },
}))
