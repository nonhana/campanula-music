import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from '../suites.ts';

export const dist = join(ROOT, 'website/dist');
export const artifact = () => {
  const files = globSync('**/*', { cwd: dist, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dist.length + 1))
    .sort()
    .map((path) => ({
      path,
      sha256: createHash('sha256')
        .update(readFileSync(join(dist, path)))
        .digest('hex'),
    }));
  if (
    !files.some((file) => file.path === 'index.html') ||
    !files.some((file) => file.path === 'demo/index.html')
  )
    throw new Error('官网或示例产物缺失');
  return {
    files,
    digest: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  };
};
