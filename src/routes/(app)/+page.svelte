<script lang='ts'>
  import type { NcmPlaylist, NcmUserPlaylists, PlaylistItem } from '$lib/types'
  import { resolve } from '$app/paths'
  import PlaylistItemCard from '$lib/components/common/PlaylistItem.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { NcmClientError } from '$lib/ncm/client'
  import { fetchUserPlaylists, PLAYLIST_ERROR_TEXT } from '$lib/ncm/playlists'
  import { Heart, Loader } from 'lucide-svelte'
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

  /** 领域形状适配：歌单条目 → 旧富卡 PlaylistItem */
  function toCard(playlist: NcmPlaylist): PlaylistItem {
    return {
      id: playlist.id,
      name: playlist.name,
      description: null,
      cover: playlist.cover || null,
      musicCount: playlist.trackCount,
      sourceId: String(playlist.id),
    }
  }
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>我的歌单</h1>
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
      <!-- 沿用旧首页的 minmax 自适应网格尺寸链 -->
      <ul role='list' class='grid grid-cols-2 w-full gap-5 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'>
        {#each playlists as playlist (playlist.id)}
          <li>
            <PlaylistItemCard playlist={toCard(playlist)} />
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/snippet}
