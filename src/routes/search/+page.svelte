<script lang='ts'>
  import type { NcmSearchPage, NcmSearchType } from '$lib/types'
  import { resolve } from '$app/paths'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { SEARCH_ERROR_TEXT, SearchClientError, searchNcm, toSongItem } from '$lib/ncm/search'
  import { addToPlaylistAndPlay } from '$lib/stores'
  import { durationFormatter } from '$lib/utils'
  import { List, Loader, Music, Search, User, X } from 'lucide-svelte'
  import { debounce } from 'throttle-debounce'

  const metadata = generateSeoMetadata('search')

  const SEARCH_TABS = [
    { type: 'song', label: '歌曲' },
    { type: 'playlist', label: '歌单' },
    { type: 'artist', label: '歌手' },
  ] as const satisfies readonly { type: NcmSearchType, label: string }[]

  let keywords = $state('')
  let type = $state<NcmSearchType>('song')
  let page = $state<NcmSearchPage | null>(null)
  let loading = $state(false)
  let errorMessage = $state<string | null>(null)

  /** 在途请求的取消句柄：新搜索发出前中止旧请求，避免乱序覆盖 */
  let controller: AbortController | null = null

  const isEmpty = $derived(
    page?.type === 'song'
      ? page.songs.length === 0
      : page?.type === 'playlist'
      ? page.playlists.length === 0
      : page?.type === 'artist'
      ? page.artists.length === 0
      : false,
  )

  async function runSearch() {
    const keyword = keywords.trim()
    if (!keyword) {
      reset()
      return
    }
    controller?.abort()
    const next = new AbortController()
    controller = next
    loading = true
    errorMessage = null
    try {
      const result = await searchNcm({ keywords: keyword, type }, next.signal)
      if (next.signal.aborted)
        return
      page = result
    }
    catch (err) {
      if (next.signal.aborted)
        return
      page = null
      errorMessage = err instanceof SearchClientError
        ? (SEARCH_ERROR_TEXT[err.code] ?? err.message)
        : SEARCH_ERROR_TEXT.UNKNOWN
      console.error('搜索失败', err)
    }
    finally {
      if (!next.signal.aborted)
        loading = false
    }
  }

  const debouncedRun = debounce(300, () => {
    void runSearch()
  })

  function reset() {
    controller?.abort()
    page = null
    errorMessage = null
    loading = false
  }

  function handleInput() {
    if (!keywords.trim()) {
      reset()
      return
    }
    debouncedRun()
  }

  function clearKeywords() {
    keywords = ''
    reset()
    // upcomingOnly：只取消待执行调用，保留后续输入可再次触发（v5 cancel 默认会永久禁用）
    debouncedRun.cancel({ upcomingOnly: true })
  }

  function selectTab(nextType: NcmSearchType) {
    if (type === nextType)
      return
    type = nextType
    if (keywords.trim()) {
      debouncedRun.cancel({ upcomingOnly: true })
      void runSearch()
    }
  }

  $effect(() => () => debouncedRun.cancel())
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>搜索</h1>
    <p class='mt-1 text-sm text-app-text-muted'>搜索歌曲、歌单与歌手，结果实时来自网易云。</p>
  </header>

  <div class='relative'>
    <Search class='pointer-events-none absolute left-3.5 top-1/2 size-5 text-app-text-muted -translate-y-1/2' />
    <input
      type='search'
      bind:value={keywords}
      oninput={handleInput}
      placeholder='输入关键词，搜索歌曲、歌单与歌手'
      aria-label='搜索关键词'
      class='w-full border border-app-border rounded-xl bg-app-surface py-3 pl-11 pr-10 text-sm text-app-text shadow-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40'
    />
    {#if keywords}
      <button
        type='button'
        onclick={clearKeywords}
        aria-label='清空关键词'
        class='absolute right-3 top-1/2 rounded-full p-1 text-app-text-muted transition-colors -translate-y-1/2 hover:bg-app-surface-hover hover:text-app-text'
      >
        <X class='size-4' />
      </button>
    {/if}
  </div>

  <div role='tablist' aria-label='搜索类型' class='flex gap-1 border-b border-app-border'>
    {#each SEARCH_TABS as tab (tab.type)}
      <button
        type='button'
        role='tab'
        aria-selected={type === tab.type}
        onclick={() => selectTab(tab.type)}
        class={[
          '-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors',
          type === tab.type
            ? 'border-primary-500 font-medium text-primary-700'
            : 'border-transparent text-app-text-muted hover:text-app-text',
        ]}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class='flex items-center justify-center gap-2 py-12 text-sm text-app-text-muted'>
      <Loader class='size-5 animate-spin' />
      搜索中…
    </div>
  {:else if errorMessage}
    <div role='alert' class='border border-error-200 rounded-xl bg-error/5 px-4 py-3 text-sm text-error-700'>
      {errorMessage}
    </div>
  {:else if page}
    {#if isEmpty}
      <p class='py-12 text-center text-sm text-app-text-muted'>
        {#if page.type === 'song'}
          没有找到相关歌曲
        {:else if page.type === 'playlist'}
          没有找到相关歌单
        {:else}
          没有找到相关歌手
        {/if}
      </p>
    {:else if page.type === 'song'}
      <ul role='list' class='space-y-1'>
        {#each page.songs as song (song.id)}
          <li>
            <button
              type='button'
              onclick={() => addToPlaylistAndPlay(toSongItem(song))}
              class='group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-app-surface-hover'
            >
              <span class='size-10 flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-700'>
                <Music class='size-5' />
              </span>
              <span class='min-w-0 flex-1'>
                <span class='block truncate text-sm text-app-text font-medium'>{song.name}</span>
                <span class='mt-0.5 block truncate text-xs text-app-text-muted'>
                  {song.artists.map(artist => artist.name).join(' / ')}{song.album.name ? ` · ${song.album.name}` : ''}
                </span>
              </span>
              <span class='shrink-0 text-xs text-app-text-muted'>{durationFormatter(song.duration)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if page.type === 'playlist'}
      <ul role='list' class='grid gap-3 sm:grid-cols-2'>
        {#each page.playlists as playlist (playlist.id)}
          <li>
            <a
              href={resolve('/playlist/[id]', { id: String(playlist.id) })}
              class='flex items-center gap-3 border border-app-border rounded-xl bg-app-surface p-3 transition-colors hover:bg-app-surface-hover'
            >
              {#if playlist.cover}
                <img src={playlist.cover} alt='' class='size-12 shrink-0 rounded-lg object-cover' />
              {:else}
                <span class='size-12 flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-700'>
                  <List class='size-5' />
                </span>
              {/if}
              <span class='min-w-0 flex-1'>
                <span class='block truncate text-sm text-app-text font-medium'>{playlist.name}</span>
                <span class='mt-0.5 block truncate text-xs text-app-text-muted'>
                  {playlist.creator}{playlist.trackCount > 0 ? ` · ${playlist.trackCount} 首` : ''}
                </span>
                <span class='mt-0.5 block text-xs text-app-text-muted'>
                  {playlist.playCount.toLocaleString('zh-CN')} 次播放
                </span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <ul role='list' class='space-y-1'>
        {#each page.artists as artist (artist.id)}
          <li class='flex items-center gap-3 rounded-lg px-3 py-2'>
            {#if artist.avatar}
              <img src={artist.avatar} alt='' class='size-11 shrink-0 rounded-full object-cover' />
            {:else}
              <span class='size-11 flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-700'>
                <User class='size-5' />
              </span>
            {/if}
            <span class='min-w-0 flex-1'>
              <span class='block truncate text-sm text-app-text font-medium'>{artist.name}</span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <p class='py-12 text-center text-sm text-app-text-muted'>输入关键词开始搜索</p>
  {/if}
</section>
