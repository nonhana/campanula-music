import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { lstat, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import type {
  ModuleIdentifier,
  ModuleQueryOf,
  ModuleResponseOf,
  NcmFailureInfo,
} from 'hana-music-api';
import { invokeModule } from 'hana-music-api';

import type { FixtureIdentity } from './fixture-identity.mts';
import { findLeaks } from './fixture-identity.mts';

const ROOT = join(import.meta.dirname, '../..');
const SDK_DIR = join(ROOT, 'node_modules/hana-music-api');
const PLACEHOLDER = 'https://p1.music.126.net/placeholder/avatar.jpg';
const IMG_ID = 109951000000000000;
const KEEP = 30;

type QueryOf<K extends ModuleIdentifier> = ModuleQueryOf<K>;

export type Outcome<K extends ModuleIdentifier> =
  | { ok: true; status: number; body: ModuleResponseOf<K>['body'] }
  | { ok: false; status: number; body: unknown; failure?: NcmFailureInfo };

export type Invoke = <K extends ModuleIdentifier>(
  module: K,
  query: QueryOf<K>,
) => Promise<Outcome<K>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validIdentity = (value: unknown): value is FixtureIdentity => {
  if (
    !isRecord(value) ||
    !isRecord(value.self) ||
    !isRecord(value.artist) ||
    !isRecord(value.next)
  )
    return false;
  if (
    ![
      value.self.uid,
      value.self.fakeUid,
      value.artist.id,
      value.artist.fakeId,
      value.next.user,
      value.next.playlist,
      value.next.song,
      value.next.album,
    ].every(
      (id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
    )
  )
    return false;
  if (
    ![
      value.self.nickname,
      value.self.fakeNickname,
      value.artist.name,
      value.artist.fakeName,
    ].every((name) => typeof name === 'string' && name.length > 0)
  )
    return false;
  return ['playlists', 'works', 'users'].every(
    (key) =>
      isRecord(value[key]) &&
      Object.entries(value[key]).every(
        ([key, id]) =>
          /^[1-9]\d*$/.test(key) &&
          Number.isSafeInteger(Number(key)) &&
          typeof id === 'number' &&
          Number.isSafeInteger(id) &&
          id > 0,
      ),
  );
};

export interface Authorization {
  instance: string;
  expiresAt: number;
  deviceId: string;
  credentials: Record<string, string>;
  identity: FixtureIdentity;
}

export const withRecording = async <T,>(
  options: {
    instance: string;
    authorizationFile: string;
    dir: string;
    authorizeUpstream?: boolean;
    source?: Invoke;
  },
  run: (recorder: ReturnType<typeof createRecorder>) => Promise<T>,
): Promise<T> => {
  let authorization: Authorization | undefined;
  try {
    const metadata = await lstat(options.authorizationFile);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
      throw new Error('临时授权文件必须只允许本人读写');
    let value: unknown;
    try {
      value = JSON.parse(await readFile(options.authorizationFile, 'utf8'));
    } catch {
      throw new Error('临时授权 JSON 格式错误');
    }
    if (
      !isRecord(value) ||
      typeof value.instance !== 'string' ||
      typeof value.expiresAt !== 'number' ||
      !Number.isFinite(value.expiresAt) ||
      typeof value.deviceId !== 'string' ||
      !value.deviceId ||
      !isRecord(value.credentials) ||
      !validIdentity(value.identity)
    )
      throw new Error('临时授权缺少有效期限、设备、凭据或身份映射');
    const credentials: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value.credentials)) {
      if (typeof entry !== 'string')
        throw new TypeError('临时授权凭据必须为字符串');
      credentials[key] = entry;
    }
    if (!credentials.MUSIC_U) throw new Error('临时授权缺少 MUSIC_U');
    let origin: string;
    try {
      origin = new URL(options.instance).origin;
    } catch {
      throw new Error('临时授权实例地址无效');
    }
    if (
      origin !== value.instance ||
      value.expiresAt <= Date.now() ||
      value.expiresAt > Date.now() + 30 * 60_000
    )
      throw new Error('实例不匹配或临时授权过期');
    authorization = {
      instance: value.instance,
      expiresAt: value.expiresAt,
      deviceId: value.deviceId,
      credentials,
      identity: value.identity,
    };
    if (!options.source && options.authorizeUpstream !== true)
      throw new Error('真实采集需要显式 authorizeUpstream');
    const auth = authorization;
    const invoke: Invoke =
      options.source ??
      (async (module, query) => {
        try {
          const response = await invokeModule(module, query, {
            cookie: auth.credentials,
            state: { deviceId: auth.deviceId },
            retry: { retries: 0 },
          });
          return { ok: true, status: response.status, body: response.body };
        } catch (error) {
          if (
            isRecord(error) &&
            typeof error.status === 'number' &&
            'body' in error
          )
            return {
              ok: false,
              status: error.status,
              body: error.body,
              failure: error.failure as NcmFailureInfo | undefined,
            };
          throw new Error('采集源异常，未输出上游错误或凭据');
        }
      });
    const account = await invoke('user_account', {});
    if (
      !account.ok ||
      !account.body.account ||
      account.body.account.anonimousUser ||
      !account.body.profile
    )
      throw new Error('临时授权未登录');
    if (
      account.body.profile!.userId !== auth.identity.self.uid ||
      account.body.profile!.nickname !== auth.identity.self.nickname
    )
      throw new Error('临时授权账号与身份映射不匹配');
    const recorder = createRecorder({
      invoke,
      dir: options.dir,
      viewer: 'explicit-session',
      identity: auth.identity,
      instance: auth.instance,
      constructed: Boolean(options.source),
      secrets: Object.values(auth.credentials),
    });
    const result = await run(recorder);
    const saved = recorder.save();
    if (saved.problems.length) {
      await Promise.all(
        saved.written.map((path) => rm(resolve(ROOT, path), { force: true })),
      );
      throw new Error(saved.problems.join('\n'));
    }
    return result;
  } finally {
    if (authorization) authorization.credentials = {};
    authorization = undefined;
    await rm(options.authorizationFile, { force: true });
  }
};

