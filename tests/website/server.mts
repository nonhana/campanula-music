import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { preview } from 'astro';

const server = await preview({
  root: fileURLToPath(new URL('../../website/', import.meta.url)),
  server: { host: '127.0.0.1', port: 4387 },
  vite: { preview: { strictPort: true } },
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await server.stop();
    process.exit(0);
  });
