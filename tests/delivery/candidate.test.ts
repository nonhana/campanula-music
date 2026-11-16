import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { inspectCandidate, sealCandidate } from './candidate.ts';

it('候选产物明确归属 SHA 和目标，拒绝缺失、空入口与文件变化', async () => {
  const root = await mkdtemp(join(tmpdir(), 'candidate-'));
  const sha = 'a'.repeat(40);
  try {
    await expect(
      inspectCandidate({ candidate: root, sha, adapter: 'node' }),
    ).rejects.toThrow();
    await mkdir(join(root, 'output/client'), { recursive: true });
    for (const [file, text] of Object.entries({
      'index.js': 'console.log("server")',
      'handler.js': 'export const handler = () => {}',
      'client/service-worker.js': 'self.addEventListener("fetch", () => {})',
      'client/manifest.webmanifest': '{"name":"Campanula"}',
      'client/_app/immutable/entry/start.js': 'export const start = 1',
    })) {
      await mkdir(join(root, 'output', file, '..'), { recursive: true });
      await writeFile(join(root, 'output', file), text);
    }
    await sealCandidate({
      candidate: root,
      sha,
      adapter: 'node',
      version: 'version-one',
    });
    expect(
      await inspectCandidate({ candidate: root, sha, adapter: 'node' }),
    ).toMatchObject({ sha, adapter: 'node', files: 5 });
    await expect(
      inspectCandidate({
        candidate: root,
        sha: 'b'.repeat(40),
        adapter: 'node',
      }),
    ).rejects.toThrow(/SHA/);
    await expect(
      inspectCandidate({ candidate: root, sha, adapter: 'vercel' }),
    ).rejects.toThrow(/目标/);
    await writeFile(join(root, 'output/index.js'), '');
    await expect(
      inspectCandidate({ candidate: root, sha, adapter: 'node' }),
    ).rejects.toThrow(/index.js/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('vercel 必须有路由、可用函数和静态资源，拒绝零文件、混目标、mock、工具、录制与媒体', async () => {
  const root = await mkdtemp(join(tmpdir(), 'candidate-'));
  const input = {
    candidate: root,
    sha: 'a'.repeat(40),
    adapter: 'vercel' as const,
    version: 'v1',
  };
  const output = join(root, 'output');
  const put = async (file: string, body: string) => {
    await mkdir(join(output, file, '..'), { recursive: true });
    await writeFile(join(output, file), body);
  };
  try {
    await mkdir(output);
    await expect(sealCandidate(input)).rejects.toThrow(/零文件/);
    await put(
      'config.json',
      JSON.stringify({
        version: 3,
        routes: [{ handle: 'filesystem' }, { src: '/api/.*', dest: '/api' }],
      }),
    );
    await put(
      'static/service-worker.js',
      'self.addEventListener("fetch", () => {})',
    );
    await put('static/manifest.webmanifest', '{"name":"Campanula"}');
    await put('static/_app/immutable/start.js', 'export const start = 1');
    await expect(sealCandidate(input)).rejects.toThrow(/函数/);
    await put(
      'functions/api.func/.vc-config.json',
      '{"runtime":"nodejs24.x","handler":"index.js"}',
    );
    await expect(sealCandidate(input)).rejects.toThrow(/index.js/);
    await put('functions/api.func/index.js', 'export default () => {}');
    await sealCandidate(input);
    expect(await inspectCandidate(input)).toMatchObject({
      files: 6,
      adapter: 'vercel',
    });
    await put(
      'functions/![-]/catchall.func/.vc-config.json',
      '{"runtime":"nodejs24.x","handler":"index.js"}',
    );
    await put(
      'functions/![-]/catchall.func/index.js',
      'export default () => {}',
    );
    await put(
      'config.json',
      JSON.stringify({
        version: 3,
        routes: [
          { handle: 'filesystem' },
          { src: '/api/.*', dest: '/missing' },
          { src: '/.*', dest: '/![-]/catchall' },
        ],
      }),
    );
    await expect(sealCandidate(input)).rejects.toThrow(/路由/);
    await rm(join(output, 'functions/![-]'), { recursive: true });
    await put(
      'config.json',
      JSON.stringify({
        version: 3,
        routes: [{ handle: 'filesystem' }, { src: '/api/.*', dest: '/api' }],
      }),
    );
    await put('functions/api.func/empty.js', '');
    for (const target of ['empty.js', '.']) {
      await symlink(target, join(output, 'functions/api.func/entry.js'));
      await put(
        'functions/api.func/.vc-config.json',
        '{"runtime":"nodejs24.x","handler":"entry.js"}',
      );
      await expect(sealCandidate(input)).rejects.toThrow(/entry.js/);
      await rm(join(output, 'functions/api.func/entry.js'));
    }
    await put(
      'functions/api.func/.vc-config.json',
      '{"runtime":"nodejs24.x","handler":"index.js"}',
    );
    await rm(join(output, 'functions/api.func/empty.js'));
    await mkdir(join(output, 'static/tests/tools'), { recursive: true });
    await expect(inspectCandidate(input)).rejects.toThrow(/泄漏|摘要/);
    await rm(join(output, 'static/tests'), { recursive: true });
    for (const [file, body] of [
      ['static/api/mock/reset.js', ''],
      ['static/design/index.html', ''],
      ['static/tests/tools/x.js', 'tool'],
      ['static/fixtures/recording.json', '{}'],
      ['static/test.wav', 'synthetic'],
      ['static/a.js', '__CAMPANULA_DESIGN_PAGE__'],
      ['static/a.js', 'user_playlist.full'],
      ['static/a.js', '__CAMPANULA_MOCK_RUNTIME__'],
    ]) {
      await put(file, body);
      await expect(sealCandidate(input)).rejects.toThrow(/泄漏|出现/);
      await rm(join(output, file.split('/').slice(0, 2).join('/')), {
        recursive: true,
      });
    }
    const vendor = 'functions/api.func/node_modules/undici/lib/mock';
    await put(`${vendor}/agent.js`, 'exports.MockAgent = class {}');
    await sealCandidate(input);
    for (const [path, body] of [
      ['tests/tools', null],
      ['fixtures/sample.json', '{}'],
      ['test.wav', 'audio'],
    ] as const) {
      if (body === null)
        await mkdir(join(output, vendor, path), { recursive: true });
      else await put(`${vendor}/${path}`, body);
      await expect(sealCandidate(input)).rejects.toThrow(/泄漏/);
      await rm(join(output, vendor, path.split('/')[0]), { recursive: true });
    }
    await put('index.js', 'node target');
    await expect(sealCandidate(input)).rejects.toThrow(/串入/);
    await rm(join(output, 'index.js'));
    await put('config.json', '{"version":3,"routes":[]}');
    await expect(sealCandidate(input)).rejects.toThrow(/路由/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('产物软链只能指向本候选内部，新增文件和压缩的 mock 泄漏都失败', async () => {
  const { symlink } = await import('node:fs/promises');
  const { gzipSync } = await import('node:zlib');
  const root = await mkdtemp(join(tmpdir(), 'candidate-'));
  const input = {
    candidate: root,
    sha: 'a'.repeat(40),
    adapter: 'node' as const,
    version: 'v1',
  };
  try {
    await mkdir(join(root, 'output/client/_app/immutable'), {
      recursive: true,
    });
    for (const file of [
      'index.js',
      'handler.js',
      'client/service-worker.js',
      'client/manifest.webmanifest',
      'client/_app/immutable/start.js',
    ])
      await writeFile(join(root, 'output', file), 'nonempty');
    await symlink('index.js', join(root, 'output/alias.js'));
    await sealCandidate(input);
    expect(await inspectCandidate(input)).toMatchObject({ files: 6 });
    await writeFile(join(root, 'output/extra.js'), 'new');
    await expect(inspectCandidate(input)).rejects.toThrow(/extra.js/);
    await rm(join(root, 'output/extra.js'));
    await writeFile(
      join(root, 'output/code.js.gz'),
      gzipSync('__CAMPANULA_MOCK_RUNTIME__'),
    );
    await expect(sealCandidate(input)).rejects.toThrow(/出现/);
    await rm(join(root, 'output/code.js.gz'));
    await symlink('../candidate.json', join(root, 'output/escape.js'));
    await expect(sealCandidate(input)).rejects.toThrow(/越界/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