const wholeNumber = (number: number | string): RegExp =>
  new RegExp(`(?<![0-9])${number}(?![0-9])`, 'g');

interface Truncated {
  path: string;
  length: number;
}

// 身份映射只在本次采集内补充，结束不写回固定文件。
const sanitize = (
  body: unknown,
  identity: FixtureIdentity,
  truncate: boolean,
  secrets: readonly string[] = [],
): { body: unknown; truncated: Truncated[] } => {
  const { self, artist } = identity;
  const fake =
    (
      table: 'playlists' | 'works' | 'users',
      counter: keyof FixtureIdentity['next'],
    ) =>
    (real: number): number =>
      (identity[table][real] ??= identity.next[counter]++);
  // 0、-1 是“没有这个人”（例如专辑页 album.info.commentThread.resourceInfo.userId 是 -1），不是谁的编号
  const fakeUser = (uid: number): number => {
    if (uid <= 0) return uid;
    return uid === self.uid ? self.fakeUid : fake('users', 'user')(uid);
  };
  const truncated: Truncated[] = [];

  const collect = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (!isRecord(node)) return;
    if (
      typeof node.id === 'number' &&
      isRecord(node.creator) &&
      node.creator.userId === self.uid &&
      'trackCount' in node
    )
      fake('playlists', 'playlist')(node.id);
    if (
      typeof node.id === 'number' &&
      Array.isArray(node.ar) &&
      node.ar.some((item) => isRecord(item) && item.id === artist.id)
    ) {
      fake('works', 'song')(node.id);
      if (isRecord(node.al) && typeof node.al.id === 'number' && node.al.id > 0)
        fake('works', 'album')(node.al.id);
    }
    Object.values(node).forEach(collect);
  };
  collect(body);

  const walk = (node: unknown, path: string): unknown => {
    if (Array.isArray(node)) {
      let items: unknown[] = node;
      if (truncate && node.length > KEEP) {
        truncated.push({ path, length: node.length });
        items = node.slice(0, KEEP);
      }
      return items.map((item, index) => walk(item, `${path}[${index}]`));
    }
    if (typeof node === 'string')
      return secrets
        .filter(Boolean)
        .reduce(
          (value, secret) => value.replaceAll(secret, '<redacted>'),
          node
            .replaceAll(self.nickname, self.fakeNickname)
            .replaceAll(artist.name, artist.fakeName),
        );
    if (!isRecord(node)) return node;
    const userId =
      typeof node.userId === 'number' && 'nickname' in node
        ? node.userId
        : null;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      const at = `${path}.${key}`;
      if (/phone/i.test(key)) {
        out[key] = typeof value === 'number' ? 0 : '<phone>';
      } else if (/captcha/i.test(key)) {
        out[key] = typeof value === 'number' ? 0 : '';
      } else if (
        (key === 'userId' || key === 'uid') &&
        typeof value === 'number'
      ) {
        out[key] = fakeUser(value);
      } else if (
        node.id === artist.id &&
        'name' in node &&
        (key === 'id' || key === 'name')
      ) {
        out[key] = key === 'id' ? artist.fakeId : artist.fakeName;
      } else if (
        (key === 'artistId' && value === artist.id) ||
        (key === 'artistName' && value === artist.name)
      ) {
        out[key] = key === 'artistId' ? artist.fakeId : artist.fakeName;
      } else if (
        /cookie|token|password|secret|authorization|music_u|csrf|^sign$/i.test(
          key,
        ) &&
        typeof value === 'string'
      ) {
        out[key] = '';
      } else if (userId !== null && key === 'nickname') {
        out[key] =
          userId === self.uid
            ? self.fakeNickname
            : `用户${fakeUser(userId) - 10000000}`;
      } else if (
        userId !== null &&
        (key === 'avatarUrl' || key === 'backgroundUrl')
      ) {
        out[key] = PLACEHOLDER;
      } else if (userId !== null && key === 'province') {
        out[key] = 110000;
      } else if (userId !== null && key === 'city') {
        out[key] = 110101;
      } else if (userId !== null && key === 'birthday') {
        out[key] = 631152000000;
      } else if (
        userId !== null &&
        ['signature', 'description', 'detailDescription'].includes(key)
      ) {
        out[key] = '';
      } else if (
        userId !== null &&
        (key === 'avatarImgId' || key === 'backgroundImgId')
      ) {
        out[key] = IMG_ID;
      } else if (
        userId !== null &&
        ['avatarImgIdStr', 'backgroundImgIdStr', 'avatarImgId_str'].includes(
          key,
        )
      ) {
        out[key] = String(IMG_ID);
      } else if (
        userId !== null &&
        (key === 'avatarDetail' || key === 'remarkName')
      ) {
        out[key] = null;
      } else {
        out[key] = walk(value, at);
      }
    }
    return out;
  };
  const clean = walk(body, 'body');

  let text = JSON.stringify(clean);
  for (const [real, fakeId] of [
    ...Object.entries(identity.playlists),
    ...Object.entries(identity.works),
  ])
    text = text.replace(wholeNumber(real), String(fakeId));
  text = text.replace(wholeNumber(self.uid), String(self.fakeUid));
  return {
    body: JSON.parse(text),
    truncated,
  };
};

