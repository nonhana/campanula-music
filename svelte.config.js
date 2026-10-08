import process from 'node:process'
import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// 验证关卡①的一次性测试版。函数地区默认香港 hkg1；对照测试时用
// `vercel deploy --prod --build-env GATE_REGION=iad1` 换到华盛顿。
const region = process.env.GATE_REGION || 'hkg1'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      runtime: 'nodejs24.x',
      regions: [region],
      maxDuration: 60,
    }),
  },
}

export default config
