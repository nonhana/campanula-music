<!--
  搜索框下面的那一块（视觉原型 SearchPanel）：桌面是顶栏搜索框的下拉，手机是搜索页的内容。
  搜索框空着时是搜索历史（只保存在这台设备上，能清空；点一个词就搜它）；
  有字时是建议列表：第一行“搜索“…””，后面是网易云给的建议（单曲、歌手、专辑、歌单，和搜索框里一样的那一段标出来）。
  点“搜索…”那一行、单曲就搜这个名字，点歌手、专辑、歌单就打开它的页面。
  建议列表是搜索框的 listbox：键盘留在搜索框里，↑↓ 选中哪一行由 searchBox.active 决定（search-box.svelte.ts）
-->
<script lang='ts'>
  import type { SuggestionRow } from './search-box.svelte'
  import { Disc3, History, ListMusic, Music, Search, UserRound } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { langOf } from '../library/view'
  import FilterChip from '../ui/FilterChip.svelte'
  import { searchBox, SUGGESTION_LIST_ID, suggestionId, suggestionRows } from './search-box.svelte'
  import { matchedParts, SUGGESTION_KINDS } from './view'

  interface Props {
    phone?: boolean
    /** 点了搜索历史里的词（当作“搜索…”那一行）、建议列表的一行 */
    onpick: (row: SuggestionRow) => void
  }

  const { phone = false, onpick }: Props = $props()
  const view = getAppView()
  const history = $derived(view.state.search.history)
  const typed = $derived(searchBox.draft.trim())
  const rows = $derived(suggestionRows(searchBox.draft, view.state.search.suggestions))
  const ICONS = { search: Search, song: Music, artist: UserRound, album: Disc3, playlist: ListMusic }

  /** 清空搜索历史。这个按钮跟着就没了：用键盘按的，焦点回到搜索框（输入框是 combobox），不掉到页面最外面 */
  function clearHistory(event: MouseEvent) {
    void view.app.clearSearchHistory()
    if (event.detail === 0)
      document.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
  }
</script>

{#if !typed}
  <section class={phone ? 'px-4 pt-4' : 'px-5 pb-5 pt-4'} aria-labelledby='search-history-title'>
    <div class='flex items-center gap-2'>
      <h2 id='search-history-title' class='text-label text-neutral-900 font-600'>搜索历史</h2>
      <span class='text-caption text-neutral-500'>只保存在这台设备上</span>
      {#if history.length > 0}
        <button
          type='button'
          class={['ml-auto rounded-full px-3 text-caption text-neutral-600 font-500 transition-colors duration-feedback press mouse:hover:(bg-primary-100 text-primary-950)', phone ? 'h-11 -mr-3' : 'h-8 -mr-2']}
          onclick={clearHistory}
        >清空</button>
      {/if}
    </div>
    {#if history.length > 0}
      <ul class='mt-3 flex flex-wrap gap-2' aria-label='搜过的词'>
        {#each history as word (word)}
          <li>
            <FilterChip class='max-w-full gap-1.5 pl-3 pr-3.5' onclick={() => onpick({ kind: 'search', name: word })}>
              <History size={14} class='flex-none text-neutral-500' aria-hidden='true' />
              <span class='truncate' lang={langOf(word)}>{word}</span>
            </FilterChip>
          </li>
        {/each}
      </ul>
    {:else}
      <p class='mt-3 text-label text-neutral-600'>搜过的词会出现在这里。</p>
    {/if}
  </section>
{:else}
  <div id={SUGGESTION_LIST_ID} role='listbox' aria-label='搜索建议' class={phone ? 'py-1' : 'p-2'}>
    <!-- 网易云的建议会重名（同名的单曲和专辑、两张同名专辑），按下标认每一行 -->
    {#each rows as row, i (i)}
      {@const Icon = ICONS[row.kind]}
      {@const [before, matched, after] = matchedParts(row.name, typed)}
      <button
        id={suggestionId(i)}
        type='button'
        role='option'
        tabindex='-1'
        aria-selected={searchBox.active === i}
        class={[
          'w-full flex items-center gap-3 text-left transition-colors duration-feedback',
          phone ? 'h-13 px-4 active:bg-primary-100' : 'h-11 rounded-lg px-3',
          searchBox.active === i && 'bg-primary-100',
        ]}
        onclick={() => onpick(row)}
        onpointermove={(event) => {
          if (event.pointerType === 'mouse')
            searchBox.active = i
        }}
      >
        <span class={['grid size-8 flex-none place-items-center rounded-full', row.kind === 'search' ? 'bg-primary-100 text-primary-950' : 'bg-neutral-100 text-neutral-600']}>
          <Icon size={16} aria-hidden='true' />
        </span>
        {#if row.kind === 'search'}
          <span class={['min-w-0 flex-1 truncate text-neutral-900', phone ? 'text-body' : 'text-label']}>搜索“<span class='font-600' lang={langOf(row.name)}>{row.name}</span>”</span>
          {#if !phone}
            <kbd class='flex-none border border-neutral-200 rounded-sm bg-white px-1.5 text-micro text-neutral-600 font-sans'>Enter</kbd>
          {/if}
        {:else}
          <span class={['min-w-0 flex-1 truncate text-neutral-800', phone ? 'text-body' : 'text-label']} lang={langOf(row.name)}>{before}{#if matched}<mark class='rounded-sm bg-primary-100 px-px text-primary-950'>{matched}</mark>{/if}{after}</span>
          <span class='flex-none text-caption text-neutral-500'>{SUGGESTION_KINDS[row.kind]}</span>
        {/if}
      </button>
    {/each}
  </div>
{/if}
