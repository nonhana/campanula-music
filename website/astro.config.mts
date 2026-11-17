import { fileURLToPath } from 'node:url';

import { satteri } from '@astrojs/markdown-satteri';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';
import UnoCSS from 'unocss/vite';

import uno from '../uno.config.mts';
import { externalLinks } from './external-links.mts';

const site = new URL('https://campanula.caelum.moe');

export default defineConfig({
  site: site.href,
  markdown: { processor: satteri({ hastPlugins: [externalLinks(site)] }) },
  output: 'static',
  trailingSlash: 'always',
  server: { port: 4322 },
  vite: {
    plugins: [
      UnoCSS({
        ...uno,
        configFile: false,
        content: {
          filesystem: [
            fileURLToPath(
              new URL('./src/**/*.{astro,md,mdx,ts}', import.meta.url),
            ),
            fileURLToPath(
              new URL(
                '../src/lib/components/**/*.{svelte,ts}',
                import.meta.url,
              ),
            ),
          ],
        },
      }),
    ],
  },
  integrations: [
    svelte(),
    starlight({
      title: 'Campanula Music',
      description: '开源的第三方网易云音乐播放器，部署自己的实例。',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      pagefind: false,
      sidebar: [{ label: '部署 Campanula', slug: 'guide' }],
      expressiveCode: false,
      customCss: ['./src/styles/guide.css'],
      components: {
        Head: './src/components/guide/Head.astro',
        ThemeProvider: './src/components/guide/Light.astro',
        PageFrame: './src/components/guide/PageFrame.astro',
        TwoColumnContent: './src/components/guide/ReadingLayout.astro',
        PageTitle: './src/components/guide/PageTitle.astro',
        ContentPanel: './src/components/guide/ContentPanel.astro',
        MarkdownContent: './src/components/guide/MarkdownContent.astro',
        Footer: './src/components/guide/Footer.astro',
        SkipLink: './src/components/guide/SkipLink.astro',
      },
    }),
  ],
});
