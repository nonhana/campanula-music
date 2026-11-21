import type { ModuleCallConfig, NcmApiResponse } from 'hana-music-api';

import { queryKey, recordedQuery } from './mock/query-key.ts';
import { sdkModules } from './mock/sdk-modules.ts';
import { validateResponse } from './sdk-contract.ts';
import { validateQuery } from './sdk-input.ts';

export type SdkResponse = NcmApiResponse<unknown>;

export interface Outcome {
  expectedMissingLoginCookie?: boolean;
  exception?: string;
  repeat?: boolean;
  required?: boolean;
  ordered?: boolean;
  rejected: boolean;
  response: SdkResponse;
  until?: Promise<void>;
  when?: Record<string, unknown>;
  fixture?: string;
}

export interface RequestSpan {
  start: number;
}

export type CallConfig = ModuleCallConfig;

export interface Call {
  module: string;
  query: unknown;
  config: CallConfig;
}

const outcomes = new Map<string, Outcome[]>();

export const calls: Call[] = [];

let held = 0;
const violations: string[] = [];
const sequence: Outcome[] = [];

export const assertComplete = (): void => {
  const pending = [...outcomes].flatMap(([module, replies]) =>
    replies
      .filter((reply) => reply.required)
      .map(
        (reply) =>
          `${module}：遗漏 ${reply.fixture ?? '必需调用'}，期望 ${JSON.stringify(reply.when)}`,
      ),
  );
  if (violations.length || pending.length)
    throw new Error([...violations, ...pending].join('\n'));
};

let currentRequest: () => RequestSpan | undefined = () => undefined;

let order = 0;

export const nextOrder = (): number => order++;

const taken: {
  module: string;
  query: unknown;
  span: RequestSpan;
  outcome: Outcome;
  queue: readonly Outcome[];
  at: number;
}[] = [];

const ambiguous: string[] = [];

let anyOrder = false;

export const allowAnyOrder = (): void => {
  anyOrder = true;
};

export const heldCalls = (): number => held;

export const trackRequests = (current: () => RequestSpan | undefined): void => {
  currentRequest = current;
};

export const ambiguities = (): readonly string[] => ambiguous;

export const queueReply = (module: string, outcome: Outcome): void => {
  if (outcome.ordered ?? outcome.required) sequence.push(outcome);
  outcomes.set(module, [...(outcomes.get(module) ?? []), outcome]);
};

export const reset = (): void => {
  outcomes.clear();
  violations.length = 0;
  sequence.length = 0;
  calls.length = 0;
  held = 0;
  taken.length = 0;
  ambiguous.length = 0;
  anyOrder = false;
};

const interchangeable = (a: Outcome, b: Outcome): boolean =>
  a.fixture === b.fixture &&
  a.until === b.until &&
  a.rejected === b.rejected &&
  JSON.stringify(a.response.cookie) === JSON.stringify(b.response.cookie);

const fits = (module: string, outcome: Outcome, query: unknown): boolean => {
  if (!outcome.when) return true;
  const actual = recordedQuery(module, query as Record<string, unknown>);
  const expected = recordedQuery(module, outcome.when);
  return Object.entries(expected).every(
    ([key, value]) => queryKey(actual[key]) === queryKey(value),
  );
};

const checkOrder = (
  module: string,
  query: unknown,
  span: RequestSpan,
  outcome: Outcome,
): void => {
  for (const other of taken) {
    if (other.module !== module || other.span === span || span.start > other.at)
      continue;
    const theirs = other.queue.indexOf(other.outcome);
    const mine = other.queue.indexOf(outcome);
    if (
      mine < 0 ||
      theirs > mine ||
      !fits(module, other.outcome, query) ||
      interchangeable(outcome, other.outcome)
    )
      continue;
    ambiguous.push(
      `${module}：${JSON.stringify(other.query)} 和 ${JSON.stringify(query)} 两个请求同时发出，先后一对调就拿反（${other.outcome.fixture} / ${outcome.fixture}）`,
    );
  }
};

