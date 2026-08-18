<script lang='ts'>
  import type { NcmPlaylist, NcmUserPlaylists } from '$lib/types'
  import { resolve } from '$app/paths'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { NcmClientError } from '$lib/ncm/client'
  import { fetchUserPlaylists, PLAYLIST_ERROR_TEXT } from '$lib/ncm/playlists'
  import { Heart, List, Loader } from 'lucide-svelte'
  import { onMount } from 'svelte'

  const metadata = generateSeoMetadata('home')

  let loading = $state(true)
  let groups = $state<NcmUserPlaylists | null>(null)
  let errorMessage = $state<string | null>(null)
  let controller: AbortController | null = null

  onMount(() => {
    controller = new AbortController()
    void load()
    return () => controller?.abort()
  })

  async function load() {
    try {
      groups = await fetchUserPlaylists(controller?.signal)
      errorMessage = null
    }
    catch (err) {
      groups = null
      errorMessage = err instanceof NcmClientError
        ? (err.message || PLAYLIST_ERROR_TEXT[err.code])
        : PLAYLIST_ERROR_TEXT.UNKNOWN
    }
    finally {
      loading = false
    }
  }
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>我的歌单</h1>
    <p class='mt-1 text-sm text-app-text-muted'>实时来自你的网易云账号：创建的歌单与收藏的歌单。</p>
  </header>

  <!-- 我喜欢的音乐入口 -->
  <a
    href={resolve('/favorites')}
    class='flex items-center gap-4 border border-app-border rounded-xl bg-app-surface p-5 shadow-sm transition-colors hover:bg-app-surface-hover'
  >
    <span class='size-12 flex shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-600'>
      <Heart class='size-6' />
    </span>
    <span class='min-w-0'>
      <span class='block text-app-text font-semibold'>我喜欢的音乐</span>
      <span class='mt-0.5 block text-sm text-app-text-muted'>你红心过的每一首歌都在这里</span>
    </span>
  </a>

  {#if loading}
    <div class='flex items-center justify-center gap-2 py-12 text-sm text-app-text-muted'>
      <Loader class='size-5 animate-spin' />
      加载中…
    </div>
  {:else if errorMessage}
    <div role='alert' class='border border-error-200 rounded-xl bg-error/5 px-4 py-3 text-sm text-error-700'>
      {errorMessage}
    </div>
  {:else if groups}
    {@render group('创建的歌单', '还没有创建的歌单', groups.created)}
    {@render group('收藏的歌单', '还没有收藏的歌单', groups.collected)}
  {/if}
</section>

{#snippet group(title: string, emptyText: string, playlists: NcmPlaylist[])}
  <section class='space-y-3'>
    <h2 class='text-lg text-app-text font-semibold'>{title}</h2>
    {#if playlists.length === 0}
      <p class='py-8 text-center text-sm text-app-text-muted'>{emptyText}</p>
    {:else}
      <ul role='list' class='grid gap-3 sm:grid-cols-2'>
        {#each playlists as playlist (playlist.id)}
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
    {/if}
  </section>
{/snippet}
