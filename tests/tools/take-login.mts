import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import { isCancel, password } from '@clack/prompts';

const [instance, output] = process.argv.slice(2);
if (!instance || !output || !process.stdin.isTTY)
  throw new Error(
    '用法：pnpm tsx tests/tools/take-login.mts <实例 origin> <临时授权文件>，在终端输入短期授权 JSON',
  );
const text = await password({
  message: '本次授权 JSON（deviceId、credentials、identity；不回显）',
});
if (isCancel(text)) process.exitCode = 1;
else {
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('授权 JSON 格式错误');
  }
  await writeFile(
    output,
    JSON.stringify({
      ...value,
      instance: new URL(instance).origin,
      expiresAt: Date.now() + 15 * 60_000,
    }),
    { mode: 0o600, flag: 'wx' },
  );
}
