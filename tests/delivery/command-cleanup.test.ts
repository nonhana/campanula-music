import { createServer } from 'node:net';
import process from 'node:process';

import { expect, it } from 'vitest';

import { startCommand } from '../_kit/command.ts';
import { requestURL } from '../_kit/http.ts';

it('关闭命令时强制清理不响应 TERM 的孙进程，端口可重新使用', async () => {
  const worker = `
    const http = require('node:http');
    process.on('SIGTERM', () => {});
    http.createServer((req, res) => res.end('owned child')).listen(0, '127.0.0.1', function () {
      console.log('PORT=' + this.address().port);
    });
  `;
  const wrapper = `
    require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(worker)}], { stdio: 'inherit' });
    process.on('SIGTERM', () => process.exit(0));
  `;
  const command = startCommand(process.execPath, ['-e', wrapper], {});
  let port = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(command.logs)), 5000);
      command.child.stdout.on('data', () => {
        const match = /PORT=(\d+)/.exec(command.logs);
        if (match) {
          port = Number(match[1]);
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    expect(
      await requestURL(`http://127.0.0.1:${port}`).then((r) => r.text()),
    ).toBe('owned child');
    const closed = command.close(100);
    let emergency = false;
    const timeout = setTimeout(() => {
      // 失败时也清掉测试自己留下的孙进程，不能靠 Vitest 超时收场。
      emergency = true;
      process.kill(-command.child.pid!, 'SIGKILL');
    }, 5000);
    await closed;
    clearTimeout(timeout);
    expect(emergency).toBe(false);
    await expect(requestURL(`http://127.0.0.1:${port}`)).rejects.toThrow();
    const listener = createServer();
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(port, '127.0.0.1', resolve);
    });
    await new Promise<void>((resolve) => listener.close(() => resolve()));
  } finally {
    await command.close(100);
  }
}, 10_000);
