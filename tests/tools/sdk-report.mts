import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { isNcmApiResponse } from 'hana-music-api';
import ts from 'typescript';

import { loadFixture } from '../_kit/fixtures.ts';
import { sdkQuery } from '../_kit/mock/query-key.ts';
import * as runtime from '../_kit/mock/runtime.ts';
import * as queue from '../_kit/netease-sdk.ts';
import { schemaName, validateSchema } from '../_kit/sdk-contract.ts';
import { inputs, validateQuery } from '../_kit/sdk-input.ts';
import { buildIndex } from './fixture-index.mts';

const ROOT = join(import.meta.dirname, '../..');
const sources = async (directory: string): Promise<string[]> =>
  (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) =>
        entry.isDirectory()
          ? sources(join(directory, entry.name))
          : /\.(?:ts|svelte)$/.test(entry.name)
            ? [join(directory, entry.name)]
            : [],
      ),
    )
  ).flat();

export const sdkReport = async () => {
  const bindings: Record<string, string> = {};
  const source = ts.createSourceFile(
    'bindings.ts',
    await readFile(join(ROOT, 'tests/_kit/mock/sdk-modules.ts'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === 'bind'
    ) {
      const arg = node.initializer.arguments[0];
      if (ts.isStringLiteral(arg))
        bindings[node.name.getText(source)] = arg.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const consumers: Record<string, string[]> = {};
  const helpers: Record<string, string[]> = {};
  const browser: Record<string, string[]> = {};
  for (const path of await sources(join(ROOT, 'src'))) {
    const text = await readFile(path, 'utf8');
    // 转义的模块名仍交给解析器；没有这些字符的文件不可能导入 SDK。
    if (!text.includes('hana-music-api') && !text.includes('\\')) continue;
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    for (const node of file.statements) {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier) ||
        !node.moduleSpecifier.text.startsWith('hana-music-api') ||
        node.importClause?.isTypeOnly
      )
        continue;
      const named = node.importClause?.namedBindings;
      if (!named || !ts.isNamedImports(named))
        throw new Error(`${path}：SDK 值导入必须具名，更新消费者合同`);
      for (const element of named.elements) {
        if (element.isTypeOnly) continue;
        const action = (element.propertyName ?? element.name).text;
        const at = `${relative(ROOT, path)}:${file.getLineAndCharacterOfPosition(element.getStart(file)).line + 1}`;
        const table = [
          'generateDeviceId',
          'getNcmFailureInfo',
          'isNcmApiResponse',
          'initializeWatchman',
        ].includes(action)
          ? action === 'initializeWatchman'
            ? browser
            : helpers
          : consumers;
        (table[action] ??= []).push(at);
      }
    }
  }
  const index = await buildIndex();
  const samples: Record<string, number> = {};
  for (const entry of index.entries)
    samples[entry.validation] = (samples[entry.validation] ?? 0) + 1;
  const actions = await Promise.all(
    Object.entries(consumers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([action, locations]) => {
        const module = bindings[action];
        if (!module || !inputs[module])
          throw new Error(`${action}：缺少 SDK 绑定或查询合同`);
        const success = index.entries.filter(
          (entry) =>
            entry.module === module && entry.validation === 'success-schema',
        );
        if (!success.length)
          throw new Error(`${action} / ${module}：缺少成功样本`);
        // 索引已按安装版 schema 逐份校验；此处另外检查消费者对应的公开 schema 存在。
        await validateSchema(
          schemaName(module),
          (await loadFixture(success[0].path)).outcome.response.body,
          action,
        );
        return {
          action,
          module,
          consumers: locations,
          required: inputs[module],
          success: success.map((entry) => entry.path),
          failures: index.entries
            .filter(
              (entry) => entry.module === module && entry.outcome !== 'ok',
            )
            .map((entry) => ({
              path: entry.path,
              validation: entry.validation,
            })),
          anyFailureGap: !index.entries.some(
            (entry) => entry.module === module && entry.outcome !== 'ok',
          ),
          failureGap: !index.entries.some(
            (entry) =>
              entry.module === module &&
              entry.outcome !== 'ok' &&
              !entry.constructed,
          ),
        };
      }),
  );
  const dynamic = [];
  const config = { cookie: runtime.loginCredentials().credentials };
  for (const action of actions) {
    const sample = await loadFixture(action.success[0]);
    const query = sdkQuery(action.module, sample.query);
    validateQuery(action.module, query, action.action);
    queue.reset();
    queue.queueReply(action.module, {
      ...sample.outcome,
      response: {
        ...sample.outcome.response,
        cookie: ['MUSIC_U=synthetic-contract; Path=/'],
      },
      when: query,
      fixture: action.success[0],
      required: true,
    });
    await queue.invokeModule(action.module, query, config);
    queue.assertComplete();
    await runtime.configure('large');
    const current = { ...query };
    if (
      action.module.startsWith('playlist_') &&
      'id' in current &&
      action.module !== 'playlist_detail'
    )
      current.id = 900000019;
    if (action.module === 'playlist_tracks')
      Object.assign(current, {
        pid: 900000019,
        tracks: [3433267939],
        op: 'add',
        step: 'initial',
      });
    if (action.module === 'song_order_update') {
      const detail = await runtime.invokeModule(
        'playlist_detail',
        { id: 900000019 },
        config,
      );
      Object.assign(current, {
        pid: 900000019,
        ids: (
          detail.body as { playlist: { trackIds: { id: number }[] } }
        ).playlist.trackIds
          .map((track) => track.id)
          .reverse(),
      });
    }
    if (action.module === 'album_sub') current.id = 3149073;
    if (action.module === 'artist_sub') current.id = 33927412;
    try {
      await runtime.invokeModule(action.module, current, config);
    } catch (error) {
      throw new Error(`${action.module} / 动态成功：${JSON.stringify(error)}`);
    }
    const templates = (await runtime.coverage()).templates;
    await runtime.configure('offline');
    let failure;
    try {
      await runtime.invokeModule(action.module, current, config);
    } catch (error) {
      failure = error;
    }
    if (!isNcmApiResponse(failure) || !('failure' in failure))
      throw new Error(`${action.module}：离线失败未符合合同`);
    queue.reset();
    queue.queueReply(action.module, {
      rejected: true,
      response: failure,
      when: query,
      required: true,
      fixture: '合成 transport 失败',
    });
    try {
      await queue.invokeModule(action.module, query);
    } catch (error) {
      if (error instanceof Error) throw error;
    }
    queue.assertComplete();
    dynamic.push({
      module: action.module,
      strictQuery: query,
      runtimeQuery: current,
      success: 'final-schema',
      failure: 'synthetic-transport',
      templates,
    });
  }
  queue.reset();
  await runtime.reset();
  return {
    dynamic,
    measuredSdk: index.checkedWith,
    actions,
    helpers,
    browser,
    samples,
    entries: index.entries,
  };
};

if (import.meta.main) {
  const report = await sdkReport();
  const output = join(ROOT, '.reports/sdk');
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, 'contract.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `${report.measuredSdk}：${report.actions.length} 个生产 action；报告 ${output}/contract.json`,
  );
}
