import { createPrivateKey, randomUUID, X509Certificate } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import { execa } from 'execa';

import { ownRoot } from './environment.mts';

export interface TlsFiles {
  cert: string;
  key: string;
  ca: string;
}

export const validateTlsFiles = async (
  files: TlsFiles,
  hosts: string[],
  now: number,
  remaining = 0,
) => {
  const [certBytes, keyBytes, caBytes] = await Promise.all([
    readFile(files.cert),
    readFile(files.key),
    readFile(files.ca),
  ]);
  const cert = new X509Certificate(certBytes);
  const ca = new X509Certificate(caBytes);
  for (const item of [cert, ca]) {
    if (
      Date.parse(item.validFrom) > now ||
      Date.parse(item.validTo) <= now + remaining
    )
      throw new Error('证书尚未生效、已过期或临近到期');
  }
  if (!ca.ca || !cert.verify(ca.publicKey))
    throw new Error('站点证书与本地 CA 不匹配');
  if (!cert.checkPrivateKey(createPrivateKey(keyBytes)))
    throw new Error('站点证书与私钥不匹配');
  for (const hostname of hosts)
    if (!cert.checkHost(hostname)) throw new Error(`证书没有覆盖 ${hostname}`);
  return { fingerprint: ca.fingerprint256, expires: cert.validTo };
};

export const certificateFiles = async (tlsDir: string): Promise<TlsFiles> => {
  let directory = tlsDir;
  try {
    const pointer = JSON.parse(
      await readFile(join(tlsDir, 'current.json'), 'utf8'),
    ) as { directory: string };
    if (!/^issued-[\w-]+$/.test(pointer.directory))
      throw new Error('证书版本记录损坏');
    directory = join(tlsDir, pointer.directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return {
    cert: join(directory, 'site.crt'),
    key: join(directory, 'site.key'),
    ca: join(directory, 'ca.crt'),
  };
};

export const ensureCertificateFiles = async (options: {
  tlsDir: string;
  caRoot: string;
  mkcertBinary: string;
  hosts: string[];
  renewBefore: number;
  now?: number;
  signal?: AbortSignal;
}) => {
  const { tlsDir, caRoot, signal } = options;
  signal?.throwIfAborted();
  await mkdir(tlsDir, { recursive: true, mode: 0o700 });
  const release = await ownRoot(tlsDir, { signal, wait: 120_000 });
  try {
    const now = options.now ?? Date.now();
    const caBytes = await readFile(join(caRoot, 'rootCA.pem'));
    const authority = new X509Certificate(caBytes);
    if (
      !authority.ca ||
      !authority.verify(authority.publicKey) ||
      Date.parse(authority.validFrom) > now ||
      Date.parse(authority.validTo) <= now + options.renewBefore
    )
      throw new Error(
        '本地 CA 已失效或临近到期，请重新运行 pnpm dev:setup 明确信任',
      );
    const files = await certificateFiles(tlsDir);
    try {
      const existing = await validateTlsFiles(
        files,
        options.hosts,
        now,
        options.renewBefore,
      );
      if (existing.fingerprint === authority.fingerprint256)
        return { ...files, reused: true };
    } catch (error) {
      if (
        ['EACCES', 'EPERM'].includes(
          (error as NodeJS.ErrnoException).code ?? '',
        )
      )
        throw error;
    }
    const generation = await mkdtemp(join(tlsDir, 'issued-'));
    const pending = join(tlsDir, `.current-${randomUUID()}.json`);
    const issued = {
      cert: join(generation, 'site.crt'),
      key: join(generation, 'site.key'),
      ca: join(generation, 'ca.crt'),
    };
    let published = false;
    try {
      await writeFile(issued.ca, caBytes, { mode: 0o600 });
      await execa(
        options.mkcertBinary,
        ['-cert-file', issued.cert, '-key-file', issued.key, ...options.hosts],
        {
          env: { CAROOT: caRoot },
          cancelSignal: signal,
          killDescendants: true,
          timeout: 60_000,
        },
      );
      await chmod(issued.key, 0o600);
      await validateTlsFiles(
        issued,
        options.hosts,
        options.now ?? Date.now(),
        options.renewBefore,
      );
      signal?.throwIfAborted();
      await writeFile(
        pending,
        JSON.stringify({ directory: basename(generation) }),
        { mode: 0o600 },
      );
      await rename(pending, join(tlsDir, 'current.json'));
      published = true;
      return { ...issued, reused: false };
    } finally {
      await rm(pending, { force: true });
      if (!published) await rm(generation, { recursive: true, force: true });
    }
  } finally {
    await release();
  }
};
