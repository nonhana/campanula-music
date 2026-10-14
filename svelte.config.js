import process from 'node:process'
import adapterNode from '@sveltejs/adapter-node'
import adapterVercel from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// 按部署平台换适配器（ADR-0009）：Vercel 构建时会设置 VERCEL=1，服务端路由变成香港 hkg1 的云函数；
// 其他环境（自己的服务器、Docker）构建成一个 Node 进程。
const adapter = process.env.VERCEL
  ? adapterVercel({ runtime: 'nodejs24.x', regions: ['hkg1'] })
  : adapterNode()

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
    // scripts/ 下的 .mts（用 tsx 跑）也做类型检查
    typescript: { config: config => ({ ...config, include: [...config.include, '../scripts/**/*.mts'] }) },
  },
}

export default config