export const invokeModule = async (
  module: string,
  query: unknown,
  config: CallConfig = {},
): Promise<SdkResponse> => {
  try {
    validateQuery(module, query, '严格队列');
  } catch (error) {
    violations.push(String(error));
    throw error;
  }
  const checkToken =
    typeof config.checkToken === 'function'
      ? await config.checkToken()
      : config.checkToken;
  const call: Call = {
    module,
    query,
    config: structuredClone({
      ...config,
      ...(checkToken !== undefined ? { checkToken } : {}),
    }),
  };
  calls.push(call);
  const queued = outcomes.get(module) ?? [];
  const queue = [...queued];
  let at = queued.findIndex(
    (outcome) => !outcome.repeat && fits(module, outcome, query),
  );
  if (at < 0)
    at = queued.findIndex(
      (outcome) => outcome.repeat && fits(module, outcome, query),
    );
  const outcome = at < 0 ? undefined : queued[at];
  if (
    !outcome ||
    (!anyOrder &&
      (outcome.ordered ?? outcome.required) &&
      sequence[0] !== outcome)
  ) {
    const detail = `${module}：${outcome ? '顺序错误' : '意外调用'}，期望 ${JSON.stringify(queued.map((item) => ({ fixture: item.fixture, when: item.when })))}，实际 ${JSON.stringify(query)}`;
    violations.push(detail);
    throw new Error(detail);
  }
  if (!outcome.repeat) queued.splice(at, 1);
  const sequenceAt = sequence.indexOf(outcome);
  if (sequenceAt >= 0) sequence.splice(sequenceAt, 1);
  const span = currentRequest();
  if (span && !anyOrder) {
    checkOrder(module, query, span, outcome);
    taken.push({
      module,
      query,
      span,
      outcome,
      queue,
      at: nextOrder(),
    });
  }
  if (outcome.until) {
    held += 1;
    await outcome.until.finally(() => {
      held -= 1;
    });
  }
  if (outcome.exception) throw new Error(outcome.exception);
  const response = structuredClone(outcome.response);
  let expectedInvalid = false;
  try {
    await validateResponse(
      module,
      response,
      outcome.rejected,
      outcome.fixture ?? '严格队列',
      query as Record<string, unknown>,
    );
  } catch (error) {
    if (outcome.expectedMissingLoginCookie && String(error).includes('MUSIC_U'))
      expectedInvalid = true;
    else {
      violations.push(String(error));
      throw error;
    }
  }
  if (outcome.expectedMissingLoginCookie && !expectedInvalid) {
    const detail = `${module}：期望缺 MUSIC_U 的负例，实际合同通过`;
    violations.push(detail);
    throw new Error(detail);
  }
  if (outcome.rejected) throw response;
  return response;
};

export {
  generateDeviceId,
  getNcmFailureInfo,
  isNcmApiResponse,
} from 'hana-music-api/utils';

export const {
  album,
  albumSub,
  albumSublist,
  artistAlbum,
  artistDesc,
  artistSongs,
  artistSub,
  artistSublist,
  captchaSent,
  cloudsearch,
  imageUploadToken,
  like,
  likelist,
  loginCellphone,
  loginQrCheck,
  loginQrCreate,
  loginQrKey,
  loginRefresh,
  logout,
  lyricNew,
  playlistCatlist,
  playlistCoverUpdate,
  playlistCreate,
  playlistDelete,
  playlistDescUpdate,
  playlistDetail,
  playlistNameUpdate,
  playlistOrderUpdate,
  playlistPrivacy,
  playlistSubscribe,
  playlistTagsUpdate,
  playlistTracks,
  recommendSongs,
  scrobble,
  searchSuggest,
  songDetail,
  songDownloadUrlV1,
  songOrderUpdate,
  songUrlV1,
  userAccount,
  userPlaylist,
  verifyGetQr,
} = sdkModules(invokeModule);
