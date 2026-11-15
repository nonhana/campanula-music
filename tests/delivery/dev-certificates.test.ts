import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { expect, it } from 'vitest';

import {
  certificateFiles,
  ensureDevelopmentCertificate,
  SOURCE,
} from '../../scripts/dev.mts';

const fixture = join(SOURCE, 'tests/fixtures/tls');
const prepare = async (certificate = 'valid.pem') => {
  const root = await mkdtemp(join(tmpdir(), 'campanula-certificate-'));
  const tlsDir = join(root, 'tls');
  const caRoot = join(root, 'authority');
  await mkdir(tlsDir);
  await mkdir(caRoot);
  await copyFile(join(fixture, 'rootCA.pem'), join(caRoot, 'rootCA.pem'));
  await copyFile(join(fixture, 'rootCA.pem'), join(tlsDir, 'ca.crt'));
  await copyFile(join(fixture, certificate), join(tlsDir, 'site.crt'));
  await copyFile(join(fixture, 'site.key'), join(tlsDir, 'site.key'));
  const calls = join(root, 'calls');
  const binary = join(root, 'mkcert.mjs');
  const issuer = async (before = '', cert = 'valid.pem') => {
    await writeFile(
      binary,
      `#!/usr/bin/env node
import { appendFile, copyFile } from 'node:fs/promises';
await appendFile(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n');
${before}
for (const [flag, source] of [['-cert-file', ${JSON.stringify(join(fixture, cert))}], ['-key-file', ${JSON.stringify(join(fixture, 'site.key'))}]]) {
  await copyFile(source, process.argv[process.argv.indexOf(flag) + 1]);
}
`,
      { mode: 0o755 },
    );
  };
  return {
    root,
    tlsDir,
    caRoot,
    calls,
    issuer,
    options: {
      tlsDir,
      caRoot,
      mkcertBinary: binary,
      now: Date.parse('2026-11-16T00:00:00Z'),
    },
    close: () => rm(root, { recursive: true, force: true }),
  };
};

it('有效站点证书保持原文件和同一个 CA，不调用 mkcert 或重新信任', async () => {
  const context = await prepare();
  try {
    const original = await stat(join(context.tlsDir, 'site.crt'));
    const result = await ensureDevelopmentCertificate(context.options);
    expect(result.reused).toBe(true);
    expect((await stat(result.cert)).mtimeMs).toBe(original.mtimeMs);
    expect(await readFile(result.ca, 'utf8')).toBe(
      await readFile(join(context.caRoot, 'rootCA.pem'), 'utf8'),
    );
    await expect(access(context.calls)).rejects.toThrow();
  } finally {
    await context.close();
  }
});

it('两个启动同时遇到临期证书时只签发一次，复用原 CA 并发布完整证书组', async () => {
  const context = await prepare('near.pem');
  await context.issuer('await new Promise(r => setTimeout(r, 100));');
  try {
    const certificates = await Promise.all([
      ensureDevelopmentCertificate(context.options),
      ensureDevelopmentCertificate(context.options),
    ]);
    expect(certificates.map((c) => c.reused).sort()).toEqual([false, true]);
    expect(certificates[0].cert).toBe(certificates[1].cert);
    expect(await readFile(certificates[0].cert, 'utf8')).toBe(
      await readFile(join(fixture, 'valid.pem'), 'utf8'),
    );
    expect(await readFile(certificates[0].ca, 'utf8')).toBe(
      await readFile(join(context.caRoot, 'rootCA.pem'), 'utf8'),
    );
    const invocations = (await readFile(context.calls, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).not.toContain('-install');
  } finally {
    await context.close();
  }
});

it.each(['missing', 'corrupt', 'key', 'expired'])(
  '%s 的站点缓存由同一个 CA 重新签发',
  async (problem) => {
    const context = await prepare(
      problem === 'expired' ? 'near.pem' : 'valid.pem',
    );
    await context.issuer();
    try {
      if (problem === 'missing') await rm(join(context.tlsDir, 'site.crt'));
      if (problem === 'corrupt')
        await writeFile(join(context.tlsDir, 'site.crt'), 'invalid');
      if (problem === 'key')
        await writeFile(join(context.tlsDir, 'site.key'), 'invalid');
      const result = await ensureDevelopmentCertificate({
        ...context.options,
        now: Date.parse('2026-12-16T00:00:00Z'),
      });
      expect(result.reused).toBe(false);
      expect(await readFile(result.cert, 'utf8')).toBe(
        await readFile(join(fixture, 'valid.pem'), 'utf8'),
      );
      expect(await readFile(result.ca, 'utf8')).toBe(
        await readFile(join(context.caRoot, 'rootCA.pem'), 'utf8'),
      );
    } finally {
      await context.close();
    }
  },
);

it('签发被取消时保留旧证书，删除未发布文件并释放锁，随后可以重试', async () => {
  const context = await prepare('near.pem');
  await context.issuer('await new Promise(r => setTimeout(r, 60_000));');
  const controller = new AbortController();
  try {
    const old = await readFile(join(context.tlsDir, 'site.crt'), 'utf8');
    const issuing = ensureDevelopmentCertificate({
      ...context.options,
      signal: controller.signal,
    });
    const rejected = expect(issuing).rejects.toThrow();
    for (let attempt = 0; ; attempt++) {
      try {
        await access(context.calls);
        break;
      } catch {
        if (attempt === 100) throw new Error('签发子进程未启动');
        await delay(20);
      }
    }
    controller.abort();
    await rejected;
    expect(await readFile(join(context.tlsDir, 'site.crt'), 'utf8')).toBe(old);
    expect((await readdir(context.tlsDir)).sort()).toEqual([
      'ca.crt',
      'site.crt',
      'site.key',
    ]);
    await context.issuer();
    expect((await ensureDevelopmentCertificate(context.options)).reused).toBe(
      false,
    );
  } finally {
    controller.abort();
    await context.close();
  }
});

it('签发器返回无效证书时不发布半套缓存，失效 CA 不会被静默替换', async () => {
  const context = await prepare('near.pem');
  await context.issuer('', 'near.pem');
  try {
    await expect(ensureDevelopmentCertificate(context.options)).rejects.toThrow(
      '临近到期',
    );
    expect((await certificateFiles(context.tlsDir)).cert).toBe(
      join(context.tlsDir, 'site.crt'),
    );
    expect((await readdir(context.tlsDir)).sort()).toEqual([
      'ca.crt',
      'site.crt',
      'site.key',
    ]);
    await copyFile(
      join(fixture, 'near.pem'),
      join(context.caRoot, 'rootCA.pem'),
    );
    await expect(ensureDevelopmentCertificate(context.options)).rejects.toThrow(
      '本地 CA',
    );
    expect(
      (await readFile(context.calls, 'utf8')).trim().split('\n'),
    ).toHaveLength(1);
  } finally {
    await context.close();
  }
});
