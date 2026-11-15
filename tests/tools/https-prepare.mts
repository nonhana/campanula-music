import { resolve } from 'node:path';
import process from 'node:process';

import { createCertificate } from './https/certificate.mts';
import { developmentSettings } from './https/development.mts';

const files = await createCertificate(
  resolve(process.argv[2] ?? developmentSettings('product').tlsDir),
);
console.log(JSON.stringify(files, null, 2));
console.log(
  '证书已生成；尚未修改系统信任或 hosts。用 ca.crt 显式配置客户端信任。证书短期有效，过期后重新生成。',
);

console.log(
  `准备后先运行 pnpm dev:proxy，再运行 pnpm dev / pnpm dev:mock。\n${developmentSettings('product').origin}/\n${developmentSettings('mock').origin}/`,
);
