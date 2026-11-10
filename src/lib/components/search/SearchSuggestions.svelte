<script lang="ts">
  import {
    Disc3,
    History,
    ListMusic,
    Music,
    Search,
    UserRound,
  } from '@lucide/svelte';

  import { getAppView } from '../shared/app-context.svelte';
  import { langOf } from '../shared/text';
  import FilterChip from '../ui/FilterChip.svelte';
  import TextButton from '../ui/TextButton.svelte';
  import type { SuggestionRow } from './search-box.svelte';
  import {
    searchBox,
    SUGGESTION_LIST_ID,
    suggestionId,
    suggestionRows,
  } from './search-box.svelte';
  import { matchedParts, SUGGESTION_KINDS } from './view';

  interface Props {
    phone?: boolean;
    onpick: (row: SuggestionRow) => void;
  }

  const { phone = false, onpick }: Props = $props();
  const view = getAppView();
  const history = $derived(view.state.search.history);
  const typed = $derived(searchBox.draft.trim());
  const rows = $derived(
    suggestionRows(searchBox.draft, view.state.search.suggestions),
  );
  const ICONS = {
    search: Search,
    song: Music,
    artist: UserRound,
    album: Disc3,
    playlist: ListMusic,
  };

  const clearHistory = (event: MouseEvent) => {
    void view.app.clearSearchHistory();
    if (event.detail === 0)
      document
        .querySelector<HTMLInputElement>('input[role="combobox"]')
        ?.focus();
  };
</script>

{#if !typed}
  {#if history.length > 0}
    <section
      class={phone ? 'px-4 pt-4' : 'px-5 pb-5 pt-4'}
      aria-labelledby="search-history-title"
    >
      <div class="flex items-center gap-2">
        <h2
          id="search-history-title"
          class="text-label text-neutral-900 font-600"
        >
          搜索历史
        </h2>
        <TextButton
          tone="neutral"
          size="caption"
          class={['ml-auto', phone ? '-mr-3' : 'h-8! -mr-2']}
          onclick={clearHistory}>清空</TextButton
        >
      </div>
      <ul class="mt-3 flex flex-wrap gap-2" aria-label="搜过的词">
        {#each history as word (word)}
          <li>
            <FilterChip
              class="max-w-full gap-1.5 pl-3 pr-3.5"
              onclick={() => onpick({ kind: 'search', name: word })}
            >
              <History
                size={14}
                class="flex-none text-neutral-500"
                aria-hidden="true"
              />
              <span class="truncate" lang={langOf(word)}>{word}</span>
            </FilterChip>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{:else}
  <div
    id={SUGGESTION_LIST_ID}
    role="listbox"
    aria-label="搜索建议"
    class={phone ? 'py-1' : 'p-2'}
  >
    {#each rows as row, i (i)}
      {@const Icon = ICONS[row.kind]}
      {@const [before, matched, after] = matchedParts(row.name, typed)}
      <button
        id={suggestionId(i)}
        type="button"
        role="option"
        tabindex="-1"
        aria-selected={searchBox.active === i}
        class={[
          'w-full flex items-center gap-3 text-left transition-colors duration-feedback',
          phone ? 'h-13 px-4 active:bg-primary-100' : 'h-11 rounded-lg px-3',
          searchBox.active === i && 'bg-primary-100',
        ]}
        onclick={() => onpick(row)}
        onpointermove={(event) => {
          if (event.pointerType === 'mouse') searchBox.active = i;
        }}
      >
        <span
          class={[
            'grid size-8 flex-none place-items-center rounded-full',
            row.kind === 'search'
              ? 'bg-primary-100 text-primary-950'
              : 'bg-neutral-100 text-neutral-600',
          ]}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
        {#if row.kind === 'search'}
          <span
            class={[
              'min-w-0 flex-1 truncate text-neutral-900',
              phone ? 'text-body' : 'text-label',
            ]}
            >搜索“<span class="font-600" lang={langOf(row.name)}
              >{row.name}</span
            >”</span
          >
          {#if !phone}
            <kbd
              class="flex-none border border-neutral-200 rounded-sm bg-white px-1.5 text-micro text-neutral-600 font-sans"
              >Enter</kbd
            >
          {/if}
        {:else}
          <span
            class={[
              'min-w-0 flex-1 truncate text-neutral-800',
              phone ? 'text-body' : 'text-label',
            ]}
            lang={langOf(row.name)}
            >{before}{#if matched}<mark
                class="rounded-sm bg-primary-100 px-px text-primary-950"
                >{matched}</mark
              >{/if}{after}</span
          >
          <span class="sr-only">，{SUGGESTION_KINDS[row.kind]}</span>
        {/if}
      </button>
    {/each}
  </div>
{/if}
