/// <reference types="vitest/config" />
import { enhancedImages } from '@sveltejs/enhanced-img'
import { sveltekit } from '@sveltejs/kit/vite'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    UnoCSS(),
    enhancedImages(),
    sveltekit(),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', '.svelte-kit/**', 'build/**'],
  },
})
