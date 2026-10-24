<!--
  播放页左对齐的歌名、歌手、专辑：歌名桌面用 Headline-sm、手机用 Title（DESIGN.md Typography），只放试听片段时跟着“试听”徽标
  （开始放才知道是不是试听：徽标淡入）。换歌时跟着换碟横着飘（SongSwap）
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { fade } from '../shared/motion'
  import { artistLine, langOf } from '../shared/text'
  import SongBadge from '../songs/SongBadge.svelte'
  import SongSwap from './SongSwap.svelte'
  import type { Turn } from './view'

  const { song, turn, phone = false }: { song: Song, turn: Turn | null, phone?: boolean } = $props()
  const view = getAppView()
</script>

<SongSwap {song} {turn} place='page'>
  {#snippet children(shown)}
    <div class='min-w-0 flex items-center gap-2'>
      <h2 class={[
        'truncate text-neutral-900 font-600',
        phone ? 'text-title' : 'text-headline-sm',
      ]} lang={langOf(shown.name)}>{shown.name}</h2>
      {#if view.state.player.trial}<span class='flex flex-none' transition:fade><SongBadge kind='trial' /></span>{/if}
    </div>
    <p class='mt-0.5 truncate text-body text-neutral-700' lang={langOf(artistLine(shown))}>{artistLine(shown)}</p>
    {#if shown.album.name}
      <p class='truncate text-label text-neutral-600 font-400' lang={langOf(shown.album.name)}>{shown.album.name}</p>
    {/if}
  {/snippet}
</SongSwap>
