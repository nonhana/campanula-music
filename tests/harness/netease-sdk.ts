import type { ModuleCallConfig, NcmApiResponse } from 'hana-music-api';

export type SdkResponse = NcmApiResponse<unknown>;

export interface Outcome {
  rejected: boolean;
  response: SdkResponse;
  until?: Promise<void>;
  when?: Record<string, unknown>;
  fixture?: string;
}

export interface RequestSpan {
  start: number;
}

export type CallConfig = Pick<
  ModuleCallConfig,
  'cookie' | 'realIP' | 'state'
> & { checkToken?: string };

export interface Call {
  module: string;
  query: unknown;
  config: CallConfig;
}

const outcomes = new Map<string, Outcome[]>();

export const calls: Call[] = [];

let held = 0;

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
  outcomes.set(module, [...(outcomes.get(module) ?? []), outcome]);
};

export const reset = (): void => {
  outcomes.clear();
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

const fits = (outcome: Outcome, query: unknown): boolean =>
  !outcome.when ||
  Object.entries(outcome.when).every(
    ([key, value]) => (query as Record<string, unknown>)[key] === value,
  );

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
      !fits(other.outcome, query) ||
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
  calls.push({
    module,
    query,
    config: structuredClone(config),
  });
  const queued = outcomes.get(module) ?? [];
  const queue = [...queued];
  const at = queued.findIndex((outcome) => fits(outcome, query));
  const outcome = at < 0 ? undefined : queued.splice(at, 1)[0];
  if (!outcome) throw new Error(`网易云替身：没有为 ${module} 准备录制数据`);
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
  const response = structuredClone(outcome.response);
  if (outcome.rejected) throw response;
  return response;
};
