import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

import type { Suggestion } from '#lib/api/search.js';
import type { App } from '#lib/app/app.js';
import type { Suggestions } from '#lib/app/search.js';

import type { SearchTab } from './view';
import { searchPath, searchTabId } from './view';

export const SUGGESTION_LIST_ID = 'search-suggestions';
export const suggestionId = (index: number): string =>
  `search-suggestion-${index}`;

export const shownKeyword = (): string =>
  page.url.pathname === resolve('/search')
    ? (page.url.searchParams.get('q') ?? '').trim()
    : '';

export type SuggestionRow = { kind: 'search'; name: string } | Suggestion;

export const suggestionRows = (
  draft: string,
  suggestions: Suggestions | null,
): SuggestionRow[] => {
  const typed = draft.trim();
  return typed
    ? [{ kind: 'search', name: typed }, ...(suggestions?.items ?? [])]
    : [];
};

export const searchBox: {
  draft: string;
  active: number;
} = $state({ draft: '', active: -1 });

export const activeSuggestionId = (app: App): string | undefined => {
  const rows = suggestionRows(searchBox.draft, app.state.search.suggestions);
  return searchBox.active >= 0 && searchBox.active < rows.length
    ? suggestionId(searchBox.active)
    : undefined;
};

export const showingResults = (): boolean => {
  const keyword = shownKeyword();
  return keyword !== '' && searchBox.draft.trim() === keyword;
};

export const selectSearchTab = async (
  keyword: string,
  tab: SearchTab,
): Promise<void> => {
  await goto(resolve(searchPath(keyword, tab)), { replace: true });
  document.getElementById(searchTabId(tab))?.focus();
};

export const resetSearchBox = (app: App): void => {
  searchBox.draft = shownKeyword();
  searchBox.active = -1;
  app.suggest('');
};

export const typeInSearchBox = (app: App, value: string): void => {
  searchBox.draft = value;
  searchBox.active = -1;
  app.suggest(value);
};

const submitSearch = (app: App, keyword: string): void => {
  const searched = keyword.trim();
  if (!searched) return;
  searchBox.draft = searched;
  searchBox.active = -1;
  app.suggest('');
  void app.search(searched);
  void goto(resolve(`/search?q=${encodeURIComponent(searched)}`), {
    replace: page.url.pathname === resolve('/search'),
  });
};

export const pickSuggestion = (app: App, row: SuggestionRow): void => {
  switch (row.kind) {
    case 'search':
    case 'song':
      submitSearch(app, row.name);
      break;
    case 'artist':
      void goto(resolve('/artists/[id=neteaseId]', { id: row.id }));
      break;
    case 'album':
      void goto(resolve('/albums/[id=neteaseId]', { id: row.id }));
      break;
    case 'playlist':
      void goto(resolve('/playlists/[id=neteaseId]', { id: row.id }));
      break;
  }
};

// Safari 按回车上屏时 isComposing 是 false，只能看 keyCode 229
const composing = (event: KeyboardEvent): boolean =>
  event.isComposing || event.keyCode === 229;

export const searchBoxKey = (event: KeyboardEvent, app: App): boolean => {
  if (composing(event)) return false;
  const rows = suggestionRows(searchBox.draft, app.state.search.suggestions);
  const at = searchBox.active < rows.length ? searchBox.active : -1;
  if (
    (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
    rows.length > 0
  ) {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    searchBox.active =
      at < 0
        ? step > 0
          ? 0
          : rows.length - 1
        : (at + step + rows.length) % rows.length;
    document
      .getElementById(suggestionId(searchBox.active))
      ?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (event.key === 'Enter' && rows.length > 0) {
    event.preventDefault();
    pickSuggestion(app, rows[Math.max(at, 0)]);
    return true;
  }
  return false;
};
