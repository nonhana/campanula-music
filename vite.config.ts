import process from 'node:process'
import adapterNode from '@sveltejs/adapter-node'
import adapterVercel from '@sveltejs/adapter-vercel'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vitest/config'

// 按部署平台换适配器（ADR-0009）：Vercel 构建时会设置 VERCEL=1，服务端路由变成香港 hkg1 的云函数；
// 其他环境（自己的服务器、Docker）构建成一个 Node 进程。
const adapter = process.env.VERCEL
  ? adapterVercel({ runtime: 'nodejs24.x', regions: ['hkg1'] })
  : adapterNode()

export default defineConfig({
  plugins: [
    UnoCSS(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter,
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
