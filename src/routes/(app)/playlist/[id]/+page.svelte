<script lang='ts'>
  import type { NcmPlaylistDetail } from '$lib/types'
  import { page } from '$app/state'
  import SongRow from '$lib/components/common/SongRow.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { NcmClientError } from '$lib/ncm/client'
  import { fetchPlaylistDetail, PLAYLIST_ERROR_TEXT } from '$lib/ncm/playlists'
  import { Loader, Music } from 'lucide-svelte'
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
{:else if detail}
  <section class='space-y-6'>
    <header class='flex items-center gap-4'>
      {#if detail.cover}
        <img src={detail.cover} alt='' class='size-20 shrink-0 rounded-xl object-cover shadow-sm' />
      {:else}
        <span class='size-20 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-700'>
          <Music class='size-9' />
        </span>
      {/if}
      <div class='min-w-0'>
        <h1 class='text-2xl text-app-text font-semibold'>{detail.name}</h1>
        <p class='mt-1 text-sm text-app-text-muted'>
          {detail.creator}{detail.trackCount > 0 ? ` · ${detail.trackCount} 首` : ''} · {detail.playCount.toLocaleString('zh-CN')} 次播放
        </p>
        {#if detail.description}
          <p class='clamp-2 mt-1 text-sm text-app-text-muted'>{detail.description}</p>
        {/if}
      </div>
    </header>

    {#if detail.songs.length === 0}
      <p class='py-12 text-center text-sm text-app-text-muted'>这个歌单还没有歌曲</p>
    {:else}
      <ul role='list' class='space-y-1'>
        {#each detail.songs as song (song.id)}
          <SongRow {song} />
        {/each}
      </ul>
    {/if}
  </section>
{/if}
