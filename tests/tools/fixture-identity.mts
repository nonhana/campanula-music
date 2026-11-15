import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '../..');
const FIXTURES = join(ROOT, 'tests/fixtures');

export interface FixtureIdentity {
  self: {
    uid: number;
    nickname: string;
    fakeUid: number;
    fakeNickname: string;
  };
  artist: { id: number; name: string; fakeId: number; fakeName: string };
  playlists: Record<string, number>;
  works: Record<string, number>;
  users: Record<string, number>;
  next: { user: number; playlist: number; song: number; album: number };
}

export const loadIdentity = (path: string): FixtureIdentity | null =>
  existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as FixtureIdentity)
    : null;

const wholeNumber = (number: number | string): RegExp =>
  new RegExp(`(?<![0-9])${number}(?![0-9])`);

const escape = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rulesOf = (identity: FixtureIdentity): [string, RegExp][] => [
  ['本人 uid', wholeNumber(identity.self.uid)],
  ['本人昵称', new RegExp(escape(identity.self.nickname))],
  ['本人的歌手编号', wholeNumber(identity.artist.id)],
  ['本人的歌手名', new RegExp(escape(identity.artist.name))],
  ...Object.keys(identity.playlists).map((id): [string, RegExp] => [
    '本人歌单',
    wholeNumber(id),
  ]),
  ...Object.keys(identity.works).map((id): [string, RegExp] => [
    '本人作品',
    wholeNumber(id),
  ]),
  ...Object.keys(identity.users).map((id): [string, RegExp] => [
    '听众编号',
    wholeNumber(id),
  ]),
];

export const findLeaks = (
  text: string,
  identity: FixtureIdentity,
): string[] => {
  const values: string[] = [];
  try {
    JSON.parse(text, (_key, value: unknown) => {
      if (typeof value === 'string') values.push(value);
      return value;
    });
  } catch {
    return ['录制不是有效 JSON'];
  }
  return rulesOf(identity).flatMap(([label, pattern]) => {
    const targets =
      label === '本人昵称' || label === '本人的歌手名' ? values : [text];
    return targets.some((value) => pattern.test(value))
      ? [`${label} 未脱敏`]
      : [];
  });
};

const fixtureFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? fixtureFiles(join(dir, entry.name))
      : [join(dir, entry.name)],
  );

const main = (args: readonly string[]): number => {
  const identityAt = args.indexOf('--identity');
  const identity = identityAt < 0 ? null : loadIdentity(args[identityAt + 1]);
  const paths =
    identityAt < 0
      ? args
      : args.filter(
          (_, index) => index !== identityAt && index !== identityAt + 1,
        );
  const files = (
    paths.length ? paths.map((file) => resolve(file)) : fixtureFiles(FIXTURES)
  ).filter(
    (file) =>
      file.startsWith(FIXTURES) &&
      /\.json(?:\.gz)?$/.test(file) &&
      existsSync(file),
  );
  const problems = files.flatMap((file) => {
    const bytes = readFileSync(file);
    const text = (file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString(
      'utf8',
    );
    const leaks = identity ? findLeaks(text, identity) : [];
    if (
      /"(?:MUSIC_U|__csrf|authorization|password)"\s*:\s*"[^"\s]+"/i.test(text)
    )
      leaks.push('凭据字段非空');
    if (
      /"(?:phone|cellphone)"\s*:\s*"?\+?\d{6,}"?[,}]/i.test(text) ||
      /"captcha"\s*:\s*"\d+"/i.test(text)
    )
      leaks.push('手机号或验证码未脱敏');
    return leaks.length
      ? [`${relative(ROOT, file)}\n  ${leaks.join('\n  ')}`]
      : [];
  });
  if (problems.length) {
    console.error(
      `录制数据里还有作者的真实身份，先脱敏（tests/fixtures/netease/README.md「脱敏」）：\n${problems.join('\n')}`,
    );
    return 1;
  }
  console.log(`录制脱敏检查：${files.length} 个文件，没有残留`);
  return 0;
};

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
