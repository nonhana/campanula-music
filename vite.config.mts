import process from 'node:process';

import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from 'unocss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import { mockPlugin } from './src/lib/server/mock/vite-plugin.ts';

const adapter = process.env.VERCEL
  ? adapterVercel({
      runtime: 'nodejs24.x',
      regions: ['hkg1'],
    })
  : adapterNode();

export default defineConfig(({ command }) => ({
  // 共用 node_modules/.vite 时后启动的会重建依赖，另一边页面拿到过期模块卡在空白首帧：mock 各用各的
  cacheDir:
    command === 'serve' && process.env.CAMPANULA_MOCK === '1'
      ? 'node_modules/.vite-mock'
      : undefined,
  define: {
    __CAMPANULA_MOCK__: JSON.stringify(
      command === 'serve' && process.env.CAMPANULA_MOCK === '1',
    ),
  },
  plugins: [
    // SvelteKit 没有 index.html，UnoCSS 的 transformIndexHtml 只会让每次读配置都警告一次（kit 3.1.0 关不掉）：摘掉它
    ...((plugins: Plugin[]): Plugin[] => {
      for (const plugin of plugins) delete plugin.transformIndexHtml;
      return plugins;
    })(UnoCSS()),
    ...(command === 'serve' && process.env.CAMPANULA_MOCK === '1'
      ? [mockPlugin()]
      : []),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter,
      // 开发时把环境变量写进 <输出目录>/generated/dev/env：共用 .svelte-kit 时 mock 一启动，5173 就换成 mock 的密钥
      outDir:
        command === 'serve' && process.env.CAMPANULA_MOCK === '1'
          ? '.svelte-kit-mock'
          : undefined,
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    // 各测试文件共用 node_modules/.vite 的依赖缓存，并行时会在临时目录改名上打架（ENOTEMPTY）：一个一个跑
    fileParallelism: false,
  },
}));
