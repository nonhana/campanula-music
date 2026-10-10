import process from 'node:process'
import adapterNode from '@sveltejs/adapter-node'
import adapterVercel from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const adapter = process.env.ADAPTER === 'node'
  ? adapterNode()
  : adapterVercel({ runtime: 'nodejs24.x', regions: ['hkg1'] })

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
    csp: {
      mode: 'auto',
    },
  },
}

export default config
