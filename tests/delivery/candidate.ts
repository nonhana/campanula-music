import { createHash } from 'node:crypto';
import {
  lstat,
  readdir,
  readFile,
  readlink,
  realpath,
  stat,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

export interface CandidateInput {
  candidate: string;
  sha: string;
  adapter: 'node' | 'vercel';
}

const markers = [
  '__CAMPANULA_MOCK_RUNTIME__',
  '__CAMPANULA_DESIGN_PAGE__',
  'campanula:mock-sdk',
  '/mock-assets/',
  '/api/mock/',
  'playlist_detail.liked-full',
  'user_playlist.full',
  'tests/_kit',
  'tests/tools',
  'tests/fixtures',
];

export const candidateEntries = async (
  root: string,
  boundary = root,
): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      const target = await readlink(path);
      const destination = await realpath(path);
      const scope = await realpath(boundary);
      if (isAbsolute(target) || relative(scope, destination).startsWith('..'))
        throw new Error(`产物符号链接越界：${path}`);
      files.push(path);
      continue;
    }
    if (entry.isDirectory())
      files.push(path, ...(await candidateEntries(path, boundary)));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`产物不是普通文件：${path}`);
  }
  return files.sort();
};

const measure = async (input: CandidateInput) => {
  const outputPath = join(input.candidate, 'output');
  const output = await realpath(outputPath);
  const fail = (reason: string): never => {
    throw new Error(`${input.adapter} 产物：${reason}`);
  };
  if ((await lstat(outputPath)).isSymbolicLink()) fail('输出根不能是符号链接');
  const files = await candidateEntries(output).catch((error: Error) =>
    fail(error.message),
  );
  if (!files.length) fail('扫描零文件');
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const path = relative(output, file).replaceAll('\\', '/');
    const scannedPath = path.replace(
      /\/node_modules\/undici\/lib\/mock(?=\/|$)/,
      '/node_modules/undici/lib',
    );
    if (
      /(?:^|\/)(?:tests|fixtures|mock-assets|mock|__mock)(?:\/|$)|(?:^|\/)(?:client|static)\/design(?:\/|$)|\/DesignPage[^/]*\.js$|\.(?:wav|mp3|ogg)$/i.test(
        scannedPath,
      )
    )
      fail(`泄漏测试工具或媒体：${path}`);
    if ((await lstat(file)).isDirectory()) {
      hashes[path] = 'directory';
      continue;
    }
    if ((await lstat(file)).isSymbolicLink()) {
      hashes[path] = `link:${await readlink(file)}`;
      continue;
    }
    const bytes = await readFile(file);
    const text = (
      path.endsWith('.gz')
        ? gunzipSync(bytes)
        : path.endsWith('.br')
          ? brotliDecompressSync(bytes)
          : bytes
    ).toString('latin1');
    for (const marker of markers)
      if (
        text.includes(marker) &&
        !(marker.startsWith('tests/') && path.endsWith('/package.json'))
      )
        fail(`${path} 出现 ${marker}`);
    hashes[path] = createHash('sha256').update(bytes).digest('hex');
  }
  const nonempty = async (path: string) => {
    const destination = await realpath(join(output, path));
    const details = await stat(destination);
    if (
      !hashes[relative(output, destination)] ||
      !details.isFile() ||
      !details.size
    )
      fail(`缺失或空文件：${path}`);
  };
  const staticRoot = input.adapter === 'node' ? 'client' : 'static';
  await nonempty(`${staticRoot}/service-worker.js`);
  await nonempty(`${staticRoot}/manifest.webmanifest`);
  const script = Object.keys(hashes).find(
    (path) =>
      path.startsWith(`${staticRoot}/_app/immutable/`) &&
      path.endsWith('.js') &&
      hashes[path] !== 'directory',
  );
  if (!script) fail(`缺失 ${staticRoot}/_app/immutable 静态资源`);
  await nonempty(script!);
  if (input.adapter === 'node') {
    if (
      hashes['config.json'] ||
      files.some((path) => relative(output, path).startsWith('functions/'))
    )
      fail('串入 Vercel 目标');
    await nonempty('index.js');
    await nonempty('handler.js');
  } else {
    if (
      hashes['index.js'] ||
      files.some((path) => relative(output, path).startsWith('client/'))
    )
      fail('串入 Node 目标');
    await nonempty('config.json');
    const config = JSON.parse(
      await readFile(join(output, 'config.json'), 'utf8'),
    ) as {
      version: number;
      routes: { src?: string; dest?: string; handle?: string }[];
    };
    if (
      config.version !== 3 ||
      !Array.isArray(config.routes) ||
      !config.routes.some((route) => route.handle === 'filesystem') ||
      !config.routes.some((route) => route.src?.includes('/api/'))
    )
      fail('Vercel v3 路由配置不完整');
    const functions = Object.keys(hashes).filter((path) =>
      path.endsWith('.func/.vc-config.json'),
    );
    if (!functions.length) fail('缺少 Vercel 函数');
    for (const file of functions) {
      const fn = JSON.parse(await readFile(join(output, file), 'utf8')) as {
        runtime: string;
        handler: string;
      };
      if (
        !fn.runtime?.startsWith('nodejs') ||
        !fn.handler ||
        isAbsolute(fn.handler)
      )
        fail(`无效函数配置：${file}`);
      const handler = relative(output, resolve(output, file, '..', fn.handler));
      if (handler.startsWith('..')) fail(`函数越界：${file}`);
      await nonempty(handler);
    }
    const final = config.routes.at(-1);
    if (
      !final?.dest ||
      !hashes[`functions/${final.dest.replace(/^\//, '')}.func/.vc-config.json`]
    )
      fail('最后一条路由缺少真实函数目标');
    for (const route of config.routes) {
      if (!route.dest) continue;
      const destination = route.dest;
      if (!destination.startsWith('/') || destination.split('/').includes('..'))
        fail(`路由目标越界：${destination}`);
      const fn = await realpath(
        join(
          output,
          'functions',
          `${destination === '/' ? 'index' : destination.slice(1)}.func/.vc-config.json`,
        ),
      ).catch(() => null);
      if (fn && functions.includes(relative(output, fn))) continue;
      const asset = `static${destination}`;
      if (hashes[asset]) await nonempty(asset);
      else fail(`路由没有函数或静态目标：${destination}`);
    }
  }
  return hashes;
};

