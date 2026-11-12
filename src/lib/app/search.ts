import { endpoints, searchPage } from '#lib/api/endpoints.js';
import type { Song } from '#lib/api/library.js';
import type {
  SearchedItems,
  SearchKind,
  SearchPageResponse,
  Suggestion,
} from '#lib/api/search.js';
import { SEARCH_KINDS, SEARCH_RESULTS_PER_REQUEST } from '#lib/api/search.js';

import type { Clock } from './browser';
import type { LocalDb } from './local';
import type {
  SessionApi,
  SessionFailure,
  SessionResult,
  SessionRound,
} from './session-round';

export const SUGGEST_DELAY = 200;
const SEARCH_HISTORY_MAX = 20;

export interface Suggestions {
  keyword: string;
  items: readonly Suggestion[];
}

export type SearchFailure = SessionFailure;

type MoreResults =
  | { status: 'notLoaded' }
  | { status: 'loading' }
  | { status: 'failed'; failure: SearchFailure };

export type SearchList<K extends SearchKind = SearchKind> =
  | { status: 'loading' }
  | { status: 'failed'; failure: SearchFailure }
  | {
      status: 'shown';
      items: readonly SearchedItems[K][];
      total: number | null;
      offset: number;
      more: MoreResults | null;
    };

type SearchResults = { keyword: string } & { [K in SearchKind]: SearchList<K> };

export interface SearchState {
  history: readonly string[];
  suggestions: Suggestions | null;
  results: SearchResults | null;
}

export const INITIAL_SEARCH: SearchState = {
  history: [],
  suggestions: null,
  results: null,
};

const remembered = (history: readonly string[], keyword: string): string[] =>
  [keyword, ...history.filter((each) => each !== keyword)].slice(
    0,
    SEARCH_HISTORY_MAX,
  );

const appended = <K extends SearchKind>(
  items: readonly SearchedItems[K][],
  page: SearchPageResponse<K>,
  offset: number,
): SearchList<K> => {
  const seen = new Set(items.map((item) => item.id));
  const fresh: SearchedItems[K][] = [];
  for (const item of page.items) {
    if (!seen.has(item.id)) fresh.push(item);
    seen.add(item.id);
  }
  const next = offset + page.items.length;
  const more =
    page.items.length > 0 &&
    (page.total === null
      ? page.items.length >= SEARCH_RESULTS_PER_REQUEST
      : next < page.total)
      ? ({ status: 'notLoaded' } as const)
      : null;
  return {
    status: 'shown',
    items: [...items, ...fresh],
    total: page.total,
    offset: next,
    more,
  };
};

export interface SearchContext {
  api: SessionApi;
  session: SessionRound;
  clock: Clock;
  local: Pick<LocalDb, 'changeSearchHistory'>;
  read: () => SearchState;
  write: (search: SearchState) => void;
}

export interface Search {
  suggest: (keyword: string) => void;
  search: (keyword: string) => Promise<void>;
  open: (keyword: string) => Promise<void>;
  more: (keyword: string, kind: SearchKind) => Promise<void>;
  searchSongs: (keyword: string) => Promise<SessionResult<readonly Song[]>>;
  clearHistory: () => Promise<void>;
}

