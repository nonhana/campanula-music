import assert from 'node:assert/strict';
import { createHash, X509Certificate } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { execa } from 'execa';

import { ensureDevelopmentCertificate } from '../../../scripts/dev.mts';

// 专项只在临时 CAROOT 签发，不运行 -install，不修改本机信任。
export const createCertificate = async (root: string, signal: AbortSignal) => {
  const caRoot = join(root, 'authority');
  const tlsDir = join(root, 'tls');
  await mkdir(caRoot, { recursive: true, mode: 0o700 });
  await mkdir(tlsDir, { mode: 0o700 });
  const binary = process.env.CAMPANULA_MKCERT ?? 'mkcert';
  const cert = join(tlsDir, 'site.crt');
  const key = join(tlsDir, 'site.key');
  const ca = join(tlsDir, 'ca.crt');
  await execa(
    binary,
    [
      '-cert-file',
      cert,
      '-key-file',
      key,
      'local.campanula.test',
      'mock.campanula.test',
    ],
    {
      env: { CAROOT: caRoot },
      cancelSignal: signal,
      killDescendants: true,
    },
  );
  await copyFile(join(caRoot, 'rootCA.pem'), ca);
  const original = await readFile(ca);
  const authorityKey = createHash('sha256')
    .update(await readFile(join(caRoot, 'rootCA-key.pem')))
    .digest('hex');
  const options = { tlsDir, caRoot, mkcertBinary: binary, signal };
  const first = await ensureDevelopmentCertificate(options);
  assert.equal(first.reused, true);
  const mtime = (await stat(first.cert)).mtimeMs;
  assert.equal(
    (await stat((await ensureDevelopmentCertificate(options)).cert)).mtimeMs,
    mtime,
  );

  // 同一个临时 CA 签一个六天叶证书，以真实 mkcert 检查自动续签。
  const csr = join(root, 'site.csr');
  const extensions = join(root, 'extensions');
  await writeFile(
    extensions,
    'subjectAltName=DNS:local.campanula.test,DNS:mock.campanula.test\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n',
  );
  await execa(
    'openssl',
    [
      'req',
      '-new',
      '-key',
      key,
      '-out',
      csr,
      '-subj',
      '/CN=local.campanula.test',
    ],
    { cancelSignal: signal },
  );
  await execa(
    'openssl',
    [
      'x509',
      '-req',
      '-in',
      csr,
      '-CA',
      ca,
      '-CAkey',
      join(caRoot, 'rootCA-key.pem'),
      '-CAcreateserial',
      '-out',
      cert,
      '-days',
      '6',
      '-extfile',
      extensions,
    ],
    { cancelSignal: signal },
  );
  const near = new X509Certificate(await readFile(cert));
  // 签发跨过秒级生效时间，防止拿签发前的旧时间误判新证书。
  const delayedIssuer = join(root, 'delayed-mkcert.mjs');
  await writeFile(
    delayedIssuer,
    `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
await new Promise(resolve => setTimeout(resolve, 2000));
const result = spawnSync(${JSON.stringify(binary)}, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`,
    { mode: 0o755 },
  );
  const renewed = await ensureDevelopmentCertificate({
    ...options,
    mkcertBinary: delayedIssuer,
  });
  assert.equal(renewed.reused, false);
  assert.ok(
    Date.parse(new X509Certificate(await readFile(renewed.cert)).validTo) >
      Date.parse(near.validTo),
  );
  assert.deepEqual(await readFile(renewed.ca), original);
  assert.equal(
    createHash('sha256')
      .update(await readFile(join(caRoot, 'rootCA-key.pem')))
      .digest('hex'),
    authorityKey,
  );
  assert.equal((await ensureDevelopmentCertificate(options)).reused, true);
  return renewed;
};