export const sealCandidate = async (
  input: CandidateInput & { version: string; source?: unknown },
) => {
  if (!/^[a-f\d]{40}$/.test(input.sha)) throw new Error('候选必须提供完整 SHA');
  const hashes = await measure(input);
  await writeFile(
    join(input.candidate, 'candidate.json'),
    JSON.stringify(
      {
        sha: input.sha,
        adapter: input.adapter,
        version: input.version,
        source: input.source,
        hashes,
      },
      null,
      2,
    ),
  );
};

export const inspectCandidate = async (input: CandidateInput) => {
  const manifest = JSON.parse(
    await readFile(join(input.candidate, 'candidate.json'), 'utf8'),
  ) as {
    sha: string;
    adapter: string;
    version: string;
    hashes: Record<string, string>;
    source: unknown;
  };
  if (!/^[a-f\d]{40}$/.test(input.sha) || manifest.sha !== input.sha)
    throw new Error(`${input.adapter} 候选 SHA 不符`);
  if (manifest.adapter !== input.adapter)
    throw new Error(`${input.adapter} 候选目标不符：${manifest.adapter}`);
  if (!manifest.version) throw new Error('候选缺少版本');
  const hashes = await measure(input);
  for (const path of new Set([
    ...Object.keys(hashes),
    ...Object.keys(manifest.hashes),
  ]))
    if (hashes[path] !== manifest.hashes[path])
      throw new Error(`${input.adapter} 产物摘要不符：${path}`);
  return {
    sha: manifest.sha,
    adapter: input.adapter,
    version: manifest.version,
    files: Object.values(hashes).filter((hash) => hash !== 'directory').length,
    source: manifest.source,
  };
};
