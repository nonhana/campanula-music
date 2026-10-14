<!--
  播放页左对齐的歌名、歌手、专辑：歌名桌面用 Headline-sm、手机用 Title（DESIGN.md Typography），只放试听片段时跟着“试听”徽标
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import { getAppView } from '../app-context.svelte'
  import SongBadge from '../library/SongBadge.svelte'
  import { artistLine, langOf } from '../library/view'

  const { song, phone = false }: { song: Song, phone?: boolean } = $props()
  const view = getAppView()
</script>

<div class='min-w-0'>
  <div class='min-w-0 flex items-center gap-2'>
    <h2 class={['truncate text-neutral-900 font-600', phone ? 'text-title' : 'text-headline-sm']} lang={langOf(song.name)}>{song.name}</h2>
    {#if view.state.player.trial}<SongBadge availability='trial' />{/if}
  </div>
  <p class='mt-0.5 truncate text-body text-neutral-700' lang={langOf(artistLine(song))}>{artistLine(song)}</p>
  {#if song.album.name}
    <p class='truncate text-label text-neutral-600 font-400' lang={langOf(song.album.name)}>{song.album.name}</p>
  {/if}
</div>
