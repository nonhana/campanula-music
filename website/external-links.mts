import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';

type MarkdownHook = NonNullable<SatteriProcessorOptions['hastPlugins']>[number];

// Markdown 和 MDX 的普通链接在构建时标记。组件自己绘制的部署按钮不经过此处。
export const externalLinks = (site: URL): MarkdownHook => ({
  name: 'campanula-external-links',
  element: {
    filter: ['a'],
    visit(node, ctx) {
      const href = node.properties?.href;
      if (typeof href !== 'string') return;
      const url = URL.parse(href, site);
      if (
        !url ||
        !['https:', 'http:'].includes(url.protocol) ||
        url.origin === site.origin
      )
        return;
      const rel = [node.properties?.rel, 'external']
        .flat()
        .join(' ')
        .trim()
        .split(/\s+/);
      ctx.setProperty(node, 'rel', [...new Set(rel)].join(' '));
      // 不让行尾的小箭头单独折到下一行。装饰不进入链接的可访问名称。
      ctx.appendChild(node, {
        type: 'element',
        tagName: 'span',
        properties: { class: 'external-link-tail', 'aria-hidden': 'true' },
        children: [
          { type: 'text', value: '\u2060' },
          {
            type: 'element',
            tagName: 'svg',
            properties: { viewBox: '0 0 24 24' },
            children: [
              {
                type: 'element',
                tagName: 'use',
                properties: { href: '#guide-external-arrow' },
                children: [],
              },
            ],
          },
        ],
      });
    },
  },
});
