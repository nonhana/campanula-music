/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      // svelte 的条件导出 browser → 客户端构建（index-client）；vitest 默认按 SSR 解析会拿到
      // index-server，导致 mount 等客户端 API 不可用
      conditions: ['browser'],
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
      exclude: ['node_modules/**', '.svelte-kit/**', 'build/**'],
      setupFiles: ['src/test/setup.ts'],
    },
  }),
)
