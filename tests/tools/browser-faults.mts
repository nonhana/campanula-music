import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { execaNode } from 'execa';

import { createWorkspace, SOURCE } from '../_kit/workspace.ts';

const reports = join(SOURCE, '.reports/browser-faults');
await mkdir(reports, { recursive: true });
const report = await mkdtemp(join(reports, 'run-'));
const source = await mkdtemp(join(tmpdir(), 'campanula-fault-source-'));
const cases = [
  {
    name: 'save',
    file: 'src/lib/components/playlist/PlaylistEditorPanel.svelte',
    before:
      'void view.app.editPlaylist(playlist.id, { name, description, tags });',
    after: 'void 0;',
    test: 'journeys/save.spec.ts',
    grep: '保存歌单名称',
    reason: '通过保存按钮提交并显示新名字',
  },
  {
    name: 'name',
    file: 'src/lib/components/songs/SongMoreButton.svelte',
    before: 'aria-label="更多操作：{songTitle(song)}"',
    after: 'data-fault-label="更多操作：{songTitle(song)}"',
    test: 'accessibility/controls.spec.ts',
    grep: '歌曲菜单按钮都有名称',
    reason: 'button-name',
  },
  {
    name: 'focus',
    file: 'src/lib/components/overlay/overlays.svelte.ts',
    before: 'next.focus({ preventScroll: true });',
    after: 'document.body.focus();',
    test: 'journeys/keyboard.spec.ts',
    grep: '键盘把歌曲加入歌单',
    reason: 'toBeFocused',
  },
  {
    name: 'modal-focus',
    file: 'src/lib/components/overlay/modal-focus.ts',
    before: "node.addEventListener('keydown', onkeydown);",
    after: 'void onkeydown;',
    test: 'journeys/keyboard.spec.ts',
    grep: '播放页和手机队列的首尾 Tab',
    reason: 'toBeFocused',
  },
  {
    name: 'queue-focus',
    file: 'src/lib/components/player/PhonePlayerPage.svelte',
    before: '{@attach trapFocus}',
    after: '',
    test: 'journeys/keyboard.spec.ts',
    grep: '播放页和手机队列的首尾 Tab',
    reason: 'toBeFocused',
    project: 'phone',
  },
];
const results: {
  name: string;
  expectedExit: number;
  report: string;
  reason?: string;
}[] = [];
const run = async (
  name: string,
  file: string,
  grep: string,
  expected: number,
  reason?: string,
  project = 'desktop',
) => {
  const result = await execaNode(
    'tests/tools/browser.mts',
    [file, `--project=${project}`, '--grep', grep],
    { env: { CAMPANULA_BROWSER_SOURCE: source }, reject: false },
  );
  await writeFile(
    join(report, `${name}.log`),
    result.all ?? `${result.stdout}\n${result.stderr}`,
  );
  const output = /浏览器报告：([^\n]+)/.exec(result.stdout)?.[1];
  if (!output) throw new Error(`${name} 缺少报告`);
  const tests = JSON.parse(await readFile(join(output, 'tests.json'), 'utf8'));
  const messages = JSON.stringify(tests);
  if (
    result.exitCode !== expected ||
    (reason && !messages.includes(reason)) ||
    tests.stats.skipped !== 0 ||
    tests.stats.unexpected !== (expected === 0 ? 0 : 1) ||
    tests.stats.expected !== (expected === 0 ? 1 : 0)
  )
    throw new Error(`${name} 没有在预期步骤得到 ${expected}：${output}`);
  results.push({ name, expectedExit: expected, report: output, reason });
  console.log(
    `${name}：${expected === 0 ? '恢复后通过' : '故障被检出'} ${output}`,
  );
};
try {
  await cp(join(SOURCE, 'src'), join(source, 'src'), { recursive: true });
  await cp(join(SOURCE, 'static'), join(source, 'static'), { recursive: true });
  const workspace = await createWorkspace({ root: source });
  await workspace.close();
  for (const mutation of cases) {
    const path = join(source, mutation.file);
    const original = await readFile(path, 'utf8');
    if (!original.includes(mutation.before))
      throw new Error(`故障注入位置已变化：${mutation.file}`);
    await writeFile(path, original.replace(mutation.before, mutation.after));
    try {
      await run(
        `${mutation.name}-broken`,
        mutation.test,
        mutation.grep,
        1,
        mutation.reason,
        mutation.project,
      );
    } finally {
      await writeFile(path, original);
    }
    await run(
      `${mutation.name}-restored`,
      mutation.test,
      mutation.grep,
      0,
      undefined,
      mutation.project,
    );
  }
  const retry = await execaNode(
    'tests/tools/browser.mts',
    [
      'journeys/environment.spec.ts',
      '--project=desktop',
      '--grep',
      '失败重试从空设备',
      '--retries=1',
      '--verify-retry',
    ],
    { reject: false },
  );
  await writeFile(
    join(report, 'retry.log'),
    `${retry.stdout}\n${retry.stderr}`,
  );
  if (retry.exitCode !== 0) throw new Error('重试隔离验证失败');
  await writeFile(
    join(report, 'result.json'),
    JSON.stringify({ passed: true, results }, null, 2),
  );
} finally {
  await rm(source, { recursive: true, force: true });
}
