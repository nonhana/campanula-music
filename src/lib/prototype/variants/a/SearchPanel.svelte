<!--
  PROTOTYPE：搜索的三种状态（历史 / 输入建议 / 结果）。
  桌面：顶栏搜索框的下拉（suggestOnly：只有历史和建议）+ 内容区的搜索结果页；手机：整页。
  输入框在外层；外层把 ↑ ↓ Enter 交给 onkey()。
-->
<script lang='ts'>
  import type { SearchTab } from '$lib/prototype/nav.svelte'
  import type { Suggestion } from '$lib/prototype/catalog'
  import type { Song } from '$lib/prototype/data'
  import Cover from '$lib/prototype/Cover.svelte'
  import { downloadedSongs, search, searchHistory, suggestions } from '$lib/prototype/catalog'
  import { formatCount, inLibrary, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import { Disc3, History, ListMusic, Music, Search, SearchX, UserRound, WifiOff } from '@lucide/svelte'
  import DesktopSongRow from './DesktopSongRow.svelte'
  import PhoneSongRow from './PhoneSongRow.svelte'
  import StateBlock from './StateBlock.svelte'
  import { matchSong } from './state.svelte'

  interface Props {
    phone?: boolean
    /** 当前高亮的建议行（-1 = 没有） */
    active?: number
    /** 建议列表的 id 前缀，给 aria-activedescendant 用 */
    idPrefix?: string
    /** 输入框里还没提交的字；不传就用 nav.query（手机整页、结果页） */
    query?: string
    /** 只显示历史和建议，不显示结果（桌面顶栏的下拉） */
    suggestOnly?: boolean
  }

  let { phone = false, active = $bindable(-1), idPrefix = 'sg', query, suggestOnly = false }: Props = $props()

  let history = $state([...searchHistory])
  const q = $derived((query ?? nav.query).trim())
  const lq = $derived(q.toLowerCase())
  const sugg = $derived(suggestions(q))
  /** 第一行是“搜索“q””，后面是建议 */
  const rows = $derived<(Suggestion | null)[]>(q ? [null, ...sugg] : [])
  const suggesting = $derived(suggestOnly || !nav.stab)
  const results = $derived(suggesting ? null : search(q))
  const offlineHits = $derived(nav.offline && q ? downloadedSongs.filter(s => matchSong(s, lq)) : [])

  const tabs = $derived<{ key: Exclude<SearchTab, ''>, label: string, count: number }[]>(results
    ? [
        { key: 'songs', label: '单曲', count: results.songs.length },
        { key: 'playlists', label: '歌单', count: results.playlists.length },
        { key: 'artists', label: '歌手', count: results.artists.length },
        { key: 'albums', label: '专辑', count: results.albums.length },
      ]
    : [])
  const total = $derived(tabs.reduce((n, t) => n + t.count, 0))

  const kindIcon = { song: Music, artist: UserRound, album: Disc3, playlist: ListMusic }
  const kindLabel = { song: '单曲', artist: '歌手', album: '专辑', playlist: '歌单' }

  $effect(() => {
    void q
    active = -1
  })

  function parts(text: string) {
    const i = text.toLowerCase().indexOf(lq)
    if (!lq || i < 0)
      return [text, '', '']
    return [text.slice(0, i), text.slice(i, i + lq.length), text.slice(i + lq.length)]
  }

  function pick(i: number) {
    const r = rows[i]
    nav.submitSearch(r ? r.text : q, r?.kind === 'artist' ? 'artists' : r?.kind === 'album' ? 'albums' : r?.kind === 'playlist' ? 'playlists' : 'songs')
  }

  /** 外层输入框的键盘：返回 true 表示已处理 */
  export function onkey(e: KeyboardEvent): boolean {
    if (e.isComposing)
      return false
    if (suggesting && rows.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const d = e.key === 'ArrowDown' ? 1 : -1
      active = active < 0 ? (d > 0 ? 0 : rows.length - 1) : (active + d + rows.length) % rows.length
      document.getElementById(`${idPrefix}-${active}`)?.scrollIntoView({ block: 'nearest' })
      return true
    }
    if (e.key === 'Enter' && q) {
      e.preventDefault()
      if (suggesting && active >= 0)
        pick(active)
      else nav.submitSearch(q, nav.stab || 'songs')
      return true
    }
    return false
  }

  function tabKey(e: KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')
      return
    e.preventDefault()
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
    nav.stab = next.key
    document.getElementById(`${idPrefix}-tab-${next.key}`)?.focus()
  }

  function isCurrent(song: Song) {
    return player.current?.id === song.id
  }
</script>

{#snippet songList(list: Song[])}
  <ul class={phone ? '' : 'flex flex-col'}>
    {#each list as song, i (song.id)}
      <li class='h-14'>
        {#if phone}
          <PhoneSongRow {song} now={isCurrent(song)} onplay={() => player.playNow(song)} />
        {:else}
          <DesktopSongRow {song} n={i + 1} now={isCurrent(song)} onplay={() => player.playNow(song)} />
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#if !q}
  <!-- 搜索历史 -->
  <section class={phone ? 'px-4 pt-4' : 'px-5 pb-5 pt-4'} aria-labelledby='{idPrefix}-history'>
    <div class='flex items-center gap-2'>
      <h2 id='{idPrefix}-history' class='text-[14px] font-600 text-neutral-900'>搜索历史</h2>
      <span class='text-[12.5px] text-neutral-500'>只保存在这台设备上</span>
      {#if history.length}
        <button class={['ghost ml-auto rounded-full px-3 text-[13px] font-500 text-neutral-600', phone ? 'h-11' : 'h-8']} onclick={() => (history = [])}>清空</button>
      {/if}
    </div>
    {#if history.length}
      <ul class='mt-3 flex flex-wrap gap-2'>
        {#each history as h (h)}
          <li>
            <button
              class={['chip inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white pl-3 pr-3.5 text-neutral-800', phone ? 'h-10 text-[14px]' : 'h-9 text-[13.5px]']}
              onclick={() => nav.submitSearch(h)}
            >
              <History size={14} class='flex-none text-neutral-500' aria-hidden='true' />
              <span lang={langOf(h)}>{h}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class='mt-3 text-[13.5px] text-neutral-600'>搜过的词会出现在这里。</p>
    {/if}
  </section>
{:else if suggesting}
  <!-- 输入建议 -->
  <ul id='{idPrefix}-list' class={phone ? 'py-1' : 'p-2'} role='listbox' aria-label='输入建议'>
    {#each rows as r, i (r ? `${r.kind}:${r.text}` : 'q')}
      {@const Icon = r ? kindIcon[r.kind] : Search}
      {@const [a, m, b] = r ? parts(r.text) : ['', '', '']}
      <li
        id='{idPrefix}-{i}'
        role='option'
        aria-selected={active === i}
        class={['sg flex cursor-pointer items-center gap-3 px-3', phone ? 'h-13 px-4' : 'h-11 rounded-xl', active === i && 'bg-primary-100']}
        onclick={() => pick(i)}
        onkeydown={() => {}}
        onpointermove={() => { if (!phone) active = i }}
      >
        <span class={['grid size-8 flex-none place-items-center rounded-full', r ? 'bg-neutral-100 text-neutral-600' : 'bg-primary-100 text-primary-900']}>
          <Icon size={16} aria-hidden='true' />
        </span>
        {#if r}
          <span class='min-w-0 flex-1 truncate text-[14.5px] text-neutral-800' lang={langOf(r.text)}>{a}<mark class='rounded-[3px] bg-primary-100 text-primary-950'>{m}</mark>{b}</span>
          <span class='flex-none text-[12.5px] text-neutral-500'>{kindLabel[r.kind]}</span>
        {:else}
          <span class='min-w-0 flex-1 truncate text-[14.5px] text-neutral-900'>搜索“<span class='font-600' lang={langOf(q)}>{q}</span>”</span>
          {#if !phone}<kbd class='flex-none rounded-md border border-neutral-200 bg-white px-1.5 font-sans text-[11px] leading-5 text-neutral-600'>Enter</kbd>{/if}
        {/if}
      </li>
    {/each}
  </ul>
{:else if nav.offline}
  <!-- 离线：只在已下载里找 -->
  <div class={phone ? 'pt-2' : 'px-2 pb-2 pt-1'}>
    <div class={['flex items-start gap-3 rounded-2xl bg-secondary-50 p-3.5', phone ? 'mx-4' : 'mx-1']} role='status'>
      <WifiOff size={18} class='mt-0.5 flex-none text-secondary-800' aria-hidden='true' />
      <p class='text-[13.5px] leading-5 text-secondary-900'>离线时不能搜索网易云。下面是已下载歌曲里和“<span lang={langOf(q)}>{q}</span>”相关的 <span class='tnum'>{offlineHits.length}</span> 首。</p>
    </div>
    {#if offlineHits.length}
      <div class='pt-2'>{@render songList(offlineHits)}</div>
    {:else}
      {@render empty(`已下载里没有“${q}”`, '联网后可以搜索全部歌曲。')}
    {/if}
  </div>
{:else if results}
  <div class={['tabs sticky z-10 flex overflow-x-auto', phone ? 'top-14 bg-primary-50 px-2' : 'top-0 bg-white px-3 pt-1']} role='tablist' aria-label='搜索结果分类'>
    {#each tabs as t, i (t.key)}
      {@const sel = nav.stab === t.key}
      <button
        id='{idPrefix}-tab-{t.key}'
        role='tab'
        aria-selected={sel}
        tabindex={sel ? 0 : -1}
        class={['relative h-11 flex-none px-3 text-[15px] transition-colors duration-150', sel ? 'font-600 text-neutral-900' : 'font-500 text-neutral-500']}
        onclick={() => (nav.stab = t.key)}
        onkeydown={e => tabKey(e, i)}
      >
        {t.label}<span class='ml-1 text-[12.5px] font-500 tnum'>{formatCount(t.count)}</span>
        {#if sel}
          <span class='absolute bottom-1 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-primary-700' aria-hidden='true'></span>
        {/if}
      </button>
    {/each}
  </div>

  <div role='tabpanel' aria-labelledby='{idPrefix}-tab-{nav.stab}' class={phone ? 'pb-6 pt-1' : 'px-2 pb-2 pt-1'}>
    {#if total === 0}
      {@render empty(`没有找到“${q}”`, '换个歌名、歌手或专辑名试试。')}
    {:else if nav.stab === 'songs'}
      {#if results.songs.length}{@render songList(results.songs)}{:else}{@render empty('没有相关的单曲')}{/if}
    {:else if nav.stab === 'playlists'}
      {#if results.playlists.length}
        <ul>
          {#each results.playlists as pl (pl.id)}
            {@const mine = inLibrary(pl)}
            <li>
              <button class={['item flex w-full items-center gap-3 text-left', phone ? 'h-16 px-4' : 'h-16 rounded-xl px-2']} onclick={() => nav.openPlaylist(pl.id)}>
                <Cover cover={pl.cover} class='size-12 flex-none rounded-lg' />
                <span class='min-w-0 flex-1'>
                  <span class='block truncate text-[14.5px] font-500 text-neutral-900' lang={langOf(pl.name)}>{pl.name}</span>
                  <span class='block truncate text-[13px] text-neutral-600'><span class='tnum'>{formatCount(pl.count)}</span> 首 · by <span lang={langOf(pl.creator)}>{pl.creator}</span></span>
                </span>
                {#if mine}
                  <span class='flex-none rounded-full bg-primary-100 px-2 text-[12px] leading-5 font-500 text-primary-950'>{pl.kind === 'own' ? '自建' : '已收藏'}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}{@render empty('没有相关的歌单')}{/if}
    {:else if nav.stab === 'artists'}
      {#if results.artists.length}
        <ul class={phone ? 'grid grid-cols-3 gap-x-3 gap-y-5 px-4 pt-3' : 'grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-2 gap-y-3 pt-2'}>
          {#each results.artists as ar (ar.id)}
            <li>
              <button class={['item w-full min-w-0 text-center', phone ? '' : 'rounded-xl p-3']} onclick={() => nav.openArtist(ar.id)}>
                <Cover cover={ar.avatar} class='mx-auto w-full rounded-full shadow-ambient' />
                <span class='mt-2 block truncate text-[14px] font-500 text-neutral-900' lang={langOf(ar.name)}>{ar.name}</span>
                {#if !ar.id.startsWith('n:')}
                  <span class='mt-0.5 block text-[12px] font-500 text-primary-900'>已收藏</span>
                {:else}
                  <span class='mt-0.5 block text-[12px] text-neutral-500 tnum'>{formatCount(ar.songCount)} 首</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}{@render empty('没有相关的歌手')}{/if}
    {:else if results.albums.length}
      <ul class={phone ? 'grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3' : 'grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-2 gap-y-2 pt-2'}>
        {#each results.albums as al (al.id)}
          <li>
            <button class={['item w-full min-w-0 text-left', phone ? '' : 'rounded-xl p-2.5']} onclick={() => nav.openAlbum(al.id)}>
              <Cover cover={al.cover} class='w-full rounded-xl shadow-ambient' />
              <span class='mt-2 block truncate text-[14px] font-500 text-neutral-900' lang={langOf(al.name)}>{al.name}</span>
              <span class='mt-0.5 block truncate text-[12.5px] text-neutral-600' lang={langOf(al.artist)}>{al.artist} · <span class='tnum'>{al.year}</span></span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}{@render empty('没有相关的专辑')}{/if}
  </div>
{/if}

{#snippet empty(title: string, body = '')}
  <StateBlock kind='empty' compact icon={SearchX} {title} {body} />
{/snippet}

<style>
  .tabs {
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  mark {
    padding: 0 1px;
  }

  @media (hover: hover) and (pointer: fine) {
    .chip:hover {
      border-color: #b9ead5;
      background: #f3fbf7;
    }

    .ghost:hover,
    .item:hover {
      background: #e8f8f1;
    }

    .ghost:hover {
      color: #1a5b43;
    }
  }
</style>