export interface RecorderOptions {
  invoke: Invoke;
  dir: string;
  viewer: string;
  truncate?: boolean;
  identity: FixtureIdentity;
  instance: string;
  constructed?: boolean;
  secrets?: readonly string[];
}

interface Call {
  module: ModuleIdentifier;
  query: unknown;
  outcome: { status: number; body: unknown };
  at: string;
}

export const createRecorder = ({
  invoke,
  dir,
  viewer,
  truncate = true,
  identity,
  instance,
  constructed = false,
  secrets = [],
}: RecorderOptions) => {
  const sdk = `hana-music-api@${(JSON.parse(readFileSync(join(SDK_DIR, 'package.json'), 'utf8')) as { version: string }).version}`;
  const calls: Call[] = [];
  return {
    async call<K extends ModuleIdentifier>(
      module: K,
      query: QueryOf<K>,
    ): Promise<Outcome<K>> {
      const outcome = await invoke(module, query);
      calls.push({
        module,
        query,
        outcome,
        at: new Date().toISOString(),
      });
      return outcome;
    },
    save(): { written: string[]; problems: string[] } {
      const out = resolve(ROOT, dir);
      mkdirSync(out, { recursive: true });
      const written: string[] = [];
      const problems: string[] = [];
      calls.forEach(({ module, query, outcome, at }, index) => {
        const privateValues = [
          ...secrets,
          ...Object.entries(isRecord(query) ? query : {})
            .filter(([key]) =>
              /phone|captcha|password|token|secret|authorization|^sign$/i.test(
                key,
              ),
            )
            .flatMap(([, value]) =>
              typeof value === 'string' && value ? [value] : [],
            ),
        ];
        const { body, truncated } = sanitize(
          outcome.body,
          identity,
          truncate,
          privateValues,
        );
        const fixture = {
          module,
          query: sanitize(query, identity, false, privateValues).body,
          context: {
            recordedAt: at,
            sdk,
            region: 'local',
            ip: 'default',
            viewer,
            instance,
            constructed,
            ...(truncated.length ? { truncated } : {}),
          },
          response: {
            status: outcome.status,
            body,
            ...('failure' in outcome && outcome.failure
              ? {
                  failure: sanitize(
                    outcome.failure,
                    identity,
                    false,
                    privateValues,
                  ).body,
                }
              : {}),
          },
        };
        const text = `${JSON.stringify(fixture, null, 2)}\n`;
        const name = `${String(index + 1).padStart(3, '0')}-${module}.json.gz`;
        const leaks = findLeaks(text, identity);
        if (leaks.length) {
          problems.push(`${name} 没写：\n  ${leaks.join('\n  ')}`);
          return;
        }
        writeFileSync(join(out, name), gzipSync(text), { flag: 'wx' });
        written.push(join(dir, name));
      });

      return { written, problems };
    },
  };
};
