import type { BrowserContext } from '@playwright/test';

export const controlNetwork = async (
  context: BrowserContext,
  origins: Set<string>,
) => {
  const external: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (
      ['data:', 'blob:', 'about:'].includes(url.protocol) ||
      origins.has(url.origin)
    )
      await route.continue();
    else {
      external.push(url.href);
      await route.abort('blockedbyclient');
    }
  });
  return external;
};