export const createSearch = (context: SearchContext): Search => {
  const { api, clock, local } = context;
  let typed = '';
  let cancelWait: (() => void) | null = null;
  let queryRound = 0;
  let inputRound = 0;

  const update = (next: Partial<SearchState>): void => {
    context.write({
      ...context.read(),
      ...next,
    });
  };

  const ask = async (keyword: string, round: number): Promise<void> => {
    const result = await api.get(endpoints.suggestions, { keywords: keyword });
    if (round !== inputRound) return;
    if (result?.ok) {
      return update({
        suggestions: { keyword, items: result.value.suggestions },
      });
    }
    update({
      suggestions: { keyword, items: [] },
    });
  };

  const stopWaiting = (): void => {
    cancelWait?.();
    cancelWait = null;
  };

  const pageOf = <K extends SearchKind>(
    kind: K,
    keyword: string,
    offset: number,
  ): Promise<SessionResult<SearchPageResponse<K>>> =>
    api.get(searchPage(kind), { keywords: keyword, offset });

  const show = <K extends SearchKind>(
    keyword: string,
    kind: K,
    list: SearchList<K>,
  ): void => {
    const results = context.read().results;
    if (results?.keyword === keyword) {
      update({
        results: { ...results, [kind]: list },
      });
    }
  };

  const first = async (keyword: string, kind: SearchKind): Promise<void> => {
    const round = queryRound;
    const result = await pageOf(kind, keyword, 0);
    if (round !== queryRound) return;
    if (result?.ok) return show(keyword, kind, appended([], result.value, 0));
    if (result)
      show(keyword, kind, { status: 'failed', failure: result.failure });
  };

  const clear = (): void => {
    queryRound += 1;
    inputRound += 1;
    typed = '';
    stopWaiting();
    update({ suggestions: null, results: null });
  };

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn') clear();
  });

  const open = async (keyword: string): Promise<void> => {
    const searched = keyword.trim();
    if (!searched) return;
    const shown = context.read().results;
    const kept = shown?.keyword === searched ? shown : null;
    if (!kept) queryRound += 1;
    const kinds = kept
      ? SEARCH_KINDS.filter((kind) => kept[kind].status === 'failed')
      : SEARCH_KINDS;
    if (kinds.length === 0) return;
    const loading = { status: 'loading' } as const;
    const base: SearchResults = kept ?? {
      keyword: searched,
      songs: loading,
      playlists: loading,
      artists: loading,
      albums: loading,
    };
    update({
      results: {
        ...base,
        ...Object.fromEntries(kinds.map((kind) => [kind, loading])),
      },
    });
    await Promise.all(kinds.map((kind) => first(searched, kind)));
  };

  const more = async (keyword: string, kind: SearchKind): Promise<void> => {
    const round = queryRound;
    const results = context.read().results;
    const list = results?.keyword === keyword ? results[kind] : null;
    if (
      list?.status !== 'shown' ||
      !list.more ||
      list.more.status === 'loading'
    )
      return;
    const loading = {
      ...list,
      more: { status: 'loading' } as const,
    };
    show(keyword, kind, loading);
    const result = await pageOf(kind, keyword, list.offset);
    const current = context.read().results;
    const listed = current?.keyword === keyword ? current[kind] : null;
    if (
      round !== queryRound ||
      listed?.status !== 'shown' ||
      listed.offset !== list.offset ||
      listed.more !== loading.more
    )
      return;
    if (result?.ok)
      return show(
        keyword,
        kind,
        appended(list.items, result.value, list.offset),
      );
    if (result) {
      show(keyword, kind, {
        ...list,
        more: { status: 'failed', failure: result.failure },
      });
    }
  };

  return {
    suggest(keyword) {
      const next = keyword.trim();
      if (next === typed) return;
      typed = next;
      const round = ++inputRound;
      stopWaiting();
      if (!next) return update({ suggestions: null });
      cancelWait = clock.after(SUGGEST_DELAY, () => {
        cancelWait = null;
        void ask(next, round);
      });
    },
    async search(keyword) {
      const searched = keyword.trim();
      if (!searched) return;
      const opening = open(searched);
      update({
        history: await local.changeSearchHistory((history) =>
          remembered(history, searched),
        ),
      });
      await opening;
    },
    open,
    more,
    async searchSongs(keyword) {
      const searched = keyword.trim();
      if (!searched) return { ok: true, value: [] };
      const result = await pageOf('songs', searched, 0);
      return (
        result && (result.ok ? { ok: true, value: result.value.items } : result)
      );
    },
    async clearHistory() {
      update({ history: await local.changeSearchHistory(() => []) });
    },
  };
};
