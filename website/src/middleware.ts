import { readFile } from 'node:fs/promises';

import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async ({ url }, next) => {
  // Astro dev 只按文件名服务 public，生产静态主机则会解析目录里的 index.html。
  if (
    import.meta.env.DEV &&
    /^\/demo\/(?:playlists\/(?:50[12]\/)?)?$/.test(url.pathname)
  )
    return new Response(
      await readFile(new URL('../public/demo/index.html', import.meta.url)),
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      },
    );
  return next();
});
