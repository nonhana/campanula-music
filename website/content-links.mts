import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';

type MarkdownHook = NonNullable<SatteriProcessorOptions['hastPlugins']>[number];
const content = new URL('./src/content/docs/', import.meta.url);

// 正文保留可在仓库阅读的相对文件链接，发布时再换成站内文章地址。
export const contentLinks: MarkdownHook = {
  name: 'campanula-content-links',
  element: {
    filter: ['a'],
    visit(node, ctx) {
      const href = node.properties?.href;
      if (typeof href !== 'string' || !ctx.fileURL || !href.startsWith('.'))
        return;
      const target = new URL(href, ctx.fileURL);
      if (
        !target.href.startsWith(content.href) ||
        !/\.mdx?$/.test(target.pathname)
      )
        return;
      const path = target.pathname
        .slice(content.pathname.length)
        .replace(/\.mdx?$/, '')
        .replace(/(^|\/)index$/, '');
      ctx.setProperty(
        node,
        'href',
        `/${path}${path.endsWith('/') ? '' : '/'}${target.search}${target.hash}`,
      );
    },
  },
};
