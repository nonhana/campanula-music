import type { Plugin } from 'vite'
import process from 'node:process'
import adapterNode from '@sveltejs/adapter-node'
import adapterVercel from '@sveltejs/adapter-vercel'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vitest/config'
import { mockPlugin } from './src/lib/server/mock/vite-plugin.ts'

/**
 * SvelteKit 没有 index.html（开发时 app.html 由 SvelteKit 自己拼，构建产物里也没有），UnoCSS 插件注册的
 * transformIndexHtml 永远不会被调用，只会让 SvelteKit 每读一次 vite 配置就警告一次（kit 3.1.0 没有关掉它的开关）。
 * 交给 Vite 之前把这个 hook 摘掉；扫描、生成 CSS 的其它 hook 不动。
 */
function withoutHtmlHook(plugins: Plugin[]): Plugin[] {
  for (const plugin of plugins)
    delete plugin.transformIndexHtml
  return plugins
}

// 按部署平台换适配器（ADR-0009）：Vercel 构建时会设置 VERCEL=1，服务端路由变成香港 hkg1 的云函数；
// 其他环境（自己的服务器、Docker）构建成一个 Node 进程。
const adapter = process.env.VERCEL
  ? adapterVercel({ runtime: 'nodejs24.x', regions: ['hkg1'] })
  : adapterNode()

export default defineConfig(({ command }) => ({
  define: {
    __CAMPANULA_MOCK__: JSON.stringify(command === 'serve' && process.env.CAMPANULA_MOCK === '1'),
  },
  plugins: [
    ...withoutHtmlHook(UnoCSS()),
    // 只有 pnpm dev:mock（CAMPANULA_MOCK=1）的 dev 服务器才换掉网易云 SDK；生产构建不加载 mock（#58）
    ...(command === 'serve' && process.env.CAMPANULA_MOCK === '1' ? [mockPlugin()] : []),
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
