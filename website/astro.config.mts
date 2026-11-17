import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://campanula.caelum.moe',
  output: 'static',
  trailingSlash: 'always',
  server: { port: 4322 },
  integrations: [
    starlight({
      title: 'Campanula Music',
      description: '开源的第三方网易云音乐播放器，部署自己的实例。',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      pagefind: false,
      sidebar: [{ label: '部署 Campanula', slug: 'guide' }],
    }),
  ],
});
