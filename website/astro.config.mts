import { fileURLToPath } from 'node:url';

import { satteri } from '@astrojs/markdown-satteri';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';
import { presetTypography } from 'unocss';
import UnoCSS from 'unocss/vite';

import uno from '../uno.config.mts';
import { colors } from '../uno.palette.mts';
import { contentLinks } from './content-links.mts';
import { externalLinks } from './external-links.mts';

const site = new URL('https://campanula.caelum.moe');

export default defineConfig({
  site: site.href,
  markdown: {
    processor: satteri({ hastPlugins: [contentLinks, externalLinks(site)] }),
  },
  output: 'static',
  trailingSlash: 'always',
  server: { port: 4322 },
  vite: {
    plugins: [
      UnoCSS({
        ...uno,
        configFile: false,
        presets: [
          ...(uno.presets ?? []),
          presetTypography({
            // 复用 Starlight 给 Expressive Code 块加的 not-content。
            selectorName: 'content',
            colorScheme: {
              links: [colors.primary[900], colors.primary[200]],
              bullets: [colors.neutral[600], colors.neutral[400]],
            },
            cssExtend: {
              'code::before': { content: 'none' },
              'code::after': { content: 'none' },
            },
          }),
        ],
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
      sidebar: [{ label: '文档目录', slug: 'guide' }],
      expressiveCode: {
        themes: ['github-light'],
        defaultProps: { frame: 'none' },
        plugins: [
          {
            name: 'Keyboard-scrollable code',
            hooks: {
              postprocessRenderedBlock: ({ renderData: { blockAst } }) => {
                for (const node of blockAst.children) {
                  if (node.type === 'element' && node.tagName === 'pre')
                    node.properties.tabIndex = 0;
                }
              },
            },
          },
        ],
        styleOverrides: {
          borderWidth: '0px',
          codeBackground: colors.white,
          codeFontSize: '0.875rem',
          frames: { frameBoxShadowCssValue: 'none' },
        },
      },
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
