<script lang='ts'>
  import type { NcmPlaylistDetail, PlaylistItem } from '$lib/types'
  import { page } from '$app/state'
  import Detail from '$lib/components/playlists/Detail.svelte'
  import SongList from '$lib/components/playlists/SongList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { NcmClientError } from '$lib/ncm/client'
  import { fetchPlaylistDetail, PLAYLIST_ERROR_TEXT } from '$lib/ncm/playlists'
  import { toSongItem } from '$lib/ncm/songs'
  import { Loader } from 'lucide-svelte'
  import { onMount } from 'svelte'

  const metadata = generateSeoMetadata('playlistDetail')

  const playlistId = Number(page.params.id)

  let detail = $state<NcmPlaylistDetail | null>(null)
  let loading = $state(true)
  let errorMessage = $state<string | null>(null)
  let controller: AbortController | null = null

  onMount(() => {
    controller = new AbortController()
    void load()
    return () => controller?.abort()
  })

  async function load() {
    try {
      detail = await fetchPlaylistDetail(playlistId, controller?.signal)
      errorMessage = null
    }
    catch (err) {
      detail = null
      errorMessage = err instanceof NcmClientError
        ? (err.message || PLAYLIST_ERROR_TEXT[err.code])
        : PLAYLIST_ERROR_TEXT.UNKNOWN
    }
    finally {
      loading = false
    }
  }

  let searchValue = $state('')

  // 领域形状适配：歌单头 → 旧富视图 PlaylistItem，歌曲 → 播放链路 SongItem
  const playlistItem = $derived(detail
    ? {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      cover: detail.cover,
      musicCount: detail.trackCount,
      sourceId: String(detail.id),
    } satisfies PlaylistItem
    : null)
  const songs = $derived(detail ? detail.songs.map(toSongItem) : [])
</script>

<SeoHead {metadata} />

{#if loading}
  <div class='flex items-center justify-center gap-2 py-12 text-sm text-app-text-muted'>
    <Loader class='size-5 animate-spin' />
    加载中…
  </div>
{:else if errorMessage}
  <div role='alert' class='border border-error-200 rounded-xl bg-error/5 px-4 py-3 text-sm text-error-700'>
    {errorMessage}
  </div>
{:else if detail && playlistItem}
  <!-- 定高根：扣去顶部留白与底部播放栏，列表在根内 flex-1 自适应头部实际高度 -->
  <div class='h-[calc(100dvh-15rem)] w-full flex flex-col gap-8 md:h-[calc(100dvh-9.5rem)]'>
    <Detail {songs} playlist={playlistItem} bind:searchValue />
    {#if songs.length === 0}
      <p class='py-12 text-center text-sm text-app-text-muted'>这个歌单还没有歌曲</p>
    {:else}
      <!-- 弹性高度：列表填满头部以下剩余空间（VirtualList 依赖有界容器） -->
      <div class='min-h-40 flex-1'>
        <SongList {songs} {searchValue} />
      </div>
    {/if}
  </div>
{/if}
