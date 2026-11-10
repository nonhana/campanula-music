import { Buffer } from 'node:buffer';
import { createDecipheriv, hkdfSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import type {
  ModuleCallConfig,
  ModuleIdentifier,
  ModuleResponseOf,
} from 'hana-music-api';
import { invokeModule } from 'hana-music-api';

import type { LoginCookie } from '../src/lib/server/credentials.ts';
import type { FixtureIdentity } from './fixture-identity.mts';
import { findLeaks, IDENTITY_FILE, loadIdentity } from './fixture-identity.mts';

const ROOT = join(import.meta.dirname, '..');
const SDK_DIR = join(ROOT, 'node_modules/hana-music-api');
const PLACEHOLDER = 'https://p1.music.126.net/placeholder/avatar.jpg';
const IMG_ID = 109951000000000000;
const KEEP = 30;
const LOGIN_FILE = join(ROOT, '_notes/campanula-login');
const RENEW =
  '请作者在专用窗口（scripts/axi.sh，开发服务器开着）里扫码登录，再跑 pnpm tsx scripts/take-login.mts';

type QueryOf<K extends ModuleIdentifier> = Parameters<
  typeof invokeModule<K>
>[1];

export type Outcome<K extends ModuleIdentifier> =
  | { ok: true; status: number; body: ModuleResponseOf<K>['body'] }
  | { ok: false; status: number; body: unknown };

export type Invoke = <K extends ModuleIdentifier>(
  module: K,
  query: QueryOf<K>,
) => Promise<Outcome<K>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// 凭据失效时网易云照样回 200、账号是 null：先只读问一次 user_account，否则会录成匿名看到的数据
export const openSession = async (): Promise<Invoke> => {
  if (!existsSync(LOGIN_FILE)) throw new Error(`没有 ${LOGIN_FILE}：${RENEW}`);
  const sealed = readFileSync(LOGIN_FILE, 'utf8').trim();
  const line = readFileSync(join(ROOT, '.env'), 'utf8').match(
    /^COOKIE_SECRET=(.*)$/m,
  );
  if (!line) throw new Error('.env 里没有 COOKIE_SECRET');
  const secret = line[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  const raw = Buffer.from(decodeURIComponent(sealed), 'base64url');
  const key = Buffer.from(
    hkdfSync('sha256', secret, '', 'campanula login cookie', 32),
  );
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  let login: LoginCookie;
  try {
    login = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(12, raw.length - 16)),
        decipher.final(),
      ]).toString('utf8'),
    ) as LoginCookie;
  } catch {
    throw new Error(
      `${LOGIN_FILE} 用本机 .env 的 COOKIE_SECRET 解不开（不是这个开发服务器发的 Cookie）：${RENEW}`,
    );
  }
  if (!login.session) throw new Error(`这个登录 Cookie 里没有登录：${RENEW}`);
  // 顶层 deviceId 不在 SDK 的类型里：隐式匿名注册要用
  const config: ModuleCallConfig & { deviceId: string } = {
    cookie: login.session.credentials,
    deviceId: login.deviceId,
    state: { deviceId: login.deviceId },
  };
  const invoke = async <K extends ModuleIdentifier>(
    module: K,
    query: QueryOf<K>,
  ): Promise<Outcome<K>> => {
    try {
      const response = await invokeModule(module, query, config);
      return { ok: true, status: response.status, body: response.body };
    } catch (thrown) {
      if (
        isRecord(thrown) &&
        typeof thrown.status === 'number' &&
        'body' in thrown
      )
        return { ok: false, status: thrown.status, body: thrown.body };
      throw thrown;
    }
  };
  const account = await invoke('user_account', {});
  if (
    !account.ok ||
    !account.body.account ||
    account.body.account.anonimousUser ||
    !account.body.profile
  )
    throw new Error(`登录已经失效（user_account 没有账号）：${RENEW}`);
  return invoke;
};

const wholeNumber = (number: number | string): RegExp =>
  new RegExp(`(?<![0-9])${number}(?![0-9])`, 'g');

interface Truncated {
  path: string;
  length: number;
}

// identity 会被就地补上新录到的编号：调用方负责存回文件
const sanitize = (
  body: unknown,
  identity: FixtureIdentity,
  truncate: boolean,
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
    if (!isRecord(node)) return node;
    const userId =
      typeof node.userId === 'number' && 'nickname' in node
        ? node.userId
        : null;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      const at = `${path}.${key}`;
      if ((key === 'userId' || key === 'uid') && typeof value === 'number') {
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
        ['cookie', 'token', 'tokenJsonStr'].includes(key) &&
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
  text = text
    .replace(wholeNumber(self.uid), String(self.fakeUid))
    .replaceAll(self.nickname, self.fakeNickname);
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
}: RecorderOptions) => {
  const identity = loadIdentity();
  if (!identity)
    throw new Error(
      `没有 ${IDENTITY_FILE}：先在作者本机建好本人身份和对照表（README「录制」）`,
    );
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
      const out = join(ROOT, dir);
      mkdirSync(out, { recursive: true });
      const written: string[] = [];
      const problems: string[] = [];
      calls.forEach(({ module, query, outcome, at }, index) => {
        const { body, truncated } = sanitize(outcome.body, identity, truncate);
        const fixture = {
          module,
          query: sanitize(query, identity, false).body,
          context: {
            recordedAt: at,
            sdk,
            region: 'local',
            ip: 'default',
            viewer,
            ...(truncated.length ? { truncated } : {}),
          },
          response: { status: outcome.status, body },
        };
        const text = `${JSON.stringify(fixture, null, 2)}\n`;
        const name = `${String(index + 1).padStart(3, '0')}-${module}.json.gz`;
        const leaks = findLeaks(text, identity);
        if (leaks.length) {
          problems.push(`${name} 没写：\n  ${leaks.join('\n  ')}`);
          return;
        }
        writeFileSync(join(out, name), gzipSync(text));
        written.push(join(dir, name));
      });
      writeFileSync(IDENTITY_FILE, `${JSON.stringify(identity, null, 2)}\n`);
      return { written, problems };
    },
  };
};
