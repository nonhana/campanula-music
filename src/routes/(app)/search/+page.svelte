<script lang='ts'>
  import type { NcmSearchPage, NcmSearchType } from '$lib/types'
  import { resolve } from '$app/paths'
  import SongSearchItem from '$lib/components/common/SongSearchItem.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { ncmImageSrc } from '$lib/ncm/image'
  import { SEARCH_ERROR_TEXT, SEARCH_PAGE_SIZE, SearchClientError, searchNcm } from '$lib/ncm/search'
  import { toSongItem } from '$lib/ncm/songs'
  import { List, Loader, Search, User, X } from '@lucide/svelte'
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
  let total = $state(0)
  /** 已请求到的偏移：按请求窗口推进，不随去重丢弃回退，避免窗口重叠（对齐歌单页模式） */
  let nextOffset = $state(0)
  let loadingMore = $state(false)
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

  const reset = () => {
    controller?.abort()
    page = null
    total = 0
    nextOffset = 0
    errorMessage = null
    loading = false
  }

  const runSearch = async () => {
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
      total = result.total
      nextOffset = SEARCH_PAGE_SIZE
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

  const handleInput = () => {
    if (!keywords.trim()) {
      reset()
      return
    }
    debouncedRun()
  }

  const clearKeywords = () => {
    keywords = ''
    reset()
    // upcomingOnly：只取消待执行调用，保留后续输入可再次触发（v5 cancel 默认会永久禁用）
    debouncedRun.cancel({ upcomingOnly: true })
  }

  const selectTab = (nextType: NcmSearchType) => {
    if (type === nextType)
      return
    type = nextType
    if (keywords.trim()) {
      debouncedRun.cancel({ upcomingOnly: true })
      void runSearch()
    }
  }

  $effect(() => () => debouncedRun.cancel())

  /** 歌曲 tab 的富行数据（随累计结果增量增长） */
  const songItems = $derived(page?.type === 'song' ? page.songs.map(toSongItem) : [])

  /** 滚动接近末尾自动加载更多（对齐旧 Header 的 onNearEnd 模式） */
  const loadMore = async () => {
    const keyword = keywords.trim()
    if (loadingMore || loading || type !== 'song' || !keyword)
      return
    if (!page || page.type !== 'song' || nextOffset >= total)
      return
    loadingMore = true
    try {
      const offset = nextOffset
      const result = await searchNcm({ keywords: keyword, type, offset })
      // 关键词/类型在请求期间变化则丢弃结果
      if (keywords.trim() !== keyword || type !== 'song' || result.type !== 'song')
        return
      nextOffset = offset + SEARCH_PAGE_SIZE
      const seen = new Set(page.songs.map(song => song.id))
      page.songs.push(...result.songs.filter(song => !seen.has(song.id)))
      total = Math.max(total, result.total)
    }
    catch (err) {
      // 增量加载失败不破坏已有结果，可继续滚动重试
      console.error('加载更多失败', err)
    }
    finally {
      loadingMore = false
    }
  }
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>搜索</h1>
  </header>

  <div class='relative'>
    <Search class='pointer-events-none absolute left-3.5 top-1/2 size-5 text-app-text-muted -translate-y-1/2' />
    <input
      type='search'
      bind:value={keywords}
      oninput={handleInput}
      placeholder='搜索歌曲、歌单与歌手'
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
      <VirtualList items={songItems} itemSize={72} containerSize={640} onNearEnd={loadMore}>
        {#snippet renderItem(item)}
          <SongSearchItem song={item} />
        {/snippet}
      </VirtualList>
      <p class='pt-2 text-center text-sm text-app-text-muted'>
        总共找到 {total.toLocaleString('zh-CN')} 首歌曲{loadingMore ? ' · 加载中…' : ''}
      </p>
    {:else if page.type === 'playlist'}
      <ul role='list' class='grid gap-3 sm:grid-cols-2'>
        {#each page.playlists as playlist (playlist.id)}
          <li>
            <a
              href={resolve('/(app)/playlist/[id]', { id: String(playlist.id) })}
              class='flex items-center gap-3 border border-app-border rounded-xl bg-app-surface p-3 transition-colors hover:bg-app-surface-hover'
            >
              {#if playlist.cover}
                <img src={ncmImageSrc(playlist.cover, 'xs')} alt='' class='size-12 shrink-0 rounded-lg object-cover' />
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
              <img src={ncmImageSrc(artist.avatar, 'xs')} alt='' class='size-11 shrink-0 rounded-full object-cover' />
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
