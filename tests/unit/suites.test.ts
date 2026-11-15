import { execFile } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import baseline from '../baselines/migration.json' with { type: 'json' };
import { compareMigration, ROOT, selectTests } from '../suites.ts';

describe('套件选择', () => {
  it('按用例全名过滤到空集时，CLI 明确失败', async () => {
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          fileURLToPath(import.meta.resolve('tsx/cli')),
          fileURLToPath(new URL('../tools/run.mts', import.meta.url)),
          'unit',
          'tests/unit/selection-core.test.ts',
          '-t',
          '__campanula_missing_case__',
        ],
        { cwd: ROOT },
      ),
    ).rejects.toMatchObject({ code: 1 });
  });

  it('漏掉迁移清单中的文件会失败，不会把剩余用例算作完整回归', () => {
    expect(() =>
      selectTests(['tests/unit/rule.test.ts'], {
        unit: ['tests/unit/rule.test.ts', 'tests/unit/missing.test.ts'],
      }),
    ).toThrow('missing.test.ts');
  });

  it('同一文件被两层选择会失败', () => {
    expect(() =>
      selectTests(
        ['tests/unit/rule.test.ts'],
        {
          unit: ['tests/unit/*.test.ts'],
          contract: ['tests/unit/*.test.ts'],
        },
        [],
      ),
    ).toThrow('归属 2 次');
  });

  it('必需套件空选择会失败', () => {
    expect(() =>
      selectTests([], { unit: ['tests/unit/*.test.ts'] }, []),
    ).toThrow('选择为空');
  });

  it('放在分层目录外的文件会失败', () => {
    expect(() =>
      selectTests(
        ['tests/unit/rule.test.ts', 'tests/lost.test.ts'],
        {
          unit: ['tests/unit/*.test.ts'],
        },
        [],
      ),
    ).toThrow('lost.test.ts');
  });

  it('旧用例缺失时，迁移核对会失败', () => {
    expect(() => compareMigration({ testResults: [] })).toThrow(
      '旧用例迁移不一致',
    );
  });

  it('目录内仍有别的文件时，删除必需文件仍会失败', () => {
    expect(() =>
      selectTests(
        ['tests/unit/rule.test.ts'],
        {
          unit: ['tests/unit/*.test.ts'],
        },
        ['tests/unit/removed.test.ts'],
      ),
    ).toThrow('缺少必需测试文件');
  });

  it('旧用例被跳过、重复执行都会失败，新增用例另列', () => {
    const testResults = baseline.migrations.map(({ to, cases }) => ({
      name: `${ROOT}${to}`,
      assertionResults: cases.map(({ name, status }) => ({
        fullName: name,
        status,
      })),
    }));
    expect(compareMigration({ testResults }).preserved).toBe(755);
    testResults[0].assertionResults[0].status = 'pending';
    expect(() => compareMigration({ testResults })).toThrow(
      '原 passed，现 pending',
    );
    testResults[0].assertionResults[0].status = 'passed';
    testResults[0].assertionResults.push(testResults[0].assertionResults[0]);
    expect(() => compareMigration({ testResults })).toThrow('旧用例迁移不一致');
    testResults[0].assertionResults.pop();
    testResults[0].assertionResults.push({
      fullName: '新增规则',
      status: 'passed',
    });
    expect(compareMigration({ testResults }).added).toEqual([
      { file: baseline.migrations[0].to, name: '新增规则', status: 'passed' },
    ]);
  });
});
