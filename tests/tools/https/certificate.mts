import { execFileSync } from 'node:child_process';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const createCertificate = async (root: string) => {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const openssl = (args: string[]) =>
    execFileSync('openssl', args, { cwd: root, stdio: 'pipe' });
  openssl([
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    'ca.key',
    '-out',
    'ca.crt',
    '-days',
    '7',
    '-subj',
    '/CN=Campanula isolated development CA',
    '-addext',
    'basicConstraints=critical,CA:TRUE',
  ]);
  openssl([
    'req',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    'site.key',
    '-out',
    'site.csr',
    '-subj',
    '/CN=local.campanula.test',
  ]);
  await writeFile(
    join(root, 'extensions'),
    'subjectAltName=DNS:local.campanula.test,DNS:mock.campanula.test\nbasicConstraints=critical,CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',
  );
  openssl([
    'x509',
    '-req',
    '-in',
    'site.csr',
    '-CA',
    'ca.crt',
    '-CAkey',
    'ca.key',
    '-CAcreateserial',
    '-out',
    'site.crt',
    '-days',
    '6',
    '-extfile',
    'extensions',
  ]);
  for (const name of ['ca.key', 'site.key'])
    await chmod(join(root, name), 0o600);
  return {
    cert: join(root, 'site.crt'),
    key: join(root, 'site.key'),
    ca: join(root, 'ca.crt'),
  };
};
